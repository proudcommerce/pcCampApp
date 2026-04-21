# =============================================================================
# Stage 1: Builder — cache-busting + PWA icon generation via Node.
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Builder only needs runtime deps (sharp) — skip devDeps and the playwright
# postinstall hook. sharp's lifecycle scripts must run to pull its native binary.
RUN npm ci --omit=dev

COPY build-cache-busting.cjs generate-icons.js ./
COPY src ./src
COPY seed ./seed

RUN node build-cache-busting.cjs

# =============================================================================
# Stage 2: Runtime — nginx + PHP-FPM serving the built assets.
# =============================================================================
FROM php:8.2-fpm-alpine

RUN apk add --no-cache nginx wget

# Let env vars (VOTING_ADMIN_KEY etc.) reach PHP-FPM workers.
RUN sed -i 's/;clear_env = no/clear_env = no/' /usr/local/etc/php-fpm.d/www.conf

EXPOSE 5173

COPY --from=builder /app/build /usr/share/nginx/html
COPY --from=builder /app/seed /app/seed
COPY nginx.prod.conf /etc/nginx/nginx.conf
RUN mkdir -p /run/nginx

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

WORKDIR /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
