/**
 * Event Configuration Loader
 * Loads event.json and replaces placeholders in development mode
 * In production, placeholders are replaced at build time
 */

(function() {
  // Check if we're in development mode (placeholders still present)
  const isDevelopment = document.title.includes('{{');

  if (!isDevelopment) {
    // Production build - placeholders already replaced
    return;
  }

  console.log('🔧 Development mode detected - loading event.json...');

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

  const configPath = getBasePath() + '/content/event.json';
  console.log('📍 Loading event.json from:', configPath);

  // Fetch event.json from correct path
  fetch(configPath)
    .then(response => response.json())
    .then(config => {
      console.log('📋 Event config loaded:', config.event.name);

      // Create replacement map
      const allowIndexing = config.seo?.allowIndexing ?? false;
      const robotsMeta = allowIndexing ? 'index, follow' : 'noindex, nofollow';

      const replacements = {
        '{{EVENT_NAME}}': config.event.name,
        '{{EVENT_SHORT_NAME}}': config.event.shortName,
        '{{EVENT_DESCRIPTION}}': config.event.description,
        '{{EVENT_HASHTAG}}': config.event.hashtag || '',
        '{{COPYRIGHT}}': config.event.copyright,
        '{{EVENT_LOCALE}}': config.event.locale || 'de',
        '{{THEME_COLOR}}': config.branding.themeColor,
        '{{BACKGROUND_COLOR}}': config.branding.backgroundColor,
        '{{ROBOTS_META}}': robotsMeta
      };

      // Replace in document title
      if (document.title.includes('{{')) {
        Object.entries(replacements).forEach(([placeholder, value]) => {
          document.title = document.title.replace(new RegExp(placeholder, 'g'), value);
        });
      }

      // Replace in meta tags
      document.querySelectorAll('meta[content*="{{"]').forEach(meta => {
        let content = meta.getAttribute('content');
        Object.entries(replacements).forEach(([placeholder, value]) => {
          content = content.replace(new RegExp(placeholder, 'g'), value);
        });
        meta.setAttribute('content', content);
      });

      // Replace lang attribute in html tag
      const htmlElement = document.documentElement;
      if (htmlElement.getAttribute('lang')?.includes('{{')) {
        let langValue = htmlElement.getAttribute('lang');
        Object.entries(replacements).forEach(([placeholder, value]) => {
          langValue = langValue.replace(new RegExp(placeholder, 'g'), value);
        });
        htmlElement.setAttribute('lang', langValue);
      }

      // Replace in visible text content
      const textNodes = getTextNodes(document.body);
      textNodes.forEach(node => {
        let text = node.textContent;
        let hasPlaceholder = false;

        Object.entries(replacements).forEach(([placeholder, value]) => {
          if (text.includes(placeholder)) {
            text = text.replace(new RegExp(placeholder, 'g'), value);
            hasPlaceholder = true;
          }
        });

        if (hasPlaceholder) {
          // Fruehere Version hat hier node.parentElement.innerHTML = text gesetzt,
          // wenn der Copyright-Text ein `<a>` enthalten hat. Das war eine
          // XSS-Senke fuer Admin-Content. Wir rendern Text jetzt immer als
          // textContent — wenn ein Link gebraucht wird, muss der im Template
          // stehen, nicht im JSON-Text.
          node.textContent = text;
        }
      });

      console.log('✅ Placeholders replaced');
    })
    .catch(error => {
      console.error('❌ Failed to load event.json:', error);
      console.warn('⚠️  Placeholders will remain visible in development mode');
    });

  // Helper function to get all text nodes
  function getTextNodes(node) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script and style tags
          if (node.parentElement.tagName === 'SCRIPT' ||
              node.parentElement.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          // Only accept nodes with placeholders
          if (node.textContent.includes('{{')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    return textNodes;
  }

  // Make config globally available for other scripts
  window.EVENT_CONFIG = null;
  fetch(configPath)
    .then(r => r.json())
    .then(config => {
      window.EVENT_CONFIG = config;
    })
    .catch(error => {
      console.error('❌ Failed to load event.json for window.EVENT_CONFIG:', error);
    });
})();
