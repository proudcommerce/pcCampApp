#!/bin/bash

# Test-Script mit automatischem Production-Server-Start
# Testet Production Build (build/) auf Port 5174

set -e

# Konfiguration - nur Production
PORT=5174
BASE_URL="http://localhost:5174"

# Parse Argumente
HEADED=""
PROJECT=""
for arg in "$@"; do
    case $arg in
        --headed)
            HEADED="--headed"
            ;;
        --project=*)
            PROJECT="${arg#*=}"
            ;;
    esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Production Build Tests (Port 5174)                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Target: $BASE_URL"
echo "📁 Testing: build/ (Production Build)"
if [ -n "$PROJECT" ]; then
    echo "📦 Project: $PROJECT"
fi
if [ "$HEADED" = "--headed" ]; then
    echo "👁️  Browser: Sichtbar (headed mode)"
else
    echo "👁️  Browser: Headless"
fi
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
    echo "✅ Server läuft bereits auf $BASE_URL"
    SERVER_WAS_RUNNING=true
else
    echo "⚠️  Server nicht verfügbar auf $BASE_URL"
    echo "🚀 Starte Production Server..."

    # Production Build erstellen falls nicht vorhanden
    if [ ! -d "build" ]; then
        echo "📦 Erstelle Production Build..."
        node build-cache-busting.cjs
        echo ""
    fi

    # Production Server starten
    docker-compose -f docker-compose.prod.yml up -d

    # Warte auf Server
    echo "⏳ Warte auf Server-Start..."
    RETRY_COUNT=0
    MAX_RETRIES=30

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if check_server; then
            echo "✅ Server ist bereit!"
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "   Versuch $RETRY_COUNT/$MAX_RETRIES..."
        sleep 2
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ Server konnte nicht gestartet werden!"
        exit 1
    fi
fi

echo ""
echo "🧪 Führe Playwright-Tests aus..."
echo ""

# Tests ausführen
TEST_CMD="BASE_URL=$BASE_URL npx playwright test"

if [ "$HEADED" = "--headed" ]; then
    TEST_CMD="$TEST_CMD --headed"
fi

if [ -n "$PROJECT" ]; then
    TEST_CMD="$TEST_CMD --project=$PROJECT"
fi

if eval $TEST_CMD; then
    TEST_EXIT_CODE=0
    echo ""
    echo "✅ Alle Tests erfolgreich!"
else
    TEST_EXIT_CODE=$?
    echo ""
    echo "❌ Tests fehlgeschlagen (Exit Code: $TEST_EXIT_CODE)"
fi

# Server stoppen falls wir ihn gestartet haben
if [ "$SERVER_WAS_RUNNING" = false ]; then
    echo ""
    echo "🛑 Stoppe Production Server..."
    docker-compose -f docker-compose.prod.yml down
    echo "✅ Server gestoppt"
fi

echo ""
echo "💡 Test-Report: npx playwright show-report"
echo ""

exit $TEST_EXIT_CODE
