<?php
// Admin authentication - Load admin key from event.json
require_once __DIR__ . '/config.php';

if (!isset($_GET['key']) || !validateAdminKey($_GET['key'])) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

$ADMIN_KEY = getAdminKey();

// Load current voting state (create default if not exists)
$stateFile = __DIR__ . '/voting-state.json';
if (!file_exists($stateFile)) {
    $defaultState = [
        'status' => 'inactive',
        'lastUpdated' => null,
        'updatedBy' => 'system'
    ];
    file_put_contents($stateFile, json_encode($defaultState, JSON_PRETTY_PRINT));
    $votingState = $defaultState;
} else {
    $votingState = json_decode(file_get_contents($stateFile), true);
}

// Load votes data (for checking if votes exist)
$votesFile = __DIR__ . '/votes.json';
$votesData = [];
if (file_exists($votesFile)) {
    $votesData = json_decode(file_get_contents($votesFile), true);
}
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voting Admin - PC CampApp</title>
<link rel="stylesheet" href="../assets/app.css">
<style>
.admin { font:16px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#ffffff; }
.admin-container { max-width:800px; margin:40px auto; padding:20px; }
.status-card { background:#f8f9fa; border:1px solid #e5e7eb; border-radius:8px; padding:24px; margin-bottom:24px; }
.status-badge { display:inline-block; padding:6px 12px; border-radius:20px; font-weight:600; font-size:14px; }
.status-inactive { background:#fef2f2; color:#dc2626; }
.status-active { background:#d1fae5; color:#059669; }
.status-ended { background:#dbeafe; color:#1e40af; }
.action-buttons { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-top:20px; }
.btn { padding:12px 24px; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:16px; transition:all 0.2s; }
.btn-primary { background:#3b82f6; color:white; }
.btn-primary:hover { background:#2563eb; }
.btn-success { background:#10b981; color:white; }
.btn-success:hover { background:#059669; }
.btn-danger { background:#ef4444; color:white; }
.btn-danger:hover { background:#dc2626; }
.btn-secondary { background:#6b7280; color:white; }
.btn-secondary:hover { background:#4b5563; }
.btn:disabled { background:#d1d5db; cursor:not-allowed; }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; margin-top:20px; }
.stat-item { background:white; border:1px solid #e5e7eb; border-radius:6px; padding:16px; text-align:center; }
.stat-value { font-size:32px; font-weight:700; color:#3b82f6; }
.stat-label { font-size:14px; color:#6b7280; margin-top:4px; }
.warning-box { background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:16px; margin-top:20px; }
.warning-box h4 { margin:0 0 8px 0; color:#dc2626; }
.warning-box p { margin:0; color:#991b1b; font-size:14px; }
.success-message { background:#d1fae5; border:1px solid #6ee7b7; border-radius:6px; padding:12px; margin-bottom:20px; color:#059669; }
.error-message { background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:12px; margin-bottom:20px; color:#dc2626; }
</style>
</head>
<body>

<div class="header"><div class="bar container"><a class="brand" href="../"><img src="../assets/logo.png" alt=""></a><button id="burger" class="burger" aria-label="Menü"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button></div></div>
<nav id="nav-drawer" class="drawer container">
  <div id="navItems"></div>
</nav>

<div class="admin-container">
    <h1>Voting Administration</h1>

    <div id="message-container"></div>

    <div class="status-card">
        <p style="margin:0 0 20px 0;text-align:center;">
            <span class="status-badge status-<?= $votingState['status'] ?>">
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

        <div class="action-buttons">
            <?php if ($votingState['status'] === 'inactive'): ?>
                <button class="btn btn-success" onclick="changeStatus('active')">
                    Aktivieren
                </button>
            <?php elseif ($votingState['status'] === 'active'): ?>
                <button class="btn btn-secondary" onclick="changeStatus('inactive')">
                    Deaktivieren
                </button>
                <button class="btn btn-danger" onclick="changeStatus('ended')">
                    Beenden
                </button>
                <a href="results.php?key=<?= $ADMIN_KEY ?>" class="btn btn-primary" style="text-align:center;text-decoration:none;display:block;background:#6366f1;">
                    Ergebnisse anzeigen
                </a>
            <?php elseif ($votingState['status'] === 'ended'): ?>
                <button class="btn btn-primary" onclick="transferVotes()">
                    Votes in sessions.json übertragen
                </button>
                <button class="btn btn-secondary" onclick="changeStatus('inactive')">
                    Zurücksetzen (Inaktiv)
                </button>
                <a href="results.php?key=<?= $ADMIN_KEY ?>" class="btn btn-primary" style="text-align:center;text-decoration:none;display:block;background:#6366f1;">
                    Ergebnisse anzeigen
                </a>
            <?php endif; ?>
        </div>

        <?php if ($votingState['status'] === 'active'): ?>
            <div class="warning-box" style="text-align:center;">
                <p>Voting ist aktuell aktiv. User können jetzt abstimmen. Stelle sicher, dass die Voting-Zeiten in der event.json korrekt konfiguriert sind.</p>
            </div>
        <?php endif; ?>

        <?php if ($votingState['status'] === 'ended'): ?>
            <div class="warning-box" style="text-align:center;">
                <p>Voting wurde beendet. Klicke auf "Votes in sessions.json übertragen", um die Ergebnisse dauerhaft zu speichern. Dies überschreibt die Vote-Zahlen in der sessions.json!</p>
            </div>
        <?php endif; ?>
    </div>
</div>

<script src="../assets/header.js"></script>
<script>
const ADMIN_KEY = <?= json_encode($ADMIN_KEY) ?>;

function showMessage(message, type = 'success') {
    const container = document.getElementById('message-container');
    const div = document.createElement('div');
    div.className = type === 'success' ? 'success-message' : 'error-message';
    div.textContent = message;
    container.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 5000);
}

async function changeStatus(newStatus) {
    const statusLabels = {
        'inactive': 'Inaktiv',
        'active': 'Aktiv',
        'ended': 'Beendet'
    };

    const confirmMessages = {
        'inactive': 'Voting wirklich deaktivieren? User können dann nicht mehr abstimmen.',
        'active': 'Voting jetzt aktivieren? User können dann abstimmen (abhängig von den Voting-Zeiten in event.json).',
        'ended': 'Voting jetzt beenden? Danach können keine weiteren Votes mehr abgegeben werden. Dies kann nicht rückgängig gemacht werden!'
    };

    if (!confirm(confirmMessages[newStatus])) {
        return;
    }

    try {
        const response = await fetch('change-status.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: ADMIN_KEY,
                status: newStatus
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(`Status erfolgreich geändert auf: ${statusLabels[newStatus]}`);
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showMessage(result.error || 'Fehler beim Ändern des Status', 'error');
        }
    } catch (error) {
        showMessage('Netzwerkfehler: ' + error.message, 'error');
    }
}

async function transferVotes() {
    if (!confirm('Votes wirklich in sessions.json übertragen?\n\nDies überschreibt alle "votes" Werte in der sessions.json mit den aktuellen Voting-Ergebnissen.\n\nVorher solltest du ein Backup erstellen!')) {
        return;
    }

    if (!confirm('Bist du sicher? Dies kann nicht rückgängig gemacht werden!')) {
        return;
    }

    try {
        const response = await fetch('transfer-votes.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: ADMIN_KEY
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(`✅ Erfolgreich übertragen! ${result.transferred} Votes wurden in sessions.json geschrieben.`);
        } else {
            showMessage(result.error || 'Fehler beim Übertragen der Votes', 'error');
        }
    } catch (error) {
        showMessage('Netzwerkfehler: ' + error.message, 'error');
    }
}
</script>

</body>
</html>
