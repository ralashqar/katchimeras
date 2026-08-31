#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const required = [
  'docs/floating-neighborhood-v2-environment-pipeline.md',
  'design/floating-neighborhood-v2/new-environment-brief.json',
  'design/floating-neighborhood-v2/briefs/README.md',
  'design/floating-neighborhood-v2/floating-neutral-source.png',
  'design/floating-neighborhood-v2/floating-home-source.png',
  'scripts/promote-floating-neighborhood-v2-tile.py',
  'design/mossprout-hex-neighborhood-v1/pipeline.json',
  'docs/mossprout-hex-neighborhood-pipeline.md',
  'scripts/generate-mossprout-hex-neighborhood.py',
];

for (const relative of required) {
  if (!existsSync(join(root, relative))) {
    throw new Error(`Floating-v2 pipeline is missing ${relative}`);
  }
}

const briefTemplate = JSON.parse(readFileSync(join(root, 'design/floating-neighborhood-v2/new-environment-brief.json'), 'utf8'));
if (!briefTemplate.floor) {
  throw new Error('Floating-v2 brief template must require a theme-specific floor.');
}
const briefsDirectory = join(root, 'design/floating-neighborhood-v2/briefs');
for (const filename of readdirSync(briefsDirectory).filter((name) => name.endsWith('.json'))) {
  const brief = JSON.parse(readFileSync(join(briefsDirectory, filename), 'utf8'));
  if (!brief.floor) {
    throw new Error(`Floating-v2 brief ${filename} is missing its theme-specific floor.`);
  }
}
const zodiacBriefsDirectory = join(briefsDirectory, 'zodiac');
const zodiacSigns = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
for (const sign of zodiacSigns) {
  const filename = `${sign}.json`;
  const brief = JSON.parse(readFileSync(join(zodiacBriefsDirectory, filename), 'utf8'));
  if (brief.key !== sign || brief.kind !== 'zodiac' || !brief.floor) {
    throw new Error(`Floating-v2 zodiac brief ${filename} lost its key, kind, or floor contract.`);
  }
  for (const relative of [
    `design/floating-neighborhood-v2/floating-zodiac-${sign}-source.png`,
    `design/floating-neighborhood-v2/floating-zodiac-${sign}-alpha.png`,
    `assets/images/katchimeras/world/hex/floating_neighborhood_v2_zodiac_${sign}_hex_tile.webp`,
    `assets/images/katchimeras/world/hex/floating_neighborhood_v2_zodiac_${sign}_hex_tile_512.webp`,
    `assets/images/katchimeras/world/hex/floating_neighborhood_v2_zodiac_${sign}_hex_tile_256.webp`,
  ]) {
    if (!existsSync(join(root, relative))) {
      throw new Error(`Floating-v2 zodiac production set is missing ${relative}`);
    }
  }
}
const worldVisuals = readFileSync(join(root, 'utils/world-visuals.ts'), 'utf8');
for (const sign of zodiacSigns) {
  if (!worldVisuals.includes(`floatingNeighborhoodV2ZodiacTile('${sign}')`)) {
    throw new Error(`Floating-v2 runtime mapping is missing zodiac sign ${sign}.`);
  }
}
for (const filename of ['qa-zodiac-fire-earth.png', 'qa-zodiac-air-water.png']) {
  if (!existsSync(join(root, 'design/floating-neighborhood-v2', filename))) {
    throw new Error(`Floating-v2 zodiac QA is missing ${filename}.`);
  }
}
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
  'Do not add a center circle',
  'reference grass is allowed and expected',
  'zodiac sanctuary',
  'floating-focused-v2',
  "erase Image 1's continuous dark-green hedge/parapet completely",
  'beneath it unchanged, and let the themed ground',
  'deep tapered floating-island silhouette',
  'floating-focused-v2 is an internal locked mode',
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
