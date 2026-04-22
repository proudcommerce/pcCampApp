<?php
// Shared helper fuer server-seitig gerenderte Head-Felder aus event.json.
// Admin-Edits an /content/event.json schlagen direkt durch — event-config-loader.js
// ueberschreibt zusaetzlich das DOM live (belt-and-suspenders), aber der initiale
// HTML-Response (fuer Crawler/Social-Previews) stimmt jetzt schon.

if (!function_exists('eh_get')) {
    function eh_get_config() {
        static $config = null;
        if ($config !== null) return $config;

        $candidates = [
            '/usr/share/nginx/html/content/event.json',
            '/app/seed/event.json',
            __DIR__ . '/../../content/event.json',
            __DIR__ . '/../../seed/event.json',
        ];
        foreach ($candidates as $path) {
            if (is_file($path) && is_readable($path)) {
                $raw = @file_get_contents($path);
                if ($raw !== false) {
                    $parsed = json_decode($raw, true);
                    if (is_array($parsed)) { $config = $parsed; return $config; }
                }
            }
        }
        $config = [];
        return $config;
    }

    function eh_get($path, $default = '') {
        $config = eh_get_config();
        $cursor = $config;
        foreach (explode('.', $path) as $key) {
            if (is_array($cursor) && array_key_exists($key, $cursor)) {
                $cursor = $cursor[$key];
            } else {
                return $default;
            }
        }
        if ($cursor === null || $cursor === '') return $default;
        return $cursor;
    }

    function eh_echo($path, $default = '') {
        echo htmlspecialchars((string) eh_get($path, $default), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    function eh_robots() {
        $allow = eh_get('seo.allowIndexing', false);
        return $allow ? 'index, follow' : 'noindex, nofollow';
    }

    // Best-effort Canonical-URL: HTTPS, Host aus X-Forwarded-Host (Reverse-Proxy)
    // oder Host-Header, Pfad ohne Query. Endet auf `/` fuer Directory-Routen
    // (nginx-Rewrite index.php zu `/`-Pfad).
    function eh_canonical_url() {
        $scheme = 'https';
        if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
            $scheme = strtolower(explode(',', $_SERVER['HTTP_X_FORWARDED_PROTO'])[0]);
        } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            $scheme = 'https';
        } elseif (!empty($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) {
            $scheme = 'https';
        } else {
            $scheme = 'http';
        }

        $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
        $host = explode(',', $host)[0];

        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        if (preg_match('#/index\.php$#i', $path)) {
            $path = preg_replace('#/index\.php$#i', '/', $path);
        }

        return $scheme . '://' . $host . $path;
    }

    // Absolute URL fuer OG-Image. Logo aus branding.logo (relativ ./assets/... oder
    // content/...) wird gegen die Origin aufgeloest. Wenn nichts konfiguriert, wird
    // auf /assets/icon-512.png zurueckgefallen (PWA-Icon, immer vorhanden).
    function eh_social_image_url() {
        $canonical = eh_canonical_url();
        $origin = preg_replace('#(https?://[^/]+).*#i', '$1', $canonical);

        $logo = eh_get('branding.logo', '');
        if ($logo !== '') {
            $rel = ltrim(preg_replace('#^\./#', '', (string) $logo), '/');
            if (preg_match('#^https?://#i', $rel)) {
                return $rel;
            }
            return $origin . '/content/' . $rel;
        }
        return $origin . '/assets/icon-512.png';
    }

    // Rendert OG- + Twitter- + Canonical-Tags. Wird von allen 6 index.php ge-included,
    // damit der Block nicht dupliziert werden muss.
    function eh_render_social_tags() {
        $title       = (string) eh_get('event.name', eh_get('event.shortName', ''));
        $fullName    = (string) eh_get('event.name', $title);
        $description = (string) eh_get('event.description', '');
        $locale      = (string) eh_get('event.locale', 'de');
        $ogLocale    = strpos($locale, '_') === false ? ($locale === 'de' ? 'de_DE' : ($locale === 'en' ? 'en_US' : $locale)) : $locale;
        $canonical   = eh_canonical_url();
        $image       = eh_social_image_url();

        $esc = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        echo "\n";
        echo '<link rel="canonical" href="' . $esc($canonical) . "\">\n";
        echo '<meta property="og:type" content="website">' . "\n";
        echo '<meta property="og:site_name" content="' . $esc($fullName) . "\">\n";
        echo '<meta property="og:title" content="' . $esc($title) . "\">\n";
        if ($description !== '') {
            echo '<meta property="og:description" content="' . $esc($description) . "\">\n";
        }
        echo '<meta property="og:url" content="' . $esc($canonical) . "\">\n";
        echo '<meta property="og:locale" content="' . $esc($ogLocale) . "\">\n";
        echo '<meta property="og:image" content="' . $esc($image) . "\">\n";
        echo '<meta property="og:image:alt" content="' . $esc($title) . "\">\n";
        echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
        echo '<meta name="twitter:title" content="' . $esc($title) . "\">\n";
        if ($description !== '') {
            echo '<meta name="twitter:description" content="' . $esc($description) . "\">\n";
        }
        echo '<meta name="twitter:image" content="' . $esc($image) . "\">\n";
        echo '<meta name="twitter:image:alt" content="' . $esc($title) . "\">\n";
    }
}
