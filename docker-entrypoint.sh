#!/bin/sh
set -e

CONTENT_DIR="/usr/share/nginx/html/content"
SEED_DIR="/app/seed"
RUNTIME_USER="${RUNTIME_USER:-nginx}"
RUNTIME_GROUP="${RUNTIME_GROUP:-nginx}"

mkdir -p "$CONTENT_DIR"
mkdir -p \
    /var/lib/nginx/tmp/client_body \
    /var/lib/nginx/tmp/fastcgi \
    /var/lib/nginx/tmp/proxy \
    /var/lib/nginx/tmp/scgi \
    /var/lib/nginx/tmp/uwsgi \
    /run/nginx
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" /var/lib/nginx /run/nginx

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

# Content-Volume gehoert dem Runtime-User, damit admin/upload.php in Worker-
# Prozessen (nginx-User) schreiben darf.
chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$CONTENT_DIR"

echo "🚀 Starting PHP-FPM (as $RUNTIME_USER)..."
su-exec "$RUNTIME_USER:$RUNTIME_GROUP" php-fpm -D

# nginx-Master lauft ebenfalls als nginx-User. `daemon off;` + `master_process on;`
# laesst nginx als einen Prozess mit einem Worker laufen — ausreichend fuer
# den Container und vermeidet einen root-Master.
echo "🚀 Starting nginx (as $RUNTIME_USER)..."
exec su-exec "$RUNTIME_USER:$RUNTIME_GROUP" nginx -g 'daemon off;'
