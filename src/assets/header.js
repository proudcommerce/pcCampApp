// Globale Event-Konfiguration
let eventConfig = null;
let translations = null;

function getPathDepth() {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));

    // Prüfe ob wir uns in einem Unterverzeichnis befinden
    // Root: / -> segments = [] -> length = 0 -> false
    // Subfolder: /floorplan/ -> segments = ['floorplan'] -> length = 1 -> true
    // Subfolder in build: /build/sessionplan/ -> segments = ['build', 'sessionplan'] -> length = 2 -> true
    return segments.length >= 1;
}

function getBasePath() {
    const pathname = window.location.pathname;
    const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));

    // Wenn wir in einem Unterverzeichnis sind, extrahiere den Base-Path
    // Root: / -> basePath = ''
    // /build/ -> basePath = '/build'
    // /build/sessionplan/ -> basePath = '/build'
    // /sessionplan/ -> basePath = ''

    if (segments.length === 0) {
        return '';
    }

    // Wenn wir auf einer Seite sind (z.B. /build/ oder /build/sessionplan/)
    // und es mehr als ein Segment gibt, ist das erste Segment der Base-Path
    if (segments.length >= 1) {
        // Prüfe ob das erste Segment ein bekannter Seitenname ist
        const knownPages = ['sessionplan', 'timetable', 'food', 'floorplan', 'sponsors', 'votes'];
        if (knownPages.includes(segments[0])) {
            // Es ist eine Seite, kein Base-Path
            return '';
        }
        // Ansonsten ist es ein Base-Path (z.B. 'build')
        return '/' + segments[0];
    }

    return '';
}

async function loadEventConfig() {
    try {
        const pathname = window.location.pathname;
        const segments = pathname.split('/').filter(s => s && !s.endsWith('.html'));
        const basePath = getBasePath();

        let configPath;
        if (basePath) {
            // We have a base path (e.g. /build)
            // Always use absolute path from base
            configPath = basePath + '/event.json';
        } else {
            // No base path
            if (segments.length === 0) {
                // We're at real root (/)
                configPath = './event.json';
            } else {
                // We're in subdirectory (/sessionplan/)
                configPath = '../event.json';
            }
        }

        const response = await fetch(configPath);
        eventConfig = await response.json();
        return eventConfig;
    } catch (error) {
        console.warn('Event-Konfiguration nicht geladen, verwende Standardwerte:', error);
        // Standardwerte falls event.json nicht verfügbar
        return {
            event: {
                locale: 'de'
            },
            performance: {
                cacheTTL: 3600000,
                newsPollingInterval: 30000
            },
            features: {
                sponsors: true,
                installPrompt: true,
                news: true,
                favorites: true
            }
        };
    }
}

function getLocaleFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('lang');
}

function getBrowserLanguage() {
    // navigator.language liefert z.B. "de-DE", "en-US", "en"
    const browserLang = navigator.language || navigator.userLanguage;
    // Extrahiere nur den Sprachcode (de, en, etc.)
    return browserLang ? browserLang.split('-')[0].toLowerCase() : null;
}

function determineLocale() {
    // Verfügbare Sprachen (Translation-Dateien)
    const availableLanguages = ['de', 'en'];
    const storageKey = 'user-language-preference';

    // 1. Priorität: URL-Parameter (?lang=en)
    const urlLang = getLocaleFromURL();
    if (urlLang && availableLanguages.includes(urlLang.toLowerCase())) {
        const selectedLang = urlLang.toLowerCase();
        // Speichere explizite Sprachwahl in localStorage
        try {
            localStorage.setItem(storageKey, selectedLang);
        } catch (error) {
            console.warn('Konnte Sprachwahl nicht speichern:', error);
        }
        return selectedLang;
    }

    // 2. Priorität: Gespeicherte Sprachwahl (aus URL-Parameter von früherem Besuch)
    try {
        const storedLang = localStorage.getItem(storageKey);
        if (storedLang && availableLanguages.includes(storedLang)) {
            return storedLang;
        }
    } catch (error) {
        console.warn('Konnte gespeicherte Sprachwahl nicht laden:', error);
    }

    // 3. Priorität: Browser-Sprache
    const browserLang = getBrowserLanguage();
    if (browserLang && availableLanguages.includes(browserLang)) {
        return browserLang;
    }

    // 4. Priorität: Fallback aus event.json
    const configLang = eventConfig?.event?.locale || 'de';
    return configLang;
}

async function loadTranslations() {
    try {
        // Lade Event-Konfiguration falls noch nicht geladen
        if (!eventConfig) {
            eventConfig = await loadEventConfig();
        }

        const locale = determineLocale();
        const basePath = getBasePath();
        const isInSubfolder = getPathDepth();

        // Detect development mode (port 5173 is dev server, 5174 is production test)
        const isDevelopment = window.location.port === '5173';

        // In production: Load translation manifest to get hashed filename
        // In development: Skip manifest and use original filename directly
        if (!isDevelopment) {
            let manifestPath;
            if (basePath) {
                manifestPath = basePath + '/translations.json';
            } else {
                manifestPath = isInSubfolder ? '../translations.json' : './translations.json';
            }

            try {
                // Try to load translation manifest (exists in production build)
                const manifestResponse = await fetch(manifestPath);
                if (manifestResponse.ok) {
                    const manifest = await manifestResponse.json();
                    const hashedTranslationPath = manifest[locale];

                    if (hashedTranslationPath) {
                        let translationPath;
                        if (basePath) {
                            translationPath = basePath + '/' + hashedTranslationPath;
                        } else {
                            translationPath = isInSubfolder ? `../${hashedTranslationPath}` : `./${hashedTranslationPath}`;
                        }
                        const response = await fetch(translationPath);
                        translations = await response.json();
                        return translations;
                    }
                }
            } catch (manifestError) {
                // Manifest not found - fall back to direct loading
                console.log('Translation manifest nicht gefunden, lade direkt:', manifestError.message);
            }
        }

        // Direct loading (development mode or production fallback)
        let translationsPath;
        if (basePath) {
            translationsPath = basePath + `/translations/${locale}.json`;
        } else {
            translationsPath = isInSubfolder ? `../translations/${locale}.json` : `./translations/${locale}.json`;
        }
        const response = await fetch(translationsPath);
        translations = await response.json();
        return translations;
    } catch (error) {
        console.warn('Translations nicht geladen, verwende Fallback:', error);
        // Fallback zu deutschen Texten
        return {};
    }
}

function t(key) {
    if (!translations) return key;

    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key;
        }
    }

    return value;
}

// Make t() globally available
window.t = t;

// Helper function to set page title with translation
function setPageTitle(pageTitleKey) {
    const pageTitle = t(pageTitleKey);
    const eventName = eventConfig?.event?.shortName || '';

    if (pageTitle && eventName) {
        document.title = `${pageTitle} - ${eventName}`;
    }
}

// Make setPageTitle globally available
window.setPageTitle = setPageTitle;

// Apply translations to all elements with data-i18n attribute
function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.textContent = t(key);
        }
    });

    // Apply translations to aria-label attributes
    const ariaElements = document.querySelectorAll('[data-i18n-aria]');
    ariaElements.forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key) {
            el.setAttribute('aria-label', t(key));
        }
    });

    // Apply translations to alt attributes
    const altElements = document.querySelectorAll('[data-i18n-alt]');
    altElements.forEach(el => {
        const key = el.getAttribute('data-i18n-alt');
        if (key) {
            el.setAttribute('alt', t(key));
        }
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    // Lade Event-Config und Translations zuerst
    await loadEventConfig();
    await loadTranslations();

    // Apply translations to HTML elements with data-i18n
    applyTranslations();

    // Dispatch event that translations are loaded
    window.dispatchEvent(new CustomEvent('translationsLoaded'));

    // Fix Logo-Link für Base-Path
    const basePath = getBasePath();
    const isInSubfolder = getPathDepth();
    const brandLink = document.querySelector('.brand');
    if (brandLink) {
        if (basePath) {
            // Build-Verzeichnis oder ähnlicher Base-Path
            brandLink.href = basePath + '/';
        } else if (isInSubfolder) {
            // Unterseite ohne Base-Path (z.B. /food/) -> zur Startseite
            brandLink.href = '../';
        } else {
            // Startseite
            brandLink.href = './';
        }
    }

    // Burger-Menü-Implementierung
    const navItems = document.getElementById('navItems');
    const oldBurger = document.getElementById('burger');
    const oldNav = document.getElementById('nav-drawer');

    let menuData = null;
    
    async function loadMenuData() {
        try {
            // Lade Event-Konfiguration falls noch nicht geladen
            if (!eventConfig) {
                eventConfig = await loadEventConfig();
            }

            // Prüfe Cache zuerst
            const cacheKey = 'sessionplan-menu';
            const cached = localStorage.getItem(cacheKey);
            const cacheTime = localStorage.getItem(cacheKey + '-time');
            const now = Date.now();

            // Cache-TTL aus Konfiguration verwenden
            const cacheTTL = eventConfig?.performance?.cacheTTL || 3600000;
            if (cached && cacheTime && (now - parseInt(cacheTime)) < cacheTTL) {
                menuData = JSON.parse(cached);
                renderMenuItems();
                return;
            }

            // Pfad-Setup
            const basePath = getBasePath();
            const isInSubfolder = getPathDepth();

            // Verwende Original-Dateinamen (funktioniert in Development & Production)
            const menuFile = 'menu.json';
            let menuPath;
            if (basePath) {
                menuPath = basePath + '/' + menuFile;
            } else {
                menuPath = isInSubfolder ? '../' + menuFile : './' + menuFile;
            }
            const response = await fetch(menuPath);
            menuData = await response.json();

            // Speichere im Cache
            localStorage.setItem(cacheKey, JSON.stringify(menuData));
            localStorage.setItem(cacheKey + '-time', now.toString());

            renderMenuItems();
        } catch (error) {
            console.error('Fehler beim Laden des Menüs:', error);
            // Fallback zu Cache falls vorhanden
            const cached = localStorage.getItem('sessionplan-menu');
            if (cached) {
                try {
                    menuData = JSON.parse(cached);
                    renderMenuItems();
                } catch (e) {
                    console.error('Fehler beim Laden des gecachten Menüs:', e);
                }
            }
        }
    }
    
    function renderMenuItems() {
        if (!menuData || !menuData.items) return;

        const basePath = getBasePath();

        if (navItems) {
            navItems.innerHTML = '';
            // Navigation: Nur aktive Einträge mit URL anzeigen
            menuData.items
                .filter(item => item.active !== false && item.url && item.url.trim() !== '')
                .forEach(item => {
                    const navItem = document.createElement('a');
                    // URL mit Base-Path prefix versehen, falls absoluter Pfad
                    let url = item.url;
                    if (url.startsWith('/') && !url.startsWith('//')) {
                        url = basePath + url;
                    }
                    navItem.href = url;
                    navItem.className = 'nav-item';
                    const contentWrap = document.createElement('span');
                    contentWrap.className = 'nav-item-content';
                    if (item.icon) {
                        const icon = createIcon(item.icon);
                        if (icon) contentWrap.appendChild(icon);
                    }
                    const label = document.createElement('span');
                    label.className = 'nav-item-label';
                    label.textContent = item.title;
                    contentWrap.appendChild(label);
                    navItem.appendChild(contentWrap);

                    // Externe Links in neuem Tab öffnen
                    if (item.url.startsWith('https://')) {
                        navItem.target = '_blank';
                        navItem.rel = 'noopener noreferrer';
                    }

                    navItems.appendChild(navItem);
                });
        }

        // Karten für die Startseite generieren
        const cardsContainer = document.getElementById('cardsContainer');
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
            // Nur aktive Menüeinträge anzeigen
            menuData.items.filter(item => item.active !== false).forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';

                // Nur klickbar wenn URL vorhanden
                if (item.url && item.url.trim() !== '') {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', function() {
                        if (item.url.startsWith('https://')) {
                            window.open(item.url, '_blank', 'noopener,noreferrer');
                        } else {
                            // URL mit Base-Path prefix versehen, falls absoluter Pfad
                            let url = item.url;
                            if (url.startsWith('/') && !url.startsWith('//')) {
                                url = basePath + url;
                            }
                            window.location.href = url;
                        }
                    });
                } else {
                    card.style.cursor = 'default';
                }

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = item.title;

                if (item.icon) {
                    const icon = createIcon(item.icon);
                    if (icon) {
                        icon.classList.add('card-icon-wrap');
                        card.appendChild(icon);
                    }
                }

                const desc = document.createElement('p');
                desc.className = 'desc';
                desc.textContent = item.description;

                card.appendChild(title);
                card.appendChild(desc);
                cardsContainer.appendChild(card);
            });
        }
    }
    
    function createIcon(name) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('nav-icon');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        let d = '';
        switch (name) {
            case 'calendar':
                d = 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18';
                break;
            case 'clock':
                d = 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20 M12 6v6 M12 12l4 2';
                break;
            case 'map':
                d = 'M1 6l7-2 7 2 7-2v14l-7 2-7-2-7 2z M8 4v14 M15 6v14';
                break;
            case 'food':
                d = 'M5 3v5 M7 3v5 M9 3v5 M5 8h4 M7 8v10 M15 3c2 3 2 5 0 8v7';
                break;
            case 'image':
                d = 'M21 5H3v14h18z M10 9a2 2 0 1 0 4 0a2 2 0 0 0-4 0 M7 17l4-5 3 4 2-3 4 4';
                break;
            case 'wifi':
                d = 'M12 20h0 M2 9c6.627-5.333 12.627-5.333 20 0 M5 12c4.418-3.556 9.582-3.556 14 0 M8 15c2.209-1.778 5.791-1.778 8 0';
                break;
            case 'star':
                d = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
                break;
            default:
                d = '';
        }
        if (!d) return null;
        path.setAttribute('d', d);
        svg.appendChild(path);
        const wrap = document.createElement('span');
        wrap.className = 'nav-icon-wrap';
        wrap.appendChild(svg);
        return wrap;
    }
    
    // Menü-Funktionalität
    if (oldBurger && oldNav) {
        function toggleMenu() {
            oldBurger.classList.toggle('active');
            oldNav.classList.toggle('active');
        }
        
        function closeMenu() {
            oldBurger.classList.remove('active');
            oldNav.classList.remove('active');
        }
        
        oldBurger.addEventListener('click', toggleMenu);
        
        document.addEventListener('click', function(event) {
            if (!oldNav.contains(event.target) && !oldBurger.contains(event.target)) {
                closeMenu();
            }
        });
        
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });
    }
    
    loadMenuData();
    if (window.newsManager) {
        window.newsManager.loadNewsData();
    }
});

// News-Management
class NewsManager {
    constructor() {
        this.newsData = null;
        this.newsButton = document.getElementById('newsButton');
        this.newsBadge = document.getElementById('newsBadge');
        this.newsFlyout = document.getElementById('news-flyout');
        this.newsContainer = document.getElementById('newsContainer');
        this.newsFlyoutContent = document.getElementById('newsFlyoutContent');
        this.readNewsStorageKey = 'sessionplan-read-news';
        this.readNews = this.loadReadNews();
        this.pollingInterval = null;

        this.init();
    }

    async init() {
        // Lade Event-Konfiguration falls noch nicht geladen
        if (!eventConfig) {
            eventConfig = await loadEventConfig();
        }

        // Prüfe ob News-Feature aktiviert ist
        if (eventConfig?.features?.news === false) {
            console.log('News-Feature ist deaktiviert');
            return;
        }

        this.initEventListeners();
        this.startNewsPolling();
    }
    
    initEventListeners() {
        if (this.newsButton) {
            this.newsButton.addEventListener('click', () => this.toggleNewsFlyout());
        }
        
        document.addEventListener('click', (event) => {
            if (this.newsFlyout && 
                !this.newsFlyout.contains(event.target) && 
                !this.newsButton.contains(event.target)) {
                this.closeNewsFlyout();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeNewsFlyout();
            }
        });
    }
    
    loadReadNews() {
        try {
            const stored = localStorage.getItem(this.readNewsStorageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Fehler beim Laden der gelesenen News:', error);
            return [];
        }
    }
    
    saveReadNews() {
        try {
            localStorage.setItem(this.readNewsStorageKey, JSON.stringify(this.readNews));
        } catch (error) {
            console.error('Fehler beim Speichern der gelesenen News:', error);
        }
    }
    
    markNewsAsRead(newsId) {
        if (!this.readNews.includes(newsId)) {
            this.readNews.push(newsId);
            this.saveReadNews();
            this.updateBadge();
        }
    }
    
    isNewsRead(newsId) {
        return this.readNews.includes(newsId);
    }
    
    async loadNewsData() {
        try {
            // Pfad-Setup
            const basePath = getBasePath();
            const isInSubfolder = getPathDepth();

            // Verwende Original-Dateinamen (funktioniert in Development & Production)
            const newsFile = 'news.json';
            let newsPath;
            if (basePath) {
                newsPath = basePath + '/' + newsFile;
            } else {
                newsPath = isInSubfolder ? '../' + newsFile : './' + newsFile;
            }
            const response = await fetch(`${newsPath}?t=${Date.now()}`);
            this.newsData = await response.json();

            this.renderNews();
            this.updateBadge();
        } catch (error) {
            console.error('Fehler beim Laden der News:', error);
        }
    }
    
    renderNews() {
        if (!this.newsData || !this.newsData.days) return;

        const currentTime = new Date();
        const currentTimeStr = currentTime.toTimeString().slice(0, 5);
        const currentDateStr = this.getCurrentDateString(currentTime);

        // Für Hauptanzeige: Nur aktuelle News (innerhalb Zeitfenster) - noch nicht abgelaufen
        const currentNews = [];
        if (this.newsData.days[currentDateStr]) {
            currentNews.push(...this.newsData.days[currentDateStr].filter(news => {
                // Validiere dass timeFrom und timeTo existieren
                if (!news.timeFrom || !news.timeTo) {
                    return false;
                }

                const timeFrom = this.timeToMinutes(news.timeFrom);
                const timeTo = this.timeToMinutes(news.timeTo);
                const currentTimeMinutes = this.timeToMinutes(currentTimeStr);

                // Zusätzliche Validierung: Zeit muss gültig sein
                if (isNaN(timeFrom) || isNaN(timeTo) || isNaN(currentTimeMinutes)) {
                    return false;
                }

                // News ist nur aktiv wenn aktuelle Zeit zwischen timeFrom und timeTo liegt
                return currentTimeMinutes >= timeFrom && currentTimeMinutes <= timeTo;
            }));
        }

        // Permanente News immer hinzufügen
        if (this.newsData.permanent) {
            currentNews.push(...this.newsData.permanent);
        }

        // Für Flyout: Alle News des aktuellen Tages, die aktiv oder abgelaufen sind (nicht zukünftig)
        const activeAndExpiredNews = [];
        if (this.newsData.days[currentDateStr]) {
            activeAndExpiredNews.push(...this.newsData.days[currentDateStr].filter(news => {
                // Validiere dass timeFrom und timeTo existieren
                if (!news.timeFrom || !news.timeTo) {
                    return false;
                }

                const timeFrom = this.timeToMinutes(news.timeFrom);
                const currentTimeMinutes = this.timeToMinutes(currentTimeStr);

                // Zusätzliche Validierung: Zeit muss gültig sein
                if (isNaN(timeFrom) || isNaN(currentTimeMinutes)) {
                    return false;
                }

                // News ist relevant wenn sie bereits gestartet hat (aktuell aktiv oder abgelaufen)
                return currentTimeMinutes >= timeFrom;
            }));
        }

        // Permanente News immer hinzufügen
        if (this.newsData.permanent) {
            activeAndExpiredNews.push(...this.newsData.permanent);
        }
        
        this.renderMainNews(currentNews);
        this.renderNewsFlyout(activeAndExpiredNews);
    }
    
    updateBadge() {
        if (!this.newsBadge || !this.newsData || !this.newsData.days) return;

        const currentTime = new Date();
        const currentTimeStr = currentTime.toTimeString().slice(0, 5);
        const currentDateStr = this.getCurrentDateString(currentTime);

        const relevantNews = [];
        if (this.newsData.days[currentDateStr]) {
            relevantNews.push(...this.newsData.days[currentDateStr].filter(news => {
                // Validiere dass timeFrom und timeTo existieren
                if (!news.timeFrom || !news.timeTo) {
                    return false;
                }

                const timeFrom = this.timeToMinutes(news.timeFrom);
                const timeTo = this.timeToMinutes(news.timeTo);
                const currentTimeMinutes = this.timeToMinutes(currentTimeStr);

                // Zusätzliche Validierung: Zeit muss gültig sein
                if (isNaN(timeFrom) || isNaN(timeTo) || isNaN(currentTimeMinutes)) {
                    return false;
                }

                // News ist nur relevant wenn sie aktiv ist (innerhalb Zeitfenster)
                return currentTimeMinutes >= timeFrom && currentTimeMinutes <= timeTo;
            }));
        }
        
        // Permanente News immer hinzufügen
        if (this.newsData.permanent) {
            relevantNews.push(...this.newsData.permanent);
        }
        
        const unreadNews = relevantNews.filter(news => !this.isNewsRead(news.id));
        
        if (unreadNews.length > 0) {
            this.newsBadge.classList.add('show');
        } else {
            this.newsBadge.classList.remove('show');
        }
    }
    
    getCurrentDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    renderMainNews(newsList) {
        if (!this.newsContainer) return;
        
        this.newsContainer.innerHTML = '';
        
        if (!newsList || newsList.length === 0) {
            return;
        }
        
        newsList.forEach(news => {
            const newsItem = document.createElement('div');
            newsItem.className = `news-item ${news.priority}`;
            
            const content = document.createElement('p');
            content.className = 'news-item-content';
            content.textContent = news.content;
            
            newsItem.appendChild(content);
            
            this.newsContainer.appendChild(newsItem);
        });
    }
    
    renderNewsFlyout(newsList) {
        if (!this.newsFlyoutContent) return;
        
        this.newsFlyoutContent.innerHTML = '';
        
        if (newsList.length === 0) {
            const noNews = document.createElement('div');
            noNews.style.textAlign = 'center';
            noNews.style.padding = '40px 20px';
            noNews.style.color = '#718096';
            
            const icon = document.createElement('div');
            icon.style.marginBottom = '16px';
            icon.style.display = 'flex';
            icon.style.justifyContent = 'center';
            
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '48');
            svg.setAttribute('height', '48');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#718096');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2');
            
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M18 14h-8');
            
            const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path3.setAttribute('d', 'M15 18h-5');
            
            const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path4.setAttribute('d', 'M10 6h8v4h-8V6Z');
            
            svg.appendChild(path1);
            svg.appendChild(path2);
            svg.appendChild(path3);
            svg.appendChild(path4);
            icon.appendChild(svg);
            
            const title = document.createElement('h3');
            title.textContent = t('news.emptyTitle');
            title.style.margin = '0 0 8px 0';
            title.style.fontSize = '18px';
            title.style.fontWeight = '600';
            title.style.color = '#4a5568';

            const description = document.createElement('p');
            description.textContent = t('news.emptyMessage');
            description.style.margin = '0';
            description.style.fontSize = '14px';
            description.style.lineHeight = '1.5';
            
            noNews.appendChild(icon);
            noNews.appendChild(title);
            noNews.appendChild(description);
            this.newsFlyoutContent.appendChild(noNews);
            return;
        }
        
        const currentTime = new Date();
        const currentTimeStr = currentTime.toTimeString().slice(0, 5);
        
        // News nach Startzeit sortieren (früheste zuerst)
        const sortedNews = newsList.sort((a, b) => {
            const timeFromA = this.timeToMinutes(a.timeFrom);
            const timeFromB = this.timeToMinutes(b.timeFrom);
            return timeFromA - timeFromB; // Aufsteigende Sortierung (früheste zuerst)
        });
        
        sortedNews.forEach(news => {
            const newsItem = document.createElement('div');
            newsItem.className = `news-item-flyout ${news.priority}`;
            
            // Prüfe ob News abgelaufen ist (nur wenn timeTo existiert)
            const isPermanent = !news.timeFrom && !news.timeTo;
            const timeTo = this.timeToMinutes(news.timeTo);
            const currentTimeMinutes = this.timeToMinutes(currentTimeStr);
            const isExpired = !isPermanent && currentTimeMinutes > timeTo;
            
            if (isExpired) {
                // Abgelaufene News haben einen anderen Stil
                newsItem.style.opacity = '0.7';
                newsItem.style.borderStyle = 'dashed';
            } else {
                // Aktive News haben normalen Stil
                newsItem.style.opacity = '1';
                newsItem.style.borderStyle = 'solid';
            }
            
            const content = document.createElement('p');
            content.className = 'news-item-content';
            content.textContent = news.content;
            
            newsItem.appendChild(content);
            
            this.newsFlyoutContent.appendChild(newsItem);
        });
    }
    
    toggleNewsFlyout() {
        if (this.newsFlyout) {
            const isOpening = !this.newsFlyout.classList.contains('active');
            this.newsFlyout.classList.toggle('active');
            this.newsButton.classList.toggle('active');
            
            if (isOpening) {
                this.markAllCurrentNewsAsRead();
            }
        }
    }
    
    markAllCurrentNewsAsRead() {
        if (!this.newsData || !this.newsData.days) return;

        const currentTime = new Date();
        const currentDateStr = this.getCurrentDateString(currentTime);
        const currentTimeStr = currentTime.toTimeString().slice(0, 5);

        const relevantNews = [];
        if (this.newsData.days[currentDateStr]) {
            relevantNews.push(...this.newsData.days[currentDateStr].filter(news => {
                // Validiere dass timeFrom und timeTo existieren
                if (!news.timeFrom || !news.timeTo) {
                    return false;
                }
                
                const timeFrom = this.timeToMinutes(news.timeFrom);
                const timeTo = this.timeToMinutes(news.timeTo);
                const currentTimeMinutes = this.timeToMinutes(currentTimeStr);
                
                // Zusätzliche Validierung: Zeit muss gültig sein
                if (isNaN(timeFrom) || isNaN(timeTo) || isNaN(currentTimeMinutes)) {
                    return false;
                }
                
                // News ist nur relevant wenn sie aktiv ist (innerhalb Zeitfenster)
                return currentTimeMinutes >= timeFrom && currentTimeMinutes <= timeTo;
            }));
        }
        
        // Permanente News immer hinzufügen
        if (this.newsData.permanent) {
            relevantNews.push(...this.newsData.permanent);
        }
        
        relevantNews.forEach(news => {
            this.markNewsAsRead(news.id);
        });
    }
    
    closeNewsFlyout() {
        if (this.newsFlyout) {
            this.newsFlyout.classList.remove('active');
            this.newsButton.classList.remove('active');
        }
    }
    
    startNewsPolling() {
        // News-Polling-Intervall aus Konfiguration verwenden
        const pollingInterval = eventConfig?.performance?.newsPollingInterval || 30000;
        this.pollingInterval = setInterval(() => {
            this.loadNewsData();
        }, pollingInterval);
    }

    stopNewsPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}

// Globale News-Instanz
window.newsManager = new NewsManager();

// Favoriten-Management
class FavoritesManager {
    constructor() {
        this.storageKey = 'sessionplan-favorites';
        this.favorites = this.loadFavorites();
    }
    
    loadFavorites() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Fehler beim Laden der Favoriten:', error);
            return [];
        }
    }
    
    saveFavorites() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.favorites));
        } catch (error) {
            console.error('Fehler beim Speichern der Favoriten:', error);
        }
    }
    
    isFavorite(sessionId) {
        return this.favorites.includes(sessionId);
    }
    
    toggleFavorite(sessionId) {
        const index = this.favorites.indexOf(sessionId);
        if (index > -1) {
            this.favorites.splice(index, 1);
        } else {
            this.favorites.push(sessionId);
        }
        this.saveFavorites();
        return this.isFavorite(sessionId);
    }
    
    getFavorites() {
        return [...this.favorites];
    }
    
    clearFavorites() {
        this.favorites = [];
        this.saveFavorites();
    }
}

// Globale Favoriten-Instanz
window.favoritesManager = new FavoritesManager();

// PWA und Push Notification Manager
class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isIOS = this.detectIOS();
        this.init();
    }

    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    async init() {
        // Lade Event-Konfiguration falls noch nicht geladen
        if (!eventConfig) {
            eventConfig = await loadEventConfig();
        }

        // Service Worker Registration immer ausführen
        this.registerServiceWorker();

        // Prüfe ob Install-Prompt-Feature aktiviert ist
        if (eventConfig?.features?.installPrompt === false) {
            console.log('Install-Prompt-Feature ist deaktiviert');
            return;
        }

        // PWA Install Prompt für Android/Desktop
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // PWA bereits installiert
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.hideInstallButton();
        });

        // iOS PWA Detection
        if (this.isIOS) {
            this.checkIOSPWA();
        }
    }
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Dynamischer Pfad basierend auf aktueller URL
            const basePath = getBasePath();
            const isInSubfolder = getPathDepth();

            // Service Worker Pfad
            let swPath;
            if (basePath) {
                // Base-Path vorhanden (z.B. /build) - verwende absoluten Pfad
                swPath = basePath + '/sw.js';
            } else if (isInSubfolder) {
                // In Unterverzeichnis ohne Base-Path (z.B. /sessionplan/) - relativer Pfad
                swPath = '../sw.js';
            } else {
                // Root ohne Base-Path (/) - absoluter Pfad von Root
                swPath = '/sw.js';
            }

            navigator.serviceWorker.register(swPath)
                .then(registration => {
                    console.log('Service Worker registriert:', registration);
                    
                    // Fehlerbehandlung für Message Port
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // Neuer Service Worker verfügbar
                                    console.log('Neuer Service Worker verfügbar');
                                }
                            });
                        }
                    });
                    
                    // Message Port Error Handling
                    if (registration.active) {
                        registration.active.addEventListener('error', (event) => {
                            console.error('Service Worker Fehler:', event.error);
                        });
                    }
                })
                .catch(error => {
                    console.log('Service Worker Registrierung fehlgeschlagen:', error);
                });
                
            // Globale Service Worker Error Handler
            navigator.serviceWorker.addEventListener('error', (event) => {
                console.error('Service Worker Global Error:', event.error);
            });
            
            navigator.serviceWorker.addEventListener('messageerror', (event) => {
                console.error('Service Worker Message Error:', event.error);
            });
        }
    }
    
    
    showInstallButton() {
        if (this.isInstalled || this.isIOS) return;

        const installButton = document.createElement('button');
        installButton.id = 'pwa-install-btn';
        installButton.className = 'pwa-install-btn';
        installButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            ${t('pwa.installButton')}
        `;
        
        installButton.addEventListener('click', () => this.installPWA());
        
        const headerButtons = document.querySelector('.header-buttons');
        if (headerButtons) {
            headerButtons.insertBefore(installButton, headerButtons.firstChild);
        }
    }
    
    hideInstallButton() {
        const installButton = document.getElementById('pwa-install-btn');
        if (installButton) {
            installButton.remove();
        }
    }
    
    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`PWA Install: ${outcome}`);
            this.deferredPrompt = null;
            this.hideInstallButton();
        }
    }
    
    checkIOSPWA() {
        // iOS PWA Detection
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        const isInWebAppiOS = window.navigator.standalone === true;
        
        if (!isInStandaloneMode && !isInWebAppiOS) {
            this.showIOSInstallPrompt();
        }
    }
    
    async showIOSInstallPrompt() {
        // Prüfe ob Banner bereits einmal angezeigt wurde
        const bannerShownKey = 'ios-install-banner-shown';
        if (localStorage.getItem(bannerShownKey)) {
            return;
        }

        // Warte auf Translations, falls sie noch nicht geladen sind
        if (!translations) {
            await new Promise(resolve => {
                window.addEventListener('translationsLoaded', resolve, { once: true });
            });
        }

        const iosBanner = document.createElement('div');
        iosBanner.id = 'ios-install-banner';
        iosBanner.className = 'ios-install-banner';

        // Header-Referenz für spätere Verwendung
        const header = document.querySelector('.header');

        // Funktion zum Schließen des Banners
        const closeBanner = () => {
            if (iosBanner.parentNode) {
                iosBanner.classList.remove('show');
                setTimeout(() => {
                    if (iosBanner.parentNode) {
                        iosBanner.remove();
                        // Header zurücksetzen
                        if (header) {
                            header.classList.remove('with-banner');
                        }
                    }
                }, 300);
            }
        };

        // Lade Event-Konfiguration falls noch nicht geladen
        if (!eventConfig) {
            eventConfig = await loadEventConfig();
        }

        const eventName = eventConfig?.event?.name || 'Event';
        const installPrefix = t('pwa.iosInstallPrefix');
        const installText = t('pwa.iosInstallPrompt');

        iosBanner.innerHTML = `
            <div class="ios-banner-content">
                <span class="ios-banner-text"><b>${eventName} ${installPrefix}</b><br>${installText}</span>
            </div>
            <button class="ios-banner-close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Event Listener für Close-Button
        const closeButton = iosBanner.querySelector('.ios-banner-close');
        closeButton.addEventListener('click', closeBanner);
        
        document.body.appendChild(iosBanner);
        
        // Header anpassen
        if (header) {
            header.classList.add('with-banner');
        }
        
        // Banner nach kurzer Verzögerung anzeigen
        setTimeout(() => {
            iosBanner.classList.add('show');
        }, 100);
        
        // Markiere Banner als angezeigt
        localStorage.setItem(bannerShownKey, 'true');
        
        // Auto-hide nach 8 Sekunden
        setTimeout(() => {
            closeBanner();
        }, 8000);
    }
    
}

// Globale PWA-Instanz
window.pwaManager = new PWAManager();
