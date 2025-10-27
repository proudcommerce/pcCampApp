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

// Check voting state
$stateFile = __DIR__ . '/voting-state.json';
if (file_exists($stateFile)) {
    $votingState = json_decode(file_get_contents($stateFile), true);
    if ($votingState['status'] !== 'active') {
        http_response_code(403);
        echo json_encode(['error' => 'Voting is not active', 'status' => $votingState['status']]);
        exit;
    }
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['sessionId']) || !isset($input['day']) || !isset($input['userKey'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

$sessionId = $input['sessionId'];
$day = $input['day'];
$userKey = $input['userKey'];

// Load event configuration to get valid voting days
$eventConfigPath = __DIR__ . '/../event.json';
$allowedDays = ['samstag', 'sonntag']; // Default fallback

if (file_exists($eventConfigPath)) {
    $eventConfig = json_decode(file_get_contents($eventConfigPath), true);
    if (isset($eventConfig['features']['votingSchedule']) && is_array($eventConfig['features']['votingSchedule'])) {
        $allowedDays = array_map(function($schedule) {
            return $schedule['day'];
        }, $eventConfig['features']['votingSchedule']);
    }
}

if (!in_array($day, $allowedDays)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid day', 'allowed_days' => $allowedDays]);
    exit;
}

$votesFile = __DIR__ . '/votes.json';
$votes = [];

if (file_exists($votesFile)) {
    $votes = json_decode(file_get_contents($votesFile), true) ?: [];
}

if (!isset($votes[$day])) {
    $votes[$day] = ['sessions' => [], 'users' => []];
}

if (isset($votes[$day]['users'][$userKey])) {
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

if (file_put_contents($votesFile, json_encode($votes, JSON_PRETTY_PRINT)) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save vote']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Vote recorded successfully',
    'votes' => $votes[$day]
]);
?>

