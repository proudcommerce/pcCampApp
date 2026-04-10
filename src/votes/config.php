<?php
/**
 * Voting System Configuration Helper
 * Loads admin key from VOTING_ADMIN_KEY environment variable
 */

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
    $eventConfigPath = __DIR__ . '/../../event.json';
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
