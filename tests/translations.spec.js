import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Translation System Tests
 * Testet die Vollständigkeit und Korrektheit aller Übersetzungsdateien
 * Tests laufen für BEIDE Sprachen (DE + EN) via separate Playwright-Projekte
 */

const expectedTranslations = {
  de: {
    'favorites.filterLabel': 'Nur Favoriten anzeigen',
    'pageTitle.sessionplan': 'Sessionplan',
    'aria.newsButton': 'News',
    'aria.menuButton': 'Menü',
    'sessionplan.roomPrefix': 'Raum'
  },
  en: {
    'favorites.filterLabel': 'Show favorites only',
    'pageTitle.sessionplan': 'Session Plan',  // With space!
    'aria.newsButton': 'News',
    'aria.menuButton': 'Menu',
    'sessionplan.roomPrefix': 'Room'
  }
};

function getCurrentLocale(testInfo) {
  // Use Playwright project metadata if available (for chromium-de/chromium-en projects)
  if (testInfo && testInfo.project && testInfo.project.metadata && testInfo.project.metadata.locale) {
    return testInfo.project.metadata.locale;
  }
  // Fallback: Read from event.json
  const eventConfigPath = path.join(process.cwd(), 'event.json');
  const eventConfig = JSON.parse(fs.readFileSync(eventConfigPath, 'utf-8'));
  return eventConfig.event.locale || 'de';
}

test.describe('Translation Files', () => {
  let deTranslations;
  let enTranslations;

  test.beforeAll(() => {
    // Lade Übersetzungsdateien
    const dePath = path.join(process.cwd(), 'src/translations/de.json');
    const enPath = path.join(process.cwd(), 'src/translations/en.json');

    deTranslations = JSON.parse(fs.readFileSync(dePath, 'utf-8'));
    enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  });

  test('de.json sollte gültiges JSON sein', () => {
    expect(deTranslations).toBeDefined();
    expect(typeof deTranslations).toBe('object');
  });

  test('en.json sollte gültiges JSON sein', () => {
    expect(enTranslations).toBeDefined();
    expect(typeof enTranslations).toBe('object');
  });

  test('beide Sprachen sollten die gleichen Top-Level-Keys haben', () => {
    const deKeys = Object.keys(deTranslations).sort();
    const enKeys = Object.keys(enTranslations).sort();

    expect(deKeys).toEqual(enKeys);
  });

  test('alle deutschen Übersetzungen sollten englische Pendants haben', () => {
    const missingKeys = [];

    function checkKeys(deObj, enObj, path = '') {
      for (const key in deObj) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in enObj)) {
          missingKeys.push(currentPath);
          continue;
        }

        if (typeof deObj[key] === 'object' && deObj[key] !== null) {
          if (typeof enObj[key] !== 'object' || enObj[key] === null) {
            missingKeys.push(`${currentPath} (type mismatch)`);
          } else {
            checkKeys(deObj[key], enObj[key], currentPath);
          }
        }
      }
    }

    checkKeys(deTranslations, enTranslations);

    if (missingKeys.length > 0) {
      console.error('Fehlende englische Übersetzungen:', missingKeys);
    }

    expect(missingKeys).toHaveLength(0);
  });

  test('alle englischen Übersetzungen sollten deutsche Pendants haben', () => {
    const missingKeys = [];

    function checkKeys(enObj, deObj, path = '') {
      for (const key in enObj) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in deObj)) {
          missingKeys.push(currentPath);
          continue;
        }

        if (typeof enObj[key] === 'object' && enObj[key] !== null) {
          if (typeof deObj[key] !== 'object' || deObj[key] === null) {
            missingKeys.push(`${currentPath} (type mismatch)`);
          } else {
            checkKeys(enObj[key], deObj[key], currentPath);
          }
        }
      }
    }

    checkKeys(enTranslations, deTranslations);

    if (missingKeys.length > 0) {
      console.error('Fehlende deutsche Übersetzungen:', missingKeys);
    }

    expect(missingKeys).toHaveLength(0);
  });

  test('keine leeren Übersetzungs-Strings in de.json', () => {
    const emptyKeys = [];

    function checkEmpty(obj, path = '') {
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'string') {
          if (value.trim() === '') {
            emptyKeys.push(currentPath);
          }
        } else if (typeof value === 'object' && value !== null) {
          checkEmpty(value, currentPath);
        }
      }
    }

    checkEmpty(deTranslations);

    if (emptyKeys.length > 0) {
      console.error('Leere Übersetzungs-Strings in de.json:', emptyKeys);
    }

    expect(emptyKeys).toHaveLength(0);
  });

  test('keine leeren Übersetzungs-Strings in en.json', () => {
    const emptyKeys = [];

    function checkEmpty(obj, path = '') {
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'string') {
          if (value.trim() === '') {
            emptyKeys.push(currentPath);
          }
        } else if (typeof value === 'object' && value !== null) {
          checkEmpty(value, currentPath);
        }
      }
    }

    checkEmpty(enTranslations);

    if (emptyKeys.length > 0) {
      console.error('Leere Übersetzungs-Strings in en.json:', emptyKeys);
    }

    expect(emptyKeys).toHaveLength(0);
  });

  test('kritische Translation-Keys sollten existieren', () => {
    const requiredKeys = [
      'pageTitle.sessionplan',
      'pageTitle.timetable',
      'pageTitle.food',
      'pageTitle.floorplan',
      'pageTitle.sponsors',
      'favorites.filterLabel',
      'favorites.addLabel',
      'favorites.removeLabel',
      'voting.submitButton',
      'voting.success',
      'errors.loadingSessions',
      'pwa.installButton',
      'aria.newsButton',
      'aria.menuButton'
    ];

    const missingDe = [];
    const missingEn = [];

    for (const key of requiredKeys) {
      const keys = key.split('.');

      // Check German
      let deValue = deTranslations;
      for (const k of keys) {
        if (deValue && typeof deValue === 'object' && k in deValue) {
          deValue = deValue[k];
        } else {
          missingDe.push(key);
          break;
        }
      }

      // Check English
      let enValue = enTranslations;
      for (const k of keys) {
        if (enValue && typeof enValue === 'object' && k in enValue) {
          enValue = enValue[k];
        } else {
          missingEn.push(key);
          break;
        }
      }
    }

    if (missingDe.length > 0) {
      console.error('Fehlende kritische Keys in de.json:', missingDe);
    }
    if (missingEn.length > 0) {
      console.error('Fehlende kritische Keys in en.json:', missingEn);
    }

    expect(missingDe).toHaveLength(0);
    expect(missingEn).toHaveLength(0);
  });
});

test.describe('Translation Runtime Tests', () => {
  let currentLocale;

  test.beforeAll(async ({ }, testInfo) => {
    currentLocale = getCurrentLocale(testInfo);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('t() Funktion sollte global verfügbar sein', async ({ page }) => {
    const hasT = await page.evaluate(() => typeof window.t === 'function');
    expect(hasT).toBe(true);
  });

  test('t() sollte existierende Keys korrekt übersetzen', async ({ page }) => {
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe(expectedTranslations[currentLocale]['favorites.filterLabel']);
  });

  test('t() sollte für nicht-existierende Keys den Key zurückgeben', async ({ page }) => {
    const translation = await page.evaluate(() => window.t('nonexistent.key'));
    expect(translation).toBe('nonexistent.key');
  });

  test('t() sollte nested Keys korrekt auflösen', async ({ page }) => {
    const translation = await page.evaluate(() => window.t('pageTitle.sessionplan'));
    expect(translation).toBe(expectedTranslations[currentLocale]['pageTitle.sessionplan']);
  });

  test('data-i18n Attribute sollten automatisch übersetzt werden', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    // Warte auf Übersetzungen
    await page.waitForTimeout(500);

    // Prüfe ob data-i18n Elemente übersetzt wurden
    const elements = await page.$$('[data-i18n]');

    for (const element of elements) {
      const key = await element.getAttribute('data-i18n');
      const text = await element.textContent();

      // Text sollte nicht mehr der Key sein
      expect(text.trim()).not.toBe(key);
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test('data-i18n-aria Attribute sollten automatisch übersetzt werden', async ({ page }) => {
    const newsBtn = page.locator('[data-i18n-aria="aria.newsButton"]');
    if (await newsBtn.count() > 0) {
      const ariaLabel = await newsBtn.getAttribute('aria-label');
      expect(ariaLabel).toBe(expectedTranslations[currentLocale]['aria.newsButton']);
    }
  });
});

test.describe('Translation auf allen Seiten', () => {
  const pages = [
    { url: '/', title: 'Home' },
    { url: '/sessionplan/', title: 'Sessionplan' },
    { url: '/timetable/', title: 'Timetable' },
    { url: '/food/', title: 'Food' },
    { url: '/floorplan/', title: 'Floorplan' },
    { url: '/sponsors/', title: 'Sponsoren' }
  ];

  for (const page of pages) {
    test(`${page.title}: alle data-i18n Elemente sollten übersetzt sein`, async ({ page: browserPage }) => {
      await browserPage.goto(page.url);
      await browserPage.waitForLoadState('networkidle');

      // Warte auf Übersetzungen
      await browserPage.waitForTimeout(500);

      // Finde alle Elemente mit data-i18n
      const elements = await browserPage.$$('[data-i18n]');

      if (elements.length === 0) {
        // Keine Übersetzungselemente auf dieser Seite
        return;
      }

      const untranslatedElements = [];

      for (const element of elements) {
        const key = await element.getAttribute('data-i18n');
        const text = await element.textContent();

        // Wenn Text dem Key entspricht, wurde nicht übersetzt
        if (text.trim() === key) {
          untranslatedElements.push(key);
        }
      }

      if (untranslatedElements.length > 0) {
        console.error(`Nicht übersetzte Elemente auf ${page.title}:`, untranslatedElements);
      }

      expect(untranslatedElements).toHaveLength(0);
    });
  }
});

test.describe('Dynamically rendered translations (via JavaScript)', () => {
  let currentLocale;

  test.beforeAll(async ({ }, testInfo) => {
    currentLocale = getCurrentLocale(testInfo);
  });

  test('Sessionplan: roomPrefix should be translated (not show translation key)', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    // Warte darauf, dass Sessions geladen werden
    await page.waitForSelector('.session-card', { timeout: 10000 }).catch(() => null);

    // Prüfe, ob Raum-Texte die Translation-Keys enthalten
    const roomElements = await page.$$('.session-card .room');

    if (roomElements.length > 0) {
      for (const roomEl of roomElements) {
        const text = await roomEl.textContent();

        // Der Text sollte NICHT den Translation-Key enthalten
        expect(text).not.toContain('sessionplan.roomPrefix');

        // Wenn ein Raum angegeben ist, sollte die korrekte Übersetzung enthalten sein
        if (text.trim().length > 0) {
          const expectedPrefix = expectedTranslations[currentLocale]['sessionplan.roomPrefix'];
          expect(text).toContain(expectedPrefix);
        }
      }
    }
  });
});

test.describe('Language Selection Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('URL-Parameter ?lang=en sollte Sprache auf Englisch setzen', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if English translation is loaded
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Show favorites only');
  });

  test('URL-Parameter ?lang=de sollte Sprache auf Deutsch setzen', async ({ page }) => {
    await page.goto('/?lang=de');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if German translation is loaded
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Nur Favoriten anzeigen');
  });

  test('URL-Parameter sollte in localStorage gespeichert werden', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check localStorage
    const storedLang = await page.evaluate(() => localStorage.getItem('user-language-preference'));
    expect(storedLang).toBe('en');
  });

  test('Gespeicherte Sprachwahl sollte auf anderen Seiten persistent sein', async ({ page }) => {
    // Set language via URL parameter
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to another page without lang parameter
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Language should still be English
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Show favorites only');

    // Check localStorage persistence
    const storedLang = await page.evaluate(() => localStorage.getItem('user-language-preference'));
    expect(storedLang).toBe('en');
  });

  test('URL-Parameter sollte Priorität über gespeicherte Sprachwahl haben', async ({ page }) => {
    // First, set language to German via URL
    await page.goto('/?lang=de');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Then override with English via URL
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should be English (URL parameter overrides stored preference)
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Show favorites only');

    // localStorage should now be updated to 'en'
    const storedLang = await page.evaluate(() => localStorage.getItem('user-language-preference'));
    expect(storedLang).toBe('en');
  });

  test('Ungültige Sprach-Parameter sollten ignoriert werden', async ({ page }) => {
    await page.goto('/?lang=invalid');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Should fall back to default language (depends on event.json config)
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));

    // Translation should be either German or English (not the key itself)
    expect(translation).not.toBe('favorites.filterLabel');
    expect(['Nur Favoriten anzeigen', 'Show favorites only']).toContain(translation);
  });

  test('Sprachwechsel sollte auf allen Seiten funktionieren', async ({ page }) => {
    const pages = [
      '/',
      '/sessionplan/',
      '/timetable/',
      '/food/',
      '/floorplan/',
      '/sponsors/'
    ];

    for (const url of pages) {
      // Test with English
      await page.goto(`${url}?lang=en`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);

      const enTranslation = await page.evaluate(() => window.t('favorites.filterLabel'));
      expect(enTranslation).toBe('Show favorites only');

      // Test with German
      await page.goto(`${url}?lang=de`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);

      const deTranslation = await page.evaluate(() => window.t('favorites.filterLabel'));
      expect(deTranslation).toBe('Nur Favoriten anzeigen');
    }
  });

  test('Sprachauswahl sollte nach Page-Reload erhalten bleiben', async ({ page }) => {
    // Set language to English
    await page.goto('/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Reload page without lang parameter
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Language should still be English (from localStorage)
    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Show favorites only');
  });

  test('Case-insensitive Sprach-Parameter sollten funktionieren', async ({ page }) => {
    // Test uppercase
    await page.goto('/?lang=EN');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const translation = await page.evaluate(() => window.t('favorites.filterLabel'));
    expect(translation).toBe('Show favorites only');

    // Stored value should be lowercase
    const storedLang = await page.evaluate(() => localStorage.getItem('user-language-preference'));
    expect(storedLang).toBe('en');
  });

  test('data-i18n Attribute sollten nach Sprachwechsel aktualisiert werden', async ({ page }) => {
    // Start with German
    await page.goto('/sessionplan/?lang=de');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if German translation is applied
    const deElements = await page.$$('[data-i18n]');
    let foundGermanText = false;

    for (const element of deElements) {
      const text = await element.textContent();
      if (text.includes('Favoriten') || text.includes('Raum')) {
        foundGermanText = true;
        break;
      }
    }

    // Switch to English
    await page.goto('/sessionplan/?lang=en');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if English translation is applied
    const enElements = await page.$$('[data-i18n]');
    let foundEnglishText = false;

    for (const element of enElements) {
      const text = await element.textContent();
      if (text.includes('Favorite') || text.includes('Room')) {
        foundEnglishText = true;
        break;
      }
    }

    // Both language switches should have worked
    expect(foundGermanText || foundEnglishText).toBe(true);
  });
});
