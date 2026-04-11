<?php
/**
 * JSON Cache-Busting Rehash Utility
 *
 * After an admin edit or vote transfer writes a JSON file, this function:
 * 1. Computes a new content hash (MD5, first 8 chars — same algo as build script)
 * 2. Deletes old hashed copies, writes the new one
 * 3. Updates cache-hashes.json so the frontend resolveAsset() picks up the change
 * 4. Bumps the Service Worker CACHE_NAME so clients reinstall and get fresh data
 *
 * Only runs in production (when cache-hashes.json exists in the build root).
 * In development mode it's a no-op.
 */

function rehashJsonFile($file, $manifestKey) {
    $buildRoot = dirname(__DIR__); // e.g. build/ (called from build/admin/ or build/votes/)
    $manifestPath = $buildRoot . '/cache-hashes.json';
    $lockPath = $buildRoot . '/.rehash.lock';

    // Only run in production build environment
    if (!file_exists($manifestPath)) return;

    $lockHandle = fopen($lockPath, 'c');
    if (!$lockHandle) return;
    if (!flock($lockHandle, LOCK_EX)) {
        fclose($lockHandle);
        return;
    }

    $content = file_get_contents($file);
    $hash = substr(md5($content), 0, 8);

    $dir = dirname($file);
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    $base = pathinfo($file, PATHINFO_FILENAME);

    // Delete old hashed versions (e.g. sessions.*.json) but keep the unhashed original
    foreach (glob($dir . '/' . $base . '.*.' . $ext) as $oldFile) {
        if ($oldFile !== $file) {
            unlink($oldFile);
        }
    }

    // Write new hashed version
    $hashedFilename = $base . '.' . $hash . '.' . $ext;
    file_put_contents($dir . '/' . $hashedFilename, $content);

    // Update cache-hashes.json
    $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];
    $manifestDir = dirname($manifestKey);
    $manifest[$manifestKey] = ($manifestDir !== '.' ? $manifestDir . '/' : '') . $hashedFilename;
    file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    // Bump SW cache version to trigger reinstall on clients
    $swPath = $buildRoot . '/sw.js';
    if (file_exists($swPath)) {
        $swContent = file_get_contents($swPath);

        // Update CACHE_NAME with new timestamp
        $swContent = preg_replace(
            "/const CACHE_NAME = '[^']*';/",
            "const CACHE_NAME = 'event-app-v" . time() . "';",
            $swContent
        );

        // Update the hashed JSON URL in urlsToCache
        $oldPattern = '/\'\.\/' . preg_quote($manifestDir !== '.' ? $manifestDir . '/' : '', '/')
            . preg_quote($base, '/') . '\.[a-f0-9]{8}\.' . preg_quote($ext, '/') . '\'/';
        $newUrl = "'./" . ($manifestDir !== '.' ? $manifestDir . '/' : '') . $hashedFilename . "'";
        $swContent = preg_replace($oldPattern, $newUrl, $swContent);

        file_put_contents($swPath, $swContent);
    }

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}
