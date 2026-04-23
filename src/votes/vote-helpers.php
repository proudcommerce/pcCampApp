<?php
/**
 * Shared helpers fuer vote.php + status.php.
 *
 * Zentraler Grund: votes.json wird nicht mehr oeffentlich ausgeliefert
 * (nginx blockt /content/voting/votes.json, siehe nginx.*.conf). Stattdessen
 * bekommen Clients aggregate Daten ueber status.php — dieser Helper liefert
 * die gemeinsame Projektion und die sessionId-Validierung.
 */

require_once __DIR__ . '/../admin/content-paths.php';

/**
 * Prueft, ob $sessionId fuer $day eine reale, nicht-gecancelte Session ist.
 * Ohne diese Pruefung koennte vote.php beliebige session-IDs anlegen.
 */
function isValidSessionId(string $sessionId, string $day): bool {
    $sessionsFile = contentPath('sessionplan/sessions.json');
    if (!file_exists($sessionsFile)) {
        return false;
    }
    $all = json_decode(file_get_contents($sessionsFile), true);
    if (!is_array($all) || !isset($all[$day]) || !is_array($all[$day])) {
        return false;
    }
    foreach ($all[$day] as $slot => $sessions) {
        if (!is_array($sessions)) continue;
        foreach ($sessions as $s) {
            if (!is_array($s)) continue;
            if (isset($s['id']) && (string) $s['id'] === $sessionId) {
                if (!empty($s['cancelled'])) return false;
                return true;
            }
        }
    }
    return false;
}

/**
 * Liest votes.json unter shared-lock und liefert eine oeffentlich sichere
 * Projektion:
 *   [
 *     'samstag' => ['sessions' => [id => count, ...]],
 *     'sonntag' => ['sessions' => [...]],
 *   ]
 * User-Records ('users') werden bewusst NICHT mitgeschickt.
 */
function loadPublicVoteAggregates(): array {
    $votesFile = contentPath('voting/votes.json');
    if (!file_exists($votesFile)) {
        return [];
    }
    $fp = fopen($votesFile, 'r');
    if (!$fp) return [];
    if (!flock($fp, LOCK_SH)) { fclose($fp); return []; }
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $data = $raw !== '' ? (json_decode($raw, true) ?: []) : [];
    $out = [];
    foreach ($data as $day => $dayData) {
        if (!is_array($dayData)) continue;
        $sessions = [];
        if (isset($dayData['sessions']) && is_array($dayData['sessions'])) {
            foreach ($dayData['sessions'] as $sid => $count) {
                $sessions[(string) $sid] = (int) $count;
            }
        }
        $out[$day] = ['sessions' => $sessions];
    }
    return $out;
}

/**
 * Prueft, ob $userKey fuer $day bereits gevotet hat — ohne andere Nutzer-
 * records an den Client zu leaken. Gibt zusaetzlich die selbst gewaehlte
 * sessionId zurueck, damit das UI den Vote-Status restaurieren kann.
 */
function lookupOwnVote(string $day, string $userKey): array {
    $votesFile = contentPath('voting/votes.json');
    if (!file_exists($votesFile)) {
        return ['hasVoted' => false, 'sessionId' => null];
    }
    $fp = fopen($votesFile, 'r');
    if (!$fp) return ['hasVoted' => false, 'sessionId' => null];
    if (!flock($fp, LOCK_SH)) { fclose($fp); return ['hasVoted' => false, 'sessionId' => null]; }
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $data = $raw !== '' ? (json_decode($raw, true) ?: []) : [];
    $record = $data[$day]['users'][$userKey] ?? null;
    if (!is_array($record)) {
        return ['hasVoted' => false, 'sessionId' => null];
    }
    return [
        'hasVoted'  => true,
        'sessionId' => isset($record['sessionId']) ? (string) $record['sessionId'] : null,
    ];
}
