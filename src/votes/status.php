<?php
/**
 * Public Voting-Status-Endpoint.
 *
 * Liefert aggregierte Vote-Zaehler und den eigenen Vote-Status eines Besuchers,
 * ohne die vollstaendige votes.json (mit allen userKeys anderer Nutzer) an den
 * Client auszuliefern.
 *
 * POST-Body: { "day"?: "...", "userKey"?: "vote_xxx" }
 *   day      optional — wenn gesetzt, wird zusaetzlich zum aggregates-Objekt
 *            auch `ownVote` fuer (day, userKey) zurueckgegeben.
 *   userKey  optional, regex-validiert — Format `vote_[a-z0-9]{4,58}`.
 *
 * Response: { aggregates: {day: {sessions: {id: count}}}, ownVote: {hasVoted, sessionId}? }
 */

header('Content-Type: application/json');

require_once __DIR__ . '/vote-helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$day = isset($input['day']) && is_string($input['day']) ? $input['day'] : null;
$userKey = isset($input['userKey']) && is_string($input['userKey']) ? $input['userKey'] : null;

if ($userKey !== null && !preg_match('/^vote_[a-z0-9]{4,58}$/', $userKey)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid userKey format']);
    exit;
}

$response = ['aggregates' => loadPublicVoteAggregates()];

if ($day !== null && $userKey !== null) {
    $response['ownVote'] = lookupOwnVote($day, $userKey);
} else {
    $response['ownVote'] = ['hasVoted' => false, 'sessionId' => null];
}

echo json_encode($response);
