---
id: F002
title: PWA-Manifest serverseitig ausliefern
slug: pwa-manifest-serverseitig
created: 2026-10-19
origin: auto
status: done
assignee: Tobias Merkl
tags: [pwa, manifest, android]
---

# F002 - PWA-Manifest serverseitig ausliefern

## Status: ✅ Done

## Zusammenfassung
`/manifest.json` wird zur Laufzeit per PHP aus `content/event.json` erzeugt. Bisher ersetzte `event-config-loader.js` den Manifest-Link nach dem Laden durch eine `blob:`-URL. Gegen diese Basis-URL kann Chrome `start_url` und `scope` nicht auflösen, und die Android-WebAPK kann ihr Manifest später nicht neu abrufen.

## Umsetzung
- 2026-10-19 (Tobias Merkl): `src/manifest.php` erzeugt das Manifest aus `event.json`, nginx (Dev und Prod) leitet `/manifest.json` dorthin. Blob-Tausch in `event-config-loader.js` und die Build-Zeit-Generierung in `build-cache-busting.cjs` entfernt. Die URL bleibt `/manifest.json`, damit bestehende Links und Tests gültig bleiben. Anlass: Installierte PWA auf Android-Smartphones zeigt die Desktop-Ansicht, im Browser-Tab nicht.

## Dokumente
| Phase | Dokument | Status |
|-------|----------|--------|
| Discovery | [brainstorm.md](./brainstorm.md) | ⬜ |
| Requirements | [requirements.md](./requirements.md) | ⬜ |
| Planning | [planning.md](./planning.md) | ⬜ |
| Implementation | - | ✅ |
| Testing | [testing.md](./testing.md) | ✅ |
| Codex-Review | [codex-review.md](./codex-review.md) | ✅ approved, 1 Runde |
| Testplan | [testplan.md](./testplan.md) | ✅ |
| Test-Report | [test-report.md](./test-report.md) | ✅ pctest passed (2026-10-19) |
