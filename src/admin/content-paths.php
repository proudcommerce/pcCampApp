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
