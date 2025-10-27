// Sponsors Page - Dynamic Content Loading
// Loads sponsor data from URL and renders detailed sponsor cards
// Logo URLs can be absolute paths (e.g., CDN or external hosting)

(async () => {
  // Helper-Funktion für Übersetzungen (aus header.js)
  const t = (key) => {
    if (typeof window.t === 'function') {
      return window.t(key);
    }
    return key;
  };

  // Set page title when translations are loaded
  window.addEventListener('translationsLoaded', () => {
    if (window.setPageTitle) {
      window.setPageTitle('pageTitle.sponsors');
    }
  });

  try {
    // Load sponsor data from current directory
    // Build script will replace with hashed filename
    const sponsorsFileName = './sponsors.json';
    const response = await fetch(sponsorsFileName);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const container = document.getElementById('sponsors-grid');

    if (!container) {
      console.error('Sponsors grid container not found');
      return;
    }

    if (!data.sponsors || data.sponsors.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#6b7280;grid-column:1/-1;">${t('sponsors.noSponsorsAvailable')}</p>`;
      return;
    }

    // Render sponsor cards with URL-based logos
    container.innerHTML = data.sponsors.map(sponsor => {
      const sponsorUrl = sponsor.url || '#';
      const displayUrl = sponsorUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      const description = sponsor.beschreibung || '';
      
      // Resolve logo path: absolute URLs stay as-is, relative paths are resolved to current directory
      const logoSrc = sponsor.logo.startsWith('http://') || sponsor.logo.startsWith('https://') || sponsor.logo.startsWith('/')
        ? sponsor.logo
        : `./${sponsor.logo}`;

      return `
        <a href="${sponsorUrl}" target="_blank" rel="noopener noreferrer" class="sponsor-card">
          <img src="${logoSrc}"
               alt="${sponsor.name}"
               loading="lazy"
               onerror="this.style.display='none'; this.parentElement.querySelector('.sponsor-fallback').style.display='flex'">
          <div class="sponsor-fallback" style="display:none;">${sponsor.name}</div>
          <h3>${sponsor.name}</h3>
          ${description ? `<p class="sponsor-description">${description}</p>` : ''}
          <span class="sponsor-link">${displayUrl}</span>
        </a>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading sponsors:', error);
    const container = document.getElementById('sponsors-grid');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;color:#ef4444;grid-column:1/-1;padding:20px;">
          <p><strong>${t('sponsors.errorLoadingTitle')}</strong></p>
          <p style="font-size:0.875rem;color:#6b7280;margin-top:8px;">${t('sponsors.errorLoadingMessage')}</p>
        </div>
      `;
    }
  }
})();
