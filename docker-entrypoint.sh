#!/bin/sh
set -e

CONTENT_DIR="/usr/share/nginx/html/content"
SEED_DIR="/app/seed"
NGINX_RUNTIME_USER="${NGINX_RUNTIME_USER:-nginx}"

mkdir -p "$CONTENT_DIR"
mkdir -p \
    /var/lib/nginx/tmp/client_body \
    /var/lib/nginx/tmp/fastcgi \
    /var/lib/nginx/tmp/proxy \
    /var/lib/nginx/tmp/scgi \
    /var/lib/nginx/tmp/uwsgi
chown -R "$NGINX_RUNTIME_USER:$NGINX_RUNTIME_USER" /var/lib/nginx/tmp

# Seed content volume on first start (when empty). Admin edits afterwards
# live here and survive image rebuilds.
if [ -d "$SEED_DIR" ] && [ -z "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
    echo "📦 Content volume empty — seeding from $SEED_DIR"
    cp -R "$SEED_DIR"/. "$CONTENT_DIR"/
fi

# Binary defaults (logo/floorplan/sponsor-logos) werden bei bestehenden Volumes
# nachgezogen, ohne JSONs zu ueberschreiben. Bereits vorhandene Dateien
# (vom Admin-Upload) bleiben unberuehrt.
for rel in assets/logo.png floorplan/floorplan.jpg sponsors/logos/sponsor-placeholder.png; do
    src="$SEED_DIR/$rel"
    dst="$CONTENT_DIR/$rel"
    if [ -f "$src" ] && [ ! -e "$dst" ]; then
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        echo "📦 Seeded missing $rel"
    fi
done

echo "🚀 Starting PHP-FPM..."
php-fpm -D

echo "🚀 Starting nginx..."
exec nginx -g 'daemon off;'
