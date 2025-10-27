(() => {
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
      window.setPageTitle('pageTitle.food');
    }
  });

  const foodContainer = document.querySelector('.food');
  if (!foodContainer) return;
  
  const formatAllergens = (allergens) => {
    if (!allergens || allergens.length === 0) return '';
    return `<sup style="font-size:10px;color:#718096;background:#f7fafc;padding:1px 4px;border-radius:3px;border:1px solid #e2e8f0;margin-left:4px;">${allergens.join(', ')}</sup>`;
  };
  
  const renderMenuItem = (item) => {
    let html = `<div><strong>${item.name}</strong>${formatAllergens(item.allergens)}</div>`;
    
    if (item.variants) {
      item.variants.forEach(variant => {
        html += `<div>${variant.name}${formatAllergens(variant.allergens)}</div>`;
      });
    }
    
    if (item.toppings) {
      item.toppings.forEach(topping => {
        html += `<div>${topping.name}${formatAllergens(topping.allergens)}</div>`;
      });
    }
    
    if (item.fillings) {
      item.fillings.forEach(filling => {
        html += `<div>${filling.name}${formatAllergens(filling.allergens)}</div>`;
      });
    }
    
    if (item.topping) {
      html += `<div>${item.topping.name}${formatAllergens(item.topping.allergens)}</div>`;
    }
    
    if (item.description) {
      html += `<div>${item.description}</div>`;
    }
    
    return html;
  };
  
  const renderMeal = (mealName, items) => {
    let html = `<div class="slot"><div class="meal">${mealName}</div>`;
    
    items.forEach(item => {
      html += renderMenuItem(item);
    });
    
    html += '</div>';
    return html;
  };
  
  const renderDay = (dayName, meals) => {
    let html = `<details><summary>${dayName}</summary><div class="meal-content">`;
    
    Object.entries(meals).forEach(([mealName, items]) => {
      html += renderMeal(mealName, items);
    });
    
    html += '</div></details>';
    return html;
  };
  
  const loadMenu = async () => {
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) return;

    try {
      // Lade Hash-Manifest für Cache Busting


      // Verwende gehashte Datei oder Fallback
      // Verwende Original-Datei
      const menuFileName = './menue.json';
      const response = await fetch(menuFileName, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const menu = await response.json();

        let html = '';
        Object.entries(menu).forEach(([dayKey, meals]) => {
          const dayName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
          html += renderDay(dayName, meals);
        });

        menuContainer.innerHTML = html;
        // Remove data-i18n attribute to prevent translation system from overwriting content
        menuContainer.removeAttribute('data-i18n');

        // Auto-open nach dem Laden
        autoOpenToday();
      } else {
        menuContainer.removeAttribute('data-i18n');
        menuContainer.innerHTML = `<div>${t('errors.loadingMenu')}</div>`;
      }
    } catch (error) {
      menuContainer.removeAttribute('data-i18n');
      menuContainer.innerHTML = `<div>${t('errors.loadingMenu')}</div>`;
    }
  };
  
  const autoOpenToday = () => {
    const now = new Date();
    const todayName = now.toLocaleDateString('de-DE', { weekday: 'long' });
    const todayNameCapitalized = todayName.charAt(0).toUpperCase() + todayName.slice(1);

    const details = Array.from(foodContainer.querySelectorAll('details'));

    // Finde den Tab, dessen Summary-Text dem heutigen Wochentag entspricht
    const targetDetails = details.find(d => {
      const summary = d.querySelector('summary');
      return summary && summary.textContent.trim() === todayNameCapitalized;
    });

    if (targetDetails) {
      // Alle anderen schließen
      details.forEach(d => d.removeAttribute('open'));
      // Heutigen Tag öffnen
      targetDetails.setAttribute('open', '');
      // Zum geöffneten Tab scrollen
      targetDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  const loadAllergens = async () => {
    const allergensList = document.getElementById('allergens-list');
    if (!allergensList) return;

    try {
      // Lade Hash-Manifest für Cache Busting


      // Verwende gehashte Datei oder Fallback
      // Verwende Original-Datei
      const allergensFileName = './allergene.json';
      const response = await fetch(allergensFileName, {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const allergens = await response.json();

        // Allergene sortieren (Buchstaben zuerst, dann Zahlen)
        const sortedEntries = Object.entries(allergens).sort(([a], [b]) => {
          const aIsLetter = /^[A-Z]$/.test(a);
          const bIsLetter = /^[A-Z]$/.test(b);

          if (aIsLetter && !bIsLetter) return -1;
          if (!aIsLetter && bIsLetter) return 1;
          if (aIsLetter && bIsLetter) return a.localeCompare(b);
          return parseInt(a) - parseInt(b);
        });

        // HTML generieren
        const html = sortedEntries.map(([code, description]) =>
          `<div><strong>${code}</strong> - ${description}</div>`
        ).join('');

        allergensList.innerHTML = html;
        // Remove data-i18n attribute to prevent translation system from overwriting content
        allergensList.removeAttribute('data-i18n');
      } else {
        allergensList.removeAttribute('data-i18n');
        allergensList.innerHTML = `<div>${t('errors.loadingAllergens')}</div>`;
      }
    } catch (error) {
      allergensList.removeAttribute('data-i18n');
      allergensList.innerHTML = `<div>${t('errors.loadingAllergens')}</div>`;
    }
  };
  
  // Speisekarte laden
  loadMenu();
  
  // Allergene laden
  loadAllergens();
})();
