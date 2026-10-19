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

const VOTING_WEEKDAY_KEYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];

/**
 * null bei fehlender oder unlesbarer Datei — damit ein Lesefehler nicht wie
 * "kein Zeitraum gesetzt" (= ganzer Tag offen) behandelt wird.
 */
function loadEventConfig(): ?array {
    $path = contentPath('event.json');
    $fp = @fopen($path, 'r');
    if (!$fp) {
        return null;
    }
    if (!flock($fp, LOCK_SH)) {
        fclose($fp);
        return null;
    }
    $raw = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $config = json_decode((string) $raw, true);
    return is_array($config) ? $config : null;
}

function findVotingScheduleEntry(array $eventConfig, string $day): ?array {
    $schedule = $eventConfig['features']['votingSchedule'] ?? [];
    if (!is_array($schedule)) {
        return null;
    }
    foreach ($schedule as $entry) {
        if (is_array($entry) && ($entry['day'] ?? null) === $day) {
            return $entry;
        }
    }
    return null;
}

/**
 * Wochentag (0 = Sonntag) eines Session-Tags: explizit aus votingSchedule,
 * sonst aus dem deutschen Tagesnamen (so benennt der Sessionplan seine Keys).
 */
function votingDayOfWeek(string $day, ?array $entry): ?int {
    if (isset($entry['dayOfWeek']) && is_int($entry['dayOfWeek'])) {
        return $entry['dayOfWeek'];
    }
    $index = array_search($day, VOTING_WEEKDAY_KEYS, true);
    return $index === false ? null : $index;
}

// Default aus event.schema.json; sessionplan.js nutzt denselben Fallback.
const VOTING_DEFAULT_TIMEZONE = 'Europe/Berlin';

function eventNow(array $eventConfig): DateTimeImmutable {
    $timezone = $eventConfig['event']['timezone'] ?? '';
    try {
        return new DateTimeImmutable('now', new DateTimeZone(is_string($timezone) && $timezone !== '' ? $timezone : VOTING_DEFAULT_TIMEZONE));
    } catch (Exception $e) {
        return new DateTimeImmutable('now', new DateTimeZone(VOTING_DEFAULT_TIMEZONE));
    }
}

/**
 * Voting fuer $day ist offen, wenn heute dieser Wochentag ist und — falls ein
 * Zeitraum gesetzt ist — die aktuelle Uhrzeit darin liegt. Ohne Zeitraum gilt
 * der ganze Tag.
 */
function isVotingWindowOpen(string $day, array $eventConfig, DateTimeImmutable $now): bool {
    $entry = findVotingScheduleEntry($eventConfig, $day);
    $dayOfWeek = votingDayOfWeek($day, $entry);
    if ($dayOfWeek === null || (int) $now->format('w') !== $dayOfWeek) {
        return false;
    }
    $start = $entry['startTime'] ?? '';
    $end = $entry['endTime'] ?? '';
    if ($start === '' || $end === '') {
        return true;
    }
    $current = $now->format('H:i');
    return $current >= $start && $current <= $end;
}
