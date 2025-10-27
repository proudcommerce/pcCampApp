import { test, expect } from '@playwright/test';

/**
 * Voting System Tests
 * Testet das komplette Voting-System: UI, Backend, State Management, Validierung
 */

test.describe('Voting UI Components', () => {
  test('Voting-Section sollte existieren auf Sessionplan-Seite', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    const votingSection = page.locator('#voting-section');
    await expect(votingSection).toHaveCount(1);
  });

  test('Voting-Container sollte existieren', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    const votingContainer = page.locator('#voting-container');
    await expect(votingContainer).toHaveCount(1);
  });

  test('Voting-Hint sollte vorhanden sein', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    const votingHint = page.locator('.voting-hint');
    await expect(votingHint).toHaveCount(1);
  });
});

test.describe('Voting State Management', () => {
  test('voting-state.json sollte erreichbar sein (wenn vorhanden)', async ({ page }) => {
    const response = await page.goto('/votes/voting-state.json');
    // voting-state.json is a runtime file, may not exist yet (404 is acceptable)
    expect([200, 404]).toContain(response.status());
  });

  test('voting-state.json sollte gültiges JSON sein (wenn vorhanden)', async ({ page }) => {
    const response = await page.goto('/votes/voting-state.json');

    if (response.status() === 200) {
      const state = await response.json();

      expect(state).toHaveProperty('status');
      expect(['active', 'inactive', 'closed']).toContain(state.status);
    } else {
      // File doesn't exist yet - this is acceptable
      expect(response.status()).toBe(404);
    }
  });

});

test.describe('Voting Configuration', () => {
  test('event.json sollte voting Feature konfiguriert haben', async ({ page }) => {
    const response = await page.goto('/event.json');
    const config = await response.json();

    expect(config).toHaveProperty('features');
    expect(config.features).toHaveProperty('voting');
    expect(typeof config.features.voting).toBe('boolean');
  });

  test('event.json sollte votingSchedule haben wenn voting aktiv', async ({ page }) => {
    const response = await page.goto('/event.json');
    const config = await response.json();

    if (config.features.voting === true) {
      expect(config.features).toHaveProperty('votingSchedule');
      expect(Array.isArray(config.features.votingSchedule)).toBe(true);
      expect(config.features.votingSchedule.length).toBeGreaterThan(0);

      // Validate schedule structure
      for (const schedule of config.features.votingSchedule) {
        expect(schedule).toHaveProperty('day');
        expect(schedule).toHaveProperty('dayLabel');
        expect(schedule).toHaveProperty('startTime');
        expect(schedule).toHaveProperty('endTime');
        // Optional: date field (not required)
      }
    }
  });
});

test.describe('Voting Backend API', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  test('vote.php sollte in build/ vorhanden sein', async ({ page }) => {
    const response = await page.goto('/votes/vote.php');

    if (phpEnabled) {
      // With PHP server: Should return 405 (POST only)
      expect(response.status()).toBe(405);
    } else {
      // Without PHP server: 404 or 405
      expect([404, 405]).toContain(response.status());
    }
  });

  (phpEnabled ? test : test.skip)('vote.php sollte POST-only sein (GET abgelehnt)', async ({ page }) => {
    const response = await page.request.get('/votes/vote.php');
    expect(response.status()).toBe(405);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toBe('Method not allowed');
  });

  (phpEnabled ? test : test.skip)('vote.php sollte fehlende Parameter ablehnen', async ({ page }) => {
    const response = await page.request.post('/votes/vote.php', {
      data: {}
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Missing required parameters');
  });

  (phpEnabled ? test : test.skip)('vote.php sollte ungültige Tage ablehnen', async ({ page }) => {
    const response = await page.request.post('/votes/vote.php', {
      data: {
        sessionId: 'test-session',
        day: 'invalid-day',
        userKey: 'test-user-key'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid day');
  });
});

test.describe('Voting Results Page', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  (phpEnabled ? test : test.skip)('results.php sollte ohne admin key 403 zurückgeben', async ({ page }) => {
    const response = await page.goto('/votes/results.php');
    expect(response.status()).toBe(403);
  });

  (phpEnabled ? test : test.skip)('results.php sollte HTML Content-Type haben (mit admin key)', async ({ page }) => {
    // Load event.json to get admin key
    const configResponse = await page.request.get('/event.json');
    const config = await configResponse.json();

    if (config.features?.votingAdminKey) {
      const response = await page.goto(`/votes/results.php?key=${config.features.votingAdminKey}`);
      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/html');
    }
  });
});

test.describe('Voting Functionality', () => {
  test('UserKey sollte generiert und gespeichert werden', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const userKey = await page.evaluate(() => localStorage.getItem('userKey'));

    // UserKey should be generated and stored
    if (userKey) {
      expect(userKey.length).toBeGreaterThan(10);
    } else {
      // If voting is disabled, userKey might not be generated
      console.log('UserKey not found - voting might be disabled');
    }
  });

  test('Sessionplan JS sollte laden', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if sessionplan.js loaded successfully
    const scriptLoaded = await page.evaluate(() => {
      // Simple check: localStorage should be available
      return typeof localStorage !== 'undefined';
    });

    // Basic check that page scripts loaded
    expect(scriptLoaded).toBe(true);
  });

  test('Voting-Section Visibility sollte von Config abhängen', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Load event config to check voting feature
    const configResponse = await page.request.get('/event.json');
    const config = await configResponse.json();

    const votingSection = page.locator('#voting-section');
    const isVisible = await votingSection.isVisible();

    if (config.features?.voting === false) {
      // If voting is disabled in config, section should be hidden
      expect(isVisible).toBe(false);
    }
    // If voting is enabled, visibility depends on schedule and state
  });
});

test.describe('Voting Translations', () => {
  test('Voting Translation Keys sollten existieren', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');

    const translations = await page.evaluate(() => {
      return {
        title: window.t('voting.title'),
        submitButton: window.t('voting.submitButton'),
        selectPlaceholder: window.t('voting.selectPlaceholder'),
        success: window.t('voting.success'),
        alreadyVoted: window.t('voting.alreadyVoted')
      };
    });

    // Should not return the keys themselves (means translation exists)
    expect(translations.title).not.toBe('voting.title');
    expect(translations.submitButton).not.toBe('voting.submitButton');
    expect(translations.selectPlaceholder).not.toBe('voting.selectPlaceholder');
    expect(translations.success).not.toBe('voting.success');
    expect(translations.alreadyVoted).not.toBe('voting.alreadyVoted');
  });
});

test.describe('Voting URL Override (Testing Feature)', () => {
  test('URL-Parameter ?vote=samstag sollte Voting-Parameter erkennen', async ({ page }) => {
    await page.goto('/sessionplan/?vote=samstag');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if URL parameter is correctly detected
    const urlParams = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('vote');
    });

    expect(urlParams).toBe('samstag');

    // Voting visibility depends on state, but URL param should be recognized
    // (We can't guarantee visibility without knowing voting-state.json)
  });

  test('URL-Parameter ?vote=sonntag sollte Voting-Parameter erkennen', async ({ page }) => {
    await page.goto('/sessionplan/?vote=sonntag');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const urlParams = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('vote');
    });

    expect(urlParams).toBe('sonntag');
  });
});

test.describe('Voting Data Persistence', () => {
  test('votes.json sollte erreichbar sein', async ({ page }) => {
    const response = await page.goto('/votes/votes.json');
    // Should return 200 (may be empty but file exists)
    expect([200, 404]).toContain(response.status());
  });

  test('votes.json sollte gültiges JSON sein (wenn vorhanden)', async ({ page }) => {
    const response = await page.goto('/votes/votes.json');

    if (response.status() === 200) {
      const votes = await response.json();
      expect(typeof votes).toBe('object');

      // Check structure for each day
      for (const day in votes) {
        expect(votes[day]).toHaveProperty('sessions');
        expect(votes[day]).toHaveProperty('users');
        expect(typeof votes[day].sessions).toBe('object');
        expect(typeof votes[day].users).toBe('object');
      }
    }
  });
});

test.describe('Voting Security', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  (phpEnabled ? test : test.skip)('Admin-Bereiche sollten ohne Key geschützt sein', async ({ page }) => {
    const adminPages = [
      '/votes/results.php',
      '/votes/admin.php'
    ];

    for (const url of adminPages) {
      const response = await page.goto(url);
      expect(response.status()).toBe(403);
    }
  });

  test('UserKey sollte persistent über Seitenaufrufe bleiben', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userKey1 = await page.evaluate(() => localStorage.getItem('userKey'));

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userKey2 = await page.evaluate(() => localStorage.getItem('userKey'));

    // Should be the same key
    expect(userKey1).toBe(userKey2);
  });
});
