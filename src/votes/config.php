<?php
/**
 * Voting System Configuration Helper
 * Loads admin key from VOTING_ADMIN_KEY environment variable
 */

/**
 * Start a PHP session with hardened cookie flags.
 * Must be called BEFORE session_start() — idempotent and safe to call
 * even when the session is already active (no-op in that case).
 *
 * Secure is derived from the request scheme so the flag is also active
 * when the container runs behind a TLS-terminating reverse proxy.
 */
function startHardenedSession() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/**
 * CSRF-Token: pro Session einmalig erzeugt, als opake 64-Zeichen-Hex-String.
 * Admin-Frontend liest den Wert aus einem Meta-Tag und spiegelt ihn in jedem
 * mutierenden Request als X-CSRF-Token Header zurueck.
 */
function getCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Verifiziert den mitgelieferten CSRF-Token gegen die Session.
 * Akzeptiert Token via `X-CSRF-Token` Header (fetch/JSON-Requests) ODER als
 * `csrf_token` Form-Feld (klassische HTML-POST-Forms wie das Logout-Form).
 * Schickt 403 + exit bei Mismatch.
 */
function requireCsrfToken() {
    $expected = $_SESSION['csrf_token'] ?? null;
    $header   = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $formVal  = $_POST['csrf_token'] ?? '';
    $provided = is_string($header) && $header !== '' ? $header : (is_string($formVal) ? $formVal : '');
    if (!$expected || $provided === '' || !hash_equals($expected, $provided)) {
        error_log(sprintf(
            '[csrf-fail] path=%s ip=%s',
            $_SERVER['REQUEST_URI'] ?? '-',
            $_SERVER['REMOTE_ADDR'] ?? '-'
        ));
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'CSRF token mismatch']);
        exit;
    }
}

function getAdminKey() {
    static $adminKey = null;

    if ($adminKey !== null) {
        return $adminKey;
    }

    // Admin-Key kommt ausschliesslich aus der Env-Variable. Der frueher hier
    // vorhandene Fallback auf event.json.features.votingAdminKey wurde
    // entfernt: event.json liegt im Content-Volume und landete beim Deploy
    // in Backups, die durch die nginx-Fixes zwar jetzt blockiert sind — das
    // Secret hat dort aber nichts zu suchen. Wer Migration braucht, setzt
    // die Env-Variable.
    $envKey = getenv('VOTING_ADMIN_KEY');
    if ($envKey !== false && $envKey !== '') {
        $adminKey = $envKey;
        return $adminKey;
    }

    error_log("ERROR: VOTING_ADMIN_KEY environment variable not set");
    return null;
}

function validateAdminKey($providedKey) {
    $validKey = getAdminKey();

    // If no valid key is configured, deny access
    if ($validKey === null) {
        return false;
    }

    // Timing-safe comparison to prevent side-channel attacks
    return hash_equals($validKey, $providedKey);
}
?>
