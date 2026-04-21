// Shared Sponsor Loading Module
// Used across all pages to DRY up sponsor rendering logic.
// Logo URLs can be absolute (CDN/external) or relative paths inside the
// content volume (content/sponsors/...), resolved via window.contentUrl.

(async () => {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  try {
    await window.assetHashesReady;

    if (typeof eventConfig === 'undefined' || !eventConfig) {
      const configResponse = await fetch(window.contentUrl('event.json'));
      window.eventConfig = await configResponse.json();
    }

    const sponsorFooter = document.getElementById('sponsorFooter');
    if (window.eventConfig?.features?.sponsors === false) {
      if (sponsorFooter) sponsorFooter.style.display = 'none';
      return;
    }

    const response = await fetch(window.contentUrl('sponsors/sponsors.json'));
    const data = await response.json();
    const container = document.getElementById('sponsorsContainer');

    if (container && data.sponsors) {
      container.innerHTML = data.sponsors.map(sponsor => {
        let logoSrc;
        if (sponsor.logo.startsWith('http://') || sponsor.logo.startsWith('https://') || sponsor.logo.startsWith('/')) {
          logoSrc = sponsor.logo;
        } else {
          // Relative path inside content/sponsors/ (e.g. "logos/foo.png").
          const rel = sponsor.logo.replace(/^\.\//, '');
          logoSrc = window.contentUrl('sponsors/' + rel);
        }

        return `<a href="${esc(sponsor.url)}" target="_blank" rel="noopener noreferrer" title="${esc(sponsor.name)}">
          <img src="${esc(logoSrc)}" alt="${esc(sponsor.name)}" class="sponsor-logo"
               onerror="this.style.display='none'; this.parentElement.textContent=this.alt">
        </a>`;
      }).join('');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Sponsoren:', error);
  }
})();
