<?php
/**
 * Admin Dashboard - Unified Content & Voting Management
 * Session-based authentication with login form
 */
require_once __DIR__ . '/../votes/config.php';
require_once __DIR__ . '/content-paths.php';
startHardenedSession();

// Handle login POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_key'])) {
    if (validateAdminKey($_POST['admin_key'])) {
        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
        exit;
    }
    $loginError = true;
    error_log(sprintf(
        '[admin-login-fail] ip=%s ua=%s',
        $_SERVER['REMOTE_ADDR'] ?? '-',
        substr($_SERVER['HTTP_USER_AGENT'] ?? '-', 0, 120)
    ));
}

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
    exit;
}

// Show login form if not authenticated
if (empty($_SESSION['admin_authenticated'])) {
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin Login - PC CampApp</title>
<style>
body { font:16px/1.4 system-ui,-apple-system,sans-serif; background:#f9fafb; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
.login-box { background:white; padding:32px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:100%; max-width:360px; }
.login-box h2 { margin:0 0 24px; text-align:center; }
.login-box input { width:100%; padding:12px; border:1px solid #d1d5db; border-radius:6px; font-size:16px; box-sizing:border-box; }
.login-box button { width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:6px; font-size:16px; font-weight:600; cursor:pointer; margin-top:12px; }
.login-box button:hover { background:#2563eb; }
.login-error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; padding:12px; border-radius:6px; margin-bottom:16px; text-align:center; font-size:14px; }
</style>
</head>
<body>
<form class="login-box" method="POST">
    <h2>Admin</h2>
    <?php if (!empty($loginError)): ?>
        <div class="login-error">Ungültiger Admin-Key</div>
    <?php endif; ?>
    <input type="password" name="admin_key" placeholder="Admin-Key eingeben" required autofocus>
    <button type="submit">Anmelden</button>
</form>
</body>
</html>
<?php
    exit;
}

// Authenticated — load voting state for the Voting tab
$ADMIN_KEY = getAdminKey();

$stateFile = contentPath('voting/voting-state.json');
if (!is_dir(dirname($stateFile))) {
    mkdir(dirname($stateFile), 0755, true);
}
if (!file_exists($stateFile)) {
    $votingState = ['status' => 'inactive', 'lastUpdated' => null, 'updatedBy' => 'system'];
    file_put_contents($stateFile, json_encode($votingState, JSON_PRETTY_PRINT));
} else {
    $votingState = json_decode(file_get_contents($stateFile), true);
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin - PC CampApp</title>
<link rel="stylesheet" href="../assets/app.css">
<link rel="stylesheet" href="admin.css">
</head>
<body>

<div class="header"><div class="bar container"><a class="brand" href="../"><img src="../assets/logo.png" alt=""></a><button id="burger" class="burger" aria-label="Menü"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button></div></div>
<nav id="nav-drawer" class="drawer container">
  <div id="navItems"></div>
</nav>

<div class="admin-container">
    <div class="admin-header">
        <h1>Administration</h1>
        <a href="?logout" class="admin-logout">Abmelden</a>
    </div>
    <div id="message-container"></div>

    <!-- Resource Tabs -->
    <div class="admin-tabs">
        <button class="admin-tab active" data-resource="sessions">Sessions</button>
        <button class="admin-tab" data-resource="timetable">Timetable</button>
        <button class="admin-tab" data-resource="news">News</button>
        <button class="admin-tab" data-resource="food">Food</button>
        <button class="admin-tab" data-resource="allergene">Allergene</button>
        <button class="admin-tab" data-resource="sponsors">Sponsors</button>
        <button class="admin-tab" data-resource="menu">Menu</button>
        <button class="admin-tab" data-resource="event">Event</button>
        <button class="admin-tab" data-resource="voting">Voting</button>
    </div>

    <!-- Editor Area -->
    <div class="admin-editor">
        <!-- Toolbar (hidden for voting tab) -->
        <div id="editor-toolbar" class="admin-toolbar">
            <div class="toolbar-left">
                <span id="resource-label" class="resource-label">Sessions</span>
                <label class="toggle-label">
                    <input type="checkbox" id="mode-toggle">
                    <span>Raw JSON</span>
                </label>
            </div>
            <div class="toolbar-right">
                <button id="btn-save" class="btn btn-primary">
                    Speichern
                </button>
            </div>
        </div>

        <!-- Structured Editor -->
        <div id="structured-editor" class="structured-editor"></div>

        <!-- Raw JSON Editor -->
        <div id="raw-editor" class="raw-editor" style="display:none;">
            <textarea id="json-textarea" spellcheck="false"></textarea>
            <div id="json-error" class="json-error" style="display:none;"></div>
        </div>

        <!-- Voting Panel (inline, no separate page) -->
        <div id="voting-panel" class="voting-panel" style="display:none;">
            <div class="status-card">
                <p style="margin:0 0 20px 0;text-align:center;">
                    <span class="status-badge status-<?= $votingState['status'] ?>" id="voting-status-badge">
                        <?php
                            $statusLabels = [
                                'inactive' => 'Voting inaktiv',
                                'active' => 'Voting aktiv',
                                'ended' => 'Voting beendet'
                            ];
                            echo $statusLabels[$votingState['status']] ?? 'Unbekannt';
                        ?>
                    </span>
                </p>
                <p style="color:#6b7280;font-size:14px;text-align:center;">
                    <?php if ($votingState['lastUpdated']): ?>
                        Letztes Update: <?= date('d.m.Y H:i:s', $votingState['lastUpdated']) ?>
                    <?php else: ?>
                        Noch keine Updates
                    <?php endif; ?>
                </p>

                <div class="action-buttons" id="voting-actions">
                    <?php if ($votingState['status'] === 'inactive'): ?>
                        <button class="btn btn-success" onclick="changeVotingStatus('active')">Aktivieren</button>
                    <?php elseif ($votingState['status'] === 'active'): ?>
                        <button class="btn btn-secondary" onclick="changeVotingStatus('inactive')">Deaktivieren</button>
                        <button class="btn btn-danger" onclick="changeVotingStatus('ended')">Beenden</button>
                        <a href="results.php" class="btn btn-primary" style="text-align:center;text-decoration:none;display:block;background:#6366f1;">Ergebnisse anzeigen</a>
                    <?php elseif ($votingState['status'] === 'ended'): ?>
                        <button class="btn btn-primary" onclick="transferVotes()">Votes in sessions.json übertragen</button>
                        <button class="btn btn-secondary" onclick="changeVotingStatus('inactive')">Zurücksetzen (Inaktiv)</button>
                        <a href="results.php" class="btn btn-primary" style="text-align:center;text-decoration:none;display:block;background:#6366f1;">Ergebnisse anzeigen</a>
                    <?php endif; ?>
                </div>

                <?php if ($votingState['status'] === 'active'): ?>
                    <div class="warning-box" style="text-align:center;margin-top:20px;">
                        <p>Voting ist aktuell aktiv. User können jetzt abstimmen.</p>
                    </div>
                <?php endif; ?>

                <?php if ($votingState['status'] === 'ended'): ?>
                    <div class="warning-box" style="text-align:center;margin-top:20px;">
                        <p>Voting wurde beendet. Klicke auf "Votes in sessions.json übertragen", um die Ergebnisse dauerhaft zu speichern.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Loading Indicator -->
        <div id="loading" class="loading">Lade Daten...</div>
    </div>
</div>

<script src="../assets/header.js"></script>
<script>
const ADMIN_KEY = <?= json_encode($ADMIN_KEY) ?>;

// Voting functions (inline, no separate JS file needed)
function showMessage(text, type) {
    const container = document.getElementById('message-container');
    const div = document.createElement('div');
    div.className = type === 'success' ? 'success-message' : 'error-message';
    div.textContent = text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

async function changeVotingStatus(newStatus) {
    const msgs = {
        'inactive': 'Voting wirklich deaktivieren?',
        'active': 'Voting jetzt aktivieren?',
        'ended': 'Voting jetzt beenden? Dies kann nicht rückgängig gemacht werden!'
    };
    if (!confirm(msgs[newStatus])) return;

    try {
        const response = await fetch('../votes/change-status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showMessage('Voting-Status geändert', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showMessage(result.error || 'Fehler', 'error');
        }
    } catch (e) { showMessage('Netzwerkfehler: ' + e.message, 'error'); }
}

async function transferVotes() {
    if (!confirm('Votes wirklich in sessions.json übertragen? Dies überschreibt die Vote-Zahlen!')) return;
    if (!confirm('Bist du sicher?')) return;

    try {
        const response = await fetch('../votes/transfer-votes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showMessage('Erfolgreich! ' + result.transferred + ' Votes übertragen.', 'success');
        } else {
            showMessage(result.error || 'Fehler', 'error');
        }
    } catch (e) { showMessage('Netzwerkfehler: ' + e.message, 'error'); }
}
</script>
<script src="admin.js"></script>

</body>
</html>
