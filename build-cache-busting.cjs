#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

// Directories
const SRC_DIR = 'src';   // Development source files (read-only)
const BUILD_DIR = 'build'; // Production output (deployment-ready)
const EVENT_CONFIG_PATH = './event.json';

// Load event configuration
let eventConfig;
try {
  eventConfig = JSON.parse(fs.readFileSync(EVENT_CONFIG_PATH, 'utf8'));
  console.log(`📋 Loaded event config: ${eventConfig.event.name}`);
} catch (error) {
  console.error(`❌ Failed to load ${EVENT_CONFIG_PATH}:`, error.message);
  console.error('   Please ensure event.json exists in the project root.');
  process.exit(1);
}

// JSON-Dateien die gecacht werden sollen (relative Pfade)
const jsonFiles = [
  'menu.json',
  'news.json',
  'sponsors/sponsors.json',
  'sessionplan/sessions.json',
  'timetable/timetable.json',
  'food/menue.json',
  'food/allergene.json',
  'translations/de.json',
  'translations/en.json'
];

// Admin-verwaltete JSON-Dateien: Beim Build nicht überschreiben wenn sie
// bereits in build/ existieren (= via Admin geändert, nicht über src/)
const adminManagedJsonFiles = [
  'menu.json',
  'news.json',
  'sponsors/sponsors.json',
  'sessionplan/sessions.json',
  'timetable/timetable.json',
  'food/menue.json',
  'food/allergene.json'
];

// CSS-Dateien
const cssFiles = [
  'assets/app.css',
  'sessionplan/sessionplan.css',
  'food/food.css',
  'timetable/timetable.css',
  'floorplan/floorplan.css',
  'sponsors/sponsors.css',
  'admin/admin.css'
];

// JavaScript-Dateien (sw.js NICHT hashen!)
const jsFiles = [
  'assets/header.js',
  'assets/event-config-loader.js',  // Development mode placeholder replacement
  'sponsors/footer.js',
  'sessionplan/sessionplan.js',
  'food/food.js',
  'timetable/timetable.js',
  'floorplan/floorplan.js',
  'sponsors/sponsors.js',
  'admin/admin.js'
];

// Source icon for PWA icon generation
const SOURCE_ICON = 'assets/icon.png';

// Generated PWA icons (will be created from SOURCE_ICON during build)
const GENERATED_ICONS = [
  { size: 16, name: 'favicon.png' },      // Browser favicon
  { size: 144, name: 'icon-144.png' },    // Windows tile
  { size: 192, name: 'icon-192.png' },    // Android home screen
  { size: 512, name: 'icon-512.png' }     // Splash screen
];

// Bild-Dateien (ohne generierte Icons, werden separat verarbeitet)
const imageFiles = [
  'assets/logo.png',
  'floorplan/floorplan-min.jpg',
  'sponsors/sponsor-placeholder.png'
];

// HTML-Dateien die angepasst werden müssen
const htmlFiles = [
  'index.html',
  'sessionplan/index.html',
  'timetable/index.html',
  'food/index.html',
  'floorplan/index.html',
  'sponsors/index.html'
];

// Dateien die 1:1 kopiert werden (ohne Hashing)
// NOTE: sw.js und manifest.json werden separat verarbeitet (updateServiceWorker/updateManifestJson)
const copyOnlyFiles = [
  'robots.txt',
  '.htaccess',
  'votes/vote.php',
  'votes/results.php',
  'votes/admin.php',
  'votes/change-status.php',
  'votes/transfer-votes.php',
  'votes/config.php',
  'votes/votes.json',
  'votes/voting-state.json',
  'votes/votes.json.example',
  'votes/README.md',
  'admin/index.php',
  'admin/api.php',
  'admin/rehash.php',
  'admin/results.php'
];

function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Ensure directory exists
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Generate PWA icons from source icon
async function generateIcons() {
  const sourceIconPath = path.join(SRC_DIR, SOURCE_ICON);

  if (!fs.existsSync(sourceIconPath)) {
    console.error(`❌ Source icon not found: ${sourceIconPath}`);
    console.error('   Please ensure assets/icon.png exists in src/ directory.');
    process.exit(1);
  }

  console.log(`\n🎨 Generating PWA icons from ${SOURCE_ICON}...`);

  const iconHashMap = {};

  for (const icon of GENERATED_ICONS) {
    try {
      // Generate resized icon
      const buffer = await sharp(sourceIconPath)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
        })
        .png()
        .toBuffer();

      // Generate hash from icon content
      const hash = generateHash(buffer);
      const baseName = path.basename(icon.name, '.png');
      const hashedName = `${baseName}.${hash}.png`;
      const outputPath = path.join(BUILD_DIR, 'assets', hashedName);

      // Save to build directory
      ensureDir(outputPath);
      fs.writeFileSync(outputPath, buffer);

      // Store mapping for later reference updates
      const originalPath = `assets/${icon.name}`;
      const hashedPath = `assets/${hashedName}`;
      iconHashMap[originalPath] = hashedPath;

      console.log(`   ✓ Generated ${icon.size}x${icon.size}: ${icon.name} → ${hashedName}`);
    } catch (error) {
      console.error(`   ❌ Failed to generate ${icon.name}:`, error.message);
      process.exit(1);
    }
  }

  return iconHashMap;
}

// Get sponsor logos dynamically
// NOTE: Sponsor logos are now loaded from external URLs
// No longer need to hash local sponsor logo files
function getSponsorLogos() {
  return []; // Empty - logos are now external URLs
}

function processJsonFiles(imageHashMap = {}) {
  const hashMap = {};

  jsonFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    const buildUnhashedPath = path.join(BUILD_DIR, relativePath);
    const isAdminManaged = adminManagedJsonFiles.includes(relativePath);

    // Admin-verwaltete Dateien: build/-Version bevorzugen (falls vorhanden)
    let sourcePath = srcPath;
    if (isAdminManaged && fs.existsSync(buildUnhashedPath)) {
      sourcePath = buildUnhashedPath;
      console.log(`  ↳ ${relativePath}: verwende bestehende build/-Version (Admin-verwaltet)`);
    }

    if (fs.existsSync(sourcePath)) {
      let content = fs.readFileSync(sourcePath, 'utf8');

      // Replace image paths in JSON content with hashed versions
      if (Object.keys(imageHashMap).length > 0) {
        // Get the directory of the current JSON file (e.g., 'sponsors' for 'sponsors/sponsoren.json')
        const jsonDir = path.dirname(relativePath);

        Object.entries(imageHashMap).forEach(([originalPath, hashedPath]) => {
          // Replace absolute paths: /sponsors/logo.jpg → /sponsors/logo.abc123.jpg
          const absoluteOriginal = '/' + originalPath;
          const absoluteHashed = '/' + hashedPath;
          content = content.replace(
            new RegExp(absoluteOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            absoluteHashed
          );

          // Replace relative paths for same-directory images
          // If JSON is in sponsors/ and image is in sponsors/, replace ./logo.jpg → ./logo.abc123.jpg
          const imageDir = path.dirname(originalPath);
          if (jsonDir === imageDir) {
            const originalFilename = path.basename(originalPath);
            const hashedFilename = path.basename(hashedPath);
            const relativeOriginal = './' + originalFilename;
            const relativeHashed = './' + hashedFilename;
            content = content.replace(
              new RegExp(relativeOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              relativeHashed
            );

            // Also replace bare filenames without ./ prefix (e.g., "logo.jpg" → "logo.abc123.jpg")
            // This is needed for JSON files that reference images by filename only
            // Negative lookaheads ensure we don't replace URLs or paths containing /
            const bareFilenamePattern = new RegExp(
              `(["'])(?!https?:\\/\\/)(?![^"']*\\/)${originalFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`,
              'g'
            );
            content = content.replace(bareFilenamePattern, `$1${hashedFilename}$1`);
          }

          // Also replace full relative paths: ./sponsors/logo.jpg → ./sponsors/logo.abc123.jpg
          const fullRelativeOriginal = './' + originalPath;
          const fullRelativeHashed = './' + hashedPath;
          content = content.replace(
            new RegExp(fullRelativeOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            fullRelativeHashed
          );
        });
      }

      const hash = generateHash(content);
      const ext = path.extname(relativePath);
      const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
      const buildPath = path.join(BUILD_DIR, hashedRelativePath);

      ensureDir(buildPath);
      fs.writeFileSync(buildPath, content);

      hashMap[relativePath] = hashedRelativePath;
      console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
    } else {
      console.warn(`⚠ JSON-Datei nicht gefunden: ${srcPath}`);
    }
  });

  return hashMap;
}

function processCssFiles() {
  const hashMap = {};

  cssFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (fs.existsSync(srcPath)) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const hash = generateHash(content);

      const ext = path.extname(relativePath);
      const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
      const buildPath = path.join(BUILD_DIR, hashedRelativePath);

      ensureDir(buildPath);
      fs.writeFileSync(buildPath, content);

      hashMap[relativePath] = hashedRelativePath;
      console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
    } else {
      console.warn(`⚠ CSS-Datei nicht gefunden: ${srcPath}`);
    }
  });

  return hashMap;
}

function processJsFiles() {
  const hashMap = {};

  // NOTE: JSON filenames are NO LONGER baked into JS at build time.
  // JS files use resolveAsset() at runtime to look up hashed filenames
  // from cache-hashes.json. This allows the admin API to rehash JSON
  // files after edits without needing to rebuild JS/HTML/SW.

  jsFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (fs.existsSync(srcPath)) {
      const content = fs.readFileSync(srcPath, 'utf8');

      const hash = generateHash(content);
      const ext = path.extname(relativePath);
      const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
      const buildPath = path.join(BUILD_DIR, hashedRelativePath);

      ensureDir(buildPath);
      fs.writeFileSync(buildPath, content);

      hashMap[relativePath] = hashedRelativePath;
      console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
    } else {
      console.warn(`⚠ JS-Datei nicht gefunden: ${srcPath}`);
    }
  });

  return hashMap;
}

function processImageFiles() {
  const hashMap = {};
  const sponsorLogos = getSponsorLogos();
  const allImageFiles = [...imageFiles, ...sponsorLogos];

  allImageFiles.forEach(relativePath => {
    const srcPath = path.join(SRC_DIR, relativePath);
    if (fs.existsSync(srcPath)) {
      const content = fs.readFileSync(srcPath); // Binary
      const hash = generateHash(content);

      const ext = path.extname(relativePath);
      const hashedRelativePath = relativePath.replace(ext, `.${hash}${ext}`);
      const buildPath = path.join(BUILD_DIR, hashedRelativePath);

      ensureDir(buildPath);
      fs.writeFileSync(buildPath, content);

      hashMap[relativePath] = hashedRelativePath;
      console.log(`✓ ${relativePath} → ${hashedRelativePath}`);
    } else {
      console.warn(`⚠ Bild-Datei nicht gefunden: ${srcPath}`);
    }
  });

  return hashMap;
}

function replaceEventPlaceholders(content) {
  // Replace event-specific placeholders with values from event.json
  // Generate robots meta tag value based on allowIndexing
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

    // Replace event placeholders first
    content = replaceEventPlaceholders(content);

    let replacements = 0;

    // Berücksichtige Subfolder-Pfade (../ vs ./)
    const isInSubfolder = relativePath.includes('/');
    const pathPrefix = isInSubfolder ? '../' : './';

    Object.entries(hashMap).forEach(([originalRelPath, hashedRelPath]) => {
      // Escape special regex characters in path
      const escapedOriginalPath = originalRelPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Check if asset is in same directory as HTML file
      const htmlDir = path.dirname(relativePath);
      const assetDir = path.dirname(originalRelPath);
      const isSameDir = htmlDir === assetDir;

      // For same-directory files, use only filename; otherwise use full relative path
      const assetFilename = path.basename(originalRelPath);
      const hashedFilename = path.basename(hashedRelPath);

      // CSS Link-Tags
      if (originalRelPath.endsWith('.css')) {
        // Try full path first
        const regex1 = new RegExp(
          `(<link[^>]*href=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        const replacement1 = `$1${pathPrefix}${hashedRelPath}"`;
        let newContent = content.replace(regex1, replacement1);
        if (newContent !== content) {
          replacements++;
          content = newContent;
        }

        // Also try same-directory reference (./filename.css)
        if (isSameDir) {
          const regex2 = new RegExp(
            `(<link[^>]*href=["'])\\./${assetFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          const replacement2 = `$1./${hashedFilename}"`;
          newContent = content.replace(regex2, replacement2);
          if (newContent !== content) {
            replacements++;
            content = newContent;
          }
        }
      }

      // Script-Tags
      if (originalRelPath.endsWith('.js')) {
        // Try full path first
        const regex1 = new RegExp(
          `(<script[^>]*src=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        const replacement1 = `$1${pathPrefix}${hashedRelPath}"`;
        let newContent = content.replace(regex1, replacement1);
        if (newContent !== content) {
          replacements++;
          content = newContent;
        }

        // Also try same-directory reference (./filename.js)
        if (isSameDir) {
          const regex2 = new RegExp(
            `(<script[^>]*src=["'])\\./${assetFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          const replacement2 = `$1./${hashedFilename}"`;
          newContent = content.replace(regex2, replacement2);
          if (newContent !== content) {
            replacements++;
            content = newContent;
          }
        }
      }

      // Image-Tags (img src)
      if (originalRelPath.match(/\.(png|jpg|jpeg)$/i)) {
        // Match full paths: ../floorplan/floorplan-min.jpg or ./assets/logo.png
        const regex = new RegExp(
          `(<img[^>]*src=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        const replacement = `$1${pathPrefix}${hashedRelPath}"`;
        const newContent = content.replace(regex, replacement);
        if (newContent !== content) {
          replacements++;
          content = newContent;
        }

        // Also match same-directory references: floorplan-min.jpg (without path prefix)
        // Only for files in subdirectories (e.g., floorplan/floorplan-min.jpg)
        const filename = path.basename(originalRelPath);
        if (originalRelPath.includes('/') && relativePath.includes('/')) {
          // This HTML is in a subdirectory, match just the filename
          const filenameRegex = new RegExp(
            `(<img[^>]*src=["'])${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
            'g'
          );
          const hashedFilename = path.basename(hashedRelPath);
          const newContent2 = content.replace(filenameRegex, `$1${hashedFilename}"`);
          if (newContent2 !== content) {
            replacements++;
            content = newContent2;
          }
        }
      }

      // Link rel="icon" und apple-touch-icon
      if (originalRelPath.match(/\.(png|jpg|jpeg)$/i)) {
        const regex = new RegExp(
          `(<link[^>]*href=["'])(\\.\\./|\\./)?(${escapedOriginalPath})["']`,
          'g'
        );
        const replacement = `$1${pathPrefix}${hashedRelPath}"`;
        const newContent = content.replace(regex, replacement);
        if (newContent !== content) {
          replacements++;
          content = newContent;
        }
      }

      // NOTE: Inline JSON references in HTML are NOT replaced anymore.
      // JS uses resolveAsset() at runtime to look up hashed filenames from cache-hashes.json.
    });

    // Write to build directory
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

function updateManifestJson(hashMap) {
  // Generate manifest.json from event.json configuration
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

  // Add icons with hashed paths from generated icons
  // Icons are auto-generated from sourceIcon, so we use the GENERATED_ICONS list
  GENERATED_ICONS.forEach(icon => {
    if (icon.size === 16) return; // Skip favicon (not needed in manifest)

    const iconPath = `assets/${icon.name}`;
    const hashedPath = hashMap[iconPath];

    if (hashedPath) {
      manifest.icons.push({
        src: '/' + hashedPath,
        sizes: `${icon.size}x${icon.size}`,
        type: 'image/png',
        purpose: icon.size === 144 ? 'any' : 'any maskable'
      });
    } else {
      console.warn(`⚠ Generated icon not found in hashMap: ${iconPath}`);
    }
  });

  // Add categories
  if (eventConfig.pwa.categories) {
    manifest.categories = eventConfig.pwa.categories;
  }

  // Write to build directory
  const buildManifestPath = path.join(BUILD_DIR, 'manifest.json');
  ensureDir(buildManifestPath);
  fs.writeFileSync(buildManifestPath, JSON.stringify(manifest, null, 2));

  console.log('✓ manifest.json generiert aus event.json');
}

function updateServiceWorker(hashMap) {
  const srcSwPath = path.join(SRC_DIR, 'sw.js');
  if (!fs.existsSync(srcSwPath)) {
    console.warn('⚠ sw.js nicht gefunden');
    return;
  }

  let content = fs.readFileSync(srcSwPath, 'utf8');

  // Aktualisiere Cache-Namen mit Zeitstempel (event-agnostic)
  const timestamp = Date.now();
  content = content.replace(
    /const CACHE_NAME = '[^']*';/,
    `const CACHE_NAME = 'event-app-v${timestamp}';`
  );

  // Erstelle neue urlsToCache-Liste mit aktuellen Hashes
  const urlsToCache = [
    "'./'",
    "'./index.html'",
    "'./sessionplan/index.html'",
    "'./timetable/index.html'",
    "'./food/index.html'",
    "'./floorplan/index.html'",
    "'./translations.json'",  // Translation manifest (NOT hashed)
    "'./cache-hashes.json'"   // Asset hash manifest for resolveAsset() offline fallback
  ];

  // Füge gehashte Assets hinzu
  Object.entries(hashMap).forEach(([originalRelPath, hashedRelPath]) => {
    const isJsonFile = originalRelPath.endsWith('.json');
    const isTranslationJson = originalRelPath.startsWith('translations/');

    // Runtime-updated JSON files are fetched network-first and cached on demand.
    // Only static translation JSON files stay in the pre-cache.
    if (isJsonFile && !isTranslationJson) return;
    if (originalRelPath.includes('sessionplan_')) return;

    urlsToCache.push(`'./${hashedRelPath}'`);
  });

  // Ersetze die urlsToCache-Array-Definition
  const urlsToCacheString = `const urlsToCache = [\n  ${urlsToCache.join(',\n  ')}\n];`;
  content = content.replace(
    /const urlsToCache = \[[\s\S]*?\];/,
    urlsToCacheString
  );

  // Write to build directory
  const buildSwPath = path.join(BUILD_DIR, 'sw.js');
  ensureDir(buildSwPath);
  fs.writeFileSync(buildSwPath, content);
  console.log('✓ Service Worker aktualisiert');
}

function createHashManifest(hashMap) {
  const manifestOutputPath = path.join(BUILD_DIR, 'cache-hashes.json');
  ensureDir(manifestOutputPath);
  fs.writeFileSync(manifestOutputPath, JSON.stringify(hashMap, null, 2));
  console.log(`✓ Hash-Manifest erstellt: ${manifestOutputPath}`);
}

function createTranslationManifest(jsonHashMap) {
  // Extract only translation files from the hash map
  const translationMap = {};

  Object.entries(jsonHashMap).forEach(([originalPath, hashedPath]) => {
    if (originalPath.startsWith('translations/')) {
      // Extract locale name (de, en, etc.) from filename
      const filename = path.basename(originalPath, '.json');
      translationMap[filename] = hashedPath;
    }
  });

  // Write translation manifest to build directory (NOT hashed, needs to be findable)
  const manifestPath = path.join(BUILD_DIR, 'translations.json');
  ensureDir(manifestPath);
  fs.writeFileSync(manifestPath, JSON.stringify(translationMap, null, 2));
  console.log(`✓ Translation-Manifest erstellt: translations.json`);
  console.log(`   Locales: ${Object.keys(translationMap).join(', ')}`);
}

function createUnhashedJsonCopies(jsonHashMap) {
  // Create unhashed copies of JSON files for PHP backend access
  // PHP scripts need direct access to sessions.json, but frontend uses hashed versions
  Object.entries(jsonHashMap).forEach(([originalPath, hashedPath]) => {
    const hashedFullPath = path.join(BUILD_DIR, hashedPath);
    const unhashedFullPath = path.join(BUILD_DIR, originalPath);

    if (fs.existsSync(hashedFullPath)) {
      ensureDir(unhashedFullPath);
      fs.copyFileSync(hashedFullPath, unhashedFullPath);
      console.log(`   ✓ ${originalPath} (unhashed copy for PHP)`);
    }
  });
}

function copyStaticFiles(hashMap = {}) {
  console.log('\n📋 Kopiere statische Dateien...');

  // Copy event.json (only if not already present in build/ from a previous admin session)
  const eventJsonSrc = EVENT_CONFIG_PATH;
  const eventJsonDest = path.join(BUILD_DIR, 'event.json');
  if (!fs.existsSync(eventJsonDest)) {
    if (fs.existsSync(eventJsonSrc)) {
      fs.copyFileSync(eventJsonSrc, eventJsonDest);
      console.log('✓ event.json kopiert');
    }
  } else {
    console.log('✓ event.json: bestehende build/-Version beibehalten');
  }

  // Generate robots.txt based on SEO config
  const allowIndexing = eventConfig.seo?.allowIndexing ?? false;
  const robotsTxtContent = allowIndexing
    ? 'User-agent: *\nAllow: /'
    : 'User-agent: *\nDisallow: /';

  const robotsTxtPath = path.join(BUILD_DIR, 'robots.txt');
  fs.writeFileSync(robotsTxtPath, robotsTxtContent);
  console.log(`✓ robots.txt generiert (allowIndexing: ${allowIndexing})`);

  copyOnlyFiles.forEach(relativePath => {
    // Skip robots.txt as it's generated above
    if (relativePath === 'robots.txt') return;

    const srcPath = path.join(SRC_DIR, relativePath);
    const buildPath = path.join(BUILD_DIR, relativePath);

    if (fs.existsSync(srcPath)) {
      ensureDir(buildPath);

      // Special handling for votes + admin PHP files: adjust paths for production
      // In src/: votes/ -> src/ -> root/event.json (../../event.json)
      // In build/: votes/ -> build/event.json (../event.json)
      const needsPhpPathFix = relativePath.endsWith('.php') &&
        (relativePath.startsWith('votes/') || relativePath.startsWith('admin/'));

      if (needsPhpPathFix) {
        let content = fs.readFileSync(srcPath, 'utf8');

        // Replace ../../event.json with ../event.json for production build
        content = content.replace(/\/\.\.\/\.\./g, '/..');

        // Replace asset references with hashed versions
        if (typeof hashMap !== 'undefined' && hashMap) {
          Object.entries(hashMap).forEach(([originalPath, hashedPath]) => {
            const originalFilename = path.basename(originalPath);
            const hashedFilename = path.basename(hashedPath);
            const escapedFilename = originalFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Cross-directory asset references: ../assets/app.css → ../assets/app.HASH.css
            if (originalPath.startsWith('assets/')) {
              const regex = new RegExp(`\\.\\./assets/${escapedFilename}`, 'g');
              content = content.replace(regex, `../assets/${hashedFilename}`);
            }

            // Same-directory asset references in admin/: admin.css → admin.HASH.css, admin.js → admin.HASH.js
            // Only applies when the hashed file sits in the same directory as the PHP file
            const phpDir = path.dirname(relativePath);
            const assetDir = path.dirname(originalPath);
            if (phpDir === assetDir && (originalPath.endsWith('.css') || originalPath.endsWith('.js'))) {
              // Match bare filename in href="admin.css" or src="admin.js" (not ../... paths)
              const bareRegex = new RegExp(`(["'])${escapedFilename}\\1`, 'g');
              content = content.replace(bareRegex, `$1${hashedFilename}$1`);
            }
          });
        }

        fs.writeFileSync(buildPath, content);
        console.log(`✓ ${relativePath} kopiert (Pfade angepasst für Production)`);
      } else {
        fs.copyFileSync(srcPath, buildPath);
        console.log(`✓ ${relativePath} kopiert`);
      }
    } else {
      // Some files like votes.json might not exist yet
      if (!relativePath.includes('votes.json')) {
        console.warn(`⚠ Datei nicht gefunden: ${srcPath}`);
      }
    }
  });
}

// Backup admin-managed JSON files before cleaning build/
function backupAdminData() {
  const backup = {};
  adminManagedJsonFiles.forEach(relativePath => {
    const buildPath = path.join(BUILD_DIR, relativePath);
    if (fs.existsSync(buildPath)) {
      backup[relativePath] = fs.readFileSync(buildPath, 'utf8');
    }
  });
  return backup;
}

// Restore admin-managed JSON files after cleaning build/
function restoreAdminData(backup) {
  const restoredCount = Object.keys(backup).length;
  if (restoredCount === 0) return;
  console.log(`\n📋 Stelle ${restoredCount} Admin-verwaltete Datei(en) wieder her...`);
  Object.entries(backup).forEach(([relativePath, content]) => {
    const buildPath = path.join(BUILD_DIR, relativePath);
    ensureDir(buildPath);
    fs.writeFileSync(buildPath, content);
    console.log(`   ✓ ${relativePath} (Admin-Daten wiederhergestellt)`);
  });
}

function cleanBuildDirectory() {
  // Backup admin-managed data before cleaning
  const adminBackup = backupAdminData();

  if (fs.existsSync(BUILD_DIR)) {
    console.log('🧹 Bereinige altes build/ Verzeichnis...');
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log('✓ build/ Verzeichnis bereinigt');
  }
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  // Restore admin-managed data
  restoreAdminData(adminBackup);
}

// Hauptfunktion
async function main() {
  console.log('🚀 Starte Production Build mit Cache Busting...');
  console.log(`📂 Source: ${SRC_DIR}/`);
  console.log(`📦 Output: ${BUILD_DIR}/\n`);

  try {
    // Clean build directory
    cleanBuildDirectory();

    // Generate PWA icons from source icon (must be async)
    const iconHashMap = await generateIcons();

    // Copy favicon for browser (16x16 favicon.png → favicon.ico in root)
    console.log('\n🔖 Kopiere favicon.ico...');
    const faviconSource = iconHashMap['assets/favicon.png'];
    if (faviconSource) {
      const faviconHashedPath = path.join(BUILD_DIR, faviconSource);
      const faviconDestPath = path.join(BUILD_DIR, 'favicon.ico');
      if (fs.existsSync(faviconHashedPath)) {
        fs.copyFileSync(faviconHashedPath, faviconDestPath);
        console.log('✓ favicon.ico kopiert (von assets/favicon.png)');
      }
    }

    // IMPORTANT: Process images FIRST so we can update JSON files with hashed image paths
    console.log('\n🖼 Verarbeite Bilder...');
    const imageHashMap = processImageFiles();

    // Merge icon hashes with image hashes
    Object.assign(imageHashMap, iconHashMap);

    // Process all asset types
    console.log('\n📄 Verarbeite JSON-Dateien...');
    const jsonHashMap = processJsonFiles(imageHashMap);

    // Create unhashed copies for PHP backend access
    console.log('\n📋 Erstelle ungehashte JSON-Kopien für PHP-Backend...');
    createUnhashedJsonCopies(jsonHashMap);

    console.log('\n🎨 Verarbeite CSS-Dateien...');
    const cssHashMap = processCssFiles();

    console.log('\n📜 Verarbeite JavaScript-Dateien...');
    const jsHashMap = processJsFiles();

    // Merge all hash maps
    const hashMap = Object.assign({}, jsonHashMap, cssHashMap, jsHashMap, imageHashMap);

    console.log('\n📝 Aktualisiere HTML-Dateien...');
    updateHtmlFiles(hashMap);

    console.log('\n📱 Aktualisiere PWA Manifest...');
    updateManifestJson(hashMap);

    console.log('\n⚙️ Aktualisiere Service Worker...');
    updateServiceWorker(hashMap);

    // Create hash manifest for runtime resolveAsset() lookups
    console.log('\n📋 Erstelle Hash-Manifest...');
    createHashManifest(hashMap);

    // Create translation manifest for i18n dynamic loading
    console.log('\n🌐 Erstelle Translation-Manifest...');
    createTranslationManifest(jsonHashMap);

    // Copy static files (pass hashMap for PHP asset path replacement)
    copyStaticFiles(hashMap);

    console.log('\n✅ Production Build abgeschlossen!');
    console.log('\n📊 Zusammenfassung:');
    console.log(`   - ${GENERATED_ICONS.length} PWA Icons generiert (aus ${SOURCE_ICON})`);
    console.log(`   - ${Object.keys(jsonHashMap).length} JSON-Dateien (gehasht)`);
    console.log(`   - ${Object.keys(cssHashMap).length} CSS-Dateien (gehasht)`);
    console.log(`   - ${Object.keys(jsHashMap).length} JavaScript-Dateien (gehasht)`);
    console.log(`   - ${Object.keys(imageHashMap).length} Bilder (gehasht)`);
    console.log(`   - ${htmlFiles.length} HTML-Dateien`);
    console.log(`   - ${copyOnlyFiles.length} statische Dateien kopiert`);
    console.log('   - manifest.json aktualisiert');
    console.log('   - Service Worker aktualisiert');
    console.log(`\n📦 Deployment-ready Dateien in: ${BUILD_DIR}/`);

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
