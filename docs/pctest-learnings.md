---
title: pctest-Learnings pcCampApp
type: notiz
status: aktuell
date: 2026-10-18
topics: [testing, voting, admin]
---

# pctest-Learnings pcCampApp

_Last updated: 2026-10-18 (F001 Voting-Zeitraum, Re-Run)_

## Fast-Path

- Ohne Docker testen: Docroot im Scratchpad mit Symlinks auf jede Datei in `src/*` anlegen, dabei `src/content` auslassen (sonst schreibt `cp -R seed …/content` ins Repo), `content/` als echte Kopie von `seed/`, dann `VOTING_ADMIN_KEY=<key> php -S 127.0.0.1:8901 -t <docroot>`. `[2026-10-18]`
- Admin-Login: `fill "input[name=admin_key]" <key>` + `press Enter`; lokaler Key steht in `.env` (`VOTING_ADMIN_KEY`). `[2026-10-18]`
- Admin-Tabs: `button[data-resource=<name>]`, Tag-Tabs: `button.day-tab[data-day=<tag>]`, Speichern: `#btn-save`, Meldungen: `.success-message` / `.error-message`. `[2026-10-18]`
- Sessionplan-Voting: `#voting-section` (display none = aus), Auswahl `#<tag>-vote`, Button `#<tag>-submit`, Status `#<tag>-status`. `[2026-10-18]`

## Dev-Env

- Playwright gegen PHP-Built-in: `BASE_URL=http://127.0.0.1:8901 PHP_TESTS_ENABLED=true node_modules/.bin/playwright test` (npx scheitert an `.npmrc`). 3 nginx-abhängige Fälle (votes.json-Sperre, `/votes/results.php`-Redirect, Admin-Redirect) sind dort immer rot. `[2026-10-18]`
- "Voting-Hint sollte vorhanden sein" ist rot, solange im Test-Content gerade ein Voting offen ist (das Formular ersetzt den Hint). `[2026-10-18]`

## Browser/Backend

- `type=time`-Inputs: `fill` setzt keinen Wert. `focus` + Ziffern einzeln per `press` (z. B. 0,8,3,0) und leeren per `press Backspace` je Segment. `[2026-10-18]`
- Admin-Buttons mit nativem `confirm()` (Voting aktivieren/deaktivieren/beenden, Votes übertragen): agent-browser blockiert schon beim `click` und hält den Daemon für alle Sessions. Stattdessen ein Node-Skript mit `require('<repo>/node_modules/@playwright/test').chromium` und `page.on('dialog', d => d.accept()|d.dismiss())`. Hänger lösen: `agent-browser close --all`. `[2026-10-18]`
- Sessionplan scrollt nach dem Laden zum aktuellen Slot, das Voting-Formular landet unter dem fixierten Header und `click` trifft den Header (meldet trotzdem "Done"). Vor dem Klick `eval "el.scrollIntoView({block:'center'})"`. `[2026-10-18]`
- Der userKey kommt aus einem Browser-Fingerprint: frische Sessions haben denselben Key. Für einen zweiten Vote `content/voting/votes.json` im Test-Content löschen. `[2026-10-18]`

## Daten/Seeding

- `seed/sessionplan/sessions.json` hat nur `samstag`. Für Tests am heutigen Wochentag einen Tag mit deutschem Wochentagsnamen als Key im Test-Content ergänzen. `seed/event.json` setzt für sonntag 14:00–15:30: Für Status-Tests ohne Zeitbezug `startTime`/`endTime` im Test-Content entfernen. `[2026-10-18]`
