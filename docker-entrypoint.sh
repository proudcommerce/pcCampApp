#!/bin/sh
set -e

CONTENT_DIR="/usr/share/nginx/html/content"
SEED_DIR="/app/seed"

mkdir -p "$CONTENT_DIR"

# Seed content volume on first start (when empty). Admin edits afterwards
# live here and survive image rebuilds.
if [ -d "$SEED_DIR" ] && [ -z "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
    echo "📦 Content volume empty — seeding from $SEED_DIR"
    cp -R "$SEED_DIR"/. "$CONTENT_DIR"/
fi

echo "🚀 Starting PHP-FPM..."
php-fpm -D

echo "🚀 Starting nginx..."
exec nginx -g 'daemon off;'
