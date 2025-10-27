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
			window.setPageTitle('pageTitle.sessionplan');
		}
	});

	// Dynamische Tage-Reihenfolge basierend auf JSON-Daten
	let availableDays = [];

	const getDayOrder = () => {
		// Wenn JSON noch nicht geladen wurde, return empty
		if (availableDays.length === 0) {
			return [];
		}

		const now = new Date();
		const todayName = now.toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase();

		// Finde den heutigen Tag in den verfügbaren Tagen
		const todayIndex = availableDays.findIndex(d => d.name.toLowerCase() === todayName);

		if (todayIndex !== -1) {
			// Wenn heute gefunden wurde, zeige heute zuerst, dann die anderen
			const today = { ...availableDays[todayIndex], lazy: false };
			const otherDays = availableDays
				.filter((_, i) => i !== todayIndex)
				.map(d => ({ ...d, lazy: true }));
			return [today, ...otherDays];
		} else {
			// Fallback: Zeige alle Tage in ursprünglicher Reihenfolge, ersten Tag nicht lazy
			return availableDays.map((d, i) => ({ ...d, lazy: i !== 0 }));
		}
	};
	
	// Lade verfügbare Tage aus JSON und erstelle Container
	const initializeDaysContainer = async () => {
		const container = document.getElementById('sessionplan-days-container');
		if (!container) return;

		try {
			// Lade sessions.json um verfügbare Tage zu ermitteln
			const sessionsFileName = './sessions.json';
			const response = await fetch(sessionsFileName, {
				credentials: 'same-origin',
				headers: { 'Accept': 'application/json' },
				cache: 'no-cache'
			});

			if (!response.ok) {
				throw new Error('Failed to load sessions data');
			}

			const sessionsData = await response.json();

			// Extrahiere verfügbare Tage aus JSON-Keys
			availableDays = Object.keys(sessionsData).map(dayKey => ({
				day: dayKey,
				name: dayKey.charAt(0).toUpperCase() + dayKey.slice(1) // Capitalize first letter
			}));

			// Erstelle Tages-Container basierend auf dynamischer Reihenfolge
			const dayOrder = getDayOrder();
			dayOrder.forEach((dayInfo, index) => {
				const h2 = document.createElement('h2');
				h2.style.cssText = 'font:600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:24px 0;text-align:center';
				h2.textContent = dayInfo.name;
				container.appendChild(h2);

				const mount = document.createElement('div');
				mount.className = 'sessionplan-mount';
				mount.setAttribute('data-src', sessionsFileName);
				mount.setAttribute('data-day', dayInfo.day);
				if (dayInfo.lazy) {
					mount.setAttribute('data-lazy', 'true');
				}
				container.appendChild(mount);

				if (index < dayOrder.length - 1) {
					const br = document.createElement('br');
					container.appendChild(br);
				}
			});

			// Initialisiere Session-Loading nach Container-Erstellung
			initializeSessionLoading();
		} catch (error) {
			console.error('Error initializing days container:', error);
			container.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;">${t('errors.loadingSessions')}</div>`;
		}
	};
	
	// Lazy Loading Observer wird nach Container-Erstellung initialisiert
	const initializeSessionLoading = () => {
		const mounts = Array.from(document.querySelectorAll('.sessionplan-mount'));
		if (!mounts.length) return;

		// Lazy Loading Observer
	const lazyObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				const container = entry.target;
				const isLazy = container.getAttribute('data-lazy') === 'true';
				if (isLazy && !container.hasAttribute('data-loaded')) {
					loadSessionData(container);
					container.setAttribute('data-loaded', 'true');
					lazyObserver.unobserve(container);
				}
			}
		});
	}, { rootMargin: '50px' });
	
	// Session-Cache entfernt - Daten werden immer aktuell geladen
	
	// Cache-Hashes werden nicht mehr benötigt - verwende Original-Dateinamen
	
		// Lade Session-Daten ohne Caching (immer aktuell)
		const loadSessionData = async (container) => {
			const src = container.getAttribute('data-src');
			const day = container.getAttribute('data-day');
			
			// Cache-Hashes werden nicht mehr verwendet
			
			// Lade direkt von Server (ohne Cache)
			try {
				const response = await fetch(src, {
					credentials: 'same-origin',
					headers: { 'Accept': 'application/json' },
					cache: 'no-cache' // Verhindert Browser-Caching
				});
			
			if (response.ok) {
				const allData = await response.json();
				// Filtere Daten nach dem gewünschten Tag
				const dayData = allData[day] || {};
				renderInto(container, dayData);
			} else {
				throw new Error('Failed to load session data');
			}
		} catch (error) {
			console.error('Error loading session data:', error);
			// Fallback zu Inline-Daten falls vorhanden
			const inlineId = container.getAttribute('data-inline-id');
			const data = readInline(inlineId);
			if (data) {
				renderInto(container, data);
			}
		}
	};
	
	const readInline = id => {
		const el = id ? document.getElementById(id) : null;
		if (!el) return null;
		try { return JSON.parse(el.textContent || '{}'); } catch { return null; }
	};
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
	const autoOpen = (container,isToday,nowMinutes) => {
		if (!isToday) return;
		const wrap = container.querySelector('.sessionplan');
		if (!wrap) return;
		const details = Array.from(wrap.querySelectorAll('details'));
		if (!details.length) return;
		const buckets = details.map(d => {
			const label = d.querySelector('summary')?.textContent || '';
			return { d, range: slotRange(label) };
		});
		let candidate = null;
		
		// Erst versuchen, den aktuellen Zeitslot zu finden
		for (let i=0;i<buckets.length;i++) {
			const r = buckets[i].range;
			if (r && nowMinutes >= r[0] && nowMinutes < r[1]) { 
				candidate = buckets[i]; 
				break; 
			}
		}
		
		// Falls kein aktueller Slot gefunden, den nächsten anstehenden Slot finden
		if (!candidate) {
			for (let i=0;i<buckets.length;i++) {
				const r = buckets[i].range;
				if (r && nowMinutes < r[0]) { 
					candidate = buckets[i]; 
					break; 
				}
			}
		}
		
		// Falls immer noch nichts gefunden, den letzten vergangenen Slot nehmen
		if (!candidate) {
			for (let i=buckets.length-1;i>=0;i--) {
				const r = buckets[i].range;
				if (r && nowMinutes >= r[0]) { 
					candidate = buckets[i]; 
					break; 
				}
			}
		}
		
		if (candidate) {
			details.forEach(x => x.removeAttribute('open'));
			candidate.d.setAttribute('open','');
			candidate.d.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	};
	const el = (t,cls,txt) => {
		const n = document.createElement(t);
		if (cls) n.className = cls;
		if (txt != null) n.textContent = String(txt);
		return n;
	};
	const createFavoriteButton = (sessionId) => {
		const btn = el('button', 'favorite-btn');
		btn.setAttribute('aria-label', t('favorites.addLabel'));
		btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

		const updateButton = () => {
			const isFavorite = window.favoritesManager?.isFavorite(sessionId) || false;
			btn.classList.toggle('favorite', isFavorite);
			btn.setAttribute('aria-label', isFavorite ? t('favorites.removeLabel') : t('favorites.addLabel'));
		};
		
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (window.favoritesManager) {
				window.favoritesManager.toggleFavorite(sessionId);
				updateButton();
				updateFavoritesFilterVisibility();
				// Prüfe globalen Favoriten-Status nach dem Toggle
				setTimeout(checkGlobalFavoritesStatus, 50);
			}
		});
		
		updateButton();
		return btn;
	};

	const updateFavoritesFilterVisibility = () => {
		const favoritesFilter = document.getElementById('favorites-filter');
		if (!favoritesFilter || !window.favoritesManager) return;
		
		favoritesFilter.style.display = 'block';
	};

	const checkGlobalFavoritesStatus = () => {
		const showFavoritesOnly = document.getElementById('favorites-only')?.checked || false;
		if (!showFavoritesOnly) {
			hideNoFavoritesMessage();
			return;
		}

		// Prüfe alle geladenen Container auf Favoriten
		let hasAnyFavorites = false;
		mounts.forEach(container => {
			if (container.hasAttribute('data-loaded') || !container.hasAttribute('data-lazy')) {
				const sessionplan = container.querySelector('.sessionplan');
				if (sessionplan) {
					const favoriteButtons = sessionplan.querySelectorAll('.favorite-btn.favorite');
					if (favoriteButtons.length > 0) {
						hasAnyFavorites = true;
					}
				}
			}
		});

		if (!hasAnyFavorites) {
			showNoFavoritesMessage();
		} else {
			hideNoFavoritesMessage();
		}
	};

	const updateFavoritesButtonStyle = () => {
		const favoritesCheckbox = document.getElementById('favorites-only');
		const favoritesLabel = document.querySelector('label[for="favorites-only"]');
		
		if (!favoritesCheckbox || !favoritesLabel) return;
		
		if (favoritesCheckbox.checked) {
			favoritesLabel.style.background = '#fef2f2';
			favoritesLabel.style.border = '1px solid #fecaca';
			favoritesLabel.style.color = '#dc2626';
		} else {
			favoritesLabel.style.background = '#ffffff';
			favoritesLabel.style.border = 'none';
			favoritesLabel.style.color = 'inherit';
		}
	};

	const showNoFavoritesMessage = () => {
		const container = document.getElementById('sessionplan-days-container');
		if (!container) return;
		
		const existingMessage = document.getElementById('no-favorites-message');
		if (existingMessage) {
			existingMessage.remove();
		}
		
		const message = document.createElement('div');
		message.id = 'no-favorites-message';
		message.style.cssText = 'text-align:center;padding:20px;background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 40px 0;color:#6b7280;';
		message.innerHTML = `
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;color:#9ca3af;">
				<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
			</svg>
			<h3 style="margin:0 0 8px 0;color:#4b5563;font-size:18px;">${t('favorites.emptyTitle')}</h3>
			<p style="margin:0;font-size:14px;">${t('favorites.emptyMessage')}</p>
		`;
		
		container.insertBefore(message, container.firstChild);
	};

	const hideNoFavoritesMessage = () => {
		const message = document.getElementById('no-favorites-message');
		if (message) {
			message.remove();
		}
	};

	const groupByRoom = (data) => {
		const roomGroups = {};
		
		Object.keys(data).forEach(slot => {
			const sessions = Array.isArray(data[slot]) ? data[slot] : [];
			sessions.forEach(session => {
				const room = session?.room || t('ui.unknownRoom');
				if (!roomGroups[room]) {
					roomGroups[room] = [];
				}
				roomGroups[room].push({
					...session,
					timeSlot: slot
				});
			});
		});
		
		return roomGroups;
	};

	const getTopSessions = (data) => {
		// Sammle alle Sessions des Tages (ohne cancelled Sessions)
		const allSessions = [];
		Object.values(data).forEach(sessions => {
			if (Array.isArray(sessions)) {
				sessions.forEach(session => {
					if (session.id && session.title && session.title.trim() !== '' && !session.title.includes('---') && !session.cancelled) {
						allSessions.push(session);
					}
				});
			}
		});
		
		// Prüfe, ob alle Sessions Votes haben (auch 0 Votes zählen)
		const allHaveVotes = allSessions.every(session => session.hasOwnProperty('votes'));
		
		if (!allHaveVotes || allSessions.length === 0) {
			return [];
		}
		
		// Sortiere nach Vote-Anzahl (absteigend) und nimm die Top 3
		return allSessions
			.sort((a, b) => (b.votes || 0) - (a.votes || 0))
			.slice(0, 3)
			.map(session => session.id);
	};


	const renderInto = (container,data) => {
		if (!data || typeof data !== 'object') return;
		const wrap = el('div','sessionplan');
		const showFavoritesOnly = document.getElementById('favorites-only')?.checked || false;
		const isRoomGrouping = document.getElementById('room-grouping')?.classList.contains('active');
		
		// Ermittle Top 3 Sessions für diesen Tag
		const topSessionIds = getTopSessions(data);
		
		if (isRoomGrouping) {
			const roomGroups = groupByRoom(data);
			
			Object.keys(roomGroups).sort().forEach(room => {
				const d = el('details');
				const s = el('summary',null,`Raum ${room}`);
				d.appendChild(s);
				const list = el('ul');
				const sessions = roomGroups[room];
				
				const filteredSessions = showFavoritesOnly 
					? sessions.filter(item => window.favoritesManager?.isFavorite(item?.id) || false)
					: sessions;
				
				if (filteredSessions.length === 0 && showFavoritesOnly) {
					return; // Skip empty room groups when filtering
				}
				
				// Auto-open details when showing favorites
				if (showFavoritesOnly && filteredSessions.length > 0) {
					d.setAttribute('open', '');
				}
				
				filteredSessions.forEach(item => {
					const li = el('li', 'session-card');
					const timeText = item.timeSlot ? `${item.timeSlot}` : '';
					li.appendChild(el('div','room',timeText));
					const titleHost = el('div');
					
					// Titel mit Badge für entfallene Sessions und Medaillen für Top-Sessions
					const titleDiv = el('div','title',item?.title ?? '');
					if (item?.cancelled) {
						titleDiv.innerHTML = `${item?.title ?? ''} <span class="cancelled-badge">${t('sessionplan.cancelledBadge')}</span>`;
						li.classList.add('cancelled');
					} else if (topSessionIds.includes(item?.id)) {
						const rank = topSessionIds.indexOf(item.id) + 1;
						const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
						titleDiv.innerHTML = `${item?.title ?? ''} ${medalIcon}`;
					}
					titleHost.appendChild(titleDiv);

					if (item?.host) titleHost.appendChild(el('div','host',item.host));
					li.appendChild(titleHost);

					if (item?.id) {
						const favoriteBtn = createFavoriteButton(item.id);
						li.appendChild(favoriteBtn);
					}

					list.appendChild(li);
				});
				d.appendChild(list);
				wrap.appendChild(d);
			});
		} else {
			Object.keys(data).sort((a,b)=>timeKey(a)-timeKey(b)).forEach(slot => {
				const d = el('details');
				const label = /\bUhr\b/.test(slot) ? slot : (slot + ' Uhr');
				const s = el('summary',null,label);
				d.appendChild(s);
				const list = el('ul');
				const sessions = Array.isArray(data[slot]) ? data[slot] : [];

				const filteredSessions = showFavoritesOnly
					? sessions.filter(item => window.favoritesManager?.isFavorite(item?.id) || false)
					: sessions;

				if (filteredSessions.length === 0 && showFavoritesOnly) {
					return; // Skip empty time slots when filtering
				}

				// Auto-open details when showing favorites
				if (showFavoritesOnly && filteredSessions.length > 0) {
					d.setAttribute('open', '');
				}

				filteredSessions.forEach(item => {
					const li = el('li', 'session-card');
					const roomText = item?.room ? `${t('sessionplan.roomPrefix')} ${item.room}` : '';
					li.appendChild(el('div','room',roomText));
					const titleHost = el('div');

					// Titel mit Badge für entfallene Sessions und Medaillen für Top-Sessions
					const titleDiv = el('div','title',item?.title ?? '');
					if (item?.cancelled) {
						titleDiv.innerHTML = `${item?.title ?? ''} <span class="cancelled-badge">${t('sessionplan.cancelledBadge')}</span>`;
						li.classList.add('cancelled');
					} else if (topSessionIds.includes(item?.id)) {
						const rank = topSessionIds.indexOf(item.id) + 1;
						const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
						titleDiv.innerHTML = `${item?.title ?? ''} ${medalIcon}`;
					}
					titleHost.appendChild(titleDiv);
					
					if (item?.host) titleHost.appendChild(el('div','host',item.host));
					li.appendChild(titleHost);
					
					if (item?.id) {
						const favoriteBtn = createFavoriteButton(item.id);
						li.appendChild(favoriteBtn);
					}
					
					list.appendChild(li);
				});
				d.appendChild(list);
				wrap.appendChild(d);
			});
		}
		container.replaceChildren(wrap);
		updateFavoritesFilterVisibility();
	};
		mounts.forEach(container => {
			const isLazy = container.getAttribute('data-lazy') === 'true';
			const day = container.getAttribute('data-day');
			const now = new Date();
			const todayName = now.toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase();
			const isToday = day === todayName;
			const nowMinutes = now.getHours()*60 + now.getMinutes();

			if (isLazy) {
				// Lazy Loading: Nur Observer hinzufügen
				lazyObserver.observe(container);
			} else {
				// Sofortiges Laden für aktuellen Tag
				loadSessionData(container).then(() => {
					autoOpen(container, isToday, nowMinutes);
				});
			}
		});
	
	// Favoriten-Filter Event Listener
	const favoritesCheckbox = document.getElementById('favorites-only');
	if (favoritesCheckbox) {
		favoritesCheckbox.addEventListener('change', () => {
			// Re-render all loaded session containers
			mounts.forEach(container => {
				if (container.hasAttribute('data-loaded') || !container.hasAttribute('data-lazy')) {
					// Lade Daten immer neu (ohne Cache)
					loadSessionData(container);
				}
			});
			updateFavoritesFilterVisibility();
			updateFavoritesButtonStyle();
			// Prüfe globalen Favoriten-Status nach dem Re-rendering
			setTimeout(checkGlobalFavoritesStatus, 100);
		});
	}
	
	// Gruppierungs-Toggle Event Listener
	const timeGroupingBtn = document.getElementById('time-grouping');
	const roomGroupingBtn = document.getElementById('room-grouping');
	
	if (timeGroupingBtn && roomGroupingBtn) {
		const updateGroupingButtons = (activeBtn) => {
			[timeGroupingBtn, roomGroupingBtn].forEach(btn => {
				if (btn === activeBtn) {
					btn.classList.add('active');
					btn.style.background = '#3b82f6';
					btn.style.color = 'white';
				} else {
					btn.classList.remove('active');
					btn.style.background = 'transparent';
					btn.style.color = '#6b7280';
				}
			});
		};
		
		timeGroupingBtn.addEventListener('click', () => {
			updateGroupingButtons(timeGroupingBtn);
			// Re-render all loaded session containers
			mounts.forEach(container => {
				if (container.hasAttribute('data-loaded') || !container.hasAttribute('data-lazy')) {
					// Lade Daten immer neu (ohne Cache)
					loadSessionData(container);
				}
			});
			// Prüfe globalen Favoriten-Status nach dem Re-rendering
			setTimeout(checkGlobalFavoritesStatus, 100);
		});
		
		roomGroupingBtn.addEventListener('click', () => {
			updateGroupingButtons(roomGroupingBtn);
			// Re-render all loaded session containers
			mounts.forEach(container => {
				if (container.hasAttribute('data-loaded') || !container.hasAttribute('data-lazy')) {
					// Lade Daten immer neu (ohne Cache)
					loadSessionData(container);
				}
			});
			// Prüfe globalen Favoriten-Status nach dem Re-rendering
			setTimeout(checkGlobalFavoritesStatus, 100);
		});
	}
	
		// Initial visibility check
		updateFavoritesFilterVisibility();
		updateFavoritesButtonStyle();
		// Prüfe initialen Favoriten-Status
		setTimeout(checkGlobalFavoritesStatus, 500);
	};

	// Starte Initialisierung - warte auf Translations
	const startInitialization = () => {
		initializeDaysContainer();
	};

	// Warte auf translationsLoaded Event von header.js
	window.addEventListener('translationsLoaded', startInitialization, { once: true });

	// Fallback: Start nach Timeout falls Event nicht kommt (z.B. header.js failed)
	setTimeout(() => {
		// Nur starten wenn noch nicht gestartet
		if (!document.querySelector('.session-card')) {
			startInitialization();
		}
	}, 2000);
})();

// Voting System
(() => {
	// Generate unique user key with fallback mechanisms
	const generateUserKey = () => {
		// First try to get existing key from localStorage
		const existingKey = localStorage.getItem('pccampapp_vote_key');
		if (existingKey) {
			return existingKey;
		}
		
		// Generate new key using multiple methods for better reliability
		const methods = [];
		
		// Method 1: Simple browser fingerprint (more stable)
		const simpleFingerprint = [
			navigator.userAgent.substring(0, 50), // Truncate to avoid changes
			navigator.language,
			screen.width + 'x' + screen.height,
			new Date().getTimezoneOffset()
		].join('|');
		
		// Method 2: Canvas fingerprint (fallback)
		try {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.font = '14px Arial';
			ctx.fillText('Browser fingerprint', 2, 2);
			methods.push(canvas.toDataURL().substring(0, 100)); // Truncate for stability
		} catch (e) {
			// Canvas not available, skip
		}
		
		// Method 3: Random component for uniqueness
		methods.push(Math.random().toString(36).substring(2, 15));
		
		// Combine all methods
		const combinedFingerprint = [simpleFingerprint, ...methods].join('|');
		
		// Simple hash function
		let hash = 0;
		for (let i = 0; i < combinedFingerprint.length; i++) {
			const char = combinedFingerprint.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		
		const userKey = 'vote_' + Math.abs(hash).toString(36);
		
		// Store in localStorage for persistence
		try {
			localStorage.setItem('pccampapp_vote_key', userKey);
		} catch (e) {
			// localStorage not available, continue with generated key
		}
		
		return userKey;
	};

	const userKey = generateUserKey();
	let votesData = {}; // Wird dynamisch initialisiert

	// Load votes data
	const loadVotes = async () => {
		try {
			const timestamp = new Date().getTime();
			const response = await fetch(`../votes/votes.json?t=${timestamp}`);
			if (response.ok) {
				votesData = await response.json();
			}
		} catch (error) {
			console.error('Failed to load votes:', error);
		}
	};

	// Populate session dropdown for specific day
	const populateDropdowns = async (day) => {
		const select = document.getElementById(`${day}-vote`);
		if (!select) return;
		
		// Cache-Hashes werden nicht mehr verwendet
		
		// Load session data for specific day with cache busting
		const timestamp = new Date().getTime();
		// Verwende Original-Dateiname
		const sessionsFileName = './sessions.json';
		const sessionData = await fetch(`${sessionsFileName}?t=${timestamp}`).then(r => r.json());

		// Populate dropdown
		const daySessions = sessionData[day] || {};
		Object.values(daySessions).flat().forEach(session => {
			if (session.id && session.title && session.title.trim() !== '' && !session.title.includes('---') && session.host && session.host.trim() !== '') {
				const option = document.createElement('option');
				option.value = session.id;
				option.textContent = `${session.title} (${session.host})`;
				select.appendChild(option);
			}
		});
	};

	// Submit vote
	const submitVote = async (day) => {
		const select = document.getElementById(`${day}-vote`);
		const button = document.getElementById(`${day}-submit`);
		const status = document.getElementById(`${day}-status`);

		if (!select.value) {
			status.textContent = t('voting.selectSession');
			status.style.color = '#ef4444';
			return;
		}

		button.disabled = true;
		button.textContent = t('voting.submitting');
		status.textContent = '';

		try {
			console.log('Submitting vote:', { sessionId: select.value, day: day, userKey: userKey });
			
			const response = await fetch('../votes/vote.php', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					sessionId: select.value,
					day: day,
					userKey: userKey
				})
			});

			const result = await response.json();
			console.log('Vote response:', { status: response.status, result: result });

			if (response.ok) {
				status.textContent = t('voting.success');
				status.style.color = '#10b981';
				button.textContent = t('voting.alreadyVoted');
				button.style.background = '#6b7280';
				select.disabled = true;

				// Update votes data
				votesData[day] = result.votes;
			} else {
				if (response.status === 409) {
					console.warn('User already voted - this might be a false positive. UserKey:', userKey);
					status.textContent = t('voting.alreadyVotedMessage');
					button.textContent = t('voting.alreadyVoted');
					button.style.background = '#6b7280';
					select.disabled = true;
				} else {
					status.textContent = `${t('ui.errorPrefix')} ${result.error}`;
					status.style.color = '#ef4444';
					button.disabled = false;
					button.textContent = t('voting.submitButton');
				}
			}
		} catch (error) {
			console.error('Vote submission error:', error);
			status.textContent = t('errors.votingNetwork');
			status.style.color = '#ef4444';
			button.disabled = false;
			button.textContent = t('voting.submitButton');
		}
	};


	// Check if voting should be visible for current day and time
	const shouldShowVoting = async () => {
		// Load event configuration if not already loaded
		if (!window.eventConfig) {
			try {
				const configPath = '../event.json';
				const response = await fetch(configPath);
				window.eventConfig = await response.json();
			} catch (error) {
				console.error('Failed to load event config:', error);
				return { show: false, day: null, dayLabel: null };
			}
		}

		// Check if voting feature is enabled
		if (window.eventConfig?.features?.voting === false) {
			console.log('Voting feature is disabled');
			return { show: false, day: null, dayLabel: null };
		}

		// Check voting-state.json for admin-controlled status
		try {
			const stateResponse = await fetch('../votes/voting-state.json');
			if (stateResponse.ok) {
				const votingState = await stateResponse.json();
				if (votingState.status !== 'active') {
					console.log('Voting is not active (admin-controlled status):', votingState.status);
					return { show: false, day: null, dayLabel: null };
				}
			}
		} catch (error) {
			// voting-state.json might not exist yet, continue
			console.warn('Could not load voting-state.json:', error);
		}

		// Get voting schedule from config
		const votingSchedule = window.eventConfig?.features?.votingSchedule || [];

		if (votingSchedule.length === 0) {
			console.warn('No voting schedule configured');
			return { show: false, day: null, dayLabel: null };
		}

		// Check current day and time against schedule
		const now = new Date();
		const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
		const currentHour = now.getHours();
		const currentMinute = now.getMinutes();
		const currentTime = currentHour * 60 + currentMinute;

		// Find matching voting schedule
		for (const schedule of votingSchedule) {
			if (schedule.dayOfWeek !== dayOfWeek) continue;

			// Parse start and end times
			const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
			const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
			const startTime = startHour * 60 + startMinute;
			const endTime = endHour * 60 + endMinute;

			// Check if current time is within voting window
			if (currentTime >= startTime && currentTime <= endTime) {
				console.log(`Voting active for: ${schedule.dayLabel} (${schedule.startTime}-${schedule.endTime})`);
				return { show: true, day: schedule.day, dayLabel: schedule.dayLabel };
			}
		}

		// URL-Override: ?vote=<day> (e.g., ?vote=samstag)
		// IMPORTANT: This is checked AFTER status and time checks, so it respects admin-controlled voting state
		// Only use for testing/debugging purposes
		const params = new URLSearchParams(window.location.search);
		const forceDay = (params.get('vote') || '').toLowerCase();
		if (forceDay) {
			const matchingDay = votingSchedule.find(s => s.day === forceDay);
			if (matchingDay) {
				console.log(`Voting forced via URL for: ${matchingDay.dayLabel} (URL override - testing only)`);
				return { show: true, day: matchingDay.day, dayLabel: matchingDay.dayLabel };
			}
		}

		return { show: false, day: null, dayLabel: null };
	};

	// Create voting UI for specific day
	const createVotingUI = (day, dayLabel) => {
		const container = document.getElementById('voting-container');
		// set header to include day
		const header = document.querySelector('#voting-section h3');
		if (header) header.textContent = `${t('voting.title')} ${dayLabel}`;

		container.innerHTML = `
			<div class="voting-day">
				<select id="${day}-vote" style="width:100%;padding:12px;font-size:16px;border:1px solid #d1d5db;border-radius:4px;">
					<option value="">${t('voting.selectPlaceholder')}</option>
				</select>
				<button id="${day}-submit" style="width:100%;margin-top:8px;padding:12px 16px;background:#6b7280;color:white;border:none;border-radius:4px;cursor:not-allowed;font-size:16px;" disabled>${t('voting.submitButton')}</button>
				<div id="${day}-status" style="margin-top:8px;font-size:0.9em;"></div>
			</div>
		`;
	};

	// Debug function to reset user identity (for troubleshooting)
	const resetUserIdentity = () => {
		localStorage.removeItem('pccampapp_vote_key');
		console.log('User identity reset. Page will reload.');
		window.location.reload();
	};
	
	// Add debug info to console
	console.log('Voting system initialized with userKey:', userKey);
	console.log('To reset voting identity, run: resetUserIdentity()');

	// Initialize voting system
	const initVoting = async () => {
		const votingInfo = await shouldShowVoting();

		if (!votingInfo.show) {
			// Hide voting section if not time yet
			document.getElementById('voting-section').style.display = 'none';
			return;
		}

		// Show voting section and create UI for current day
		document.getElementById('voting-section').style.display = 'block';
		createVotingUI(votingInfo.day, votingInfo.dayLabel);
		
		await loadVotes();
		await populateDropdowns(votingInfo.day);
		
	// Check if user already voted
	console.log('Checking vote status for userKey:', userKey);
	console.log('Votes data for', votingInfo.day, ':', votesData[votingInfo.day]);
	
	if (votesData[votingInfo.day].users && votesData[votingInfo.day].users[userKey]) {
		console.log('User has already voted for', votingInfo.day);
		const select = document.getElementById(`${votingInfo.day}-vote`);
		const button = document.getElementById(`${votingInfo.day}-submit`);
		select.value = votesData[votingInfo.day].users[userKey].sessionId;
		select.disabled = true;
		button.textContent = t('voting.alreadyVoted');
		button.style.background = '#6b7280';
		button.disabled = true;
	} else {
		console.log('User has not voted yet for', votingInfo.day);
	}

		// Add event listeners
		const select = document.getElementById(`${votingInfo.day}-vote`);
		const button = document.getElementById(`${votingInfo.day}-submit`);
		
		// Enable/disable button based on selection
		select.addEventListener('change', () => {
			if (select.value) {
				button.disabled = false;
				button.style.background = '#10b981';
				button.style.cursor = 'pointer';
			} else {
				button.disabled = true;
				button.style.background = '#6b7280';
				button.style.cursor = 'not-allowed';
			}
		});
		
		button.addEventListener('click', () => submitVote(votingInfo.day));
	};

	// Start voting system after translations are loaded
	window.addEventListener('translationsLoaded', initVoting, { once: true });

	// Fallback: Start after timeout if translations event doesn't fire
	setTimeout(() => {
		if (document.getElementById('voting-section').style.display !== 'none') {
			return; // Already initialized
		}
		initVoting();
	}, 2000);
})();
