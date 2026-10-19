# F002 PWA-Manifest serverseitig ausliefern — Test Report (2026-10-19)

**Tester:** Claude (pctest)
**Build/Branch:** main @ f95a22e + uncommitted F002-Änderungen
**Test-Backend:** agent-browser v0.27.0, zusätzlich Playwright (CDP `Page.getAppManifest`) und curl
**App-Typ:** Web
**Umgebung:** Prod-Image (`docker build`), isoliert auf Port 5199, Seed-Content, Wegwerf-Admin-Key
**Roles tested:** Besucher, Admin
**Result:** ✅ 5/5 bestanden | ⚠ 0 Warnings | ❌ 0 Failures

## Summary

`/manifest.json` wird über nginx-Rewrite von `manifest.php` aus `event.json` erzeugt, Chrome parst es ohne Fehler und hält die App für installierbar. Der Manifest-Link bleibt `./manifest.json` (vorher `blob:`-URL). Admin-Änderungen wirken sofort, fehlende PWA-Felder fallen auf Defaults zurück. Keine Regression auf den übrigen Seiten.

## Test-Matrix

| ID | Titel | Rolle | Verdict | Notizen |
|----|-------|-------|---------|---------|
| T1 | Manifest-Auslieferung | Besucher | ✅ | 200, `application/manifest+json`, alle Pflichtfelder, Icons 144/192/512 je 200 `image/png` |
| T2 | Manifest-Link + Chrome-Parsing (Pixel 7) | Besucher | ✅ | `href` `./manifest.json`, `errors: []`, `installabilityErrors: []`, `innerWidth` 412, 0 JS-Fehler |
| T3 | Admin-Änderung ohne Rebuild | Admin | ✅ | Tab "Event", `manifestShortName` → `pctest-F002`, "Event-Config gespeichert", Manifest liefert neuen Wert |
| T4 | Fehlende PWA-Felder | — | ✅ | `startUrl`/`scope`/`display`/`orientation` entfernt → Defaults `/`, `/`, `standalone`, `portrait-primary` |
| T5 | Cross-Feature-Smoke | Besucher | ✅ | 6 Seiten, Titel aus `event.json`, 0 JS-Fehler |

## Befunde

Keine.

Gegenprobe zum Alt-Stand (aus dem Implementer-Lauf, Vergleichs-Image ohne F002): `tests/pwa.spec.js:180` "manifest link sollte im HTML sein" ist dort rot, weil der Link nach dem Laden auf eine `blob:`-URL zeigt. Mit F002 grün.

Korrektur an der Testanleitung: `testing.md` Test 4 erwartete einspaltige Kacheln. Die Startseite ist auch mobil zweispaltig (`#cardsContainer`, `src/assets/app.css:202`), Erwartung angepasst.

## Cross-Feature Smoke

- Startseite, Sessionplan, Timetable, Food, Floorplan, Sponsoren: ✅ rendern, Branding gesetzt, keine JS-Fehler
- Admin "Event"-Tab speichern: ✅

## Console / Network Anomalies

- Console: 0 JS-Fehler. Ein vorbestehender 404 auf `/content/content-hashes.json` bei frischem Content-Volume (unabhängig von F002).

## Screenshots

- `T2-result.png` — Startseite im Pixel-7-Viewport

## Nächste Schritte

- [ ] Am Android-Smartphone: App deinstallieren, neu installieren, Ansicht prüfen (`testing.md` Test 4). Ob das die Desktop-Ansicht behebt, ist nur am Gerät prüfbar.
