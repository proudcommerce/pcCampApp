(() => {
  // Set page title when translations are loaded
  window.addEventListener('translationsLoaded', () => {
    if (window.setPageTitle) {
      window.setPageTitle('pageTitle.timetable');
    }
  });

  const mounts = Array.from(document.querySelectorAll('.timetable-mount'));
  if (!mounts.length) return;
  
  let timetableData = {};
  
  const timeKey = s => {
    const m = /^(\d{1,2}):(\d{2})/.exec(s || '');
    return m ? parseInt(m[1],10)*60+parseInt(m[2],10) : 0;
  };
  
  const slotRange = s => {
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(s || '');
    if (!m) return null;
    const start = parseInt(m[1],10)*60+parseInt(m[2],10);
    const end = parseInt(m[3],10)*60+parseInt(m[4],10);
    return [start,end];
  };
  
  const autoOpen = (container, nowMinutes) => {
    const wrap = container.querySelector('.timetable');
    if (!wrap) return;
    const details = Array.from(wrap.querySelectorAll('details'));
    if (!details.length) return;

    const now = new Date();
    const todayName = now.toLocaleDateString('de-DE', { weekday: 'long' });
    const todayNameCapitalized = todayName.charAt(0).toUpperCase() + todayName.slice(1);

    // Finde den Tab, dessen Summary-Text dem heutigen Wochentag entspricht
    const targetDetail = details.find(d => {
      const summaryText = d.querySelector('summary')?.textContent.trim();
      return summaryText === todayNameCapitalized;
    });

    if (targetDetail) {
      details.forEach(x => x.removeAttribute('open'));
      targetDetail.setAttribute('open','');
      targetDetail.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  const el = (t, cls, txt) => {
    const n = document.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = String(txt);
    return n;
  };
  
  const renderDayContent = (dayData) => {
    const content = el('div','slot-content');
    Object.keys(dayData).sort((a,b)=>timeKey(a)-timeKey(b)).forEach(slot => {
      const slotDiv = el('div','slot');
      slotDiv.appendChild(el('div','muted',slot));
      const sessions = Array.isArray(dayData[slot]) ? dayData[slot] : [];
      sessions.forEach(item => {
        const itemDiv = el('div');
        itemDiv.appendChild(el('div','room',item?.room ?? ''));
        itemDiv.appendChild(el('div','title',item?.title ?? ''));
        slotDiv.appendChild(itemDiv);
      });
      content.appendChild(slotDiv);
    });
    return content;
  };

  const renderInto = (container, data) => {
    if (!data || typeof data !== 'object') return;
    const wrap = el('div','timetable');
    const days = Object.keys(data);

    if (days.length === 1) {
      wrap.appendChild(renderDayContent(data[days[0]] || {}));
    } else {
      days.forEach(day => {
        const d = el('details');
        const s = el('summary',null,day.charAt(0).toUpperCase() + day.slice(1));
        d.appendChild(s);
        d.appendChild(renderDayContent(data[day] || {}));
        wrap.appendChild(d);
      });
    }
    container.replaceChildren(wrap);
  };
  
  const loadTimetableData = async () => {
    try {
      await window.assetHashesReady;
      const response = await fetch(window.contentUrl('timetable/timetable.json'));
      if (!response.ok) throw new Error('Failed to load timetable data');
      timetableData = await response.json();
    } catch (error) {
      console.error('Error loading timetable data:', error);
      return;
    }
    
    mounts.forEach(container => {
      const now = new Date();
      const nowMinutes = now.getHours()*60 + now.getMinutes();
      
      renderInto(container, timetableData);
      autoOpen(container, nowMinutes);
    });
  };

  loadTimetableData();
})();
