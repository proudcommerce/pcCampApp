# Changelog

## [3.0.0] - 2026-04-21

Architektur-Refactor: Saubere Trennung Code ↔ Content. Der komplette Build laeuft jetzt in einem Multi-Stage Dockerfile — lokales Node/npm ist nicht mehr erforderlich (`git clone && make prod-up`). Alle laufzeit-aenderbaren Daten (event.json, menu.json, news.json, sessions.json, timetable.json, food/*.json, sponsors.json, voting/*.json, Hash-Manifest, SW-Version) liegen jetzt im Host-Volume `./content/`, das beim ersten Container-Start aus `./seed/` geseedet wird. Code-Assets werden weiter vom Multi-Stage-Build ins Image gehasht (neues Manifest `assets-hashes.json`), Content-Rehashing uebernimmt `rehash.php` im Volume (Manifest `content/content-hashes.json`). Service Worker kombiniert jetzt eine Build-Version (`BUILD_VERSION`, beim Image-Build gesetzt) mit einer Content-Version (`content/sw-version.txt`, vom Rehash gebumpt), sodass sowohl Code-Deploys als auch Admin-Edits den Cache sauber invalidieren. `event.json` ist jetzt regulaer ueber die Admin-UI pflegbar (neuer Tab „Event", Raw-JSON-Editor). Zentraler PHP-Helper `content-paths.php` aufloest Content-Pfade konsistent in Dev und Prod. Breaking: Alle URL-Pfade fuer dynamischen Content haben sich geaendert (z. B. `/menu.json` → `/content/menu.json`). Bestehende Installationen werden nicht migriert.

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
