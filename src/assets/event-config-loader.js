/**
 * Event Configuration Loader
 *
 * Wendet Branding/Meta/Copyright/Manifest zur Laufzeit aus /content/event.json an.
 * Seit der PHP-Umstellung rendert index.php den Head-Bereich bereits server-seitig
 * aus derselben JSON — das reicht fuer Crawler/Social-Previews. Dieser Loader
 * bleibt aktiv, damit Admin-Edits ohne Full-Reload sichtbar werden (DOM-Override)
 * und damit dynamisch generierte Felder wie Manifest/Logo-URL zur Laufzeit
 * gesetzt werden.
 *
 * Copyright/Hashtag werden via textContent gesetzt (XSS-Schutz fuer
 * Admin-Content — siehe frueheren Kommentar zu innerHTML). Wer HTML im Footer
 * braucht, hinterlegt es im Template, nicht in der JSON.
 */

(function() {
  // Zentrale Definition liegt in header.js (window.getBasePath). Fallback auf
  // eine identische Lokalkopie, falls header.js (noch) nicht geladen ist.
  const getBasePath = window.getBasePath || (() => {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));
    const knownPages = ['sessionplan', 'timetable', 'food', 'floorplan', 'sponsors', 'votes', 'admin'];
    if (segments.length === 0) return '';
    if (knownPages.includes(segments[0])) return '';
    return '/' + segments[0];
  });

  const basePath = getBasePath();
  const configPath = basePath + '/content/event.json';

  window.EVENT_CONFIG = null;

  function setMeta(name, value) {
    if (value === undefined || value === null) return;
    const el = document.querySelector('meta[name="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }

  function applyHeadConfig(config) {
    const event = config.event || {};
    const branding = config.branding || {};
    const allowIndexing = (config.seo && config.seo.allowIndexing) ?? false;
    const robotsMeta = allowIndexing ? 'index, follow' : 'noindex, nofollow';

    if (event.locale) document.documentElement.setAttribute('lang', event.locale);
    // Titel spiegelt den vollen event.name (nicht shortName) — konsistent zu dem
    // was index.php server-seitig rendert.
    const titleText = event.name || event.shortName;
    if (titleText) document.title = titleText;

    setMeta('description', event.description);
    setMeta('robots', robotsMeta);
    setMeta('theme-color', branding.themeColor);
    setMeta('apple-mobile-web-app-title', titleText);
    setMeta('msapplication-TileColor', branding.themeColor);

    applyManifest(config);
  }

  function applyBodyConfig(config) {
    const event = config.event || {};
    const branding = config.branding || {};

    const brandImg = document.querySelector('img[data-brand-logo]');
    if (brandImg) {
      const altText = event.name || event.shortName;
      if (altText) brandImg.setAttribute('alt', altText);

      const configured = branding.logo || 'assets/logo.png';
      const rel = String(configured).replace(/^\.\//, '');
      const logoSrc = /^(https?:\/\/|\/)/i.test(rel) ? rel : basePath + '/content/' + rel;
      if (brandImg.getAttribute('src') !== logoSrc) {
        brandImg.src = logoSrc;
      }
    }

    // H1 nur auf der Startseite — Unterseiten haben keinen main>h1.
    const h1 = document.querySelector('main h1');
    if (h1 && event.name) h1.textContent = event.name;

    const copyrightLeft = document.querySelector('.copyright-left');
    if (copyrightLeft && event.copyright !== undefined) copyrightLeft.innerHTML = event.copyright;

    const copyrightRight = document.querySelector('.copyright-right');
    if (copyrightRight && event.hashtag !== undefined) copyrightRight.innerHTML = event.hashtag || '';
  }

  function applyManifest(config) {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    const event = config.event || {};
    const branding = config.branding || {};
    const pwa = config.pwa || {};

    const manifest = {
      name: pwa.manifestName,
      short_name: pwa.manifestShortName,
      description: pwa.manifestDescription,
      start_url: pwa.startUrl,
      display: pwa.display,
      background_color: branding.backgroundColor,
      theme_color: branding.themeColor,
      orientation: pwa.orientation,
      scope: pwa.scope,
      lang: event.locale,
      icons: [
        { src: basePath + '/assets/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
        { src: basePath + '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: basePath + '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };
    if (pwa.categories) manifest.categories = pwa.categories;

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    manifestLink.setAttribute('href', URL.createObjectURL(blob));
  }

  function apply(config) {
    window.EVENT_CONFIG = config;
    applyHeadConfig(config);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyBodyConfig(config));
    } else {
      applyBodyConfig(config);
    }
  }

  fetch(configPath, { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(apply)
    .catch(error => {
      console.error('Failed to load event.json:', error);
    });
})();
