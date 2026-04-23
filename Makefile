.PHONY: help install clean test test-headed test-report test-php test-php-headed test-all \
        test-translations test-translations-de test-translations-en \
        dev-start dev-stop dev-build dev-logs dev-remove \
        dev-prod-start dev-prod-stop dev-prod-build dev-prod-logs dev-prod-remove \
        prod-start prod-stop prod-build prod-logs prod-remove

# Host-Ports aus .env lesen (Fallback auf Defaults aus docker-compose)
-include .env
export
DEV_PORT  ?= 5173
PROD_PORT ?= 5174

# =============================================================================
# HELP
# =============================================================================

help:
	@echo "╔═════════════════════════════════════════════════╗"
	@echo "║           PC CampCamp - Make Commands           ║"
	@echo "╚═════════════════════════════════════════════════╝"
	@echo ""
	@echo "Setup:"
	@echo "  make install             - Installiert Playwright (nur fuer lokale Tests)"
	@echo "  make clean               - Vollstaendige Bereinigung (Docker + content/)"
	@echo ""
	@echo "Development (Port $(DEV_PORT), src/ live-mount):"
	@echo "  make dev-start           - Startet Dev-Container"
	@echo "  make dev-stop            - Stoppt Dev-Container"
	@echo "  make dev-build           - Rebuild Dev Image (ohne Cache)"
	@echo "  make dev-logs            - Live-Logs"
	@echo "  make dev-remove          - Container + Netzwerke entfernen"
	@echo ""
	@echo "Dev-Prod (Port $(PROD_PORT), Multi-Stage Image, Foreground):"
	@echo "  make dev-prod-start      - Startet lokalen Prod-Test (baut Image)"
	@echo "  make dev-prod-stop       - Stoppt lokalen Prod-Test"
	@echo "  make dev-prod-build      - Rebuild Prod Image (ohne Cache)"
	@echo "  make dev-prod-logs       - Live-Logs"
	@echo "  make dev-prod-remove     - Container + Netzwerke entfernen"
	@echo ""
	@echo "Production (Port $(PROD_PORT), Multi-Stage Image, Detached -d):"
	@echo "  make prod-start          - Startet Prod-Container im Hintergrund (baut Image)"
	@echo "  make prod-stop           - Stoppt Prod-Container"
	@echo "  make prod-build          - Rebuild Prod Image (ohne Cache)"
	@echo "  make prod-logs           - Live-Logs"
	@echo "  make prod-remove         - Container + Netzwerke entfernen"
	@echo ""
	@echo "Testing (Production):"
	@echo "  make test                 - Standard Tests (Port 5174)"
	@echo "  make test-php             - Voting/PHP Tests"
	@echo "  make test-translations    - Uebersetzungs-Tests (DE + EN)"
	@echo "  make test-all             - Alle Tests"
	@echo "  make test-headed          - Tests mit sichtbarem Browser"
	@echo "  make test-report          - HTML Test-Report oeffnen"

# =============================================================================
# SETUP
# =============================================================================

install:
	@echo "Installiere Playwright-Browser fuer lokale Tests..."
	@npm install
	@npx playwright install
	@echo "OK"

clean:
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           Vollstaendige Bereinigung                          ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Folgende Aktionen werden ausgefuehrt:"
	@echo "   - Loeschen von node_modules/, build/, content/"
	@echo "   - Stoppen/Entfernen aller pccampapp Docker Container/Images/Volumes"
	@echo ""
	@printf "Fortfahren? [y/N] " && read ans && [ $${ans:-N} = y ]
	@rm -rf node_modules build content
	@docker compose down -v --remove-orphans 2>/dev/null || true
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
	@docker images | grep pccampapp | awk '{print $$3}' | xargs -r docker rmi -f 2>/dev/null || true
	@docker volume ls | grep pccampapp | awk '{print $$2}' | xargs -r docker volume rm 2>/dev/null || true
	@echo "Bereinigung abgeschlossen. Naechster Schritt: make dev-start oder make prod-start"

# =============================================================================
# TESTING (Production Build)
# =============================================================================

test:
	@bash scripts/test-with-server.sh

test-headed:
	@bash scripts/test-with-server.sh --headed

test-php:
	@bash scripts/test-with-server.sh tests/voting.spec.js

test-php-headed:
	@bash scripts/test-with-server.sh tests/voting.spec.js --headed

test-translations:
	@$(MAKE) test-translations-de
	@$(MAKE) test-translations-en
	@node scripts/restore-locale.js

test-translations-de:
	@bash scripts/test-with-server.sh --project=chromium-de

test-translations-en:
	@bash scripts/test-with-server.sh --project=chromium-en

test-all:
	@$(MAKE) test
	@$(MAKE) test-php
	@$(MAKE) test-translations

test-report:
	@npx playwright show-report

# =============================================================================
# DEVELOPMENT (src/ live-mount, Port 5173)
# =============================================================================

dev-start:
	@echo "Development Container (http://localhost:$(DEV_PORT)) — src/ live-mount"
	@docker compose up

dev-stop:
	@docker compose down

dev-build:
	@docker compose build --no-cache

dev-logs:
	@docker compose logs -f

dev-remove:
	@docker compose down -v --remove-orphans

# =============================================================================
# DEV-PROD / FAK (Multi-Stage Image, Port 5174, Foreground)
# Lokaler Prod-Test — baut exakt das Image, das auch auf den Server geht.
# =============================================================================

dev-prod-start:
	@echo "Dev-Prod Container (http://localhost:$(PROD_PORT)) — Foreground, Multi-Stage Build"
	@docker compose -f docker-compose.prod.yml up --build

dev-prod-stop:
	@docker compose -f docker-compose.prod.yml down

dev-prod-build:
	@docker compose -f docker-compose.prod.yml build --no-cache

dev-prod-logs:
	@docker compose -f docker-compose.prod.yml logs -f

dev-prod-remove:
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans

# =============================================================================
# PRODUCTION (Multi-Stage Image, Port 5174, Detached)
# Fuer echtes Server-Deployment — laeuft im Hintergrund.
# =============================================================================

prod-start:
	@echo "Production Container (http://localhost:$(PROD_PORT)) — Detached, Multi-Stage Build"
	@docker compose -f docker-compose.prod.yml up -d --build

prod-stop:
	@docker compose -f docker-compose.prod.yml down

prod-build:
	@docker compose -f docker-compose.prod.yml build --no-cache

prod-logs:
	@docker compose -f docker-compose.prod.yml logs -f

prod-remove:
	@docker compose -f docker-compose.prod.yml down -v --remove-orphans
