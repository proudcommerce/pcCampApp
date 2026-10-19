---
status: passed
date: 2026-10-18
reviewer: codex
self_review: false
rounds: 3
stop_reason: approved
---

# Codex-Review F001 — Voting-Zeitraum pro Session-Tag

## Scope

Uncommitted Changes im Hauptrepo (`git diff HEAD`), ohne `docs/`.

## Findings

Letzte Runde (3): keine Findings, `VERDICT: APPROVED`.

Behoben in Runde 1:
- Hoch: Fehlende `voting-state.json` übersprang die Statusprüfung in `src/votes/vote.php`. Jetzt 403, der Sessionplan blendet das Formular aus.
- Hoch: Reihenfolge Schedule/Sessions beim Speichern konnte einen Tag ohne Zeitraum hinterlassen (`src/admin/admin.js`).
- Mittel: Unterschiedlicher Zeitzonen-Fallback in Client (Browser) und Server (PHP-Default). Jetzt beidseitig `Europe/Berlin` (Schema-Default).

Behoben in Runde 2:
- Hoch: Neue Tage waren bei gescheitertem Schedule-Update ganztägig offen. Der Schedule wird jetzt vor den Sessions gespeichert und entfernt keine Einträge gelöschter Tage mehr.
- Hoch: Eine unlesbare `event.json` öffnete das Zeitfenster. `loadEventConfig()` liest jetzt mit `LOCK_SH` und liefert bei Fehlern `null`, `vote.php` antwortet dann mit 503.
- Mittel: `dependentRequired` ist kein Draft-07-Schlüsselwort, ersetzt durch `dependencies` in `event.schema.json`.

## Kurzfazit

Drei Runden, fünf Hoch- und zwei Mittel-Findings behoben. Die Fixes betreffen vor allem den Grundsatz, bei Fehlern oder fehlenden Daten geschlossen zu bleiben. Eine Transaktion über `sessions.json` und `event.json` gibt es bewusst nicht. Die Speicherreihenfolge sorgt dafür, dass kein Tag ungewollt ganztägig offen ist.
