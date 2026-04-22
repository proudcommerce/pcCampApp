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

  const makeEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = String(text);
    return el;
  };

  const appendAllergens = (parent, allergens) => {
    if (!allergens || allergens.length === 0) return;
    const sup = document.createElement('sup');
    sup.style.cssText = 'font-size:10px;color:#718096;background:#f7fafc;padding:1px 4px;border-radius:3px;border:1px solid #e2e8f0;margin-left:4px;';
    sup.textContent = allergens.join(', ');
    parent.appendChild(sup);
  };

  const appendNamedLine = (container, name, allergens) => {
    const line = document.createElement('div');
    line.textContent = name != null ? String(name) : '';
    appendAllergens(line, allergens);
    container.appendChild(line);
  };

  const appendMenuItem = (parent, item) => {
    const first = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.name != null ? String(item.name) : '';
    first.appendChild(strong);
    appendAllergens(first, item.allergens);
    parent.appendChild(first);

    if (Array.isArray(item.variants)) {
      item.variants.forEach(v => appendNamedLine(parent, v.name, v.allergens));
    }
    if (Array.isArray(item.toppings)) {
      item.toppings.forEach(t => appendNamedLine(parent, t.name, t.allergens));
    }
    if (Array.isArray(item.fillings)) {
      item.fillings.forEach(f => appendNamedLine(parent, f.name, f.allergens));
    }
    if (item.topping && typeof item.topping === 'object') {
      appendNamedLine(parent, item.topping.name, item.topping.allergens);
    }
    if (item.description) {
      parent.appendChild(makeEl('div', null, item.description));
    }
  };

  const buildMeal = (mealName, items) => {
    const slot = makeEl('div', 'slot');
    slot.appendChild(makeEl('div', 'meal', mealName));
    if (Array.isArray(items)) {
      items.forEach(item => appendMenuItem(slot, item));
    }
    return slot;
  };

  const buildDay = (dayName, meals) => {
    const details = document.createElement('details');
    details.appendChild(makeEl('summary', null, dayName));
    const content = makeEl('div', 'meal-content');
    Object.entries(meals || {}).forEach(([mealName, items]) => {
      content.appendChild(buildMeal(mealName, items));
    });
    details.appendChild(content);
    return details;
  };
  
  const loadMenu = async () => {
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) return;

    try {
      await window.assetHashesReady;
      const response = await fetch(window.contentUrl('food/menue.json'), {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const menu = await response.json();

        menuContainer.replaceChildren();
        Object.entries(menu).forEach(([dayKey, meals]) => {
          const dayName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
          menuContainer.appendChild(buildDay(dayName, meals));
        });
        // Remove data-i18n attribute to prevent translation system from overwriting content
        menuContainer.removeAttribute('data-i18n');

        // Auto-open nach dem Laden
        autoOpenToday();
      } else {
        menuContainer.removeAttribute('data-i18n');
        menuContainer.replaceChildren(makeEl('div', null, t('errors.loadingMenu')));
      }
    } catch (error) {
      menuContainer.removeAttribute('data-i18n');
      menuContainer.replaceChildren(makeEl('div', null, t('errors.loadingMenu')));
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
      await window.assetHashesReady;
      const response = await fetch(window.contentUrl('food/allergene.json'), {
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

        allergensList.replaceChildren();
        sortedEntries.forEach(([code, description]) => {
          const row = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = String(code);
          row.appendChild(strong);
          row.appendChild(document.createTextNode(' - ' + (description != null ? String(description) : '')));
          allergensList.appendChild(row);
        });
        // Remove data-i18n attribute to prevent translation system from overwriting content
        allergensList.removeAttribute('data-i18n');
      } else {
        allergensList.removeAttribute('data-i18n');
        allergensList.replaceChildren(makeEl('div', null, t('errors.loadingAllergens')));
      }
    } catch (error) {
      allergensList.removeAttribute('data-i18n');
      allergensList.replaceChildren(makeEl('div', null, t('errors.loadingAllergens')));
    }
  };
  
  // Speisekarte laden
  loadMenu();
  
  // Allergene laden
  loadAllergens();
})();
