<?php
/**
 * Voting System Configuration Helper
 * Loads admin key from event.json
 */

function getAdminKey() {
    static $adminKey = null;

    if ($adminKey !== null) {
        return $adminKey;
    }

    // Load event.json from root (two levels up: votes/ -> src/ -> root/)
    $eventConfigPath = __DIR__ . '/../../event.json';

    if (!file_exists($eventConfigPath)) {
        error_log("ERROR: event.json not found at {$eventConfigPath}");
        return null;
    }

    $eventConfig = json_decode(file_get_contents($eventConfigPath), true);

    if (!$eventConfig) {
        error_log("ERROR: Failed to parse event.json");
        return null;
    }

    // Get admin key from features.votingAdminKey
    if (isset($eventConfig['features']['votingAdminKey']) && !empty($eventConfig['features']['votingAdminKey'])) {
        $adminKey = $eventConfig['features']['votingAdminKey'];
    } else {
        error_log("ERROR: votingAdminKey not found or empty in event.json");
        return null;
    }

    return $adminKey;
}

function validateAdminKey($providedKey) {
    $validKey = getAdminKey();

    // If no valid key is configured, deny access
    if ($validKey === null) {
        return false;
    }

    // Validate provided key against configured key
    return $providedKey === $validKey;
}
?>
