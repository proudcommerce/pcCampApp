# Frontend Tests

Dieses Verzeichnis enthält alle Frontend-Tests für die Event-App, implementiert mit [Playwright](https://playwright.dev/).

## Übersicht

Die Test-Suite umfasst drei Hauptkategorien:

### 1. Translation Tests (`translations.spec.js`)

Testet die Vollständigkeit und Konsistenz des Übersetzungssystems:

- **JSON-Validierung**: Prüft ob de.json und en.json gültiges JSON sind
- **Key-Konsistenz**: Stellt sicher, dass beide Sprachen die gleichen Keys haben
- **Vollständigkeit**: Prüft ob alle deutschen Übersetzungen englische Pendants haben (und umgekehrt)
- **Leere Strings**: Findet leere Übersetzungs-Strings
- **Kritische Keys**: Validiert das Vorhandensein essentieller Translation-Keys
- **Runtime-Tests**: Testet die `t()` Funktion und `data-i18n` Attribute
- **Seiten-Coverage**: Prüft ob alle Seiten korrekt übersetzt sind

**Typische Fehler die erkannt werden:**
- Fehlende Übersetzungen in en.json
- Leere Strings in Translation-Dateien
- Keys die nicht auf allen Seiten übersetzt werden
- Falsche Key-Pfade in `data-i18n` Attributen

### 2. PWA Tests (`pwa.spec.js`)

Testet Progressive Web App Funktionalität:

- **Manifest**: Validiert manifest.json und alle Icon-Größen
- **Service Worker**: Prüft Registrierung und Aktivierung
- **Offline-Modus**: Testet App-Verfügbarkeit ohne Netzwerk
- **Cache-Busting**: Validiert gehashte Dateinamen (CSS, JS, JSON)
- **Installation**: Prüft PWA-Meta-Tags und Apple-Touch-Icons

**Typische Fehler die erkannt werden:**
- Fehlende oder falsche Manifest-Einträge
- Service Worker wird nicht registriert
- Assets werden offline nicht geladen
- Cache-Busting funktioniert nicht (fehlende Hashes)

### 3. UI/UX Tests (`ui.spec.js`)

Testet Benutzeroberfläche und Interaktionen:

- **Navigation**: Header, Menu-Button, Logo-Links
- **Seiten-Funktionalität**: Sessionplan, Timetable, Food, Sponsors
- **Responsive Design**: Mobile und Desktop Layouts
- **Accessibility**: ARIA-Labels, Fokus-Management, Alt-Texte
- **Performance**: Ladezeiten, Render-Blocking
- **Error Handling**: 404-Seiten, JavaScript-Fehler

**Typische Fehler die erkannt werden:**
- Buttons funktionieren nicht
- Mobile Navigation ist kaputt
- Fehlende ARIA-Labels
- Seiten laden zu langsam
- JavaScript-Fehler in der Konsole

## Installation

```bash
# Dependencies installieren (inkl. Playwright Browser)
make install

# Oder direkt:
npm install
npx playwright install
```

## Tests ausführen

### Alle Tests

```bash
# Alle Tests ausführen (headless)
make test

# Oder direkt:
npm test
```

### Einzelne Test-Suiten

```bash
# Nur Übersetzungs-Tests
make test-translations

# Nur PWA-Tests
make test-pwa

# Nur UI/UX-Tests
make test-ui
```

### Mit Browser-Anzeige

```bash
# Tests mit sichtbarem Browser
make test-headed

# Oder direkt:
npm run test:headed
```

### Interaktiver Modus

```bash
# Playwright UI (empfohlen für Entwicklung)
npm run test:ui
```

## Test-Reports

Nach Testausführung wird automatisch ein HTML-Report generiert:

```bash
# Report öffnen
make test-report

# Oder direkt:
npm run test:report
```

Der Report zeigt:
- Alle fehlgeschlagenen Tests mit Screenshots
- Detaillierte Fehlermeldungen
- Test-Laufzeiten
- Browser-Logs und Traces

## Entwicklung

### Neuen Test hinzufügen

1. Erstelle neue `.spec.js` Datei in `tests/`:
   ```javascript
   import { test, expect } from '@playwright/test';

   test.describe('Meine Feature-Tests', () => {
     test('sollte Feature X testen', async ({ page }) => {
       await page.goto('/');
       // Test-Logik hier
     });
   });
   ```

2. Test ausführen:
   ```bash
   npx playwright test tests/mein-test.spec.js
   ```

### Debugging

```bash
# Test im Debug-Modus
npx playwright test --debug

# Test pausieren mit:
await page.pause();

# Screenshots erstellen
await page.screenshot({ path: 'debug.png' });
```

### Best Practices

1. **Selektoren**: Verwende semantische Selektoren
   ```javascript
   // Gut
   page.locator('[aria-label="News"]')
   page.locator('button:has-text("Submit")')

   // Schlecht
   page.locator('.btn-123')
   ```

2. **Waits**: Verwende explizite Waits
   ```javascript
   // Gut
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible();

   // Schlecht
   await page.waitForTimeout(5000);
   ```

3. **Assertions**: Verwende beschreibende Fehlermeldungen
   ```javascript
   expect(translation, 'Übersetzung sollte nicht leer sein').not.toBe('');
   ```

## CI/CD Integration

Die Tests laufen automatisch in der GitLab CI/CD Pipeline:

```yaml
# .gitlab-ci.yml
test:
  stage: test
  script:
    - npm install
    - npx playwright install --with-deps
    - npm test
```

## Häufige Probleme

### "baseURL not reachable"

```bash
# Starte Dev-Server vor Tests:
make dev-up

# In separatem Terminal:
make test
```

### "Browser not installed"

```bash
# Installiere Playwright Browser:
npx playwright install
```

### Tests timeout

Erhöhe Timeout in `playwright.config.js`:
```javascript
timeout: 60 * 1000, // 60 Sekunden
```

### Screenshots nicht erstellt

Tests erstellen nur bei Fehlern Screenshots. Forciere Screenshots mit:
```javascript
screenshot: 'on', // In playwright.config.js
```

## Struktur

```
tests/
├── README.md                 # Diese Datei
├── translations.spec.js      # Übersetzungs-Tests
├── pwa.spec.js              # PWA-Funktionalität
└── ui.spec.js               # UI/UX Tests

playwright-report/           # HTML-Reports (gitignored)
test-results/               # Test-Artefakte (gitignored)
playwright.config.js        # Playwright-Konfiguration
```

## Ressourcen

- [Playwright Dokumentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Fragen?

Bei Problemen oder Fragen:
1. Prüfe die [Playwright Docs](https://playwright.dev/)
2. Schaue in bestehende Tests für Beispiele
3. Öffne ein Issue im GitLab
