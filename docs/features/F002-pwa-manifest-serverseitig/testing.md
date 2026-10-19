# Testanleitung F002 — PWA-Manifest serverseitig ausliefern

## Vorbereitung

- App über das Prod-Image starten (`make dev-prod-start`) oder den Dev-Container (`make dev-start`).
- Android-Smartphone mit Chrome, auf dem die App bisher installiert war.

## Tests

### 1. Manifest wird ausgeliefert
1. Im Browser `/manifest.json` aufrufen.
2. **Erwartung: JSON mit Name, Kurzname, `start_url`, `scope`, `display: standalone`, Theme-Farbe und drei Icons. Content-Type `application/manifest+json`.**

### 2. Admin-Änderung wirkt ohne Rebuild
1. Im Admin-Tab "Event" den PWA-Kurznamen ändern und speichern.
2. `/manifest.json` neu laden.
3. **Erwartung: Der neue Kurzname steht im Manifest.**

### 3. Manifest-Link bleibt fest
1. Startseite öffnen, in den DevTools unter Application → Manifest nachsehen.
2. **Erwartung: Manifest-URL ist `/manifest.json` (keine `blob:`-URL), keine Fehler oder Warnungen zu `start_url`/`scope`, App ist installierbar.**

### 4. Installation auf Android (Fehlerfall aus dem Anlass)
1. Bereits installierte App vom Homescreen deinstallieren.
2. Seite in Chrome öffnen, "App installieren" wählen.
3. App vom Homescreen starten.
4. **Erwartung: Mobile Ansicht wie im Browser-Tab (volle Bildschirmbreite, Kacheln zweispaltig, Schrift nicht verkleinert), Start auf `/`.**

## Checkliste

- [ ] Test 1: Manifest wird ausgeliefert
- [ ] Test 2: Admin-Änderung wirkt
- [ ] Test 3: Manifest-URL fest, installierbar
- [ ] Test 4: Installation auf Android-Smartphone zeigt mobile Ansicht

## Abdeckungsmatrix

| Akzeptanzkriterium / Bedienweg | Nachweis | Geprüfte Wirkung | Offene Grenze |
|---|---|---|---|
| `/manifest.json` liefert gültiges Manifest | `tests/pwa.spec.js` (Manifest erreichbar, gültig, Icon-Größen, Icons existieren) gegen Prod-Image, alle grün | HTTP 200, Pflichtfelder, Icons abrufbar | — |
| Manifest-Link zeigt auf feste URL | `tests/pwa.spec.js:180` "manifest link sollte im HTML sein": vorher rot (blob:-URL), jetzt grün | `href` enthält `manifest.json` nach Laden der Config | — |
| Chrome parst Manifest fehlerfrei und hält App für installierbar | CDP `Page.getAppManifest` + `Page.getInstallabilityErrors` im Pixel-7-Profil gegen Prod-Image: `errors: []`, `installabilityErrors: []`, URL `/manifest.json` | Parsing, scope aufgelöst, installierbar | Echte WebAPK-Installation nur am Gerät prüfbar |
| Laufzeit-Änderung an `event.json` wirkt | `manifestShortName` im Container geändert, `curl /manifest.json` liefert neuen Wert | Kein Rebuild nötig | — |
| Keine Regression | Volle Playwright-Suite gegen Prod-Image: 123 grün, 5 rot; Vergleichsstand ohne F002: 122 grün, 6 rot. Die 5 sind in beiden Ständen rot (custom.css ohne Hash, roomPrefix-Übersetzung de/en, zwei nginx-Admin-Redirect-Tests) | — | Die 5 roten Tests sind vorbestehend |
| Desktop-Ansicht in installierter App verschwindet | manueller Test 4 | — | Ursache nicht belegt; nur am Gerät prüfbar |
