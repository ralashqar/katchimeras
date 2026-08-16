#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataRoot = path.join(root, 'data', 'egg-avatar');
const outputPath = path.join(root, 'constants', 'egg-avatar-catalog.generated.ts');
const assetOutputPath = path.join(root, 'constants', 'egg-avatar-assets.generated.ts');
const categories = [
  ['body', 'bodies.json', 50],
  ['face', 'faces.json', 30],
  ['hat', 'hats.json', 40],
  ['held', 'held.json', 20],
];
const minimumReadyCount = { body: 10, face: 5, hat: 6, held: 6 };
const rarityValues = new Set(['common', 'rare', 'epic', 'legendary']);
const accessValues = new Set(['free', 'premium', 'essence']);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexPattern = /^#[0-9A-Fa-f]{6}$/;

function fail(message) {
  throw new Error(`[egg-avatar-catalog] ${message}`);
}

function readJson(relativePath) {
  const filePath = path.join(dataRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Cannot read ${path.relative(root, filePath)}: ${error.message}`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be a non-empty string`);
}

function runtimeHighAssetPath(sourceAssetPath) {
  if (path.posix.extname(sourceAssetPath).toLowerCase() !== '.png') {
    fail(`high-resolution source art must be PNG: ${sourceAssetPath}`);
  }
  const directory = path.posix.dirname(sourceAssetPath);
  const basename = path.posix.basename(sourceAssetPath, '.png');
  return path.posix.join(directory, 'high', `${basename}.webp`);
}

function validateItem(item, category, index, seenIds, bodyAccents) {
  const label = `${category}[${index}]`;
  if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`${label} must be an object`);
  nonEmptyString(item.id, `${label}.id`);
  if (!idPattern.test(item.id)) fail(`${label}.id must be kebab-case: ${item.id}`);
  if (seenIds.has(item.id)) fail(`Duplicate catalogue id: ${item.id}`);
  seenIds.add(item.id);
  nonEmptyString(item.name, `${label}.name`);
  nonEmptyString(item.description, `${label}.description`);
  if (!rarityValues.has(item.rarity)) fail(`${label}.rarity is invalid`);
  if (!item.visualDesign || typeof item.visualDesign !== 'object') fail(`${label}.visualDesign is required`);
  nonEmptyString(item.visualDesign.summary, `${label}.visualDesign.summary`);
  nonEmptyString(item.visualDesign.shapeLanguage, `${label}.visualDesign.shapeLanguage`);
  for (const key of ['palette', 'constraints']) {
    if (!Array.isArray(item.visualDesign[key]) || item.visualDesign[key].length === 0) {
      fail(`${label}.visualDesign.${key} must be a non-empty array`);
    }
    item.visualDesign[key].forEach((value, itemIndex) => nonEmptyString(value, `${label}.visualDesign.${key}[${itemIndex}]`));
  }
  if (!item.access || !accessValues.has(item.access.mode)) fail(`${label}.access.mode is invalid`);
  if (item.access.mode === 'essence') {
    if (!Number.isInteger(item.access.essencePrice) || item.access.essencePrice <= 0) {
      fail(`${label} must have a positive integer Essence price`);
    }
  } else if (item.access.essencePrice !== null) {
    fail(`${label} must have a null Essence price for ${item.access.mode} access`);
  }
  if (!['ready', 'planned'].includes(item.availability)) fail(`${label}.availability is invalid`);
  if (!Number.isInteger(item.sortOrder) || item.sortOrder !== index + 1) fail(`${label}.sortOrder must equal ${index + 1}`);
  if (!Number.isInteger(item.version) || item.version < 1) fail(`${label}.version must be positive`);
  if (!Number.isInteger(item.layoutVersion) || item.layoutVersion < 1) fail(`${label}.layoutVersion must be positive`);
  if (item.presentation) {
    if (!(item.presentation.scale > 0)) fail(`${label}.presentation.scale must be positive`);
    if (!Number.isFinite(item.presentation.offsetX) || !Number.isFinite(item.presentation.offsetY)) {
      fail(`${label}.presentation offsets must be finite`);
    }
  }
  if (item.availability === 'planned') {
    if (item.assetRefs !== null) fail(`${label} is planned and must not reference art`);
    if (item.isDefault) fail(`${label} is planned and cannot be a default`);
    return;
  }
  if (!item.assetRefs || typeof item.assetRefs !== 'object') fail(`${label} is ready and requires assetRefs`);
  for (const resolution of ['high', 'app', 'thumbnail']) {
    const assetPath = item.assetRefs[resolution];
    nonEmptyString(assetPath, `${label}.assetRefs.${resolution}`);
    if (!assetPath.startsWith('assets/images/katchimeras/egg-avatars/')) {
      fail(`${label}.assetRefs.${resolution} must stay inside the egg-avatar asset root`);
    }
    if (!fs.existsSync(path.join(root, assetPath))) fail(`${label} is missing ${assetPath}`);
  }
  for (const resolution of ['app', 'thumbnail']) {
    if (path.posix.extname(item.assetRefs[resolution]).toLowerCase() !== '.webp') {
      fail(`${label}.assetRefs.${resolution} must be an optimized WebP`);
    }
  }
  const highRuntimePath = runtimeHighAssetPath(item.assetRefs.high);
  if (!fs.existsSync(path.join(root, highRuntimePath))) {
    fail(`${label} is missing optimized high-resolution runtime art ${highRuntimePath}`);
  }
  if (category === 'body') {
    const accent = bodyAccents[item.id];
    if (!hexPattern.test(accent ?? '')) fail(`${label} requires a six-digit body accent in body-accents.json`);
  }
}

function loadAndValidate() {
  const bodyAccents = readJson('body-accents.json');
  const seenIds = new Set();
  const catalogs = {};
  for (const [category, filename, expectedCount] of categories) {
    const document = readJson(filename);
    if (document.schemaVersion !== 1) fail(`${filename} schemaVersion must be 1`);
    if (document.category !== category) fail(`${filename} category must be ${category}`);
    if (!Array.isArray(document.items) || document.items.length !== expectedCount) {
      fail(`${filename} must contain exactly ${expectedCount} items`);
    }
    document.items.forEach((item, index) => validateItem(item, category, index, seenIds, bodyAccents));
    const ready = document.items.filter((item) => item.availability === 'ready');
    if (ready.length < minimumReadyCount[category]) fail(`${filename} must retain at least ${minimumReadyCount[category]} ready items`);
    const defaults = ready.filter((item) => item.isDefault);
    const expectedDefaults = category === 'body' || category === 'face' ? 1 : 0;
    if (defaults.length !== expectedDefaults) fail(`${filename} must have exactly ${expectedDefaults} ready defaults`);
    catalogs[category] = document.items;
  }
  for (const id of Object.keys(bodyAccents)) {
    const body = catalogs.body.find((item) => item.id === id);
    if (!body || body.availability !== 'ready') fail(`body-accents.json contains non-ready body ${id}`);
  }
  return { bodyAccents, catalogs };
}

function quote(value) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function tuple(name, values) {
  return `export const ${name} = [\n${values.map((value) => `  ${quote(value)},`).join('\n')}\n] as const;`;
}

function assetMap(catalogs) {
  const sections = categories.map(([category]) => {
    const entries = catalogs[category]
      .filter((item) => item.availability === 'ready')
      .map((item) => {
        const refs = item.assetRefs;
        const highRuntimePath = runtimeHighAssetPath(refs.high);
        return `    ${quote(item.id)}: {\n      fullSource: require(${quote(`../${refs.app}`)}),\n      highSource: require(${quote(`../${highRuntimePath}`)}),\n      thumbnailSource: require(${quote(`../${refs.thumbnail}`)}),\n    },`;
      });
    return `  ${category}: {\n${entries.join('\n')}\n  },`;
  });
  return `export const EGG_AVATAR_READY_ASSETS = {\n${sections.join('\n')}\n} as const;`;
}

function generateSource({ bodyAccents, catalogs }) {
  const allTuples = [
    tuple('EGG_AVATAR_BODY_CATALOG_IDS', catalogs.body.map((item) => item.id)),
    tuple('EGG_AVATAR_FACE_CATALOG_IDS', catalogs.face.map((item) => item.id)),
    tuple('EGG_AVATAR_HAT_CATALOG_IDS', catalogs.hat.map((item) => item.id)),
    tuple('EGG_AVATAR_HELD_CATALOG_IDS', catalogs.held.map((item) => item.id)),
  ];
  const readyTuples = [
    tuple('EGG_AVATAR_SKIN_IDS', catalogs.body.filter((item) => item.availability === 'ready').map((item) => item.id)),
    tuple('EGG_AVATAR_FACE_IDS', catalogs.face.filter((item) => item.availability === 'ready').map((item) => item.id)),
    tuple('EGG_AVATAR_HAT_IDS', catalogs.hat.filter((item) => item.availability === 'ready').map((item) => item.id)),
    tuple('EGG_AVATAR_HELD_ACCESSORY_IDS', catalogs.held.filter((item) => item.availability === 'ready').map((item) => item.id)),
  ];
  const accentSource = Object.entries(bodyAccents).map(([id, accent]) => `  ${quote(id)}: ${quote(accent)},`).join('\n');
  return `/* This file is generated by scripts/generate-egg-avatar-catalog.cjs. Do not edit. */\n\n${allTuples.join('\n\n')}\n\n${readyTuples.join('\n\n')}\n\nexport const EGG_AVATAR_BODY_ACCENTS = {\n${accentSource}\n} as const;\n`;
}

function generateAssetSource({ catalogs }) {
  return `/* This file is generated by scripts/generate-egg-avatar-catalog.cjs. Do not edit.\n * Runtime imports contain optimized WebPs only; archival PNG masters stay tooling-only. */\n\n${assetMap(catalogs)}\n`;
}

function main() {
  const catalog = loadAndValidate();
  const source = generateSource(catalog);
  const assetSource = generateAssetSource(catalog);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (current !== source) fail(`${path.relative(root, outputPath)} is stale; run npm run avatar:catalog:generate`);
    const currentAssets = fs.existsSync(assetOutputPath) ? fs.readFileSync(assetOutputPath, 'utf8') : '';
    if (currentAssets !== assetSource) fail(`${path.relative(root, assetOutputPath)} is stale; run npm run avatar:catalog:generate`);
    console.log('egg-avatar catalogue is valid and generated output is current');
    return;
  }
  fs.writeFileSync(outputPath, source, 'utf8');
  fs.writeFileSync(assetOutputPath, assetSource, 'utf8');
  console.log(`wrote ${path.relative(root, outputPath)} and ${path.relative(root, assetOutputPath)}`);
}

main();
