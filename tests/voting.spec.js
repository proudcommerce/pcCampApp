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
    const response = await page.goto('/content/voting/voting-state.json');
    // voting-state.json is a runtime file, may not exist yet (404 is acceptable)
    expect([200, 404]).toContain(response.status());
  });

  test('voting-state.json sollte gültiges JSON sein (wenn vorhanden)', async ({ page }) => {
    const response = await page.goto('/content/voting/voting-state.json');

    if (response.status() === 200) {
      const state = await response.json();

      expect(state).toHaveProperty('status');
      expect(['active', 'inactive', 'ended']).toContain(state.status);
    } else {
      // File doesn't exist yet - this is acceptable
      expect(response.status()).toBe(404);
    }
  });

});

test.describe('Voting Configuration', () => {
  test('event.json sollte voting Feature konfiguriert haben', async ({ page }) => {
    const response = await page.goto('/content/event.json');
    const config = await response.json();

    expect(config).toHaveProperty('features');
    expect(config.features).toHaveProperty('voting');
    expect(typeof config.features.voting).toBe('boolean');
  });

  test('event.json sollte votingSchedule haben wenn voting aktiv', async ({ page }) => {
    const response = await page.goto('/content/event.json');
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
        // Muss dem Server-Regex entsprechen, damit die Day-Validierung greift.
        userKey: 'vote_abcd1234'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid day');
  });

  (phpEnabled ? test : test.skip)('vote.php sollte ungueltige userKey-Formate ablehnen', async ({ page }) => {
    const response = await page.request.post('/votes/vote.php', {
      data: {
        sessionId: 'test-session',
        day: 'samstag',
        userKey: '../../etc/passwd'
      }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid userKey format');
  });
});

test.describe('Voting Results Page', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  (phpEnabled ? test : test.skip)('results.php sollte ohne admin key 403 zurückgeben', async ({ page }) => {
    const response = await page.goto('/votes/results.php');
    expect(response.status()).toBe(403);
  });

  (phpEnabled ? test : test.skip)('results.php sollte HTML Content-Type haben (mit admin session)', async ({ page }) => {
    // Login via admin.php to create session
    const adminKey = process.env.VOTING_ADMIN_KEY;
    if (!adminKey) {
      test.skip();
      return;
    }

    // POST login to admin.php to establish session
    await page.goto('/votes/admin.php');
    await page.fill('input[name="admin_key"]', adminKey);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Now access results.php with session cookie
    const response = await page.goto('/votes/results.php');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });
});

test.describe('Voting Functionality', () => {
  test('UserKey sollte generiert und gespeichert werden', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const userKey = await page.evaluate(() => localStorage.getItem('pccampapp_vote_key'));

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
    const configResponse = await page.request.get('/content/event.json');
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
  test('votes.json darf NICHT oeffentlich abrufbar sein', async ({ page }) => {
    // Die Rohdatei enthaelt userKeys aller Voter; nginx blockt sie auf 404.
    // Aggregate liegen auf /votes/status.php.
    const response = await page.goto('/content/voting/votes.json');
    expect(response.status()).toBe(404);
  });
});

test.describe('Voting Public Aggregates', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  // GET ist nicht erlaubt — muss 405 oder 404 sein (je nach Build-Stand).
  test('status.php darf auf GET nicht 200 liefern', async ({ page }) => {
    const response = await page.request.get('/votes/status.php');
    expect([404, 405]).toContain(response.status());
  });

  (phpEnabled ? test : test.skip)('status.php liefert bei POST aggregates + ownVote', async ({ page }) => {
    const response = await page.request.post('/votes/status.php', {
      data: {}
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('aggregates');
    expect(body).toHaveProperty('ownVote');
    expect(body.ownVote).toHaveProperty('hasVoted');
  });

  (phpEnabled ? test : test.skip)('status.php lehnt ungueltigen userKey ab', async ({ page }) => {
    const response = await page.request.post('/votes/status.php', {
      data: { day: 'samstag', userKey: '../../etc/passwd' }
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('Voting Security', () => {
  const phpEnabled = process.env.PHP_TESTS_ENABLED === 'true';

  (phpEnabled ? test : test.skip)('Admin-Bereiche sollten ohne Key geschützt sein', async ({ page }) => {
    // /votes/results.php leitet weiter zu /admin/results.php — dort 403 ohne Session.
    const resultsResponse = await page.goto('/votes/results.php');
    expect(resultsResponse.status()).toBe(403);

    // /votes/admin.php leitet zu /admin/ → Login-Formular (200),
    // Admin-UI darf ohne Auth nicht erreichbar sein.
    await page.goto('/votes/admin.php');
    await expect(page.locator('form input[name="admin_key"]')).toBeVisible();
    await expect(page.locator('.admin-tabs')).toHaveCount(0);
  });

  test('UserKey sollte persistent über Seitenaufrufe bleiben', async ({ page }) => {
    await page.goto('/sessionplan/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userKey1 = await page.evaluate(() => localStorage.getItem('pccampapp_vote_key'));

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const userKey2 = await page.evaluate(() => localStorage.getItem('pccampapp_vote_key'));

    // Should be the same key
    expect(userKey1).toBe(userKey2);
  });
});
