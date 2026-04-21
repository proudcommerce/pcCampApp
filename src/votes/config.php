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

function getAdminKey() {
    static $adminKey = null;

    if ($adminKey !== null) {
        return $adminKey;
    }

    // Primary: load from environment variable
    $envKey = getenv('VOTING_ADMIN_KEY');
    if ($envKey !== false && $envKey !== '') {
        $adminKey = $envKey;
        return $adminKey;
    }

    // Fallback: load from event.json (deprecated)
    require_once __DIR__ . '/../admin/content-paths.php';
    $eventConfigPath = contentPath('event.json');
    if (file_exists($eventConfigPath)) {
        $eventConfig = json_decode(file_get_contents($eventConfigPath), true);
        if (isset($eventConfig['features']['votingAdminKey']) && !empty($eventConfig['features']['votingAdminKey'])) {
            $adminKey = $eventConfig['features']['votingAdminKey'];
            error_log("WARNING: Using votingAdminKey from event.json is deprecated. Set VOTING_ADMIN_KEY environment variable instead.");
            return $adminKey;
        }
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
