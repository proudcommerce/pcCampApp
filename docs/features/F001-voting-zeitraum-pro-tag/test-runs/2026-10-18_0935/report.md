# F001 Voting-Zeitraum pro Session-Tag — Test Report (2026-10-18)

**Tester:** Claude (pctest)
**Build/Branch:** main @ 479f4c5 + uncommitted Changes
**Test-Backend:** agent-browser v0.27.0
**App-Typ:** Web
**Umgebung:** PHP-Built-in-Server 127.0.0.1:8901, Docroot mit Symlinks auf `src/`, isolierter Content (Kopie von `seed/` plus Sonntag-Session 900), Sonntag 09:33–09:50 Europe/Berlin
**Roles tested:** Admin, anonymer Besucher
**Result:** ✅ 7/7 bestanden | ⚠ 0 Warnings | ❌ 0 Failures

## Summary

Zeitraum je Tag lässt sich im Admin setzen, leeren und wieder laden. Der Sessionplan zeigt das Voting nur im Zeitraum, ohne Zeitraum ganztägig und bei inaktivem Status nie. Fehleingaben werden abgefangen. Am Produktcode musste nichts korrigiert werden.

## Test-Matrix

| ID | Titel | Rolle | Verdict | Notizen |
|----|-------|-------|---------|---------|
| T1 | Zeitraum-Felder im Admin sichtbar | Admin | ✅ | Je Tag `[data-voting-day]` mit 2 `type=time`-Inputs, vorbefüllt aus `event.json` (sonntag 14:00/15:30) |
| T2 | Gültiger Zeitraum → Voting sichtbar + abstimmbar | Admin, Besucher | ✅ | 08:30–10:30 gespeichert, `event.json` korrekt; Sessionplan "Session Voting Sonntag", Vote → "Bewertung gespeichert!", vote.php 200 |
| T3 | Zukünftiger Zeitraum → kein Voting | Admin, Besucher | ✅ | 12:00–13:00: `#voting-section` display none; nach Reload stehen 12:00/13:00 in den Feldern |
| T4 | Kein Zeitraum → ganztägig | Admin, Besucher | ✅ | `event.json` sonntag ohne startTime/endTime; Konsole "Voting active for: Sonntag (00:00-23:59)" |
| T5 | Status inaktiv → kein Voting | Besucher | ✅ | `#voting-section` display none. Status per Datei gesetzt, nicht per Admin-Button (s. Grenzen) |
| T6 | Fehleingaben | Admin | ✅ | Nur Von → "bitte Von und Bis angeben…"; 18:00/10:00 → "Von muss vor Bis liegen."; `event.json` unverändert |
| T7 | Cross-Feature-Smoke Sessionplan / Sessions-Speichern | Besucher | ✅ | Beide Tage gerendert, Samstag-Sessions unverändert, Samstag-Zeitraum 16:00–17:45 erhalten |

Backend ergänzend per curl (vor dem Browserlauf): außerhalb Fenster 403, falscher Wochentag 403, Status inaktiv/fehlt 403, `event.json` fehlt 503, ohne Zeitraum 200, Doppelvote 409.

## Befunde

Keine Produktbefunde.

## Grenzen

- T5 über den Admin-Button "Deaktivieren" nicht ausgeführt: Der native `confirm()` blockierte den agent-browser-Daemon für alle Sessions. Der Button ist von diesem Feature unverändert. Geprüft wurde die Wirkung des Status (`voting-state.json` inaktiv), dazu serverseitig per curl.
- Testserver ist PHP-Built-in statt nginx. Die nginx-spezifischen Playwright-Fälle (votes.json-Sperre, Redirects) schlagen dort vorbestehend fehl und betreffen das Feature nicht.

## Cross-Feature Smoke

- Sessionplan-Rendering: ✅ unverändert
- Sessions-Editor speichern: ✅ Sessions-Daten und Vote-Zähler bleiben erhalten

## Console / Network Anomalies

- Console: 0 Errors (`errors --json` leer in Admin und Sessionplan)
- Network: nur erwartete Requests (status.php 200, vote.php 200)

## Screenshots

- `screenshots/admin-sessions-voting-zeitraum-BEFORE.png` / `-AFTER.png` (T1)
- `screenshots/sessionplan-voting-offen-AFTER.png` (T2)
- `screenshots/sessionplan-voting-geschlossen-AFTER.png` (T3)

## Naechste Schritte

- [ ] User-Sign-off, danach Commit über `/pccommit`
