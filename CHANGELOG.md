# Changelog

## [2.0.0] - 2026-04-11

Breaking Changes & Major Feature Release. Online Content-Verwaltung: Alle Event-Daten (Sessions, Timetable, News, Food, Sponsoren, Navigation) können jetzt direkt im Browser bearbeitet werden — ohne Build oder Deployment. Admin-Zugang über `/admin/?key=...` mit Session-basiertem Login. Voting-Admin wurde in das unified Admin-Panel integriert (`src/votes/admin.php` leitet weiter). Automatisches Backup bei jeder Änderung. Build-Prozess bewahrt Admin-Änderungen. Service Worker auf Network-first für JSON-Daten umgestellt. Runtime-Asset-Resolution via `cache-hashes.json` ersetzt Build-Time-Injection von gehashten JSON-Pfaden in JS/HTML. Production-Docker-Mount jetzt writable für Admin-Content-Management.

## [1.0.3] - 2026-04-10

Security-Hardening: Admin-Key aus event.json in Umgebungsvariable verschoben, Session-basierte Admin-Authentifizierung, CORS-Wildcard entfernt, Timing-safe Key-Vergleich, XSS-Schutz in Sponsor-Templates.

## [1.0.2] - 2025-10-29

Problem Votes-Administration behoben.

## [1.0.1] - 2025-10-28

Ersetze "docker-compose" durch "docker compose".

## [1.0.0] - 2025-10-27

Initialer Release auf Github nach erfolgreichem Live-Test auf dem DevOps Camp 2025.
