---
status: passed
date: 2026-10-19
reviewer: codex
self_review: false
rounds: 1
stop_reason: approved
---

# Codex-Review F002 — PWA-Manifest serverseitig ausliefern

## Scope

Uncommitted Changes, beschränkt auf F002: `src/manifest.php` (neu), `src/manifest.json` (gelöscht), `src/assets/event-config-loader.js`, `build-cache-busting.cjs`, `nginx.conf`, `nginx.prod.conf`. Parallele Änderungen im Working Tree (Sperre von `*.md` in nginx, `.dockerignore`, `votes/README.md` aus `copyOnlyFiles`) waren ausdrücklich ausgenommen.

## Findings

Keine. Codex hat PHP-Syntax, Manifest-Ausgabe, nginx-Routing, Header, Icon-Pfade, Build-Einbindung und abhängige Stellen (Service Worker, Tests) geprüft. Docker- und Browser-Integration konnte Codex nicht prüfen (Docker-Socket gesperrt); die ist im Implementer-Lauf gegen das Prod-Image nachgewiesen (siehe `testing.md`).

## Kurzfazit

Approved in Runde 1 ohne Findings.
