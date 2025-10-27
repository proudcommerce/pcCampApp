<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Load admin key from event.json
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['key']) || !validateAdminKey($input['key'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// Check if voting is ended
$stateFile = __DIR__ . '/voting-state.json';
if (!file_exists($stateFile)) {
    http_response_code(400);
    echo json_encode(['error' => 'Voting state file not found. Please use admin panel to initialize voting system.']);
    exit;
}

$votingState = json_decode(file_get_contents($stateFile), true);

if ($votingState['status'] !== 'ended') {
    http_response_code(400);
    echo json_encode(['error' => 'Voting must be ended before transferring votes', 'currentStatus' => $votingState['status']]);
    exit;
}

// Load votes.json
$votesFile = __DIR__ . '/votes.json';
if (!file_exists($votesFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Votes file not found']);
    exit;
}

$votesData = json_decode(file_get_contents($votesFile), true);

// Load sessions.json
$sessionsFile = __DIR__ . '/../sessionplan/sessions.json';
if (!file_exists($sessionsFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Sessions file not found']);
    exit;
}

$sessionsData = json_decode(file_get_contents($sessionsFile), true);

// Transfer votes to sessions
$transferredCount = 0;

foreach ($votesData as $day => $dayData) {
    if (!isset($dayData['sessions']) || !isset($sessionsData[$day])) {
        continue;
    }

    foreach ($dayData['sessions'] as $sessionId => $voteCount) {
        // Find session in sessions.json and update votes
        foreach ($sessionsData[$day] as $timeSlot => &$sessions) {
            if (!is_array($sessions)) continue;

            foreach ($sessions as &$session) {
                if (isset($session['id']) && $session['id'] == $sessionId) {
                    $session['votes'] = $voteCount;
                    $transferredCount++;
                    break 2; // Break both loops when found
                }
            }
        }
    }
}

// Save updated sessions.json
if (file_put_contents($sessionsFile, json_encode($sessionsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save sessions.json']);
    exit;
}

echo json_encode([
    'success' => true,
    'transferred' => $transferredCount,
    'message' => "Successfully transferred {$transferredCount} vote counts to sessions.json"
]);
?>
