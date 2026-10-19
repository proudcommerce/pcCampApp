# F001 - Testplan

Basis: http://127.0.0.1:8901 (PHP-Testserver, isolierter Content). Heute = Sonntag. Rolle: Admin (Key aus Testumgebung) + anonymer Besucher.
Alle Cases `Parallel: nein`: Sie teilen `event.json` und `voting-state.json`.

T1: Zeitraum-Felder im Admin sichtbar
  Pre: Admin-Login
  Parallel: nein
  Steps: /admin/ → Tab Sessions → Tag-Tab "Sonntag"
  Expect: Block "Voting-Zeitraum" mit zwei time-Inputs (Von/Bis) und Hinweis; vorhandene Werte aus event.json (sonntag 14:00/15:30) vorbefüllt

T2: Aktuell gültiger Zeitraum → Voting sichtbar + abstimmbar
  Parallel: nein
  Steps: Sonntag Von = jetzt-1h, Bis = jetzt+1h, Speichern; /sessionplan/ laden; Session wählen, abstimmen
  Expect: Meldung gespeichert; event.json sonntag.startTime/endTime gesetzt; #voting-section sichtbar mit Titel Sonntag; Vote → Erfolgsmeldung; Console ohne Errors

T3: Zukünftiger Zeitraum → kein Voting, Werte persistiert
  Parallel: nein
  Steps: Sonntag Von/Bis = jetzt+2h/jetzt+3h, Speichern; /sessionplan/ laden; Admin Sessions-Tab neu laden
  Expect: #voting-section display none; Inputs zeigen die gespeicherten Zeiten

T4: Kein Zeitraum → ganztägig
  Parallel: nein
  Steps: beide Felder leeren, Speichern; /sessionplan/ laden
  Expect: event.json sonntag ohne startTime/endTime; #voting-section sichtbar

T5: Status über Admin-Button → Voting im Sessionplan folgt
  Parallel: nein
  Backend: Playwright (page.on('dialog')), weil agent-browser beim synchronen confirm() im onclick blockiert
  Steps:
    a) Tab Voting → "Deaktivieren" → confirm ABBRECHEN → voting-state.json bleibt active, Sessionplan zeigt Voting
    b) "Deaktivieren" → confirm BESTÄTIGEN → voting-state.json inactive, Sessionplan ohne Voting
    c) "Aktivieren" → confirm bestätigen → active, Sessionplan zeigt Voting wieder
  Expect: Dialogtext je Aktion; Zustand ändert sich nur bei accept; #voting-section folgt dem Status

T6: Fehleingaben
  Parallel: nein
  Steps: nur Von ausfüllen → Speichern; Von 18:00 / Bis 10:00 → Speichern
  Expect: Fehlermeldung je Fall, event.json unverändert

T7: Cross-Feature-Smoke
  Parallel: nein
  Steps: /sessionplan/ lädt beide Tage; Admin-Sessions speichern ändert sessions.json-Inhalt nicht (Session-Titel unverändert)
  Expect: Tage samstag/sonntag gerendert, keine Console-Errors
