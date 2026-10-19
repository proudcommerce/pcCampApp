---
id: F001
title: Voting-Zeitraum pro Session-Tag
slug: voting-zeitraum-pro-tag
created: 2026-10-18
origin: auto
status: done
assignee: Tobias Merkl
tags: [voting, admin, sessionplan]
---

# F001 - Voting-Zeitraum pro Session-Tag

## Status: ✅ Done

## Zusammenfassung
Im Admin lässt sich an jedem Session-Tag ein Zeitraum (von/bis) hinterlegen, in dem das Voting für diesen Tag offen ist. Ohne Zeitraum ist das Voting am jeweiligen Tag ganztägig offen. Voraussetzung bleibt, dass das Voting im Admin-Bereich "Voting" aktiviert ist.

## Umsetzung
- 2026-10-18 (Tobias Merkl): Zeitraum-Felder je Tag im Sessions-Editor, Speicherung weiter in `event.json` → `features.votingSchedule` (startTime/endTime jetzt optional) — bestehende Quelle für vote.php, results.php und Sessionplan, kein zweiter Speicherort. "Ohne Zeitraum" bedeutet ganzer Tag am passenden Wochentag (Entscheidung User). vote.php prüft Tag und Zeitfenster jetzt serverseitig in der Event-Zeitzone; vorher war das Zeitfenster nur eine Anzeige-Regel im Client.
- 2026-10-19 (Tobias Merkl): Votes-Übertragen auch bei aktivem Voting erlaubt, Button im Voting-Tab bei Status aktiv, Anleitung in README und Voting-Tab — bisher erzwang die Übertragung der Tagesergebnisse Beenden → Zurücksetzen → Aktivieren vor dem nächsten Tag.

## Dokumente
| Phase | Dokument | Status |
|-------|----------|--------|
| Discovery | [brainstorm.md](./brainstorm.md) | ⬜ |
| Requirements | [requirements.md](./requirements.md) | ⬜ |
| Planning | [planning.md](./planning.md) | ⬜ |
| Implementation | - | ✅ |
| Testing | [testing.md](./testing.md) | ✅ |
| Codex-Review | [codex-review.md](./codex-review.md) | ✅ |
| Testplan | [testplan.md](./testplan.md) | ✅ |
| Test-Report | [test-report.md](./test-report.md) | ✅ pctest passed (2026-10-18) |
| Testing (Vorher/Nachher) | [before-after.md](./before-after.md) | ✅ |
