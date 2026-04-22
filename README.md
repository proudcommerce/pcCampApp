# PC CampApp

[Version](CHANGELOG.md) [PWA](https://web.dev/progressive-web-apps/) [Playwright](https://playwright.dev/) [License](LICENSE) [PHP](https://www.php.net/) [Docker](https://www.docker.com/)

---

## 🌟 Features

- **📱 Progressive Web App** - Installierbar auf allen Geräten, funktioniert offline
- **🔄 Vollständig Wiederverwendbar** - Eine einzige `event.json` für jede Veranstaltung
- **🌍 Mehrsprachig** - Integrierte i18n-Unterstützung (Deutsch/Englisch)
- **⚡ Performance-Optimiert** - Cache-Busting, Service Worker, Lazy Loading
- **📊 Event-Features** - Sessionpläne, Zeitpläne, Speisekarten, Sponsoren, Voting
- **✏️ Online Content-Verwaltung** - Event-Daten im Browser bearbeiten, ohne Deployment
- **🎨 Auto-Branding** - PWA-Icons werden automatisch aus einem einzigen Quellbild generiert
- **🖌️ Custom Styles** - Farbpalette und CSS pro Event ueber `content/assets/custom.css` ueberschreibbar — ohne Rebuild
- **🧪 100% Getestet** - Playwright-Tests für Übersetzungen, PWA, UI/UX
- **🐳 Docker Ready** - Entwicklungsumgebung mit einem Befehl

---

**Live: [https://app.devops-camp.de](https://app.devops-camp.de) oder [https://app.joomladay.de**](https://app.joomladay.de)

---

## 📋 Inhaltsverzeichnis

- [Quick Start](#-quick-start)
- [Screenshots](#-screenshots)
- [Konfiguration](#konfiguration)
  - [Anpassung für Ihre Veranstaltung](#anpassung-für-ihre-veranstaltung-initial-setup-via-seed)
  - [Eventspezifische JSON-Dateien](#eventspezifische-json-dateien)
  - [JSON-Dateien für neue Events anpassen](#json-dateien-für-neue-events-anpassen)
  - [Custom Styles / Branding-Farben](#custom-styles--branding-farben)
- [Content-Verwaltung (Admin)](#️-content-verwaltung-admin)
  - [Zugriff](#zugriff)
  - [Verwaltbare Bereiche](#verwaltbare-bereiche)
- [Voting-System](#-voting-system)
  - [Aktivierung](#aktivierung)
  - [Voting-Konfiguration](#voting-konfiguration)
  - [Nutzung](#nutzung)
  - [Admin-Bereich](#admin-bereich)
- [Entwicklung](#-entwicklung)
  - [Wichtigste Befehle](#wichtigste-befehle)
- [Internationalisierung (i18n)](#-internationalisierung-i18n)
  - [Unterstützte Sprachen](#unterstützte-sprachen)
  - [i18n-Konfiguration](#i18n-konfiguration)
  - [Übersetzungen hinzufügen](#übersetzungen-hinzufügen)
- [Architektur](#️-architektur)
  - [Tech-Stack](#tech-stack)
  - [Caching-Strategie](#caching-strategie)
  - [PWA-Features](#pwa-features)
- [Lizenz](#-lizenz)

---

## 🚀 Quick Start (lokal, Entwicklung)

```bash
git clone <repository-url>
cd pccampapp
cp .env.example .env

# Dev-Container starten — src/ live-mount, Live-Reload, Port 5173
make dev-start
open http://localhost:5173
```

Kein lokales Node/npm noetig — alles laeuft im Container. Fuer lokale
Playwright-Tests auf dem Host zusaetzlich: `make install` (Playwright-Browser).

### Produktion lokal testen

```bash
# Multi-Stage Build als Docker-Image, Port 5174 (Foreground)
make dev-prod-start
open http://localhost:5174
```

`make dev-prod-start` baut exakt das Image, das auch auf den Server geht.

---

## 📦 Deployment (Server)

Auf dem Ziel-Server brauchst du nur **Docker** (`docker compose`). Kein Node,
kein PHP, keine Build-Toolchain:

```bash
# 1. Repo oder einfach nur diese Dateien klonen:
#    Dockerfile, docker-compose.prod.yml, nginx.prod.conf, nginx.security-headers.conf,
#    docker-entrypoint.sh, src/, seed/, build-cache-busting.cjs,
#    package*.json, event.schema.json
git clone <repository-url>
cd pccampapp

# 2. Environment setzen (sicherer Admin-Key!)
cp .env.example .env
vim .env   # VOTING_ADMIN_KEY=<random>

# 3. Bauen und starten — Multi-Stage-Build erstellt das Image aus der Node-Stage,
#    content/ wird beim ersten Start aus seed/ geseedet.
make prod-start

# 4. Reverse-Proxy (nginx/Caddy/Traefik) vorschalten und Port 5174 bzw. PROD_PORT
#    auf deine Domain mit TLS routen.
```

**Persistente Daten:** Alle admin-pflegbaren Inhalte (`event.json`, `menu.json`,
`sessions.json`, `votes.json`, Hash-Manifest, SW-Version, …) liegen im
Host-Verzeichnis `./content/`. Das ist der einzige Pfad, den du beim Deploy
sichern musst.

```bash
# Backup
tar cf content-backup-$(date +%F).tar content/

# Restore
make prod-stop
tar xf content-backup-YYYY-MM-DD.tar
make prod-start
```

**Updates (neue App-Version ausrollen):**

```bash
git pull
make prod-start
```

Das Image wird neu gebaut, `content/` bleibt unveraendert — Admin-Aenderungen
ueberleben jedes Update. Service Worker invalidiert automatisch (neue
`BUILD_VERSION` im Image + bestehende `content/sw-version.txt`).

---

## 🚀 Screenshots



Screenshots anzeigen

pccampapp1

pccampapp2

pccampapp3

pccampapp4

pccampapp5



---

## ⚙️ Konfiguration

Die App ist komplett **konfigurationsgesteuert** — keine Code-Änderungen für neue
Events. Es gibt zwei Wege, Inhalte zu pflegen:

| Weg                         | Wann nutzen?                                                             |
| --------------------------- | ------------------------------------------------------------------------ |
| **Admin-UI** (empfohlen)    | Laufendes Event, Inhalte ändern sich regelmäßig, keine Dev-Tools nötig   |
| **seed/** (Initial-Vorlage) | Erstes Deployment eines neuen Events, Vorlage in Git versionieren        |

> Nach dem ersten Container-Start wird `seed/` einmalig nach `content/`
> kopiert. Ab dann leben alle Inhalte (inkl. Admin-Uploads von Logo/Floorplan/
> Sponsor-Logos) im `content/`-Volume und überleben jedes Image-Update.

### Anpassung für Ihre Veranstaltung (Initial-Setup via seed/)

```bash
# 1. Event-Konfiguration bearbeiten (Seed-Vorlage fuer frische Deployments)
vim seed/event.json

# 2. Nur PWA-Icon-Quelle ist noch Code (Image-gebacken, generiert 16/144/192/512)
cp ihr-icon.png src/assets/icon.png

# 3. Eventspezifische Inhalte aktualisieren (Seed — kopiert beim ersten Start
#    ins Laufzeit-Volume content/; spaetere Admin-Edits leben dort)
vim seed/sessionplan/sessions.json   # Sessionplan-Daten
vim seed/timetable/timetable.json    # Zeitplan-Daten
vim seed/news.json                   # Event-News
vim seed/menu.json                   # Navigation
vim seed/food/menue.json             # Speisekarten
vim seed/food/allergene.json         # Allergen-Informationen
vim seed/sponsors/sponsors.json      # Sponsoren-Liste

# 4. Event-Grafiken (content — tauschbar ohne Rebuild, Admin-Upload moeglich)
cp ihr-logo.png      seed/assets/logo.png                        # Header/Brand
cp ihr-floorplan.jpg seed/floorplan/floorplan.jpg                # Raumplan
cp ihr-sponsor.png   seed/sponsors/logos/sponsor-placeholder.png # Sponsor-Logo

# 5. Bauen & deployen
make build
```

**Keine Code-Änderungen nötig!** Das Build-System automatisch:

- Generiert PWA-Manifest aus der Konfiguration
- Erstellt alle PWA-Icons (16x16, 144x144, 192x192, 512x512)
- Wendet Theme-Farben an

Alle `event.json`-Felder (Name, Titel, Beschreibung, Theme-Color, Copyright, Logo-Alt, Manifest) werden zusaetzlich **zur Laufzeit** aus `content/event.json` angewandt — Admin-Edits im Tab „Event" wirken ohne Rebuild. Build-Zeit-Platzhalter `{{EVENT_NAME}}` etc. sind nur noch Initial-Seed.

### Eventspezifische JSON-Dateien

Die App verwendet mehrere JSON-Dateien für eventspezifische Inhalte. Diese müssen für jede neue Veranstaltung angepasst werden. Quelle dafür ist der `seed/`-Ordner — beim ersten Container-Start wird er nach `content/` kopiert; ab dann leben alle Admin-Edits (und hochgeladene Grafiken) ausschließlich im `content/`-Volume.

#### 📅 Sessionplan (`seed/sessionplan/sessions.json`)

Strukturiert Sessions nach Tagen und Zeitslots:

```json
{
  "samstag": {
    "11:00 - 12:00": [
      {
        "id": "10",
        "room": "Raum Alpha",
        "title": "Einführung in moderne Entwicklungsmethoden",
        "host": "Max Mustermann",
        "votes": 0,
        "cancelled": false
      }
    ]
  },
  "sonntag": {
    "10:00 - 11:00": [
      {
        "id": "100",
        "room": "Raum Beta",
        "title": "Erfahrungsaustausch",
        "host": "Lisa Schmidt",
        "votes": 0,
        "cancelled": false
      }
    ]
  }
}
```

#### ⏰ Zeitplan (`seed/timetable/timetable.json`)

Zeitplan für das gesamte Event:

```json
{
  "freitag": {
    "18:00 - 21:00 Uhr": [
      {
        "room": "Empfangsbereich",
        "title": "Check-in und Networking"
      }
    ]
  },
  "samstag": {
    "09:30 Uhr": [
      {
        "room": "Hauptraum",
        "title": "Begrüßung und Vorstellungsrunde"
      }
    ]
  }
}
```

#### 📰 News (`seed/news.json`)

Event-News mit Zeitfenstern:

```json
{
  "permanent": [
    {
      "id": "1",
      "content": "Willkommen zur Event-Demo!",
      "priority": "medium"
    }
  ],
  "days": {
    "2025-11-15": [
      {
        "id": "10",
        "content": "Die Türen öffnen um 18:00 Uhr.",
        "timeFrom": "16:00",
        "timeTo": "20:00",
        "priority": "high"
      }
    ]
  }
}
```

#### 🍽️ Speisekarten (`seed/food/menue.json`)

Menü nach Tagen und Mahlzeiten:

```json
{
  "samstag": {
    "Frühstück": [
      {
        "name": "Brötchen-Auswahl",
        "variants": [
          {
            "name": "Vollkorn",
            "allergens": ["A"]
          }
        ]
      }
    ],
    "Mittagessen": [
      {
        "name": "Pasta-Station",
        "variants": [
          {
            "name": "Bolognese",
            "allergens": ["A", "G", "I"]
          }
        ]
      }
    ]
  }
}
```

#### 🚨 Allergene (`seed/food/allergene.json`)

Allergen-Codes und Beschreibungen:

```json
{
  "A": "Glutenhaltiges Getreide",
  "C": "Eier",
  "G": "Milch",
  "I": "Fleisch",
  "L": "Schwefeldioxid und Sulfite"
}
```

#### ⭐ Sponsoren (`seed/sponsors/sponsors.json`)

Sponsoren-Liste. Das Feld `logo` akzeptiert zwei Varianten:

- **Lokal** — Pfad relativ zu `content/sponsors/`, z. B. `"logos/foo.png"`. Die
  Datei wird aus dem Content-Volume ausgeliefert (Seed: `seed/sponsors/logos/`,
  Laufzeit/Admin: `content/sponsors/logos/`).
- **Extern** — absolute URL (`https://…`) oder absoluter Pfad (`/…`) auf ein
  CDN- oder extern gehostetes Logo. Wird 1:1 in den `<img src>` uebernommen.

```json
{
  "sponsors": [
    {
      "name": "Sponsor 1",
      "logo": "logos/sponsor-placeholder.png",
      "url": "https://example.com",
      "beschreibung": "Beschreibung des Sponsors"
    }
  ]
}
```

#### 🗺️ Floorplan (`seed/floorplan/floorplan.jpg`)

Das Floorplan-Bild lebt im Content-Volume (`content/floorplan/floorplan.jpg`).
Austausch ohne Rebuild — per Admin-Upload (Tab **Event** → **Branding &
Medien**), per Volume-Zugriff oder Ersatzdatei im Seed.

#### 🖼️ App-Logo (`seed/assets/logo.png`)

Das Header-/Brand-Logo lebt ebenfalls im Content-Volume
(`content/assets/logo.png`). Der Pfad wird in `event.json` als
`branding.logo` hinterlegt — akzeptiert relative Pfade (relativ zu
`content/`) oder absolute URLs (CDN). Admin-Upload im Tab **Event** →
**Branding & Medien** bumpt dabei `sw-version.txt`, sodass Clients beim
naechsten Reload das neue Logo aus einem frischen Service-Worker-Cache ziehen.

#### 🧭 Navigation (`seed/menu.json`)

Hauptnavigation der App:

```json
{
  "items": [
    {
      "title": "Sessionplan",
      "url": "/sessionplan/",
      "description": "",
      "icon": "calendar",
      "active": true
    },
    {
      "title": "WLAN",
      "url": "",
      "description": "EventWiFi / test123",
      "icon": "wifi",
      "active": true
    }
  ]
}
```

### JSON-Dateien für neue Events anpassen

**Schritt-für-Schritt-Anleitung:**

> Hinweis: Alle Pfade beziehen sich auf `seed/` — die Vorlage fuer frische
> Deployments. Nach dem ersten Start sind Aenderungen ueber den Admin-Bereich
> im laufenden Container persistent und landen im `content/`-Volume.

1. **Sessionplan aktualisieren** (`seed/sessionplan/sessions.json`):
  - Tage anpassen (z.B. `samstag`, `sonntag` → `freitag`, `samstag`)
  - Zeitslots anpassen (z.B. `11:00 - 12:00` → `10:00 - 11:00`)
  - Raum-Namen aktualisieren
  - Session-Titel, Hosts und IDs anpassen
2. **Zeitplan erstellen** (`seed/timetable/timetable.json`):
  - Event-Tage definieren
  - Zeitslots mit Räumen und Aktivitäten hinzufügen
  - Struktur: `"Tag": { "Zeit": [{"room": "Raum", "title": "Aktivität"}] }`
3. **News konfigurieren** (`seed/news.json`):
  - Permanente News in `permanent` Array
  - Tages-spezifische News in `days` Objekt
  - Zeitfenster mit `timeFrom`/`timeTo` (optional)
  - Prioritäten: `high`, `medium`, `low`
4. **Speisekarten erstellen** (`seed/food/menue.json`):
  - Mahlzeiten nach Tagen strukturieren
  - Allergen-Codes aus `allergene.json` verwenden
  - Varianten für verschiedene Optionen
5. **Sponsoren hinzufügen** (`seed/sponsors/sponsors.json`):
  - Entweder: Logo-Datei nach `seed/sponsors/logos/` legen (im Betrieb: `content/sponsors/logos/`) und als `"logo": "logos/dateiname.png"` referenzieren
  - Oder: Extern hostet — `"logo": "https://cdn.example.com/logo.png"` (auch absolute Pfade `/…` moeglich); wird 1:1 verwendet
  - URLs und Beschreibungen anpassen
6. **Floorplan austauschen** (`seed/floorplan/floorplan.jpg`):
  - Bild ersetzen; wird zur Laufzeit aus `content/floorplan/floorplan.jpg` ausgeliefert
7. **Navigation anpassen** (`seed/menu.json`):
  - Menüpunkte aktivieren/deaktivieren
  - URLs und Beschreibungen aktualisieren
  - WLAN-Informationen anpassen

**Tipp:** Alternativ können alle JSON-Dateien über die [Content-Verwaltung](#%EF%B8%8F-content-verwaltung-admin) direkt im Browser bearbeitet werden — ohne Build oder Deployment.

### Custom Styles / Branding-Farben

Die Farbpalette und beliebige CSS-Regeln koennen pro Event ueber `content/assets/custom.css` ueberschrieben werden — ohne Rebuild. `src/assets/app.css` und die Modul-CSS nutzen CSS-Custom-Properties; `content/assets/custom.css` wird als letztes Stylesheet geladen und gewinnt.

```css
/* content/assets/custom.css */
:root {
  --color-primary: #d9174b;
  --color-primary-dark: #b70529;
  --color-primary-light: #ea285c;
  --color-text: #41454b;
  --color-text-strong: #111111;
  --color-bg: #f5f5f5;
  --color-border: #dadada;
}

/* Einzelne Komponenten gezielt ueberschreiben */
.card { border-radius: 4px; }
```

Verfuegbare Tokens: `--color-primary` / `-dark` / `-light`, `--color-text` / `-strong` / `-soft` / `-muted`, `--color-bg`, `--color-surface` / `-alt`, `--color-border` / `-strong`, `--color-success`, `--color-danger`, `--color-favorite` / `-hover`. Default-Werte stehen im `:root`-Block von [src/assets/app.css](src/assets/app.css). Seed-Vorlage liegt in [seed/assets/custom.css](seed/assets/custom.css) mit Token-Dokumentation. Admin-UI bleibt bewusst von dem Override ausgenommen.

---

## ✏️ Content-Verwaltung (Admin)

Das Admin-Panel verwaltet **alle Event-Daten** (Sessions, Timetable, News, Food,
Sponsoren, Navigation, Event-Config + Logos/Floorplan) **und** das Voting
direkt im Browser — ohne Build, ohne Deployment, ohne Commit.

### Zugriff

```text
http://localhost:5173/admin/
```

Login über ein Formular mit dem Admin-Key. Der Key wird beim Deployment über
die `VOTING_ADMIN_KEY` Umgebungsvariable gesetzt (siehe [.env.example](.env.example))
und ist nur durch Container-Neustart änderbar. **Logout** über den Button oben
rechts im Admin-Panel.

### Verwaltbare Bereiche


| Bereich   | Datei            | Beschreibung                                                                                                      |
| --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sessions  | `sessions.json`  | Sessionplan nach Tagen und Zeitslots                                                                              |
| Timetable | `timetable.json` | Event-Zeitplan                                                                                                    |
| News      | `news.json`      | Permanente und tagesspezifische Ankündigungen                                                                     |
| Food      | `menue.json`     | Speisekarten mit Allergenen                                                                                       |
| Allergene | `allergene.json` | Allergen-Codes und Beschreibungen                                                                                 |
| Sponsors  | `sponsors.json`  | Sponsoren-Liste                                                                                                   |
| Menu      | `menu.json`      | Navigation der App                                                                                                |
| Event     | `event.json`     | Event-Konfiguration (Raw-JSON-Editor) + Upload von App-Logo und Floorplan-Bild (Branding & Medien)                |
| Voting    | —                | Voting-Status steuern (aktivieren/deaktivieren/beenden), Ergebnisse anzeigen, Votes in `sessions.json` übertragen |


**Features:**

- **Strukturierter Editor** — Formulare für jede Resource (Felder, Checkboxen, Auswahlen)
- **Raw JSON Editor** — Umschaltbar für direktes JSON-Editing (Event-Tab ist Raw-only)
- **Asset-Upload** — App-Logo, Floorplan und Sponsor-Logos per Drag & Drop (im Event-Tab, MIME-validiert, max. 5 MB)
- **Schema-Validierung** — Payloads werden beim Speichern serverseitig geprüft (Typen, Feldlängen, nur sichere URL-Schemes)
- **Backup/Restore** — Vor jedem Speichern wird automatisch ein Backup erstellt
- **Sofort live** — Änderungen sind nach dem Speichern direkt für alle User sichtbar (Service Worker network-first für JSON)
- **Tastaturkürzel** — `Ctrl+S` / `Cmd+S` zum Speichern

> **Persistenz:** Admin-Edits leben in `content/` und überleben jedes Image-Update.
> Der Build fasst das Content-Volume nicht an.

---

## 🗳️ Voting-System

Das Voting-System ermöglicht es Teilnehmern, Sessions zu bewerten und die beliebtesten Sessions zu ermitteln.

### Aktivierung

Das Voting-System kann über `event.json` zeitgesteuert aktiviert werden:

```json
{
  "features": {
    "voting": true,
    "votingSchedule": [
      {
        "day": "samstag",
        "dayLabel": "Samstag",
        "dayOfWeek": 6,
        "startTime": "16:00",
        "endTime": "17:45"
      }
    ]
  }
}
```

Der **Admin-Key** wird ausschließlich über die `VOTING_ADMIN_KEY` Umgebungsvariable gesetzt (siehe [.env.example](.env.example)) — **nicht mehr in `event.json`**. Der frühere `features.votingAdminKey`-Fallback ist entfernt; der Admin-API-Schema-Validator lehnt das Feld beim Speichern aktiv ab. Zusätzlich kann das Voting auch über den [Admin-Bereich](#️-content-verwaltung-admin) de/aktiviert oder beendet werden.

### Voting-Konfiguration

- **voting:** Aktiviert/deaktiviert das Voting-System
- **votingSchedule:** Zeitfenster für Abstimmungen
  - `day`: Interner Tag-Name (z.B. "samstag")
  - `dayLabel`: Anzeige-Name (z.B. "Samstag")
  - `dayOfWeek`: Wochentag als Zahl (0=Sonntag, 6=Samstag)
  - `startTime` / `endTime`: Zeitfenster für Abstimmungen
- **VOTING_ADMIN_KEY** (env): Geheimes Passwort für Admin-Bereich — in `.env` setzen

### Voting-Logik: Wann wird das Voting-Fenster angezeigt?

Das Voting-Fenster wird nur angezeigt, wenn **alle** folgenden Bedingungen erfüllt sind:

#### 1. Feature-Flag aktiv

```json
// event.json
{
  "features": {
    "voting": true  // ← Muss auf true stehen
  }
}
```

#### 2. Admin-Status "active"

```json
// content/voting/voting-state.json
{
  "status": "active"  // ← Mögliche Werte: "inactive", "active", "ended"
}
```

Der Status kann über den [Admin-Bereich](#admin-bereich) geändert werden.

#### 3. Zeitfenster aktiv

Das aktuelle Datum und die Uhrzeit müssen innerhalb eines konfigurierten Zeitfensters liegen:

```json
// event.json
{
  "features": {
    "votingSchedule": [
      {
        "dayOfWeek": 6,        // Samstag
        "startTime": "16:00",  // ← Voting öffnet um 16:00 Uhr
        "endTime": "17:45"     // ← Voting schließt um 17:45 Uhr
      }
    ]
  }
}
```

**Prüfung:** System vergleicht aktuellen Wochentag (0=Sonntag, 6=Samstag) und Uhrzeit mit der Konfiguration.

> **Testing:** Für lokale Tests kann die Zeitfenster-Prüfung mit dem
> Query-Parameter `?vote=<tag>` (z. B. `?vote=samstag`) übersprungen werden —
> Feature-Flag und Admin-Status müssen trotzdem aktiv sein.

### Nutzung

**Von Teilnehmern:**

- Voting-Button erscheint im Sessionplan während der konfigurierten Zeitfenster
- Jeder Teilnehmer kann **eine Stimme pro Tag** abgeben
- Abstimmung erfolgt via Browser-Fingerprint (anonymisiert)
- Top 3 Sessions werden mit Medaillen (🥇🥈🥉) angezeigt

### Admin-Bereich

Voting wird im [Admin-Panel](#️-content-verwaltung-admin) im Tab **"Voting"** verwaltet:

- Live-Statistik und Teilnehmerzahlen
- Voting aktivieren / deaktivieren / beenden
- Ergebnisse in `sessions.json` übertragen (Winner-Badge TOP 3)
- Ergebnis-Ansicht mit Medaillen-Ranking

---

## 💻 Entwicklung

### Wichtigste Befehle

| Befehl                | Was es tut                                                  |
| --------------------- | ----------------------------------------------------------- |
| `make dev-start`      | Dev-Container starten (Port 5173, Live-Reload aus `src/`)   |
| `make dev-prod-start` | Prod-Image lokal testen (Port 5174, Multi-Stage-Build)      |
| `make prod-start`     | Prod-Container für Server-Deployment (detached, baut Image) |
| `make test-all`       | Alle Playwright-Tests                                       |
| `make clean`          | node_modules, build-Output und Docker-Artefakte entfernen   |

Jedes der drei `start`-Targets hat passende `-stop`, `-build`, `-logs` und
`-remove`-Varianten (z. B. `make dev-stop`, `make prod-build`). Eine vollständige
Übersicht liefert `make help` oder `cat Makefile`.


---

## 🌍 Internationalisierung (i18n)

### Unterstützte Sprachen

- 🇩🇪 Deutsch (`de`)
- 🇬🇧 Englisch (`en`)

### i18n-Konfiguration

Sprache in `event.json` festlegen:

```json
{
  "event": {
    "locale": "de"
  }
}
```

### Übersetzungen hinzufügen

1. Schlüssel zu `src/translations/de.json` hinzufügen:
  ```json
   {
     "myFeature": {
       "title": "Mein Feature"
     }
   }
  ```
2. Denselben Schlüssel zu `src/translations/en.json` hinzufügen:
  ```json
   {
     "myFeature": {
       "title": "My Feature"
     }
   }
  ```
3. In HTML verwenden:
  ```html
   <h1 data-i18n="myFeature.title">My Feature</h1>
  ```
4. Überprüfen:
  ```bash
   make test
  ```

---

## 🏗️ Architektur

### Tech-Stack

- **Frontend:** Vanilla JavaScript (keine Frameworks!)
- **Styling:** Reines CSS (keine Präprozessoren)
- **Backend:** PHP (Voting-System + Content-Verwaltung)
- **PWA:** Service Worker, Web App Manifest
- **Build:** Node.js im Multi-Stage Docker-Build (Cache-Busting, Icon-Generierung)
- **Testing:** Playwright (Cross-Browser)
- **Server:** nginx + PHP-FPM (Docker, Dev + Prod)

### Caching-Strategie

**3-Schichten-Caching-System:**

1. **Service Worker Cache** — Network-first für JSON-Daten (damit Admin-Änderungen sofort sichtbar werden), Cache-first für statische Assets (HTML, CSS, JS, Bilder)
2. **localStorage Cache** — reiner Offline-Fallback für JSON-Daten (wird bei jedem erfolgreichen Fetch aktualisiert, aber nicht als Primärquelle verwendet)
3. **Cache Busting** — MD5-gehashte Dateinamen, zur Laufzeit aufgelöst via `assets-hashes.json` (Code-Assets, Image-Build) und `content/content-hashes.json` (Content-Volume, Runtime-Rehash) — ermöglicht Rehashing ohne Rebuild nach Admin-Edits

Beispiel:

- `app.css` → `app.b417865e.css`
- `menu.json` → `menu.ec9daa78.json`
- `header.js` → `header.e3796179.js`

Hash-Updates erfolgen beim Build **und** zur Laufzeit (nach Admin-Edits via [rehash.php](src/admin/rehash.php)).

### PWA-Features

- ✅ **Installierbar** - Zum Startbildschirm hinzufügen (Android, iOS, Desktop)
- ✅ **Offline-First** - Funktioniert ohne Internet
- ✅ **Schnell** - Gecachte Assets, sofortiges Laden
- ✅ **Responsiv** - Mobil, Tablet, Desktop
- ✅ **Sicher** - HTTPS erforderlich
- ✅ **Auto-Updates** - Service Worker Updates

---

## 📄 Lizenz

Dieses Projekt ist lizenziert unter der **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### Was bedeutet das?

- ✅ **Freie Nutzung** - Sie können die Software frei verwenden, modifizieren und verteilen
- ✅ **Open Source** - Der Quellcode bleibt immer verfügbar
- ✅ **SaaS-geschützt** - Auch bei Web-Service-Betrieb muss der Code offengelegt werden
- ⚠️ **Copyleft** - Änderungen müssen unter derselben Lizenz veröffentlicht werden
- ⚠️ **Netzwerk-Nutzung** - Bei SaaS-Betrieb muss ein Link zum Quellcode bereitgestellt werden

Für **Closed-Source** oder **proprietäre** Nutzung ist eine separate kommerzielle Lizenz erforderlich.

Siehe [LICENSE](LICENSE) für den vollständigen Lizenztext.

---

Mit ❤️ entwickelt für das [DevOps Camp](https://devops-camp.de).

© [Proud Commerce](https://www.proudcommerce.com) | 2025