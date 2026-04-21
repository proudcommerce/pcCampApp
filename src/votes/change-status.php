<?php
require_once __DIR__ . '/config.php';
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

if (!isset($input['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing status parameter']);
    exit;
}

$allowedStatuses = ['inactive', 'active', 'ended'];
$newStatus = $input['status'];

if (!in_array($newStatus, $allowedStatuses)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status', 'allowed' => $allowedStatuses]);
    exit;
}

$stateFile = contentPath('voting/voting-state.json');
if (!is_dir(dirname($stateFile))) {
    mkdir(dirname($stateFile), 0755, true);
}

$votingState = [
    'status' => $newStatus,
    'lastUpdated' => time(),
    'updatedBy' => 'admin'
];

if (file_put_contents($stateFile, json_encode($votingState, JSON_PRETTY_PRINT)) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save state']);
    exit;
}

echo json_encode([
    'success' => true,
    'status' => $newStatus,
    'message' => 'Status updated successfully'
]);
?>
