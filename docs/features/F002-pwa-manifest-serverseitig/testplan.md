# Testplan F002 — PWA-Manifest serverseitig ausliefern

Umgebung: Prod-Image (`docker build`), isoliert auf Port 5199, ohne Content-Volume (Seed), `VOTING_ADMIN_KEY` als Wegwerf-Key.

T1: Manifest-Auslieferung
  Pre:  Container läuft
  Parallel: ja
  Steps:
    1. GET /manifest.json
  Expect:
    - 200, Content-Type application/manifest+json
    - name, short_name, start_url, scope, display=standalone, theme_color, background_color, 3 Icons (144/192/512)
    - alle Icon-URLs relativ zu /manifest.json liefern 200 image/png

T2: Manifest-Link im Browser (Pixel-7-Viewport)
  Pre:  Container läuft
  Parallel: ja
  Steps:
    1. open / im mobilen Viewport (412px), warten bis event.json geladen
    2. href von link[rel=manifest] lesen
    3. Chrome-Manifest-Parsing (CDP Page.getAppManifest, Page.getInstallabilityErrors)
  Expect:
    - href bleibt ./manifest.json (vorher: blob:-URL)
    - Manifest-URL /manifest.json, errors [], installabilityErrors []
    - innerWidth 412, .grid einspaltig
    - Console: keine neuen Errors (vorbestehend: 404 content-hashes.json bei frischem Volume)

T3: Admin-Änderung wirkt ohne Rebuild
  Pre:  Admin-Login mit Wegwerf-Key
  Parallel: nein (mutiert event.json)
  Steps:
    1. /admin/ einloggen, Tab "Event"
    2. pwa.manifestShortName auf "pctest-F002" ändern, speichern
    3. GET /manifest.json
  Expect:
    - Speichern erfolgreich (.success-message)
    - short_name = "pctest-F002"

T4: Fehlende PWA-Felder (Edge)
  Pre:  T3 abgeschlossen
  Parallel: nein (mutiert event.json)
  Steps:
    1. im Container pwa.startUrl, pwa.scope, pwa.display, pwa.orientation aus event.json entfernen
    2. GET /manifest.json
  Expect:
    - 200, gültiges JSON mit Defaults start_url "/", scope "/", display "standalone", orientation "portrait-primary"

T5: Cross-Feature-Smoke
  Pre:  Container läuft
  Parallel: ja
  Steps:
    1. /, /sessionplan/, /timetable/, /food/, /floorplan/, /sponsors/ öffnen
  Expect:
    - Seiten rendern, Branding aus event.json (Titel) gesetzt, keine JS-Fehler

Nicht abgedeckt: echte WebAPK-Installation auf einem Android-Gerät (manueller Test 4 in testing.md).
