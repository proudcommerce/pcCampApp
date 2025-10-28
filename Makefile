.PHONY: help install clean test test-headed test-report test-php test-php-headed test-all \
        test-translations test-translations-de test-translations-en build \
        dev-up dev-down dev-rebuild dev-logs dev-remove generate-icons \
        prod-up prod-down prod-rebuild prod-logs prod-remove

# =============================================================================
# HELP
# =============================================================================

help:
	@echo "╔═════════════════════════════════════════════════╗"
	@echo "║           PC CampCamp - Make Commands           ║"
	@echo "╚═════════════════════════════════════════════════╝"
	@echo ""
	@echo "Setup & Build:"
	@echo "  make install         - Installiert Dependencies (node_modules)"
	@echo "  make build           - Erstellt Production Build (build/)"
	@echo "  make clean           - Vollständige Bereinigung (node_modules, build, Docker)"
	@echo ""
	@echo "Development (Port 5173 - src/):"
	@echo "  make dev-up          - Startet Dev-Server"
	@echo "  make dev-down        - Stoppt Dev-Server"
	@echo "  make dev-rebuild     - Rebuild Docker Image (ohne Cache)"
	@echo "  make dev-logs        - Zeigt Live-Logs"
	@echo "  make dev-remove      - Stoppt und entfernt Container + Volumes"
	@echo ""
	@echo "Production (Port 5174 - build/):"
	@echo "  make prod-up         - Startet Prod-Test-Server (inkl. Build)"
	@echo "  make prod-down       - Stoppt Prod-Test-Server"
	@echo "  make prod-rebuild    - Rebuild Docker Image (ohne Cache)"
	@echo "  make prod-logs       - Zeigt Live-Logs"
	@echo "  make prod-remove     - Stoppt und entfernt Container + Volumes"
	@echo ""
	@echo "Testing (Production):"
	@echo "  make test                 - Standard Tests (Port 5174, ohne PHP)"
	@echo "  make test-php             - PHP Tests (Port 5175, mit PHP-Server)"
	@echo "  make test-translations    - Übersetzungs-Tests (DE + EN)"
	@echo "  make test-translations-de - Übersetzungs-Tests (nur DE)"
	@echo "  make test-translations-en - Übersetzungs-Tests (nur EN)"
	@echo "  make test-all             - Alle Tests (Standard + PHP + Translations)"
	@echo "  make test-headed          - Tests mit sichtbarem Browser"
	@echo "  make test-report          - Öffne HTML Test-Report"

# =============================================================================
# SETUP & BUILD
# =============================================================================

install:
	@echo "📦 Installiere Dependencies..."
	@npm install
	@echo "✅ Dependencies installiert"

clean:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Vollständige Bereinigung                           ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "⚠️  WARNUNG: Folgende Aktionen werden ausgeführt:"
	@echo "   • Löschen von node_modules/"
	@echo "   • Löschen von build/"
	@echo "   • Stoppen und Entfernen aller Docker Container"
	@echo "   • Entfernen aller Docker Images (pccampapp)"
	@echo "   • Entfernen aller Docker Volumes (pccampapp)"
	@echo ""
	@printf "❓ Möchten Sie fortfahren? [y/N] " && read ans && [ $${ans:-N} = y ]
	@echo ""
	@echo "🧹 Bereinige node_modules und build/..."
	@rm -rf node_modules
	@rm -rf build
	@echo "✅ Lokale Dateien bereinigt"
	@echo ""
	@echo "🐳 Stoppe und entferne Docker Container..."
	@docker compose down -v --remove-orphans 2>/dev/null || true
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
	@echo "✅ Container gestoppt und entfernt"
	@echo ""
	@echo "🗑️  Entferne Docker Images..."
	@docker images | grep pccampapp | awk '{print $$3}' | xargs -r docker rmi -f 2>/dev/null || true
	@echo "✅ Images entfernt"
	@echo ""
	@echo "📦 Entferne Docker Volumes..."
	@docker volume ls | grep pccampapp | awk '{print $$2}' | xargs -r docker volume rm 2>/dev/null || true
	@echo "✅ Volumes entfernt"
	@echo ""
	@echo "✨ Vollständige Bereinigung abgeschlossen!"
	@echo ""
	@echo "💡 Nächster Schritt: make install && make dev-up"

# =============================================================================
# TESTING (Production Build - Port 5174)
# =============================================================================

test:
	@bash scripts/test-with-server.sh

test-headed:
	@bash scripts/test-with-server.sh --headed

test-php:
	@bash scripts/test-php-with-server.sh

test-php-headed:
	@bash scripts/test-php-with-server.sh --headed

test-translations:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Translation Tests (DE + EN)                        ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🌐 Teste Übersetzungen für beide Sprachen..."
	@echo ""
	@echo "🇩🇪 Part 1/2: Deutsche Übersetzungen"
	@$(MAKE) test-translations-de
	@echo ""
	@echo "🇬🇧 Part 2/2: Englische Übersetzungen"
	@$(MAKE) test-translations-en
	@echo ""
	@echo "🔄 Stelle Standard-Locale wieder her..."
	@node scripts/restore-locale.js
	@echo ""
	@echo "✅ Alle Translation-Tests abgeschlossen!"

test-translations-de:
	@echo "🇩🇪 Teste Deutsche Übersetzungen..."
	@bash scripts/test-with-server.sh --project=chromium-de

test-translations-en:
	@echo "🇬🇧 Teste Englische Übersetzungen..."
	@bash scripts/test-with-server.sh --project=chromium-en

test-all:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Running All Tests (Standard + PHP + Translations)  ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🔹 Part 1/3: Standard Tests (Port 5174, nginx)"
	@echo ""
	@$(MAKE) test
	@echo ""
	@echo "🔹 Part 2/3: PHP Tests (Port 5175, PHP Built-in Server)"
	@echo ""
	@$(MAKE) test-php
	@echo ""
	@echo "🔹 Part 3/3: Translation Tests (DE + EN)"
	@echo ""
	@$(MAKE) test-translations

test-report:
	@echo "📊 Öffne Playwright Test-Report..."
	@npx playwright show-report

generate-icons:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           PWA Icon Generator                                 ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@node generate-icons.js
	@echo ""
	@echo "✅ PWA Icons generiert!"
	@echo "💡 Verwendet automatisch bei: make dev-up"

build:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Production Build mit Cache-Busting                 ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "📦 Verarbeite Assets: JSON, CSS, JS, Bilder..."
	@node build-cache-busting.cjs
	@echo ""
	@echo "✅ Build abgeschlossen!"
	@echo ""
	@echo "📊 Build Output:"
	@echo "   📁 build/ - Deployment-ready Dateien"
	@echo "   🔒 Alle Assets gehasht (immutable URLs)"
	@echo "   ⚙️  Service Worker aktualisiert"
	@echo "   📱 PWA Manifest aktualisiert"
	@echo ""
	@echo "💡 Nächster Schritt: make prod-up (Build lokal testen)"

# =============================================================================
# DEVELOPMENT (src/ auf Port 5173)
# =============================================================================

dev-up:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Development Server (src/)                          ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🎨 Generiere PWA Icons..."
	@node generate-icons.js
	@echo ""
	@echo "🐳 Starte Docker Development Server..."
	@echo "🌐 URL: http://localhost:5173"
	@echo "📁 Serviert: src/ (live-reload aktiv)"
	@echo "🔄 Caching: deaktiviert (Cache-Control: no-store)"
	@echo ""
	@docker compose up

dev-down:
	@echo "🛑 Stoppe Development Server..."
	@docker compose down
	@echo "✅ Development Server gestoppt"

dev-rebuild:
	@echo "🔨 Rebuild Development Docker Image (ohne Cache)..."
	@docker compose build --no-cache
	@echo "✅ Image neu gebaut"

dev-logs:
	@echo "📋 Development Server Logs (Ctrl+C zum Beenden)..."
	@docker compose logs -f

dev-remove:
	@echo "🗑️  Entferne Development Container, Netzwerke und Volumes..."
	@docker compose down -v --remove-orphans
	@echo "✅ Vollständig entfernt"

# =============================================================================
# PRODUCTION TEST (build/ auf Port 5174)
# =============================================================================

prod-up:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Production Server                                  ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🔨 Erstelle frischen Production Build..."
	@echo ""
	@$(MAKE) build
	@echo ""
	@echo "🐳 Starte Production Server..."
	@echo "🌐 URL: http://localhost:5174"
	@echo "📁 Serviert: build/ (Production-ready)"
	@echo "🔍 Teste: Cache-Busting, gehashte Assets, PWA"
	@echo ""
	@docker compose -f docker-compose.prod.yml up 

prod-down:
	@echo "🛑 Stoppe Production Server..."
	@docker compose -f docker-compose.prod.yml down
	@echo "✅ Production Server gestoppt"

prod-rebuild:
	@echo "🔨 Rebuild Production Docker Image (ohne Cache)..."
	@docker compose -f docker-compose.prod.yml build --no-cache
	@echo "✅ Image neu gebaut"

prod-logs:
	@echo "📋 Production Server Logs (Ctrl+C zum Beenden)..."
	@docker compose -f docker-compose.prod.yml logs -f

prod-remove:
	@echo "🗑️  Entferne Production Container, Netzwerke und Volumes..."
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans
	@echo "✅ Vollständig entfernt"
