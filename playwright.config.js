import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for PC CampApp
 * Tests Production Build (build/) auf http://localhost:5174
 *
 * Testet:
 * - Übersetzungen (Translation System) - BEIDE Sprachen (DE + EN)
 * - PWA-Funktionalität (Service Worker, Offline, Manifest)
 * - UI/UX (Navigation, Responsive Design, Accessibility)
 * - Cache-Busting (Gehashte Assets)
 */
export default defineConfig({
  testDir: './tests',

  // Globales Timeout
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },

  // Parallele Test-Ausführung
  fullyParallel: false,

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retries
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],

  // Gemeinsame Einstellungen für alle Projekte
  use: {
    // Base URL - Production Build auf Port 5174
    baseURL: process.env.BASE_URL || 'http://localhost:5174',

    // Screenshot nur bei Fehlern
    screenshot: 'only-on-failure',

    // Video nur bei ersten Retry
    video: 'retain-on-failure',

    // Trace bei Fehlern
    trace: 'on-first-retry',
  },

  // Test-Projekte für verschiedene Sprachen
  projects: [
    {
      name: 'chromium-de',
      testMatch: /translations\.spec\.js/,
      use: { 
        ...devices['Desktop Chrome'],
        locale: 'de-DE',
      },
      metadata: {
        locale: 'de'
      },
      globalSetup: './scripts/setup-locale-de.js',
    },
    {
      name: 'chromium-en',
      testMatch: /translations\.spec\.js/,
      use: { 
        ...devices['Desktop Chrome'],
        locale: 'en-US',
      },
      metadata: {
        locale: 'en'
      },
      globalSetup: './scripts/setup-locale-en.js',
    },
    {
      name: 'chromium',
      testIgnore: /translations\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Andere Browser temporär deaktiviert für schnelleres Testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // // Mobile Tests
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Production Server (optional - nur wenn nicht bereits läuft)
  // In lokaler Umgebung wird Server via make test-prod gestartet
  webServer: process.env.CI ? {
    command: 'make prod-up',
    port: 5174,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  } : undefined,
});
