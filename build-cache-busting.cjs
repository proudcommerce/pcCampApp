#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

// Directories
const SRC_DIR = 'src';          // Code source (HTML/CSS/JS/PHP + static assets)
const SEED_DIR = 'seed';        // Default content for fresh content volumes
const BUILD_DIR = 'build';      // Deployment-ready output (copied into the image)
const EVENT_CONFIG_PATH = path.join(SEED_DIR, 'event.json');

// Load event configuration (only used for build-time placeholder replacement
// and manifest.json generation — runtime edits happen via /content/event.json).
let eventConfig;
try {
  eventConfig = JSON.parse(fs.readFileSync(EVENT_CONFIG_PATH, 'utf8'));
  console.log(`📋 Loaded event config from ${EVENT_CONFIG_PATH}: ${eventConfig.event.name}`);
} catch (error) {
  console.error(`❌ Failed to load ${EVENT_CONFIG_PATH}:`, error.message);
  process.exit(1);
}

// JSON files that are part of the *code* (not runtime-editable content).
// Only translations fall into this bucket after the content/ split.
const jsonFiles = [
  'translations/de.json',
  'translations/en.json'
];

const cssFiles = [
  'assets/app.css',
  'sessionplan/sessionplan.css',
  'food/food.css',
  'timetable/timetable.css',
  'floorplan/floorplan.css',
  'sponsors/sponsors.css',
  'admin/admin.css'
];

const jsFiles = [
  'assets/header.js',
  'assets/event-config-loader.js',
  'sponsors/footer.js',
  'sessionplan/sessionplan.js',
  'food/food.js',
  'timetable/timetable.js',
  'floorplan/floorplan.js',
  'sponsors/sponsors.js',
  'admin/admin.js'
];

const SOURCE_ICON = 'assets/icon.png';

const GENERATED_ICONS = [
  { size: 16, name: 'favicon.png' },
  { size: 144, name: 'icon-144.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

// All event-owned images (logo, floorplan, sponsor logos) live in the content/
// volume and are served via window.contentUrl() — no build-time hashing needed.
const imageFiles = [];

const htmlFiles = [
  'index.html',
  'sessionplan/index.html',
  'timetable/index.html',
  'food/index.html',
  'floorplan/index.html',
  'sponsors/index.html',
  // PHP-Templates mit Asset-Referenzen (link/script/img) — gleiche Hash-Rewrite-Logik,
  // `replaceEventPlaceholders` ist no-op solange keine {{...}}-Platzhalter enthalten sind.
  'admin/index.php',
  'admin/results.php'
];

// Files copied 1:1 (no hashing). Runtime-editable files (votes, content JSONs)
// are NOT listed — they live in /content/ which is seeded on container start.
const copyOnlyFiles = [
  '.htaccess',
  'votes/vote.php',
  'votes/results.php',
  'votes/admin.php',
  'votes/change-status.php',
  'votes/transfer-votes.php',
  'votes/status.php',
  'votes/vote-helpers.php',
  'votes/config.php',
  'votes/README.md',
  'admin/api.php',
  'admin/rehash.php',
  'admin/content-paths.php',
  'admin/schemas.php',
  'admin/upload.php'
];

function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function generateIcons() {
  const sourceIconPath = path.join(SRC_DIR, SOURCE_ICON);
  if (!fs.existsSync(sourceIconPath)) {
    console.error(`❌ Source icon not found: ${sourceIconPath}`);
    process.exit(1);
  }

  // Icons bleiben bewusst ungehasht und unter festem Namen — das erlaubt
  // Admin-Logo-Uploads, ihre resizes per nginx try_files /content$uri $uri
  // vor den Build-Default zu legen, ohne manifest.json / HTML neu bauen zu muessen.
  // Cache-Invalidation laeuft ueber BUILD_VERSION + content/sw-version.txt im SW.
  console.log(`\n🎨 Generating PWA icons from ${SOURCE_ICON}...`);
  const iconPaths = [];

  for (const icon of GENERATED_ICONS) {
    const buffer = await sharp(sourceIconPath)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    const outputPath = path.join(BUILD_DIR, 'assets', icon.name);
    ensureDir(outputPath);
    fs.writeFileSync(outputPath, buffer);

    iconPaths.push(`assets/${icon.name}`);
    console.log(`   ✓ ${icon.size}x${icon.size}: ${icon.name}`);
  }

  return iconPaths;
}

function processJsonFiles() {
  const hashMap = {};
  jsonFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ JSON-Datei nicht gefunden: ${srcPath}`);
      return;
    }
    const content = fs.readFileSync(srcPath, 'utf8');
    const hash = generateHash(content);
    const ext = path.extname(relativePath);
    const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
    const buildPath = path.join(BUILD_DIR, hashedRelativePath);

    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);

    hashMap[relativePath] = hashedRelativePath;
    console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
  });
  return hashMap;
}

function processCssFiles() {
  const hashMap = {};
  cssFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ CSS-Datei nicht gefunden: ${srcPath}`);
      return;
    }
    const content = fs.readFileSync(srcPath, 'utf8');
    const hash = generateHash(content);
    const ext = path.extname(relativePath);
    const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
    const buildPath = path.join(BUILD_DIR, hashedRelativePath);

    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);

    hashMap[relativePath] = hashedRelativePath;
    console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
  });
  return hashMap;
}

function processJsFiles() {
  const hashMap = {};
  jsFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ JS-Datei nicht gefunden: ${srcPath}`);
      return;
    }
    const content = fs.readFileSync(srcPath, 'utf8');
    const hash = generateHash(content);
    const ext = path.extname(relativePath);
    const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
    const buildPath = path.join(BUILD_DIR, hashedRelativePath);

    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);

    hashMap[relativePath] = hashedRelativePath;
    console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
  });
  return hashMap;
}

function processImageFiles() {
  const hashMap = {};
  imageFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ Bild-Datei nicht gefunden: ${srcPath}`);
      return;
    }
    const content = fs.readFileSync(srcPath);
    const hash = generateHash(content);
    const ext = path.extname(relativePath);
    const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
    const buildPath = path.join(BUILD_DIR, hashedRelativePath);

    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);

    hashMap[relativePath] = hashedRelativePath;
    console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
  });
  return hashMap;
}

function replaceEventPlaceholders(content) {
  const allowIndexing = eventConfig.seo?.allowIndexing ?? false;
  const robotsMeta = allowIndexing ? 'index, follow' : 'noindex, nofollow';

  const replacements = {
    '{{EVENT_NAME}}': eventConfig.event.name,
    '{{EVENT_SHORT_NAME}}': eventConfig.event.shortName,
    '{{EVENT_DESCRIPTION}}': eventConfig.event.description,
    '{{EVENT_HASHTAG}}': eventConfig.event.hashtag || '',
    '{{COPYRIGHT}}': eventConfig.event.copyright,
    '{{EVENT_LOCALE}}': eventConfig.event.locale || 'de',
    '{{THEME_COLOR}}': eventConfig.branding.themeColor,
    '{{BACKGROUND_COLOR}}': eventConfig.branding.backgroundColor,
    '{{SPONSOR_FOOTER_TEXT}}': eventConfig.texts?.sponsorFooterText || 'Vielen Dank an unsere Sponsoren:',
    '{{NEWS_BUTTON_LABEL}}': eventConfig.texts?.newsButtonLabel || 'News',
    '{{MENU_BUTTON_LABEL}}': eventConfig.texts?.menuButtonLabel || 'Menü',
    '{{ROBOTS_META}}': robotsMeta
  };

  let result = content;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });
  return result;
}

function updateHtmlFiles(hashMap) {
  htmlFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ HTML-Datei nicht gefunden: ${srcPath}`);
      return;
    }

    let content = fs.readFileSync(srcPath, 'utf8');
    content = replaceEventPlaceholders(content);

    let replacements = 0;
    const isInSubfolder = relativePath.includes('/');
    const pathPrefix = isInSubfolder ? '../' : './';

    Object.entries(hashMap).forEach(([originalRelPath, hashedRelPath]) => {
      const escapedOriginalPath = originalRelPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const htmlDir = path.dirname(relativePath);
      const assetDir = path.dirname(originalRelPath);
      const isSameDir = htmlDir === assetDir;
      const assetFilename = path.basename(originalRelPath);
      const hashedFilename = path.basename(hashedRelPath);

      if (originalRelPath.endsWith('.css')) {
        const regex1 = new RegExp(
          `(<link[^>]*href=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        let newContent = content.replace(regex1, `$1${pathPrefix}${hashedRelPath}"`);
        if (newContent !== content) { replacements++; content = newContent; }

        if (isSameDir) {
          const regex2 = new RegExp(
            `(<link[^>]*href=["'])(\\.\\/)?${assetFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          newContent = content.replace(regex2, `$1$2${hashedFilename}"`);
          if (newContent !== content) { replacements++; content = newContent; }
        }
      }

      if (originalRelPath.endsWith('.js')) {
        const regex1 = new RegExp(
          `(<script[^>]*src=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        let newContent = content.replace(regex1, `$1${pathPrefix}${hashedRelPath}"`);
        if (newContent !== content) { replacements++; content = newContent; }

        if (isSameDir) {
          const regex2 = new RegExp(
            `(<script[^>]*src=["'])(\\.\\/)?${assetFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          newContent = content.replace(regex2, `$1$2${hashedFilename}"`);
          if (newContent !== content) { replacements++; content = newContent; }
        }
      }

      if (originalRelPath.match(/\.(png|jpg|jpeg)$/i)) {
        const regex = new RegExp(
          `(<img[^>]*src=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        let newContent = content.replace(regex, `$1${pathPrefix}${hashedRelPath}"`);
        if (newContent !== content) { replacements++; content = newContent; }

        const filename = path.basename(originalRelPath);
        if (originalRelPath.includes('/') && relativePath.includes('/')) {
          const filenameRegex = new RegExp(
            `(<img[^>]*src=["'])${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          const newContent2 = content.replace(filenameRegex, `$1${hashedFilename}"`);
          if (newContent2 !== content) { replacements++; content = newContent2; }
        }

        const linkRegex = new RegExp(
          `(<link[^>]*href=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        const newContent3 = content.replace(linkRegex, `$1${pathPrefix}${hashedRelPath}"`);
        if (newContent3 !== content) { replacements++; content = newContent3; }
      }
    });

    const buildPath = path.join(BUILD_DIR, relativePath);
    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);

    if (replacements > 0) {
      console.log(`✓ ${relativePath} aktualisiert (${replacements} Ersetzungen)`);
    } else {
      console.log(`  ${relativePath} - keine Änderungen erforderlich`);
    }
  });
}

function updateManifestJson() {
  const manifest = {
    name: eventConfig.pwa.manifestName,
    short_name: eventConfig.pwa.manifestShortName,
    description: eventConfig.pwa.manifestDescription,
    start_url: eventConfig.pwa.startUrl,
    display: eventConfig.pwa.display,
    background_color: eventConfig.branding.backgroundColor,
    theme_color: eventConfig.branding.themeColor,
    orientation: eventConfig.pwa.orientation,
    scope: eventConfig.pwa.scope,
    lang: eventConfig.event.locale,
    icons: []
  };

  GENERATED_ICONS.forEach(icon => {
    if (icon.size === 16) return;
    manifest.icons.push({
      src: `/assets/${icon.name}`,
      sizes: `${icon.size}x${icon.size}`,
      type: 'image/png',
      purpose: icon.size === 144 ? 'any' : 'any maskable'
    });
  });

  if (eventConfig.pwa.categories) {
    manifest.categories = eventConfig.pwa.categories;
  }

  const buildManifestPath = path.join(BUILD_DIR, 'manifest.json');
  ensureDir(buildManifestPath);
  fs.writeFileSync(buildManifestPath, JSON.stringify(manifest, null, 2));
  console.log('✓ manifest.json generiert');
}

function updateServiceWorker(hashMap, iconPaths = []) {
  const srcSwPath = path.join(SRC_DIR, 'sw.js');
  if (!fs.existsSync(srcSwPath)) {
    console.warn('⚠ sw.js nicht gefunden');
    return;
  }

  let content = fs.readFileSync(srcSwPath, 'utf8');

  // BUILD_VERSION is the build-time part of the cache name. At runtime sw.js
  // combines it with the content-volume's sw-version.txt so admin edits also
  // invalidate the cache without rebuilding the image.
  const buildVersion = Date.now().toString();
  content = content.replace(
    /const BUILD_VERSION = '[^']*';/,
    `const BUILD_VERSION = 'v${buildVersion}';`
  );

  const urlsToCache = [
    "'./'",
    "'./index.html'",
    "'./sessionplan/index.html'",
    "'./timetable/index.html'",
    "'./food/index.html'",
    "'./floorplan/index.html'",
    "'./translations.json'",
    "'./assets-hashes.json'"
  ];

  Object.entries(hashMap).forEach(([originalRelPath, hashedRelPath]) => {
    const isJsonFile = originalRelPath.endsWith('.json');
    const isTranslationJson = originalRelPath.startsWith('translations/');
    if (isJsonFile && !isTranslationJson) return;
    urlsToCache.push(`'./${hashedRelPath}'`);
  });

  // Icons werden ungehasht ausgeliefert (nginx try_files faellt auf
  // content/assets/ vor dem Build-Default zurueck).
  iconPaths.forEach(iconRelPath => {
    urlsToCache.push(`'./${iconRelPath}'`);
  });

  const urlsToCacheString = `const urlsToCache = [\n  ${urlsToCache.join(',\n  ')}\n];`;
  content = content.replace(
    /const urlsToCache = \[[\s\S]*?\];/,
    urlsToCacheString
  );

  const buildSwPath = path.join(BUILD_DIR, 'sw.js');
  ensureDir(buildSwPath);
  fs.writeFileSync(buildSwPath, content);
  console.log('✓ Service Worker aktualisiert (BUILD_VERSION + urlsToCache)');
}

function createAssetsHashManifest(hashMap) {
  const manifestOutputPath = path.join(BUILD_DIR, 'assets-hashes.json');
  ensureDir(manifestOutputPath);
  fs.writeFileSync(manifestOutputPath, JSON.stringify(hashMap, null, 2));
  console.log(`✓ Assets-Hash-Manifest erstellt: ${manifestOutputPath}`);
}

function createTranslationManifest(jsonHashMap) {
  const translationMap = {};
  Object.entries(jsonHashMap).forEach(([originalPath, hashedPath]) => {
    if (originalPath.startsWith('translations/')) {
      const filename = path.basename(originalPath, '.json');
      translationMap[filename] = hashedPath;
    }
  });

  const manifestPath = path.join(BUILD_DIR, 'translations.json');
  ensureDir(manifestPath);
  fs.writeFileSync(manifestPath, JSON.stringify(translationMap, null, 2));
  console.log(`✓ Translation-Manifest erstellt: translations.json`);
  console.log(`   Locales: ${Object.keys(translationMap).join(', ')}`);
}

function copyStaticFiles() {
  console.log('\n📋 Kopiere statische Dateien...');

  const allowIndexing = eventConfig.seo?.allowIndexing ?? false;
  const robotsTxtContent = allowIndexing
    ? 'User-agent: *\nAllow: /'
    : 'User-agent: *\nDisallow: /';
  fs.writeFileSync(path.join(BUILD_DIR, 'robots.txt'), robotsTxtContent);
  console.log(`✓ robots.txt generiert (allowIndexing: ${allowIndexing})`);

  copyOnlyFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    const buildPath = path.join(BUILD_DIR, relativePath);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠ Datei nicht gefunden: ${srcPath}`);
      return;
    }
    ensureDir(buildPath);
    fs.copyFileSync(srcPath, buildPath);
    console.log(`✓ ${relativePath} kopiert`);
  });
}

function cleanBuildDirectory() {
  if (fs.existsSync(BUILD_DIR)) {
    console.log('🧹 Bereinige altes build/ Verzeichnis...');
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

async function main() {
  console.log('🚀 Starte Production Build mit Cache Busting...');
  console.log(`📂 Code:    ${SRC_DIR}/`);
  console.log(`🌱 Seed:    ${SEED_DIR}/  (Build-Zeit Event-Config)`);
  console.log(`📦 Output:  ${BUILD_DIR}/\n`);

  try {
    cleanBuildDirectory();

    const iconPaths = await generateIcons();

    console.log('\n🔖 Kopiere favicon.ico...');
    const faviconBuildPath = path.join(BUILD_DIR, 'assets/favicon.png');
    const faviconDestPath = path.join(BUILD_DIR, 'favicon.ico');
    if (fs.existsSync(faviconBuildPath)) {
      fs.copyFileSync(faviconBuildPath, faviconDestPath);
      console.log('✓ favicon.ico kopiert');
    }

    console.log('\n🖼 Verarbeite Bilder...');
    const imageHashMap = processImageFiles();

    console.log('\n📄 Verarbeite JSON-Dateien (Code-Teil)...');
    const jsonHashMap = processJsonFiles();

    console.log('\n🎨 Verarbeite CSS-Dateien...');
    const cssHashMap = processCssFiles();

    console.log('\n📜 Verarbeite JavaScript-Dateien...');
    const jsHashMap = processJsFiles();

    const hashMap = Object.assign({}, jsonHashMap, cssHashMap, jsHashMap, imageHashMap);

    console.log('\n📝 Aktualisiere HTML-Dateien...');
    updateHtmlFiles(hashMap);

    console.log('\n📱 Aktualisiere PWA Manifest...');
    updateManifestJson();

    console.log('\n⚙️ Aktualisiere Service Worker...');
    updateServiceWorker(hashMap, iconPaths);

    console.log('\n📋 Erstelle Assets-Hash-Manifest...');
    createAssetsHashManifest(hashMap);

    console.log('\n🌐 Erstelle Translation-Manifest...');
    createTranslationManifest(jsonHashMap);

    copyStaticFiles();

    console.log('\n✅ Production Build abgeschlossen!');
    console.log('\n📊 Zusammenfassung:');
    console.log(`   - ${GENERATED_ICONS.length} PWA Icons generiert`);
    console.log(`   - ${Object.keys(jsonHashMap).length} JSON-Dateien (Code, gehasht)`);
    console.log(`   - ${Object.keys(cssHashMap).length} CSS-Dateien`);
    console.log(`   - ${Object.keys(jsHashMap).length} JavaScript-Dateien`);
    console.log(`   - ${Object.keys(imageHashMap).length} Bilder`);
    console.log(`   - ${htmlFiles.length} HTML-Dateien`);
    console.log(`   - ${copyOnlyFiles.length} statische Dateien kopiert`);
    console.log(`\n📦 Deployment-ready in: ${BUILD_DIR}/`);
    console.log(`🌱 Content wird zur Laufzeit aus ${SEED_DIR}/ nach /content/ geseedet.`);
  } catch (error) {
    console.error('❌ Fehler beim Build:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processJsonFiles, processCssFiles, processJsFiles, processImageFiles, updateHtmlFiles, updateServiceWorker };
