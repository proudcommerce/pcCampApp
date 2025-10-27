<?php
// Admin authentication - Load admin key from event.json
require_once __DIR__ . '/config.php';

if (!isset($_GET['key']) || !validateAdminKey($_GET['key'])) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$votesFile = __DIR__ . '/votes.json';
$votes = [];

if (file_exists($votesFile)) {
    $votes = json_decode(file_get_contents($votesFile), true) ?: [];
}

// Load event configuration to get configured voting days
$eventConfigPath = __DIR__ . '/../../event.json';
$votingDays = [];
if (file_exists($eventConfigPath)) {
    $eventConfig = json_decode(file_get_contents($eventConfigPath), true);
    if (isset($eventConfig['features']['votingSchedule']) && is_array($eventConfig['features']['votingSchedule'])) {
        foreach ($eventConfig['features']['votingSchedule'] as $schedule) {
            $votingDays[] = [
                'day' => $schedule['day'],
                'dayLabel' => $schedule['dayLabel']
            ];
        }
    }
}

// Fallback to hardcoded days if no config found
if (empty($votingDays)) {
    $votingDays = [
        ['day' => 'samstag', 'dayLabel' => 'Samstag'],
        ['day' => 'sonntag', 'dayLabel' => 'Sonntag']
    ];
}

// Get session data
$sessionsData = json_decode(file_get_contents(__DIR__ . '/../sessionplan/sessions.json'), true);

// Helper function to get session info with time slot
function getSessionInfo($sessionId, $sessionsData) {
    foreach ($sessionsData as $timeSlot => $sessions) {
        foreach ($sessions as $session) {
            if ($session['id'] == $sessionId) {
                return array_merge($session, ['timeSlot' => $timeSlot]);
            }
        }
    }
    return null;
}

// Get top sessions for each configured day
$dayResults = [];
foreach ($votingDays as $dayConfig) {
    $dayKey = $dayConfig['day'];
    $dayLabel = $dayConfig['dayLabel'];
    $dayData = $sessionsData[$dayKey] ?? [];
    $dayTop = [];

    if (isset($votes[$dayKey]['sessions'])) {
        foreach ($votes[$dayKey]['sessions'] as $sessionId => $count) {
            $sessionInfo = getSessionInfo($sessionId, $dayData);
            if ($sessionInfo) {
                $dayTop[] = [
                    'session' => $sessionInfo,
                    'votes' => $count
                ];
            }
        }
        usort($dayTop, function($a, $b) { return $b['votes'] - $a['votes']; });
    }

    // Count users who voted on this day
    $userCount = isset($votes[$dayKey]['users']) ? count($votes[$dayKey]['users']) : 0;

    $dayResults[] = [
        'day' => $dayKey,
        'dayLabel' => $dayLabel,
        'sessions' => $dayTop,
        'userCount' => $userCount
    ];
}

// Calculate total stats
$totalVotes = 0;
$totalUsers = 0;
foreach ($votes as $dayData) {
    if (isset($dayData['sessions'])) {
        foreach ($dayData['sessions'] as $voteCount) {
            $totalVotes += $voteCount;
        }
    }
    if (isset($dayData['users'])) {
        $totalUsers += count($dayData['users']);
    }
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voting Ergebnisse - PC CampApp</title>
<link rel="stylesheet" href="../assets/app.css">
<style>
body { background:#f9fafb; }
.results-container { max-width:1200px; margin:40px auto; padding:0 20px; }
.results-container h1 { margin:0 0 24px 0; }
.page-header { background:white; padding:24px 32px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:24px; }

.stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; margin-top:20px; }
.stat-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:20px; text-align:center; }
.stat-value { font-size:36px; font-weight:700; color:#3b82f6; margin-bottom:4px; }
.stat-label { font-size:14px; color:#6b7280; }

.day-section { background:white; padding:32px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:24px; }
.day-section h2 { margin:0 0 24px 0; color:#111827; font-size:24px; display:flex; align-items:center; gap:12px; }
.day-badge { background:#e0e7ff; color:#4338ca; padding:4px 12px; border-radius:20px; font-size:14px; font-weight:600; }

.results-table { width:100%; border-collapse:separate; border-spacing:0 8px; }
.results-table thead th { text-align:left; padding:12px 16px; color:#6b7280; font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; }
.results-table tbody tr { background:#f9fafb; transition:all 0.2s; }
.results-table tbody tr:hover { background:#f3f4f6; transform:translateX(4px); }
.results-table tbody td { padding:16px; border-top:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb; }
.results-table tbody td:first-child { border-left:1px solid #e5e7eb; border-radius:8px 0 0 8px; }
.results-table tbody td:last-child { border-right:1px solid #e5e7eb; border-radius:0 8px 8px 0; }

.rank { width:48px; text-align:center; font-weight:700; font-size:20px; color:#9ca3af; }
.rank-1 { color:#fbbf24; font-size:28px; }
.rank-2 { color:#d1d5db; font-size:24px; }
.rank-3 { color:#f59e0b; font-size:22px; }

.session-info { flex:1; }
.session-title { font-weight:600; color:#111827; font-size:16px; margin-bottom:4px; }
.session-meta { display:flex; gap:16px; color:#6b7280; font-size:14px; }
.session-meta span { display:flex; align-items:center; gap:4px; }
.session-meta svg { width:16px; height:16px; }

.votes-badge { background:#3b82f6; color:white; padding:4px 10px; border-radius:6px; font-weight:700; font-size:14px; min-width:40px; text-align:center; }
.votes-badge-gold { background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
.votes-badge-silver { background:linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%); }
.votes-badge-bronze { background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }

.no-votes { text-align:center; color:#9ca3af; font-style:italic; padding:40px; background:#f9fafb; border-radius:8px; }
.medal { font-size:24px; }
</style>
</head>
<body>

<div class="header"><div class="bar container"><a class="brand" href="../"><img src="../assets/logo.png" alt=""></a><button id="burger" class="burger" aria-label="Menü"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button></div></div>
<nav id="nav-drawer" class="drawer container">
  <div id="navItems"></div>
</nav>

<div class="results-container">
    <h1>Voting Ergebnisse</h1>

    <div class="page-header">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value"><?= $totalUsers ?></div>
                <div class="stat-label">Teilnehmer</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?= $totalVotes ?></div>
                <div class="stat-label">Votes Gesamt</div>
            </div>
            <?php foreach ($dayResults as $dayResult): ?>
                <div class="stat-card">
                    <div class="stat-value"><?= $dayResult['userCount'] ?></div>
                    <div class="stat-label">Votes <?= htmlspecialchars($dayResult['dayLabel']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

    <?php foreach ($dayResults as $dayResult): ?>
        <div class="day-section">
            <h2>
                <?= htmlspecialchars($dayResult['dayLabel']) ?>
                <span class="day-badge"><?= count($dayResult['sessions']) ?> Sessions</span>
            </h2>
            <?php if (empty($dayResult['sessions'])): ?>
                <div class="no-votes">Noch keine Votes abgegeben</div>
            <?php else: ?>
                <table class="results-table">
                    <tbody>
                        <?php foreach ($dayResult['sessions'] as $index => $item): ?>
                            <tr>
                                <td class="rank rank-<?= $index + 1 ?>">
                                    <div class="votes-badge <?= $index === 0 ? 'votes-badge-gold' : ($index === 1 ? 'votes-badge-silver' : ($index === 2 ? 'votes-badge-bronze' : '')) ?>">
                                        <?= $item['votes'] ?>
                                    </div>
                                </td>
                                <td>
                                    <div class="session-info">
                                        <div class="session-title"><?= htmlspecialchars($item['session']['title']) ?></div>
                                        <div class="session-meta">
                                            <span>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <?= htmlspecialchars($item['session']['timeSlot'] ?? 'N/A') ?>
                                            </span>
                                            <?php if (!empty($item['session']['host'])): ?>
                                                <span>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    <?= htmlspecialchars($item['session']['host']) ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>
</div>

<script src="../assets/header.js"></script>
</body>
</html>
