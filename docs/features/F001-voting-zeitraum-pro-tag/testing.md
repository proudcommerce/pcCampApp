# F001 - Testanleitung Voting-Zeitraum pro Session-Tag

## Vorbereitung

- App läuft lokal, Admin-Login mit dem `VOTING_ADMIN_KEY` aus `.env` möglich.
- In `sessions.json` gibt es einen Tag, dessen Name dem heutigen Wochentag entspricht (z. B. heute Sonntag → Tag "sonntag" mit mindestens einer Session).
- Admin → Tab "Voting" → Status "Voting aktiv".

## Tests

### 1. Zeitraum-Felder im Admin sichtbar
1. Admin → Tab "Sessions" öffnen.
2. Den Tag-Tab "Sonntag" wählen.

**Oberhalb der Zeitslots steht der Block "Voting-Zeitraum" mit den Feldern "Von" und "Bis" sowie dem Hinweis, dass leer den ganzen Tag bedeutet.**

### 2. Zeitraum speichern, der jetzt gilt
1. Bei "Sonntag" Von = eine Stunde vor jetzt, Bis = eine Stunde nach jetzt eintragen.
2. "Speichern" klicken.
3. Sessionplan in neuem Tab öffnen.

**Meldung "Sessions gespeichert". Im Sessionplan erscheint der Block "Voting Sonntag" mit Auswahlliste. Abstimmen klappt.**

### 3. Zeitraum, der jetzt nicht gilt
1. Im Admin bei "Sonntag" Von/Bis auf einen Zeitraum in der Zukunft setzen, speichern.
2. Sessionplan neu laden.

**Kein Voting-Block im Sessionplan. Nach Tab "Sessions" erneut öffnen stehen die gespeicherten Zeiten noch in den Feldern.**

### 4. Kein Zeitraum = ganzer Tag
1. Im Admin beide Felder bei "Sonntag" leeren, speichern.
2. Sessionplan neu laden.

**Voting-Block erscheint, unabhängig von der Uhrzeit.**

### 5. Voting im Bereich "Voting" deaktiviert
1. Admin → Tab "Voting" → "Deaktivieren".
2. Sessionplan neu laden.

**Kein Voting-Block, auch ohne Zeitraum.**

### 6. Fehleingaben
1. Bei "Sonntag" nur "Von" ausfüllen, speichern.
2. Von = 18:00, Bis = 10:00, speichern.

**Jeweils Fehlermeldung ("Von und Bis angeben oder beide leer lassen" bzw. "Von muss vor Bis liegen"), nichts wird gespeichert.**

## Checkliste

- [ ] 1 Zeitraum-Felder sichtbar
- [ ] 2 Zeitraum aktiv → Voting sichtbar und Abstimmen möglich
- [ ] 3 Zeitraum nicht aktiv → kein Voting, Werte bleiben gespeichert
- [ ] 4 Ohne Zeitraum → Voting ganztägig
- [ ] 5 Status inaktiv → kein Voting
- [ ] 6 Fehleingaben abgefangen

## Abdeckungsmatrix

| Akzeptanzkriterium / Bedienweg | Nachweis | Geprüfte Wirkung | Offene Grenze |
|---|---|---|---|
| Zeitraum je Tag im Admin einstellbar | manuell Test 1–3, `/pctest` | Felder sichtbar, Speichern schreibt `event.json` → `features.votingSchedule` | – |
| Zeitfenster gilt serverseitig (Grenzen inkl.) | PHP-CLI-Test `isVotingWindowOpen()` (11 Fälle, Scratchpad-Skript), curl gegen `vote.php`: 403 außerhalb des Fensters | Stimmen außerhalb werden abgelehnt | Skript nicht im Repo, das Projekt hat keine PHP-Unit-Suite |
| Ohne Zeitraum ganztägig | PHP-CLI-Test (00:00 und 23:59), curl: 200 | Stimme am passenden Wochentag angenommen | – |
| Falscher Wochentag | PHP-CLI-Test, curl `samstag` am Sonntag: 403 | abgelehnt | – |
| Voraussetzung Status aktiv | curl: inaktiv → 403, Statusdatei fehlt → 403 | abgelehnt | – |
| `event.json` unlesbar | curl: 503 | Fenster öffnet nicht | – |
| Validierung Von/Bis | `validateResourcePayload()` per PHP-CLI (nur eins / Von ≥ Bis abgelehnt), Admin-Validierung Test 6 | ungültige Zeiträume werden nicht gespeichert | – |
| Schema `votingSchedule` | `tests/voting.spec.js` "votingSchedule-Eintraege haben einen Tag und optional ein vollstaendiges Zeitfenster" | Paarigkeit und Format | – |
