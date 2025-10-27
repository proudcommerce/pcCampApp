// Shared Sponsor Loading Module
// Used across all pages to DRY up sponsor rendering logic
// Logo URLs can be absolute paths (e.g., CDN or external hosting)

(async () => {
  try {
    // Helper function to determine base path
    function getBasePath() {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));

      if (segments.length === 0) {
        return '';
      }

      const knownPages = ['sessionplan', 'timetable', 'food', 'floorplan', 'sponsors', 'votes'];
      if (knownPages.includes(segments[0])) {
        return '';
      }

      return '/' + segments[0];
    }

    // Lade Event-Konfiguration falls noch nicht geladen
    if (typeof eventConfig === 'undefined' || !eventConfig) {
      const pathname = window.location.pathname;
      const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));
      const basePath = getBasePath();

      let configPath;
      if (basePath) {
        configPath = basePath + '/event.json';
      } else {
        const isInSubfolder = segments.length >= 1;
        configPath = isInSubfolder ? '../event.json' : './event.json';
      }
      const configResponse = await fetch(configPath);
      window.eventConfig = await configResponse.json();
    }

    // Prüfe ob Sponsoren-Feature aktiviert ist
    const sponsorFooter = document.getElementById('sponsorFooter');
    if (window.eventConfig?.features?.sponsors === false) {
      console.log('Sponsoren-Feature ist deaktiviert');
      if (sponsorFooter) {
        sponsorFooter.style.display = 'none';
      }
      return;
    }

    // Determine correct path to sponsors.json
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));
    const basePath = getBasePath();

    let pathPrefix;
    if (basePath) {
      // Base path exists (e.g., /build)
      pathPrefix = basePath + '/sponsors';
    } else {
      // No base path
      const isInSubfolder = segments.length >= 1;
      pathPrefix = isInSubfolder ? '../sponsors' : './sponsors';
    }

    // Verwende Original-Datei (wird vom Build-Script durch gehashte Version ersetzt)
    const sponsorsFileName = `${pathPrefix}/sponsors.json`;
    const response = await fetch(sponsorsFileName);
    const data = await response.json();
    const container = document.getElementById('sponsorsContainer');

    if (container && data.sponsors) {
      container.innerHTML = data.sponsors.map(sponsor => {
        // Resolve logo path: absolute URLs stay as-is, relative paths get prefix
        const logoSrc = sponsor.logo.startsWith('http://') || sponsor.logo.startsWith('https://') || sponsor.logo.startsWith('/')
          ? sponsor.logo
          : `${pathPrefix}/${sponsor.logo.replace(/^\.\//, '')}`;
        
        return `<a href="${sponsor.url}" target="_blank" rel="noopener noreferrer" title="${sponsor.name}">
          <img src="${logoSrc}" alt="${sponsor.name}" class="sponsor-logo"
               onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'sponsor-fallback\\'>${sponsor.name}</span>'">
        </a>`;
      }).join('');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Sponsoren:', error);
  }
})();
