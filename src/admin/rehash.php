<?php
/**
 * Content Cache-Busting Utility
 *
 * After an admin edit (or a vote transfer) writes a JSON file in the content/
 * volume, this function:
 *   1. Computes a new content hash (MD5, first 8 chars — same algo as the build).
 *   2. Deletes stale hashed copies and writes a fresh one alongside the unhashed file.
 *   3. Updates content/content-hashes.json so the frontend resolveAsset() picks it up.
 *   4. Bumps content/sw-version.txt so the Service Worker forms a new CACHE_NAME.
 *
 * Code assets (CSS/JS/HTML) are hashed at image build time; their manifest lives
 * in /assets-hashes.json and is never touched at runtime.
 */

require_once __DIR__ . '/content-paths.php';

function rehashJsonFile($file, $manifestKey) {
    $contentRoot = contentRoot();
    $manifestPath = $contentRoot . '/content-hashes.json';
    $swVersionPath = $contentRoot . '/sw-version.txt';
    $lockPath = $contentRoot . '/.rehash.lock';

    // File must live inside the content volume.
    $realFile = realpath($file);
    $realRoot = realpath($contentRoot);
    if (!$realFile || !$realRoot || strpos($realFile, $realRoot) !== 0) {
        return;
    }

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

    // Clean up previous hashed versions, keep the unhashed original.
    foreach (glob($dir . '/' . $base . '.*.' . $ext) as $oldFile) {
        if ($oldFile !== $file) {
            unlink($oldFile);
        }
    }

    // Write the new hashed copy.
    $hashedFilename = $base . '.' . $hash . '.' . $ext;
    file_put_contents($dir . '/' . $hashedFilename, $content);

    // Update the content manifest (relative paths, content/-root).
    $manifest = file_exists($manifestPath)
        ? (json_decode(file_get_contents($manifestPath), true) ?: [])
        : [];
    $manifestDir = dirname($manifestKey);
    $manifest[$manifestKey] = ($manifestDir !== '.' ? $manifestDir . '/' : '') . $hashedFilename;
    file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    // Bump the runtime SW version. sw.js in the image reads this and combines
    // it with its build-time BUILD_VERSION to form the cache key.
    file_put_contents($swVersionPath, (string) time());

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}
