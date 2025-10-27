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

$stateFile = __DIR__ . '/voting-state.json';

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
