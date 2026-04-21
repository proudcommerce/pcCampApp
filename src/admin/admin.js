/**
 * Admin Content Management UI
 * Provides structured editors for all JSON data resources.
 * ADMIN_KEY is injected by index.php via <script> tag.
 */
(() => {
  // State
  let currentResource = 'sessions';
  let currentData = null;
  let isRawMode = false;

  // DOM elements
  const structuredEditor = document.getElementById('structured-editor');
  const rawEditor = document.getElementById('raw-editor');
  const jsonTextarea = document.getElementById('json-textarea');
  const jsonError = document.getElementById('json-error');
  const loading = document.getElementById('loading');
  const resourceLabel = document.getElementById('resource-label');
  const modeToggle = document.getElementById('mode-toggle');
  const btnSave = document.getElementById('btn-save');
  const messageContainer = document.getElementById('message-container');
  const editorToolbar = document.getElementById('editor-toolbar');
  const votingPanel = document.getElementById('voting-panel');

  // Resource display names
  const resourceNames = {
    sessions: 'Sessions',
    timetable: 'Timetable',
    news: 'News',
    food: 'Food',
    allergene: 'Allergene',
    sponsors: 'Sponsors',
    menu: 'Menu',
    event: 'Event-Config'
  };

  // Resources that only support the raw JSON editor (no structured view).
  const rawOnlyResources = new Set(['event']);

  // ─── API Helper ───────────────────────────────────────────────

  async function apiCall(action, resource, data) {
    const body = { key: ADMIN_KEY, action, resource };
    if (data !== undefined) body.data = data;

    const response = await fetch('./api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'API error');
    return result;
  }

  // ─── Messages ─────────────────────────────────────────────────

  function showMessage(text, type) {
    const div = document.createElement('div');
    div.className = type === 'success' ? 'success-message' : 'error-message';
    div.textContent = text;
    messageContainer.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  // ─── Data Loading ─────────────────────────────────────────────

  async function loadResource(resource) {
    currentResource = resource;

    // Update tab styling
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.resource === resource);
    });

    // Voting tab: show voting panel, hide content editor
    if (resource === 'voting') {
      editorToolbar.style.display = 'none';
      structuredEditor.style.display = 'none';
      rawEditor.style.display = 'none';
      loading.classList.remove('visible');
      votingPanel.style.display = '';
      return;
    }

    // Content tabs: show editor, hide voting panel.
    const forceRaw = rawOnlyResources.has(resource);
    const effectiveRaw = isRawMode || forceRaw;
    votingPanel.style.display = 'none';
    editorToolbar.style.display = '';
    structuredEditor.style.display = effectiveRaw ? 'none' : '';
    rawEditor.style.display = effectiveRaw ? '' : 'none';
    if (modeToggle) modeToggle.disabled = forceRaw;

    resourceLabel.textContent = resourceNames[resource] || resource;
    structuredEditor.innerHTML = '';
    loading.classList.add('visible');

    try {
      const result = await apiCall('get', resource);
      currentData = result.data;

      loading.classList.remove('visible');
      renderEditor();
    } catch (err) {
      loading.classList.remove('visible');
      showMessage('Fehler beim Laden: ' + err.message, 'error');
    }
  }

  // ─── Rendering Dispatch ───────────────────────────────────────

  function renderEditor() {
    const effectiveRaw = isRawMode || rawOnlyResources.has(currentResource);
    if (effectiveRaw) {
      jsonTextarea.value = JSON.stringify(currentData, null, 2);
      jsonError.style.display = 'none';
    } else {
      renderStructuredEditor();
    }
  }

  function renderStructuredEditor() {
    const renderers = {
      sessions: renderSessions,
      timetable: renderTimetable,
      news: renderNews,
      food: renderFood,
      allergene: renderAllergene,
      sponsors: renderSponsors,
      menu: renderMenu
    };

    const render = renderers[currentResource];
    if (render) {
      render();
    } else {
      structuredEditor.innerHTML = '<div class="empty-state"><p>Kein Editor verfügbar</p></div>';
    }
  }

  // ─── Collect Data from Structured Editor ──────────────────────

  function collectData() {
    const effectiveRaw = isRawMode || rawOnlyResources.has(currentResource);
    if (effectiveRaw) {
      try {
        const parsed = JSON.parse(jsonTextarea.value);
        jsonError.style.display = 'none';
        return parsed;
      } catch (e) {
        jsonError.textContent = 'JSON ungültig: ' + e.message;
        jsonError.style.display = '';
        return null;
      }
    }

    const collectors = {
      sessions: collectSessions,
      timetable: collectTimetable,
      news: collectNews,
      food: collectFood,
      allergene: collectAllergene,
      sponsors: collectSponsors,
      menu: collectMenu
    };

    const collect = collectors[currentResource];
    return collect ? collect() : currentData;
  }

  // ─── Save & Restore ───────────────────────────────────────────

  async function save() {
    const data = collectData();
    if (data === null) return;

    btnSave.disabled = true;
    btnSave.textContent = 'Speichern...';

    try {
      await apiCall('update', currentResource, data);
      currentData = data;
      showMessage(resourceNames[currentResource] + ' gespeichert', 'success');
    } catch (err) {
      showMessage('Fehler beim Speichern: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Speichern';
    }
  }


  // ─── Utility: Create HTML Elements ────────────────────────────

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'className') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      });
    }
    if (children !== undefined) {
      if (Array.isArray(children)) children.forEach(c => { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      else if (typeof children === 'string') el.textContent = children;
      else if (children instanceof Node) el.appendChild(children);
    }
    return el;
  }

  function inputField(label, value, attrs) {
    const field = h('div', { className: 'item-field' + (attrs && attrs.fullWidth ? ' full-width' : '') });
    field.appendChild(h('label', null, label));
    const inputAttrs = { type: 'text', value: value || '' };
    if (attrs) {
      if (attrs.name) inputAttrs['data-name'] = attrs.name;
      if (attrs.placeholder) inputAttrs.placeholder = attrs.placeholder;
    }
    field.appendChild(h('input', inputAttrs));
    return field;
  }

  function textareaField(label, value, attrs) {
    const field = h('div', { className: 'item-field' + (attrs && attrs.fullWidth ? ' full-width' : '') });
    field.appendChild(h('label', null, label));
    const ta = h('textarea', { rows: '3' }, value || '');
    if (attrs && attrs.name) ta.setAttribute('data-name', attrs.name);
    field.appendChild(ta);
    return field;
  }

  function deleteButton(onClick) {
    const btn = h('button', { className: 'btn-icon danger', title: 'Entfernen', onClick }, '\u00D7');
    return btn;
  }

  // Delete button for whole groups (timeslots, meals, news dates).
  // Asks for confirmation via native confirm() — acceptable here because it's admin-only.
  function groupDeleteButton(label, onConfirm) {
    return h('button', {
      className: 'btn btn-small btn-danger',
      title: 'Gruppe l\u00f6schen',
      onClick: () => {
        if (confirm(`${label} wirklich l\u00f6schen? Alle Eintr\u00e4ge darin gehen verloren.`)) {
          onConfirm();
        }
      }
    }, '\u00D7');
  }

  // Inline prompt replacement (prompt() fails in many mobile/embedded browsers)
  function inlinePrompt(button, placeholder, onSubmit) {
    // Replace button with input + confirm
    const wrapper = h('div', { className: 'inline-prompt' });
    const input = h('input', { type: 'text', placeholder, className: 'inline-prompt-input' });
    const ok = h('button', { className: 'btn btn-primary btn-small', onClick: () => {
      const val = input.value.trim();
      if (val) { onSubmit(val); }
      wrapper.replaceWith(button);
    } }, 'OK');
    const cancel = h('button', { className: 'btn btn-small', style: 'background:#e5e7eb;color:#374151;', onClick: () => {
      wrapper.replaceWith(button);
    } }, 'Abbrechen');
    wrapper.appendChild(input);
    wrapper.appendChild(ok);
    wrapper.appendChild(cancel);
    button.replaceWith(wrapper);
    input.focus();
  }

  // ─── Day-based Tab Helper ─────────────────────────────────────

  function renderDayTabs(data, renderDayContent) {
    const days = Object.keys(data);
    if (days.length === 0) {
      structuredEditor.innerHTML = '<div class="empty-state"><p>Keine Tage vorhanden</p></div>';
      return;
    }

    const container = document.createDocumentFragment();

    // Day tabs
    const tabsDiv = h('div', { className: 'day-tabs' });
    days.forEach((day, i) => {
      const tabWrapper = h('div', { className: 'day-tab-wrapper' + (i === 0 ? ' active' : '') });
      const tab = h('button', {
        className: 'day-tab' + (i === 0 ? ' active' : ''),
        'data-day': day,
        onClick: () => {
          tabsDiv.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
          tabsDiv.querySelectorAll('.day-tab-wrapper').forEach(w => w.classList.remove('active'));
          tab.classList.add('active');
          tabWrapper.classList.add('active');
          contentDivs.forEach(d => d.style.display = 'none');
          contentDivs[i].style.display = '';
        }
      }, day.charAt(0).toUpperCase() + day.slice(1));
      const delTab = h('button', {
        className: 'day-tab-delete',
        title: 'Tag l\u00f6schen',
        onClick: () => {
          if (confirm(`Tag "${day}" wirklich l\u00f6schen? Alle Eintr\u00e4ge darin gehen verloren.`)) {
            delete data[day];
            renderEditor();
          }
        }
      }, '\u00D7');
      tabWrapper.appendChild(tab);
      tabWrapper.appendChild(delTab);
      tabsDiv.appendChild(tabWrapper);
    });

    // Add day button
    const addDayBtn = h('button', { className: 'day-tab', style: 'border-style:dashed;' }, '+ Tag');
    addDayBtn.addEventListener('click', () => {
      inlinePrompt(addDayBtn, 'z.B. Samstag', (name) => {
        data[name.toLowerCase()] = {};
        renderEditor();
      });
    });
    tabsDiv.appendChild(addDayBtn);

    container.appendChild(tabsDiv);

    // Day content
    const contentDivs = [];
    days.forEach((day, i) => {
      const dayDiv = h('div', { 'data-day-content': day });
      if (i > 0) dayDiv.style.display = 'none';
      renderDayContent(dayDiv, day, data[day]);
      container.appendChild(dayDiv);
      contentDivs.push(dayDiv);
    });

    structuredEditor.innerHTML = '';
    structuredEditor.appendChild(container);
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSIONS EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderSessions() {
    renderDayTabs(currentData, (container, day, timeslots) => {
      const slots = Object.keys(timeslots);

      slots.forEach(slot => {
        const group = h('div', { className: 'timeslot-group' });

        // Timeslot header
        const header = h('div', { className: 'timeslot-header' });
        header.appendChild(h('h3', null, slot));
        const headerActions = h('div', { className: 'timeslot-header-actions' });
        headerActions.appendChild(h('button', {
          className: 'btn btn-small btn-secondary',
          onClick: () => {
            timeslots[slot].push({ id: String(Date.now()).slice(-6), room: '', title: '', host: '', votes: 0, cancelled: false });
            renderEditor();
          }
        }, '+ Session'));
        headerActions.appendChild(groupDeleteButton(`Zeitslot "${slot}"`, () => {
          delete timeslots[slot];
          renderEditor();
        }));
        header.appendChild(headerActions);
        group.appendChild(header);

        // Sessions
        timeslots[slot].forEach((session, idx) => {
          group.appendChild(renderSessionCard(session, () => {
            timeslots[slot].splice(idx, 1);
            renderEditor();
          }));
        });

        container.appendChild(group);
      });

      // Add timeslot
      const addSlotBtn = h('button', { className: 'btn-add' }, '+ Zeitslot hinzufügen');
      addSlotBtn.addEventListener('click', () => {
        inlinePrompt(addSlotBtn, '14:00 - 15:00', (slot) => {
          timeslots[slot] = [];
          renderEditor();
        });
      });
      container.appendChild(addSlotBtn);
    });
  }

  function renderSessionCard(session, onDelete) {
    const card = h('div', { className: 'item-card', 'data-type': 'session' });
    const row1 = h('div', { className: 'item-row' });
    row1.appendChild(inputField('ID', session.id, { name: 'id' }));
    row1.appendChild(inputField('Raum', session.room, { name: 'room' }));
    card.appendChild(row1);

    const row2 = h('div', { className: 'item-row' });
    row2.appendChild(inputField('Titel', session.title, { name: 'title', fullWidth: true }));
    card.appendChild(row2);

    const row3 = h('div', { className: 'item-row' });
    row3.appendChild(inputField('Host', session.host, { name: 'host' }));

    const cancelField = h('div', { className: 'item-field' });
    cancelField.appendChild(h('label', null, 'Status'));
    const cb = h('div', { className: 'item-checkbox' });
    const checkbox = h('input', { type: 'checkbox', 'data-name': 'cancelled' });
    checkbox.checked = session.cancelled || false;
    cb.appendChild(checkbox);
    cb.appendChild(h('label', null, 'Abgesagt'));
    cancelField.appendChild(cb);
    row3.appendChild(cancelField);
    card.appendChild(row3);

    const actions = h('div', { className: 'item-actions' });
    actions.appendChild(deleteButton(onDelete));
    card.appendChild(actions);

    return card;
  }

  function collectSessions() {
    const data = {};
    structuredEditor.querySelectorAll('[data-day-content]').forEach(dayDiv => {
      const day = dayDiv.getAttribute('data-day-content');
      data[day] = {};

      dayDiv.querySelectorAll('.timeslot-group').forEach(group => {
        const slot = group.querySelector('h3').textContent;
        const sessions = [];

        group.querySelectorAll('.item-card[data-type="session"]').forEach(card => {
          sessions.push({
            id: card.querySelector('[data-name="id"]').value,
            room: card.querySelector('[data-name="room"]').value,
            title: card.querySelector('[data-name="title"]').value,
            host: card.querySelector('[data-name="host"]').value,
            votes: 0,
            cancelled: card.querySelector('[data-name="cancelled"]').checked
          });
        });

        data[day][slot] = sessions;
      });
    });
    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // TIMETABLE EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderTimetable() {
    renderDayTabs(currentData, (container, day, slots) => {
      Object.keys(slots).forEach(time => {
        const group = h('div', { className: 'timeslot-group' });
        const header = h('div', { className: 'timeslot-header' });
        header.appendChild(h('h3', null, time));
        const headerActions = h('div', { className: 'timeslot-header-actions' });
        headerActions.appendChild(h('button', {
          className: 'btn btn-small btn-secondary',
          onClick: () => {
            slots[time].push({ room: '', title: '' });
            renderEditor();
          }
        }, '+ Eintrag'));
        headerActions.appendChild(groupDeleteButton(`Zeitslot "${time}"`, () => {
          delete slots[time];
          renderEditor();
        }));
        header.appendChild(headerActions);
        group.appendChild(header);

        slots[time].forEach((item, idx) => {
          const card = h('div', { className: 'item-card', 'data-type': 'timetable-item' });
          const row = h('div', { className: 'item-row' });
          row.appendChild(inputField('Raum', item.room, { name: 'room' }));
          row.appendChild(inputField('Titel', item.title, { name: 'title' }));
          card.appendChild(row);

          const actions = h('div', { className: 'item-actions' });
          actions.appendChild(deleteButton(() => { slots[time].splice(idx, 1); renderEditor(); }));
          card.appendChild(actions);

          group.appendChild(card);
        });

        container.appendChild(group);
      });

      const addTimeBtn = h('button', { className: 'btn-add' }, '+ Zeitslot hinzufügen');
      addTimeBtn.addEventListener('click', () => {
        inlinePrompt(addTimeBtn, '09:00 - 10:00 Uhr', (time) => {
          slots[time] = [];
          renderEditor();
        });
      });
      container.appendChild(addTimeBtn);
    });
  }

  function collectTimetable() {
    const data = {};
    structuredEditor.querySelectorAll('[data-day-content]').forEach(dayDiv => {
      const day = dayDiv.getAttribute('data-day-content');
      data[day] = {};

      dayDiv.querySelectorAll('.timeslot-group').forEach(group => {
        const time = group.querySelector('h3').textContent;
        const items = [];

        group.querySelectorAll('.item-card[data-type="timetable-item"]').forEach(card => {
          items.push({
            room: card.querySelector('[data-name="room"]').value,
            title: card.querySelector('[data-name="title"]').value
          });
        });

        data[day][time] = items;
      });
    });
    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // NEWS EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderNews() {
    structuredEditor.innerHTML = '';

    // Permanent news
    const permSection = h('div', { className: 'news-section' });
    permSection.appendChild(h('h3', null, 'Permanente News'));

    (currentData.permanent || []).forEach((item, idx) => {
      permSection.appendChild(renderNewsCard(item, 'permanent', () => {
        currentData.permanent.splice(idx, 1);
        renderEditor();
      }));
    });

    permSection.appendChild(h('button', {
      className: 'btn-add',
      onClick: () => {
        if (!currentData.permanent) currentData.permanent = [];
        currentData.permanent.push({ id: String(Date.now()).slice(-6), content: '', priority: 'medium' });
        renderEditor();
      }
    }, '+ Permanente News'));

    structuredEditor.appendChild(permSection);

    // Day-specific news
    const daysSection = h('div', { className: 'news-section' });
    daysSection.appendChild(h('h3', null, 'Tagesspezifische News'));

    const days = currentData.days || {};
    Object.keys(days).forEach(date => {
      const dateGroup = h('div', { className: 'timeslot-group' });
      const header = h('div', { className: 'timeslot-header' });
      header.appendChild(h('h3', null, date));
      const headerActions = h('div', { className: 'timeslot-header-actions' });
      headerActions.appendChild(h('button', {
        className: 'btn btn-small btn-secondary',
        onClick: () => {
          days[date].push({ id: String(Date.now()).slice(-6), content: '', timeFrom: '', timeTo: '', priority: 'medium' });
          renderEditor();
        }
      }, '+ News'));
      headerActions.appendChild(groupDeleteButton(`Tag "${date}"`, () => {
        delete days[date];
        renderEditor();
      }));
      header.appendChild(headerActions);
      dateGroup.appendChild(header);

      days[date].forEach((item, idx) => {
        dateGroup.appendChild(renderNewsCard(item, 'day', () => {
          days[date].splice(idx, 1);
          if (days[date].length === 0) delete days[date];
          renderEditor();
        }));
      });

      daysSection.appendChild(dateGroup);
    });

    const addDateBtn = h('button', { className: 'btn-add' }, '+ Tag hinzufügen');
    addDateBtn.addEventListener('click', () => {
      inlinePrompt(addDateBtn, '2025-11-15', (date) => {
        if (!currentData.days) currentData.days = {};
        currentData.days[date] = [];
        renderEditor();
      });
    });
    daysSection.appendChild(addDateBtn);

    structuredEditor.appendChild(daysSection);
  }

  function renderNewsCard(item, type, onDelete) {
    const card = h('div', { className: 'item-card', 'data-type': 'news-item' });

    const row1 = h('div', { className: 'item-row' });
    row1.appendChild(inputField('ID', item.id, { name: 'id' }));

    // Priority select
    const prioField = h('div', { className: 'item-field' });
    prioField.appendChild(h('label', null, 'Priorität'));
    const select = h('select', { 'data-name': 'priority' });
    ['low', 'medium', 'high'].forEach(p => {
      const opt = h('option', { value: p }, p);
      if (item.priority === p) opt.selected = true;
      select.appendChild(opt);
    });
    prioField.appendChild(select);
    row1.appendChild(prioField);
    card.appendChild(row1);

    // Content
    card.appendChild(textareaField('Inhalt', item.content, { name: 'content', fullWidth: true }));

    // Time fields (only for day-specific)
    if (type === 'day') {
      const row2 = h('div', { className: 'item-row' });
      row2.appendChild(inputField('Von', item.timeFrom, { name: 'timeFrom', placeholder: 'HH:MM' }));
      row2.appendChild(inputField('Bis', item.timeTo, { name: 'timeTo', placeholder: 'HH:MM' }));
      card.appendChild(row2);
    }

    const actions = h('div', { className: 'item-actions' });
    actions.appendChild(deleteButton(onDelete));
    card.appendChild(actions);

    return card;
  }

  function collectNews() {
    const data = { permanent: [], days: {} };

    const sections = structuredEditor.querySelectorAll('.news-section');
    // First section = permanent
    if (sections[0]) {
      sections[0].querySelectorAll('.item-card[data-type="news-item"]').forEach(card => {
        data.permanent.push({
          id: card.querySelector('[data-name="id"]').value,
          content: card.querySelector('[data-name="content"]').value,
          priority: card.querySelector('[data-name="priority"]').value
        });
      });
    }

    // Second section = days
    if (sections[1]) {
      sections[1].querySelectorAll('.timeslot-group').forEach(group => {
        const date = group.querySelector('h3').textContent;
        data.days[date] = [];

        group.querySelectorAll('.item-card[data-type="news-item"]').forEach(card => {
          data.days[date].push({
            id: card.querySelector('[data-name="id"]').value,
            content: card.querySelector('[data-name="content"]').value,
            timeFrom: card.querySelector('[data-name="timeFrom"]').value,
            timeTo: card.querySelector('[data-name="timeTo"]').value,
            priority: card.querySelector('[data-name="priority"]').value
          });
        });
      });
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOD EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderFood() {
    renderDayTabs(currentData, (container, day, meals) => {
      Object.keys(meals).forEach(meal => {
        const group = h('div', { className: 'timeslot-group' });
        const header = h('div', { className: 'timeslot-header' });
        header.appendChild(h('h3', null, meal));
        const headerActions = h('div', { className: 'timeslot-header-actions' });
        headerActions.appendChild(h('button', {
          className: 'btn btn-small btn-secondary',
          onClick: () => {
            meals[meal].push({ name: '' });
            renderEditor();
          }
        }, '+ Gericht'));
        headerActions.appendChild(groupDeleteButton(`Mahlzeit "${meal}"`, () => {
          delete meals[meal];
          renderEditor();
        }));
        header.appendChild(headerActions);
        group.appendChild(header);

        meals[meal].forEach((item, idx) => {
          const card = h('div', { className: 'item-card', 'data-type': 'food-item' });
          const row = h('div', { className: 'item-row' });
          row.appendChild(inputField('Gericht', item.name, { name: 'name' }));
          row.appendChild(inputField('Allergene', (item.allergens || []).join(', '), { name: 'allergens', placeholder: 'z.B. A, C, G' }));
          card.appendChild(row);

          const actions = h('div', { className: 'item-actions' });
          actions.appendChild(deleteButton(() => { meals[meal].splice(idx, 1); renderEditor(); }));
          card.appendChild(actions);

          group.appendChild(card);
        });

        container.appendChild(group);
      });

      const addMealBtn = h('button', { className: 'btn-add' }, '+ Mahlzeit hinzufügen');
      addMealBtn.addEventListener('click', () => {
        inlinePrompt(addMealBtn, 'Frühstück, Mittagessen, ...', (meal) => {
          meals[meal] = [];
          renderEditor();
        });
      });
      container.appendChild(addMealBtn);
    });
  }

  function collectFood() {
    const data = {};
    structuredEditor.querySelectorAll('[data-day-content]').forEach(dayDiv => {
      const day = dayDiv.getAttribute('data-day-content');
      data[day] = {};

      dayDiv.querySelectorAll('.timeslot-group').forEach(group => {
        const meal = group.querySelector('h3').textContent;
        const items = [];

        group.querySelectorAll('.item-card[data-type="food-item"]').forEach(card => {
          const item = { name: card.querySelector('[data-name="name"]').value };
          const allergensStr = card.querySelector('[data-name="allergens"]').value.trim();
          if (allergensStr) {
            item.allergens = allergensStr.split(',').map(s => s.trim()).filter(Boolean);
          }
          items.push(item);
        });

        data[day][meal] = items;
      });
    });
    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // ALLERGENE EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderAllergene() {
    structuredEditor.innerHTML = '';

    const entries = Object.entries(currentData);
    entries.forEach(([code, desc], idx) => {
      const row = h('div', { className: 'allergen-row' });
      row.appendChild(h('input', { type: 'text', value: code, 'data-name': 'code', style: 'font-weight:600;text-align:center;' }));
      row.appendChild(h('input', { type: 'text', value: desc, 'data-name': 'desc' }));
      row.appendChild(deleteButton(() => {
        delete currentData[code];
        renderEditor();
      }));
      structuredEditor.appendChild(row);
    });

    const addAllergenBtn = h('button', { className: 'btn-add' }, '+ Allergen hinzufügen');
    addAllergenBtn.addEventListener('click', () => {
      inlinePrompt(addAllergenBtn, 'Code z.B. H', (code) => {
        currentData[code.toUpperCase()] = '';
        renderEditor();
      });
    });
    structuredEditor.appendChild(addAllergenBtn);
  }

  function collectAllergene() {
    const data = {};
    structuredEditor.querySelectorAll('.allergen-row').forEach(row => {
      const code = row.querySelector('[data-name="code"]').value.trim();
      const desc = row.querySelector('[data-name="desc"]').value.trim();
      if (code) data[code] = desc;
    });
    return data;
  }

  // ═══════════════════════════════════════════════════════════════
  // SPONSORS EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderSponsors() {
    structuredEditor.innerHTML = '';

    const sponsors = currentData.sponsors || [];
    sponsors.forEach((sponsor, idx) => {
      const card = h('div', { className: 'item-card', 'data-type': 'sponsor' });

      const row1 = h('div', { className: 'item-row' });
      row1.appendChild(inputField('Name', sponsor.name, { name: 'name' }));
      row1.appendChild(inputField('Logo-Datei', sponsor.logo, { name: 'logo' }));
      card.appendChild(row1);

      const row2 = h('div', { className: 'item-row' });
      row2.appendChild(inputField('URL', sponsor.url, { name: 'url', fullWidth: true }));
      card.appendChild(row2);

      card.appendChild(textareaField('Beschreibung', sponsor.beschreibung, { name: 'beschreibung', fullWidth: true }));

      const actions = h('div', { className: 'item-actions' });
      actions.appendChild(deleteButton(() => {
        sponsors.splice(idx, 1);
        renderEditor();
      }));
      card.appendChild(actions);

      structuredEditor.appendChild(card);
    });

    structuredEditor.appendChild(h('button', {
      className: 'btn-add',
      onClick: () => {
        sponsors.push({ name: '', logo: 'sponsor-placeholder.png', url: '', beschreibung: '' });
        renderEditor();
      }
    }, '+ Sponsor hinzufügen'));
  }

  function collectSponsors() {
    const sponsors = [];
    structuredEditor.querySelectorAll('.item-card[data-type="sponsor"]').forEach(card => {
      sponsors.push({
        name: card.querySelector('[data-name="name"]').value,
        logo: card.querySelector('[data-name="logo"]').value,
        url: card.querySelector('[data-name="url"]').value,
        beschreibung: card.querySelector('[data-name="beschreibung"]').value
      });
    });
    return { sponsors };
  }

  // ═══════════════════════════════════════════════════════════════
  // MENU EDITOR
  // ═══════════════════════════════════════════════════════════════

  function renderMenu() {
    structuredEditor.innerHTML = '';

    const items = currentData.items || [];
    items.forEach((item, idx) => {
      const card = h('div', { className: 'item-card menu-item-card', 'data-type': 'menu-item' });

      const row1 = h('div', { className: 'item-row' });
      row1.appendChild(inputField('Titel', item.title, { name: 'title' }));
      row1.appendChild(inputField('URL', item.url, { name: 'url' }));
      card.appendChild(row1);

      const row2 = h('div', { className: 'item-row' });
      row2.appendChild(inputField('Beschreibung', item.description, { name: 'description' }));
      row2.appendChild(inputField('Icon', item.icon, { name: 'icon' }));
      card.appendChild(row2);

      const row3 = h('div', { className: 'item-row' });
      const activeField = h('div', { className: 'item-field' });
      activeField.appendChild(h('label', null, 'Sichtbar'));
      const cb = h('div', { className: 'item-checkbox' });
      const checkbox = h('input', { type: 'checkbox', 'data-name': 'active' });
      checkbox.checked = item.active !== false;
      cb.appendChild(checkbox);
      cb.appendChild(h('label', null, 'Aktiv'));
      activeField.appendChild(cb);
      row3.appendChild(activeField);
      card.appendChild(row3);

      const actions = h('div', { className: 'item-actions' });
      actions.appendChild(deleteButton(() => { items.splice(idx, 1); renderEditor(); }));
      card.appendChild(actions);

      structuredEditor.appendChild(card);
    });

    structuredEditor.appendChild(h('button', {
      className: 'btn-add',
      onClick: () => {
        items.push({ title: '', url: '', description: '', icon: 'calendar', active: true });
        renderEditor();
      }
    }, '+ Menüpunkt hinzufügen'));
  }

  function collectMenu() {
    const items = [];
    structuredEditor.querySelectorAll('.item-card[data-type="menu-item"]').forEach(card => {
      items.push({
        title: card.querySelector('[data-name="title"]').value,
        url: card.querySelector('[data-name="url"]').value,
        description: card.querySelector('[data-name="description"]').value,
        icon: card.querySelector('[data-name="icon"]').value,
        active: card.querySelector('[data-name="active"]').checked
      });
    });
    return { items };
  }

  // ─── Event Listeners ──────────────────────────────────────────

  // Tab clicks
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => loadResource(tab.dataset.resource));
  });

  // Mode toggle
  modeToggle.addEventListener('change', () => {
    isRawMode = modeToggle.checked;

    if (isRawMode) {
      // Collect current structured data before switching
      const collected = collectData();
      if (collected) currentData = collected;
      jsonTextarea.value = JSON.stringify(currentData, null, 2);
      jsonError.style.display = 'none';
    } else {
      // Parse raw JSON before switching back
      try {
        currentData = JSON.parse(jsonTextarea.value);
      } catch (e) {
        showMessage('JSON ungültig — bleibe im Raw-Modus', 'error');
        modeToggle.checked = true;
        isRawMode = true;
        return;
      }
    }

    structuredEditor.style.display = isRawMode ? 'none' : '';
    rawEditor.style.display = isRawMode ? '' : 'none';

    if (!isRawMode) renderStructuredEditor();
  });

  // Save & Restore
  btnSave.addEventListener('click', save);

  // Keyboard shortcut: Ctrl+S / Cmd+S
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });

  // ─── Init ─────────────────────────────────────────────────────

  loadResource('sessions');
})();
