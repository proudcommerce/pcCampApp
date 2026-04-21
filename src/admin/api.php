<?php
/**
 * Admin API - Content Management for pcCampApp
 * Provides CRUD operations for all JSON data files.
 *
 * Usage: POST /admin/api.php
 * Body: { "key": "admin-key", "action": "get|update|reset", "resource": "...", "data": {...} }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Load auth from existing votes config
require_once __DIR__ . '/../votes/config.php';
require_once __DIR__ . '/rehash.php';
require_once __DIR__ . '/content-paths.php';

// Parse request body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

// Validate admin key
if (!isset($input['key']) || !validateAdminKey($input['key'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid admin key']);
    exit;
}

// Validate required fields
$action = $input['action'] ?? null;
$resource = $input['resource'] ?? null;

if (!$action || !$resource) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing action or resource']);
    exit;
}

// Resource to file path mapping — all content lives in the content/ volume.
$resourceMap = [
    'sessions'  => contentPath('sessionplan/sessions.json'),
    'timetable' => contentPath('timetable/timetable.json'),
    'news'      => contentPath('news.json'),
    'food'      => contentPath('food/menue.json'),
    'allergene' => contentPath('food/allergene.json'),
    'sponsors'  => contentPath('sponsors/sponsors.json'),
    'menu'      => contentPath('menu.json'),
    'event'     => contentPath('event.json'),
];

// Relative keys used in content-hashes.json (relative to content/ root).
$resourceManifestKeys = [
    'sessions'  => 'sessionplan/sessions.json',
    'timetable' => 'timetable/timetable.json',
    'news'      => 'news.json',
    'food'      => 'food/menue.json',
    'allergene' => 'food/allergene.json',
    'sponsors'  => 'sponsors/sponsors.json',
    'menu'      => 'menu.json',
    'event'     => 'event.json',
];

if (!isset($resourceMap[$resource])) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown resource: ' . $resource]);
    exit;
}

$targetFile = $resourceMap[$resource];

// Ensure file exists
if (!file_exists($targetFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Resource file not found: ' . $resource]);
    exit;
}

// Dispatch action
switch ($action) {
    case 'get':
        handleGet($targetFile, $resource);
        break;
    case 'update':
        handleUpdate($targetFile, $resource, $input['data'] ?? null);
        break;
    case 'reset':
        handleReset($targetFile, $resource);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action: ' . $action]);
}

/**
 * GET - Read current JSON data
 */
function handleGet($file, $resource) {
    $content = file_get_contents($file);
    $data = json_decode($content, true);

    if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse JSON for ' . $resource]);
        return;
    }

    $backupExists = file_exists($file . '.backup');

    echo json_encode([
        'success'      => true,
        'resource'     => $resource,
        'data'         => $data,
        'backupExists' => $backupExists,
    ]);
}

/**
 * UPDATE - Write new JSON data with backup
 */
function handleUpdate($file, $resource, $data) {
    if ($data === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing data field']);
        return;
    }

    // Validate that data is a valid structure (array or object)
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Data must be a JSON object or array']);
        return;
    }

    // Acquire exclusive lock for thread-safety
    $fp = fopen($file, 'c+');
    if (!$fp) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not open file']);
        return;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        http_response_code(500);
        echo json_encode(['error' => 'Could not acquire file lock']);
        return;
    }

    // Read current content for backup
    $currentContent = stream_get_contents($fp);

    // Create backup
    file_put_contents($file . '.backup', $currentContent);

    // Write new content
    $newContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $newContent);

    flock($fp, LOCK_UN);
    fclose($fp);

    // Rehash the JSON file for cache busting (production only)
    global $resourceManifestKeys;
    $manifestKey = $resourceManifestKeys[$resource] ?? null;
    if ($manifestKey) {
        rehashJsonFile($file, $manifestKey);
    }

    echo json_encode([
        'success'  => true,
        'message'  => $resource . ' updated successfully',
        'resource' => $resource,
        'backup'   => true,
    ]);
}

/**
 * RESET - Restore from backup
 */
function handleReset($file, $resource) {
    $backupFile = $file . '.backup';

    if (!file_exists($backupFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'No backup found for ' . $resource]);
        return;
    }

    $backupContent = file_get_contents($backupFile);

    // Validate backup is valid JSON
    $backupData = json_decode($backupContent, true);
    if ($backupData === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['error' => 'Backup file is corrupted']);
        return;
    }

    // Restore backup
    file_put_contents($file, $backupContent);

    // Rehash after restore
    global $resourceManifestKeys;
    $manifestKey = $resourceManifestKeys[$resource] ?? null;
    if ($manifestKey) {
        rehashJsonFile($file, $manifestKey);
    }

    echo json_encode([
        'success'  => true,
        'message'  => $resource . ' restored from backup',
        'resource' => $resource,
    ]);
}
?>
