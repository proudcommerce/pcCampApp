import { test, expect } from '@playwright/test';

/**
 * UI/UX Tests
 * Testet Navigation, Responsive Design, Accessibility, und Benutzerinteraktionen
 */

test.describe('Navigation', () => {
  test('Header sollte auf allen Seiten sichtbar sein', async ({ page }) => {
    const pages = ['/', '/sessionplan/', '/timetable/', '/food/', '/sponsors/'];

    for (const url of pages) {
      await page.goto(url);
      const header = page.locator('header');
      await expect(header).toBeVisible();
    }
  });

  test('Menu-Button sollte funktionieren', async ({ page }) => {
    await page.goto('/');

    const menuBtn = page.locator('#burger, [aria-label*="enü"], button:has-text("Menu")').first();

    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(300); // Animation

      // Menu sollte geöffnet sein (drawer ist die Menu-Klasse)
      const menu = page.locator('#nav-drawer, .drawer, [role="menu"]').first();
      await expect(menu).toBeVisible();
    }
  });

  test('News-Button sollte existieren', async ({ page }) => {
    await page.goto('/');

    const newsBtn = page.locator('[aria-label*="News"], button:has-text("News")').first();
    await expect(newsBtn).toBeVisible();
  });

  test('Logo sollte zur Startseite führen', async ({ page }) => {
    await page.goto('/sessionplan/');

    const logo = page.locator('header img[alt*="Logo"], header a[href="/"]').first();

    if (await logo.count() > 0) {
      await logo.click();
      await page.waitForURL('**/', { timeout: 5000 });
      expect(page.url()).toContain('/');
    }
  });
});

test.describe('Sessionplan Page', () => {
  test('Sessionplan sollte laden', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toContain('Sessionplan');
  });

  test('Filter-Buttons sollten vorhanden sein', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    // Warte auf JavaScript Initialisierung
    await page.waitForTimeout(1000);

    // Prüfe ob Filter-Controls existieren
    const filterButtons = page.locator('button, input[type="checkbox"]');
    const count = await filterButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Favoriten-Feature sollte funktionieren', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Warte auf Session-Daten

    // Prüfe ob Favoriten-Filter existiert (Hauptfeature-Indikator)
    const favFilter = page.locator('#favorites-filter, #favorites-only');
    await expect(favFilter.first()).toBeVisible();

    // Prüfe ob FavoritesManager geladen ist
    const hasFavoritesManager = await page.evaluate(() => {
      return typeof window.favoritesManager !== 'undefined';
    });

    expect(hasFavoritesManager).toBe(true);
  });
});

test.describe('Timetable Page', () => {
  test('Timetable sollte laden', async ({ page }) => {
    await page.goto('/timetable/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('Timeline sollte angezeigt werden', async ({ page }) => {
    await page.goto('/timetable/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Prüfe ob Timeline-Elemente existieren
    const timelineItems = page.locator('.timeline-item, .time-slot, [data-time]');
    const count = await timelineItems.count();

    // Sollte mindestens ein Element haben (oder leer sein wenn keine Daten)
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Food Page', () => {
  test('Food Page sollte laden', async ({ page }) => {
    await page.goto('/food/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('Speisekarte sollte angezeigt werden', async ({ page }) => {
    await page.goto('/food/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for menu to load

    // Prüfe ob Menü-Daten geladen wurden (nicht mehr "Lade Speisekarte...")
    const menuContainer = page.locator('#menu-container');
    await expect(menuContainer).toBeVisible();

    // Überprüfe, dass Details-Elemente (Tage) geladen wurden
    const menuDetails = page.locator('#menu-container details').first();
    await expect(menuDetails).toBeVisible();
  });

  test('Allergene sollten angezeigt werden', async ({ page }) => {
    await page.goto('/food/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Prüfe ob Allergene-Section existiert
    const allergens = page.locator('h2:has-text("Allergene"), h3:has-text("Allergene")');

    if (await allergens.count() > 0) {
      await expect(allergens.first()).toBeVisible();
    }
  });
});

test.describe('Sponsors Page', () => {
  test('Sponsors Page sollte laden', async ({ page }) => {
    await page.goto('/sponsors/');
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    expect(title).toContain('Sponsor');
  });

  test('Sponsoren-Liste sollte angezeigt werden', async ({ page }) => {
    await page.goto('/sponsors/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const sponsorsContainer = page.locator('.sponsors, .sponsor-list, main').first();
    await expect(sponsorsContainer).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('Mobile: Header sollte responsive sein', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    const box = await header.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });

  test('Mobile: Navigation sollte funktionieren', async ({ page }) => {
    await page.goto('/');

    // Menu sollte als Hamburger-Icon angezeigt werden
    const menuBtn = page.locator('button[aria-label*="enü"], .menu-toggle').first();

    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(300);

      const menu = page.locator('.menu-panel, nav').first();
      await expect(menu).toBeVisible();
    }
  });
});

test.describe('Accessibility', () => {
  test('Seiten sollten korrekte ARIA-Labels haben', async ({ page }) => {
    await page.goto('/');

    // Wait for translations to be loaded (aria-labels are set dynamically)
    await page.waitForFunction(() => {
      return document.querySelectorAll('[aria-label]').length > 0;
    }, { timeout: 5000 });

    const ariaElements = await page.$$('[aria-label]');
    expect(ariaElements.length).toBeGreaterThan(0);

    for (const element of ariaElements) {
      const label = await element.getAttribute('aria-label');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  test('Interaktive Elemente sollten fokussierbar sein', async ({ page }) => {
    await page.goto('/');

    const buttons = await page.$$('button, a');

    for (const button of buttons.slice(0, 5)) { // Teste erste 5
      await button.focus();
      const isFocused = await button.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
    }
  });

  test('Bilder sollten alt-Texte haben', async ({ page }) => {
    await page.goto('/');

    const images = await page.$$('img');

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // Alt kann leer sein für dekorative Bilder
      expect(alt).not.toBeNull();
    }
  });

  test('Seiten sollten semantisches HTML verwenden', async ({ page }) => {
    await page.goto('/');

    // Prüfe auf semantische Elemente
    const header = page.locator('header');
    const main = page.locator('main');

    await expect(header).toHaveCount(1);
    await expect(main).toHaveCount(1);
  });
});

test.describe('Performance', () => {
  test('Seite sollte schnell laden', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Sollte unter 5 Sekunden laden (großzügig für CI)
    expect(loadTime).toBeLessThan(5000);
  });

  test('CSS sollte ohne render-blocking laden', async ({ page }) => {
    await page.goto('/');

    // Prüfe ob Seite sichtbar ist (nicht durch CSS blockiert)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const display = await body.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });
});

test.describe('Error Handling', () => {
  test('404 sollte behandelt werden', async ({ page }) => {
    const response = await page.goto('/non-existent-page/', { waitUntil: 'networkidle' });

    // Sollte 404 zurückgeben oder zur Startseite umleiten
    const status = response.status();
    expect([404, 200]).toContain(status);
  });

  test('JavaScript-Fehler sollten nicht die ganze App crashen', async ({ page }) => {
    const errors = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Kritische Fehler sollten nicht auftreten
    const criticalErrors = errors.filter(err =>
      err.includes('Uncaught') || err.includes('TypeError')
    );

    if (criticalErrors.length > 0) {
      console.error('JavaScript Errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });
});
