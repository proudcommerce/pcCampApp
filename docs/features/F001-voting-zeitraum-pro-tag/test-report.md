# F001 Voting-Zeitraum pro Session-Tag — Test Report (2026-10-18, Re-Run)

**Tester:** Claude (pctest)
**Build/Branch:** main @ 479f4c5 + uncommitted Changes (unverändert seit Lauf 2026-10-18_0935)
**Test-Backend:** agent-browser v0.27.0; T5 zusätzlich Playwright @playwright/test (aus `node_modules`), weil agent-browser beim synchronen `confirm()` blockiert
**App-Typ:** Web
**Umgebung:** PHP-Built-in-Server 127.0.0.1:8901, Docroot mit Symlinks auf `src/`, isolierter Content (Kopie von `seed/` plus Sonntag-Session 900), Sonntag 09:48–09:56 Europe/Berlin
**Roles tested:** Admin, anonymer Besucher
**Result:** ✅ 7/7 bestanden | ⚠ 0 Warnings | ❌ 0 Failures

## Summary

Re-Run mit Fokus auf die Lücke aus dem ersten Lauf: T5 läuft jetzt über den echten Admin-Button samt `confirm()`-Dialog, beide Zweige geprüft. Alle übrigen Fälle bestätigt. Keine Produktbefunde, kein Code geändert.

## Test-Matrix

| ID | Titel | Rolle | Verdict | Notizen |
|----|-------|-------|---------|---------|
| T1 | Zeitraum-Felder im Admin sichtbar | Admin | ✅ | samstag 16:00/17:45, sonntag 14:00/15:30 vorbefüllt, Hinweis je Tag vorhanden |
| T2 | Gültiger Zeitraum → Voting sichtbar + abstimmbar | Admin, Besucher | ✅ | 08:30–10:30 in `event.json`; "Session Voting Sonntag"; echter Klick → POST vote.php 200, "Bewertung gespeichert!" |
| T3 | Zukünftiger Zeitraum → kein Voting | Admin, Besucher | ✅ | 12:00–13:00: `#voting-section` none; nach Admin-Reload 12:00/13:00 in den Feldern |
| T4 | Kein Zeitraum → ganztägig | Admin, Besucher | ✅ | `event.json` sonntag ohne Zeiten; Formular mit 2 Optionen, Log "Voting active for: Sonntag (00:00-23:59)" |
| T5a | Deaktivieren → Dialog abbrechen | Admin, Besucher | ✅ | Dialog "Voting wirklich deaktivieren?"; Status bleibt `active`; Sessionplan zeigt Voting |
| T5b | Deaktivieren → Dialog bestätigen | Admin, Besucher | ✅ | Status `inactive`; Sessionplan ohne Voting |
| T5c | Aktivieren → Dialog bestätigen | Admin, Besucher | ✅ | Dialog "Voting jetzt aktivieren?"; Status `active`; Sessionplan zeigt Voting wieder |
| T6 | Fehleingaben | Admin | ✅ | Nur Von → "bitte Von und Bis angeben…"; 18:00/10:00 → "Von muss vor Bis liegen."; `event.json` unverändert |
| T7 | Cross-Feature-Smoke | Besucher | ✅ | Tage Sonntag/Samstag gerendert, Samstag-Sessions und -Zeitraum unverändert |

T5 lief zweimal. Im ersten Durchgang war der Sonntag-Zeitraum aus dem Seed (14:00–15:30) aktiv, das Voting deshalb auch bei aktivem Status zu Recht ausgeblendet. Für den gewerteten Durchgang wurde der Sonntag-Zeitraum im Test-Content entfernt, damit nur der Status den Ausschlag gibt.

## Befunde

Keine Produktbefunde.

Testtreiber-Artefakt (kein Produktfehler): Nach dem Laden scrollt der Sessionplan per Auto-Open zum aktuellen Slot (`scrollY` 440). Der Voting-Button liegt dann unter dem fixierten Header, und `agent-browser click` trifft den Header (`elementFromPoint` → `bar container`). Nach `scrollIntoView({block:'center'})` klappt der Klick. Ein Nutzer klickt auf den sichtbaren Button.

## Cross-Feature Smoke

- Sessionplan-Rendering: ✅ unverändert
- Sessions-Editor speichern: ✅ Sessions-Daten, Vote-Zähler und Samstag-Zeitraum bleiben erhalten
- Playwright `tests/voting.spec.js`: 21 grün, 4 rot. Drei nginx-abhängige Fälle (votes.json-Sperre, Redirects) und "Voting-Hint", weil Sonntag im Test-Content ganztägig offen ist. Identisch zum ersten Lauf, nicht durch F001 verursacht.

## Console / Network Anomalies

- Console: 0 Errors (agent-browser `errors --json` leer, Playwright `pageerror` leer)
- Network: change-status.php 200 (2×), status.php 200, vote.php 200

## Screenshots

- `T5b-admin-voting-inaktiv.png` (Admin-Voting-Tab nach Deaktivieren)
- Vorher/Nachher-Paar unverändert aus Lauf 2026-10-18_0935, siehe `../../before-after.md`

## Nachtrag 2026-10-19: Übertragen bei aktivem Voting

Playwright gegen PHP-Testserver, Montag 09:22, Test-Content mit Samstag-Stimmen (Session 10: 3, Session 20: 1) und offenem Tag "montag".

| ID | Titel | Verdict | Notizen |
|----|-------|---------|---------|
| T8a | Button bei Status aktiv | ✅ | Buttons: Deaktivieren, Beenden, Votes in sessions.json übertragen, Ergebnisse anzeigen; Anleitungstext sichtbar |
| T8b | Übertragen, erster Dialog abgebrochen | ✅ | `sessions.json` unverändert (10:0, 20:0), Status aktiv |
| T8c | Übertragen, beide Dialoge bestätigt | ✅ | "Erfolgreich! 2 Votes übertragen."; `sessions.json` 10:3, 20:1; Status bleibt aktiv |
| T8d | Nächster Tag nach Übertragen | ✅ | Montag-Vote → vote.php 200; Samstag zeigt 🥇/🥈 an Session 10/20 |

Beobachtung außerhalb des Scopes: Die Medaillen-Logik im Sessionplan vergibt 🥉 auch an eine Session mit 0 Stimmen, sobald weniger als drei Sessions eines Tages Stimmen haben.

Screenshot: `screenshots/admin-voting-aktiv-uebertragen-AFTER.png`

## Naechste Schritte

- [ ] User-Sign-off, danach Commit über `/pccommit`
