FROM php:8.2-fpm-alpine

# Install nginx and PHP extensions
RUN apk add --no-cache \
    nginx \
    wget

# Expose Port 5173 (custom development port)
EXPOSE 5173

# Kopiere nginx Config
COPY nginx.conf /etc/nginx/nginx.conf

# Create nginx run directory
RUN mkdir -p /run/nginx

# Workdir für Content (src/ wird via volume gemountet)
WORKDIR /usr/share/nginx/html

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Health Check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
