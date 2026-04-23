<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../admin/content-paths.php';
require_once __DIR__ . '/vote-helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)
    || !isset($input['sessionId'], $input['day'], $input['userKey'])
    || !is_string($input['sessionId'])
    || !is_string($input['day'])
    || !is_string($input['userKey'])
) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

$sessionId = $input['sessionId'];
$day = $input['day'];
$userKey = $input['userKey'];

// userKey muss dem Client-Format entsprechen (`vote_<alnum>`, 8-64 Zeichen).
// Ohne Pattern koennten Angreifer kollidierende oder absurd grosse Keys senden
// und so Vote-Budgets/Storage anderer Nutzer verfaelschen.
if (!preg_match('/^vote_[a-z0-9]{4,58}$/', $userKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid userKey format']);
    exit;
}

$eventConfigPath = contentPath('event.json');
$allowedDays = ['samstag', 'sonntag'];

if (file_exists($eventConfigPath)) {
    $eventConfig = json_decode(file_get_contents($eventConfigPath), true);
    if (isset($eventConfig['features']['votingSchedule']) && is_array($eventConfig['features']['votingSchedule'])) {
        $allowedDays = array_map(function($schedule) {
            return $schedule['day'];
        }, $eventConfig['features']['votingSchedule']);
    }
}

if (!in_array($day, $allowedDays, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid day', 'allowed_days' => $allowedDays]);
    exit;
}

$stateFile = contentPath('voting/voting-state.json');
if (file_exists($stateFile)) {
    $votingState = json_decode(file_get_contents($stateFile), true);
    if (($votingState['status'] ?? null) !== 'active') {
        http_response_code(403);
        echo json_encode(['error' => 'Voting is not active', 'status' => $votingState['status'] ?? null]);
        exit;
    }
}

// sessionId gegen sessions.json[day] pruefen — nur existierende, nicht gecancelte
// Sessions duerfen gevotet werden.
if (!isValidSessionId($sessionId, $day)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown or cancelled session']);
    exit;
}

$votesFile = contentPath('voting/votes.json');

// Atomares read-modify-write mit flock. Ohne Lock koennen gleichzeitige Votes
// sich gegenseitig ueberschreiben.
$dir = dirname($votesFile);
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}
$fp = fopen($votesFile, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open votes file']);
    exit;
}
if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    http_response_code(500);
    echo json_encode(['error' => 'Failed to acquire lock']);
    exit;
}

$raw = stream_get_contents($fp);
$votes = $raw !== '' ? (json_decode($raw, true) ?: []) : [];

if (!isset($votes[$day])) {
    $votes[$day] = ['sessions' => [], 'users' => []];
}

if (isset($votes[$day]['users'][$userKey])) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(409);
    echo json_encode(['error' => 'User already voted for this day']);
    exit;
}

if (!isset($votes[$day]['sessions'][$sessionId])) {
    $votes[$day]['sessions'][$sessionId] = 0;
}
$votes[$day]['sessions'][$sessionId]++;

$votes[$day]['users'][$userKey] = [
    'sessionId' => $sessionId,
    'timestamp' => time()
];

ftruncate($fp, 0);
rewind($fp);
if (fwrite($fp, json_encode($votes, JSON_PRETTY_PRINT)) === false) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save vote']);
    exit;
}
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

// Public-Response enthaelt nur aggregate Zaehler, keine userKeys anderer Nutzer.
echo json_encode([
    'success'  => true,
    'message'  => 'Vote recorded successfully',
    'sessions' => $votes[$day]['sessions'],
    'hasVoted' => true,
]);
