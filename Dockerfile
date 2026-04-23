# =============================================================================
# Stage 1: Builder — cache-busting + PWA icon generation via Node.
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Builder only needs runtime deps (sharp) — skip devDeps and the playwright
# postinstall hook. sharp's lifecycle scripts must run to pull its native binary.
RUN npm ci --omit=dev

COPY build-cache-busting.cjs ./
COPY src ./src
COPY seed ./seed

RUN node build-cache-busting.cjs

# =============================================================================
# Stage 2: Runtime — nginx + PHP-FPM serving the built assets.
# =============================================================================
FROM php:8.2-fpm-alpine

RUN apk add --no-cache nginx wget libpng libjpeg-turbo freetype libwebp su-exec

# GD extension — used at runtime by src/admin/upload.php to resize the uploaded
# logo into PWA icons (favicon + 144/192/512) that land in the content volume.
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
        libpng-dev libjpeg-turbo-dev freetype-dev libwebp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" gd \
    && apk del .build-deps

# Let env vars (VOTING_ADMIN_KEY etc.) reach PHP-FPM workers.
RUN sed -i 's/;clear_env = no/clear_env = no/' /usr/local/etc/php-fpm.d/www.conf

# Admin file uploads (logo/floorplan/sponsor-logo) bis 5 MB; nginx deckelt bei
# gleichem Wert via client_max_body_size.
RUN { \
    echo 'upload_max_filesize = 5M'; \
    echo 'post_max_size = 6M'; \
    echo 'memory_limit = 64M'; \
  } > /usr/local/etc/php/conf.d/uploads.ini

# PHP-FPM-Worker + nginx-Worker laufen als non-root 'nginx'-User. Ohne diese
# Zeilen startet PHP-FPM seine Worker als 'www-data'; wir konsolidieren auf
# den nginx-User, damit Schreibrechte im Content-Volume konsistent sind.
RUN sed -i \
        -e 's/^user = www-data/user = nginx/' \
        -e 's/^group = www-data/group = nginx/' \
        -e 's/^listen.owner = www-data/listen.owner = nginx/' \
        -e 's/^listen.group = www-data/listen.group = nginx/' \
        /usr/local/etc/php-fpm.d/www.conf

# PHP-FPM-Master loggt auf stderr des Containers. Default `/proc/self/fd/2`
# scheitert beim non-root-Start, weil der nginx-User den FD nicht oeffnen darf.
RUN { \
    echo '[global]'; \
    echo 'error_log = /dev/stderr'; \
  } > /usr/local/etc/php-fpm.d/zz-logging.conf

EXPOSE 5173

COPY --from=builder /app/build /usr/share/nginx/html
COPY --from=builder /app/seed /app/seed
COPY nginx.prod.conf /etc/nginx/nginx.conf
COPY nginx.security-headers.conf /etc/nginx/nginx.security-headers.conf
RUN mkdir -p /run/nginx

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
