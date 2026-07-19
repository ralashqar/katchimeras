#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const required = [
  'docs/floating-neighborhood-v2-environment-pipeline.md',
  'design/floating-neighborhood-v2/new-environment-brief.json',
  'design/floating-neighborhood-v2/briefs/README.md',
  'design/floating-neighborhood-v2/floating-neutral-source.png',
  'design/floating-neighborhood-v2/floating-home-source.png',
  'scripts/promote-floating-neighborhood-v2-tile.py',
];

for (const relative of required) {
  if (!existsSync(join(root, relative))) {
    throw new Error(`Floating-v2 pipeline is missing ${relative}`);
  }
}

JSON.parse(readFileSync(join(root, 'design/floating-neighborhood-v2/new-environment-brief.json'), 'utf8'));
const generator = readFileSync(join(root, 'scripts/generate-katchimera-hex-tile.py'), 'utf8');
const generatorContracts = [
  'floating-neutral-source.png',
  'floating-home-source.png',
  '--dry-run',
  '--brief',
  'briefSha256',
  'baseSha256',
  'V2 generation never accepts a creature reference',
  'pure-black #000000',
  'Do not add a circle',
];
for (const contract of generatorContracts) {
  if (!generator.includes(contract)) {
    throw new Error(`Floating-v2 generator lost required contract: ${contract}`);
  }
}

const promotion = readFileSync(join(root, 'scripts/promote-floating-neighborhood-v2-tile.py'), 'utf8');
for (const contract of ['hex-tile-pipeline.py', 'package-transparent-hex-tile.py', 'generate-hex-tile-bounds.py']) {
  if (!promotion.includes(contract)) {
    throw new Error(`Floating-v2 promotion lost required stage: ${contract}`);
  }
}

console.log('Floating neighbourhood v2 generation and promotion contracts are present.');
