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
for rel in assets/logo.png assets/custom.css floorplan/floorplan.jpg sponsors/logos/sponsor-placeholder.png; do
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

# PHP-FPM-Master laeuft als root, damit er /dev/stderr (→ /proc/self/fd/2 des
# Container-Init) fuer error_log oeffnen darf. Die Worker wechseln laut www.conf
# (`user = nginx`) automatisch in den unprivilegierten Runtime-User — das ist
# das offizielle php:fpm-Pattern.
echo "🚀 Starting PHP-FPM (master root, workers $RUNTIME_USER)..."
php-fpm -D

# nginx-Master laeuft als root, damit er :80/:5173 und /var/log/nginx oeffnen
# kann. Die Worker wechseln per `user`-Direktive in den nginx-User.
echo "🚀 Starting nginx..."
exec nginx -g 'daemon off;'
