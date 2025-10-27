import { test, expect } from '@playwright/test';

/**
 * PWA (Progressive Web App) Tests
 * Testet Installation, Service Worker, Offline-Modus, und Manifest
 */

test.describe('PWA Manifest', () => {
  test('manifest.json sollte erreichbar sein', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response.status()).toBe(200);
  });

  test('manifest.json sollte gültig sein', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    const manifest = await response.json();

    // Kritische Manifest-Felder
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBeDefined();
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.background_color).toBeDefined();
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  test('manifest sollte alle erforderlichen Icon-Größen haben', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    const manifest = await response.json();

    const requiredSizes = ['144x144', '192x192', '512x512'];
    const iconSizes = manifest.icons.map(icon => icon.sizes);

    for (const size of requiredSizes) {
      expect(iconSizes).toContain(size);
    }
  });

  test('manifest icons sollten existieren', async ({ page }) => {
    const manifestResponse = await page.goto('/manifest.json');
    const manifest = await manifestResponse.json();

    for (const icon of manifest.icons) {
      const iconResponse = await page.goto(icon.src);
      expect(iconResponse.status()).toBe(200);
    }
  });
});

test.describe('Service Worker', () => {
  test('Service Worker sollte registriert werden', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Warte auf Service Worker Registrierung
    await page.waitForTimeout(2000);

    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });

    expect(swRegistered).toBe(true);
  });

  test('sw.js sollte erreichbar sein', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response.status()).toBe(200);
  });

  test('Service Worker sollte aktiviert werden', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Warte auf Aktivierung
    await page.waitForTimeout(2000);

    const swActive = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active !== null;
      }
      return false;
    });

    expect(swActive).toBe(true);
  });
});

test.describe('Offline-Funktionalität', () => {
  test('App sollte offline verfügbar sein', async ({ page, context }) => {
    // Erste Ladung (cached assets)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Warte auf Service Worker Cache

    // Gehe offline
    await context.setOffline(true);

    // Reload im Offline-Modus
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Prüfe ob Seite geladen wurde
    const title = await page.title();
    expect(title).toBeTruthy();

    // Prüfe ob grundlegende Elemente vorhanden sind
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Wieder online
    await context.setOffline(false);
  });

  test('CSS sollte offline geladen werden', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.reload();

    // Prüfe ob Styles angewendet wurden
    const header = page.locator('header');
    const backgroundColor = await header.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    // Sollte nicht transparent sein (default)
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

    await context.setOffline(false);
  });
});

test.describe('PWA Installation', () => {
  test('viewport meta tag sollte korrekt gesetzt sein', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
  });

  test('theme-color meta tag sollte gesetzt sein', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveCount(1);

    const color = await themeColor.getAttribute('content');
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('apple-touch-icon sollte definiert sein', async ({ page }) => {
    await page.goto('/');

    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveCount(1);
  });

  test('manifest link sollte im HTML sein', async ({ page }) => {
    await page.goto('/');

    const manifestLink = await page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);

    const href = await manifestLink.getAttribute('href');
    expect(href).toContain('manifest.json');
  });
});

test.describe('Cache-Busting', () => {
  test('CSS Dateien sollten Hashes haben', async ({ page }) => {
    await page.goto('/');

    const cssLinks = await page.$$('link[rel="stylesheet"]');
    expect(cssLinks.length).toBeGreaterThan(0);

    for (const link of cssLinks) {
      const href = await link.getAttribute('href');

      // Prüfe ob Hash im Dateinamen (z.B. app.abc123.css)
      const hasHash = /\.[a-f0-9]{8}\.css/.test(href);
      expect(hasHash).toBe(true);
    }
  });

  test('JavaScript Dateien sollten Hashes haben', async ({ page }) => {
    await page.goto('/');

    const scriptTags = await page.$$('script[src]');

    for (const script of scriptTags) {
      const src = await script.getAttribute('src');

      // Ignoriere externe Scripts
      if (src.startsWith('http')) continue;

      // Prüfe ob Hash im Dateinamen (z.B. header.xyz789.js)
      const hasHash = /\.[a-f0-9]{8}\.js/.test(src);
      expect(hasHash).toBe(true);
    }
  });

  test('JSON Dateien sollten über gehashte URLs geladen werden', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fange alle Netzwerk-Requests ab
    const jsonRequests = [];

    page.on('request', request => {
      if (request.url().endsWith('.json') && !request.url().includes('event.json')) {
        jsonRequests.push(request.url());
      }
    });

    // Trigger JSON loading (z.B. News, Menu)
    await page.waitForTimeout(2000);

    // Prüfe ob JSON-Requests Hashes haben
    for (const url of jsonRequests) {
      const hasHash = /\.[a-f0-9]{8}\.json/.test(url);
      expect(hasHash).toBe(true);
    }
  });
});
