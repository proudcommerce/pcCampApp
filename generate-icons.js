#!/usr/bin/env node

/**
 * PWA Icon Generator for Development Mode
 *
 * Generates all PWA icons from the source icon (src/assets/icon.png)
 * without running the full build process.
 *
 * This is needed for development mode (make dev-up) to prevent
 * console errors when manifest.json references icons that don't exist.
 *
 * In production builds, this is integrated into build-cache-busting.js
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = 'src';
const SOURCE_ICON = path.join(SRC_DIR, 'assets/icon.png');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 16, name: 'favicon.png' },      // Browser favicon
  { size: 144, name: 'icon-144.png' },    // Windows tile
  { size: 192, name: 'icon-192.png' },    // Android home screen
  { size: 512, name: 'icon-512.png' }     // Splash screen
];

/**
 * Generate a single PWA icon
 */
async function generateIcon(sourceIcon, size, outputPath) {
  try {
    await sharp(sourceIcon)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toFile(outputPath);

    console.log(`   ✅ ${size}x${size} → ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`   ❌ Failed to generate ${outputPath}:`, error.message);
    throw error;
  }
}

/**
 * Generate all PWA icons
 */
async function generateAllIcons() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           PWA Icon Generator (Development Mode)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check if source icon exists
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`❌ Source icon not found: ${SOURCE_ICON}`);
    console.error('   Please ensure src/assets/icon.png exists.');
    process.exit(1);
  }

  console.log(`📷 Source: ${SOURCE_ICON}`);
  console.log(`📁 Output: ${path.join(SRC_DIR, 'assets/')}`);
  console.log('');
  console.log('🎨 Generating PWA icons...');

  const assetsDir = path.join(SRC_DIR, 'assets');

  // Generate all icons
  for (const icon of ICON_SIZES) {
    const outputPath = path.join(assetsDir, icon.name);
    await generateIcon(SOURCE_ICON, icon.size, outputPath);
  }

  console.log('');
  console.log('✅ All PWA icons generated successfully!');
  console.log('');
  console.log('💡 Icons generated:');
  ICON_SIZES.forEach(icon => {
    console.log(`   - ${icon.name} (${icon.size}x${icon.size})`);
  });
}

// Run icon generation
generateAllIcons().catch(error => {
  console.error('❌ Icon generation failed:', error);
  process.exit(1);
});
