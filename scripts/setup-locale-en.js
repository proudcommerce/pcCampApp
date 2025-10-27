#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const eventConfigPath = path.join(projectRoot, 'event.json');

console.log('🇬🇧 Setup: Englische Locale für Tests');

const eventConfig = JSON.parse(fs.readFileSync(eventConfigPath, 'utf-8'));

eventConfig.event.locale = 'en';

fs.writeFileSync(eventConfigPath, JSON.stringify(eventConfig, null, 2));

console.log('✅ event.json aktualisiert: locale = en');
console.log('🔨 Starte Build...');

execSync('node build-cache-busting.cjs', { 
    cwd: projectRoot,
    stdio: 'inherit'
});

console.log('✅ Build abgeschlossen (Englisch)');

