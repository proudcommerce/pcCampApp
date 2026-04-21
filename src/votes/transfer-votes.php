<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../admin/rehash.php';
require_once __DIR__ . '/../admin/content-paths.php';
startHardenedSession();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// Auth: session (admin or voting) or key in body
$authenticated = !empty($_SESSION['admin_authenticated']) || !empty($_SESSION['voting_admin']);
if (!$authenticated && isset($input['key'])) {
    $authenticated = validateAdminKey($input['key']);
}
if (!$authenticated) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// Check if voting is ended
$stateFile = contentPath('voting/voting-state.json');
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
$votesFile = contentPath('voting/votes.json');
if (!file_exists($votesFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Votes file not found']);
    exit;
}

$votesData = json_decode(file_get_contents($votesFile), true);

// Load sessions.json
$sessionsFile = contentPath('sessionplan/sessions.json');
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

// Rehash sessions.json for cache busting
rehashJsonFile($sessionsFile, 'sessionplan/sessions.json');

echo json_encode([
    'success' => true,
    'transferred' => $transferredCount,
    'message' => "Successfully transferred {$transferredCount} vote counts to sessions.json"
]);
?>
