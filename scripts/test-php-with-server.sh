#!/bin/bash

# PHP Test-Script mit automatischem PHP Built-in Server-Start
# Testet Production Build (build/) mit PHP auf Port 5175

set -e

# Konfiguration - PHP Server
PORT=5175
BASE_URL="http://localhost:5175"
HEADED="${1:-}"   # --headed für sichtbaren Browser

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           PHP Tests (Port 5175)                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Target: $BASE_URL"
echo "📁 Testing: build/ (Production Build with PHP)"
echo "🐘 Server: PHP Built-in Server"
if [ "$HEADED" = "--headed" ]; then
    echo "👁️  Browser: Sichtbar (headed mode)"
else
    echo "👁️  Browser: Headless"
fi
echo ""

# Prüfe ob PHP installiert ist
if ! command -v php &> /dev/null; then
    echo "❌ PHP ist nicht installiert!"
    echo "💡 Installiere PHP: brew install php"
    exit 1
fi

echo "✅ PHP Version: $(php -v | head -n 1)"
echo ""

# Prüfe ob Server bereits läuft
check_server() {
    if curl -s --fail "$BASE_URL" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Server-Status prüfen
SERVER_WAS_RUNNING=false
if check_server; then
    echo "✅ PHP Server läuft bereits auf $BASE_URL"
    SERVER_WAS_RUNNING=true
else
    echo "⚠️  PHP Server nicht verfügbar auf $BASE_URL"
    echo "🚀 Starte PHP Built-in Server..."

    # Production Build erstellen falls nicht vorhanden
    if [ ! -d "build" ]; then
        echo "📦 Erstelle Production Build..."
        node build-cache-busting.cjs
        echo ""
    fi

    # PHP Built-in Server im Hintergrund starten
    php -S localhost:$PORT -t build/ > /dev/null 2>&1 &
    PHP_PID=$!
    echo "🐘 PHP Server gestartet (PID: $PHP_PID)"

    # Warte auf Server
    echo "⏳ Warte auf Server-Start..."
    RETRY_COUNT=0
    MAX_RETRIES=30

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if check_server; then
            echo "✅ PHP Server ist bereit!"
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "   Versuch $RETRY_COUNT/$MAX_RETRIES..."
        sleep 1
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ PHP Server konnte nicht gestartet werden!"
        if [ -n "$PHP_PID" ]; then
            kill $PHP_PID 2>/dev/null || true
        fi
        exit 1
    fi
fi

echo ""
echo "🧪 Führe PHP-Tests aus (voting.spec.js mit PHP-Backend)..."
echo ""

# Tests ausführen - nur voting.spec.js mit aktivierten PHP-Tests
if [ "$HEADED" = "--headed" ]; then
    TEST_CMD="BASE_URL=$BASE_URL PHP_TESTS_ENABLED=true npx playwright test tests/voting.spec.js --headed"
else
    TEST_CMD="BASE_URL=$BASE_URL PHP_TESTS_ENABLED=true npx playwright test tests/voting.spec.js"
fi

if eval $TEST_CMD; then
    TEST_EXIT_CODE=0
    echo ""
    echo "✅ Alle PHP-Tests erfolgreich!"
else
    TEST_EXIT_CODE=$?
    echo ""
    echo "❌ PHP-Tests fehlgeschlagen (Exit Code: $TEST_EXIT_CODE)"
fi

# Server stoppen falls wir ihn gestartet haben
if [ "$SERVER_WAS_RUNNING" = false ]; then
    echo ""
    echo "🛑 Stoppe PHP Server..."
    if [ -n "$PHP_PID" ]; then
        kill $PHP_PID 2>/dev/null || true
        echo "✅ PHP Server gestoppt (PID: $PHP_PID)"
    fi
fi

echo ""
echo "💡 Test-Report: npx playwright show-report"
echo ""

exit $TEST_EXIT_CODE
