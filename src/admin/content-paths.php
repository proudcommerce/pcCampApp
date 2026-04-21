<?php
/**
 * Canonical path resolver for the content volume.
 *
 * Works identically in dev (src/ bind-mount) and prod (multi-stage image):
 * both layouts serve from /usr/share/nginx/html/, with /content/ as a
 * dedicated writable mount. We resolve via the document root so callers
 * don't have to count ../ levels.
 */

function contentRoot() {
    $fromDocRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/content';
    if (is_dir($fromDocRoot)) {
        return $fromDocRoot;
    }
    // Fallback for CLI / missing DOCUMENT_ROOT: resolve from this file's location.
    return realpath(__DIR__ . '/..') . '/content';
}

function contentPath($relative) {
    return contentRoot() . '/' . ltrim($relative, '/');
}

/**
 * Resolve the brand logo URL for server-rendered pages (admin panel).
 * Reads branding.logo from content/event.json; relative paths point at the
 * content/ volume, absolute URLs (http(s)://) or paths (/...) pass through.
 */
function brandLogoUrl() {
    $default = '/content/assets/logo.png';
    $eventJson = contentPath('event.json');
    if (!is_file($eventJson)) {
        return $default;
    }
    $cfg = json_decode(file_get_contents($eventJson), true);
    $logo = $cfg['branding']['logo'] ?? null;
    if (!is_string($logo) || $logo === '') {
        return $default;
    }
    if (preg_match('#^(https?://|/)#i', $logo)) {
        return $logo;
    }
    return '/content/' . ltrim(preg_replace('#^\./#', '', $logo), '/');
}
