<?php
require_once __DIR__ . '/assets/event-head.php';

$manifest = [
    'name'             => (string) eh_get('pwa.manifestName', eh_get('event.name')),
    'short_name'       => (string) eh_get('pwa.manifestShortName', eh_get('event.shortName')),
    'description'      => (string) eh_get('pwa.manifestDescription', eh_get('event.description')),
    'start_url'        => (string) eh_get('pwa.startUrl', '/'),
    'scope'            => (string) eh_get('pwa.scope', '/'),
    'display'          => (string) eh_get('pwa.display', 'standalone'),
    'orientation'      => (string) eh_get('pwa.orientation', 'portrait-primary'),
    'background_color' => (string) eh_get('branding.backgroundColor', '#ffffff'),
    'theme_color'      => (string) eh_get('branding.themeColor', '#3182ce'),
    'lang'             => (string) eh_get('event.locale', 'de'),
    'icons'            => [
        ['src' => 'assets/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
        ['src' => 'assets/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
        ['src' => 'assets/icon-144.png', 'sizes' => '144x144', 'type' => 'image/png', 'purpose' => 'any'],
    ],
];

$categories = eh_get('pwa.categories', []);
if (is_array($categories) && $categories) {
    $manifest['categories'] = array_values($categories);
}

header('Content-Type: application/manifest+json; charset=utf-8');
echo json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
