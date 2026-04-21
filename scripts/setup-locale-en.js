#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const eventConfigPath = path.join(projectRoot, 'content', 'event.json');

console.log('🇬🇧 Setup: Englische Locale für Tests');

const eventConfig = JSON.parse(fs.readFileSync(eventConfigPath, 'utf-8'));
eventConfig.event.locale = 'en';
fs.writeFileSync(eventConfigPath, JSON.stringify(eventConfig, null, 2));

console.log('✅ content/event.json aktualisiert: locale = en');
