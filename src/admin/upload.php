<?php
/**
 * Admin File Upload — Binary assets (logo, floorplan, sponsor logos).
 *
 * Session-authenticated, multipart/form-data, same-origin only (no CORS).
 * Form fields:
 *   target  — one of: logo | floorplan | sponsor-logo
 *   file    — the uploaded image
 *   name    — (sponsor-logo only) desired filename stem, used to build
 *             content/sponsors/logos/<slug>.<ext>
 *
 * Response: JSON { success, path } on success, { error } on failure.
 * After a successful upload content/sw-version.txt is bumped so clients
 * pick up the new asset via a fresh Service Worker cache.
 */

// Admin-Upload-Debug: alle Fehler sofort anzeigen + loggen, damit ein
// Worker-Crash/PHP-Fatal nicht als nginx-500 verpufft. (Nur dieser Endpoint.)
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
ini_set('log_errors', '1');
error_reporting(E_ALL);
error_log('[admin-upload] entry method=' . ($_SERVER['REQUEST_METHOD'] ?? '-')
    . ' len=' . ($_SERVER['CONTENT_LENGTH'] ?? '-')
    . ' type=' . ($_SERVER['CONTENT_TYPE'] ?? '-'));

header('Content-Type: application/json');

// Fatal-Errors in ein sauberes JSON verpacken, damit das Frontend nicht auf
// einer nginx-500-HTML-Seite sitzen bleibt.
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
        }
        error_log('[admin-upload-fatal] ' . $err['message'] . ' in ' . $err['file'] . ':' . $err['line']);
        echo "\n" . json_encode([
            'error' => 'Server error: ' . $err['message'],
            'where' => basename($err['file']) . ':' . $err['line'],
        ]);
    }
});

set_exception_handler(function ($e) {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    error_log('[admin-upload-exception] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode([
        'error' => 'Exception: ' . $e->getMessage(),
        'where' => basename($e->getFile()) . ':' . $e->getLine(),
    ]);
    exit;
});

require_once __DIR__ . '/../votes/config.php';
require_once __DIR__ . '/content-paths.php';
require_once __DIR__ . '/rehash.php';
startHardenedSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (empty($_SESSION['admin_authenticated'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

$target = $_POST['target'] ?? null;
if (!in_array($target, ['logo', 'floorplan', 'sponsor-logo'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown target']);
    exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error']);
    exit;
}

$file = $_FILES['file'];

// Size cap: 5 MB — sufficient for logos/floorplans, keeps DoS surface small.
$maxBytes = 5 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
    http_response_code(413);
    echo json_encode(['error' => 'File too large (max 5 MB)']);
    exit;
}

// MIME sniffing — don't trust the client-supplied type. SVG is intentionally
// excluded (script-in-SVG is a live XSS vector).
$allowed = [
    'image/png'  => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];

$mime = null;
if (function_exists('finfo_open')) {
    $fh = finfo_open(FILEINFO_MIME_TYPE);
    if ($fh) {
        $mime = finfo_file($fh, $file['tmp_name']);
        finfo_close($fh);
    }
}
// Fallback via getimagesize, falls fileinfo-Extension fehlt.
if (!$mime) {
    $info = @getimagesize($file['tmp_name']);
    if ($info && isset($info['mime'])) {
        $mime = $info['mime'];
    }
}
if (!$mime || !isset($allowed[$mime])) {
    http_response_code(415);
    echo json_encode(['error' => 'Unsupported image type: ' . ($mime ?: 'unknown')]);
    exit;
}
$ext = $allowed[$mime];

// Resolve destination.
switch ($target) {
    case 'logo':
        $destDir  = contentPath('assets');
        $destFile = $destDir . '/logo.' . $ext;
        // Drop any previous logo.* to avoid stale formats (png + jpg side by side).
        foreach (glob($destDir . '/logo.*') as $prev) {
            @unlink($prev);
        }
        $manifestPath = 'assets/logo.' . $ext;
        break;
    case 'floorplan':
        // Frontend referenziert einen festen Pfad (floorplan/floorplan.jpg) —
        // erzwinge JPG, um hardcoded Image-URLs gueltig zu halten.
        if ($ext !== 'jpg') {
            http_response_code(415);
            echo json_encode(['error' => 'Floorplan muss als JPEG hochgeladen werden']);
            exit;
        }
        $destDir  = contentPath('floorplan');
        $destFile = $destDir . '/floorplan.jpg';
        $manifestPath = 'floorplan/floorplan.jpg';
        break;
    case 'sponsor-logo':
        $destDir = contentPath('sponsors/logos');
        $stem = $_POST['name'] ?? pathinfo($file['name'], PATHINFO_FILENAME);
        $slug = preg_replace('/[^a-z0-9._-]+/', '-', strtolower($stem));
        $slug = trim($slug, '-.');
        if ($slug === '') {
            $slug = 'sponsor-' . substr(bin2hex(random_bytes(4)), 0, 8);
        }
        $destFile = $destDir . '/' . $slug . '.' . $ext;
        $manifestPath = 'sponsors/logos/' . $slug . '.' . $ext;
        break;
}

if (!is_dir($destDir) && !mkdir($destDir, 0755, true) && !is_dir($destDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create target directory']);
    exit;
}

if (!move_uploaded_file($file['tmp_name'], $destFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to store uploaded file']);
    exit;
}
chmod($destFile, 0644);

// Logo-Upload: aus der Quelldatei die PWA-Icons in die Content-Volume
// generieren (favicon + 144/192/512). nginx liefert sie per try_files
// vor dem Build-Default aus, Service Worker invalidiert ueber sw-version.txt.
if ($target === 'logo') {
    $iconTargets = [
        ['size' => 16,  'name' => 'favicon.png'],
        ['size' => 144, 'name' => 'icon-144.png'],
        ['size' => 192, 'name' => 'icon-192.png'],
        ['size' => 512, 'name' => 'icon-512.png'],
    ];
    $iconErrors = [];
    foreach ($iconTargets as $icon) {
        $iconPath = $destDir . '/' . $icon['name'];
        if (!renderIconFromSource($destFile, $mime, $icon['size'], $iconPath)) {
            $iconErrors[] = $icon['name'];
        }
    }
    if ($iconErrors) {
        error_log('[admin-upload] icon generation failed for: ' . implode(', ', $iconErrors));
    }
}

// Logo-Upload: branding.logo in event.json auf den neuen Pfad zeigen lassen,
// damit z.B. Endungswechsel (png -> jpg) atomar konsistent bleiben.
if ($target === 'logo') {
    $eventJson = contentPath('event.json');
    if (is_file($eventJson)) {
        $cfg = json_decode(file_get_contents($eventJson), true);
        if (is_array($cfg)) {
            $cfg['branding'] = $cfg['branding'] ?? [];
            $cfg['branding']['logo'] = $manifestPath;
            file_put_contents(
                $eventJson,
                json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
            );
            rehashJsonFile($eventJson, 'event.json');
        }
    }
}

// Bump sw-version so Service-Worker-Clients invalidieren ihren Cache
// — Binaerdateien gehen nicht durch rehashJsonFile(), daher hier explizit.
$swVersionPath = contentRoot() . '/sw-version.txt';
file_put_contents($swVersionPath, (string) time());

echo json_encode([
    'success' => true,
    'target'  => $target,
    'path'    => $manifestPath,
    'url'     => '/content/' . $manifestPath,
]);

/**
 * Resize a source image into a square PWA icon ($size x $size), letterboxed
 * onto a transparent canvas (contain-fit). Returns true on success.
 *
 * GD-basiert; bewusst parallel zum Build-Pfad (sharp in build-cache-busting.cjs),
 * damit Admin-Logo-Uploads die PWA-Icons laufend aktualisieren koennen.
 */
function renderIconFromSource(string $sourcePath, string $mime, int $size, string $outPath): bool
{
    if (!function_exists('imagecreatetruecolor')) {
        error_log('[admin-upload] GD extension not available — skipping icon generation');
        return false;
    }

    $src = null;
    switch ($mime) {
        case 'image/png':
            $src = @imagecreatefrompng($sourcePath);
            break;
        case 'image/jpeg':
            $src = @imagecreatefromjpeg($sourcePath);
            break;
        case 'image/webp':
            if (function_exists('imagecreatefromwebp')) {
                $src = @imagecreatefromwebp($sourcePath);
            }
            break;
        case 'image/gif':
            $src = @imagecreatefromgif($sourcePath);
            break;
    }
    if (!$src) {
        return false;
    }

    $srcW = imagesx($src);
    $srcH = imagesy($src);
    if ($srcW < 1 || $srcH < 1) {
        imagedestroy($src);
        return false;
    }

    $scale  = min($size / $srcW, $size / $srcH);
    $dstW   = max(1, (int) round($srcW * $scale));
    $dstH   = max(1, (int) round($srcH * $scale));
    $offsetX = (int) (($size - $dstW) / 2);
    $offsetY = (int) (($size - $dstH) / 2);

    $dst = imagecreatetruecolor($size, $size);
    if (!$dst) {
        imagedestroy($src);
        return false;
    }
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $size, $size, $transparent);

    imagealphablending($dst, true);
    imagesavealpha($dst, true);

    $ok = imagecopyresampled($dst, $src, $offsetX, $offsetY, 0, 0, $dstW, $dstH, $srcW, $srcH);
    if ($ok) {
        $dir = dirname($outPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $ok = imagepng($dst, $outPath, 6);
        if ($ok) {
            @chmod($outPath, 0644);
        }
    }

    imagedestroy($dst);
    imagedestroy($src);
    return $ok;
}
