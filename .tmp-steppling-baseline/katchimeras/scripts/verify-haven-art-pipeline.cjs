#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const managedCharacters = [
  'mossprout',
  'steppling',
  'feastle',
  'bedrotte',
  'pagelet',
  'gatherglow',
  'tasklet',
  'shellio',
];
const required = [
  'docs/haven-environment-art-pipeline.md',
  ...managedCharacters.map((character) => `design/floating-neighborhood-v2/haven/${character}/progression.json`),
  'scripts/generate-haven-progression.py',
  'scripts/prepare-haven-progression.py',
  'scripts/promote-haven-progression.py',
  'scripts/render-haven-progression-qa.py',
];

for (const relative of required) {
  if (!existsSync(join(root, relative))) {
    throw new Error(`Haven art pipeline is missing ${relative}`);
  }
}

const expectedOrder = [0, 4, 2, 1, 3];
const expectedGraph = {
  0: { kind: 'endpoint' },
  4: { kind: 'endpoint' },
  2: { kind: 'interpolation', between: [0, 4] },
  1: { kind: 'interpolation', between: [0, 2] },
  3: { kind: 'interpolation', between: [2, 4] },
};
const manifests = new Map();
for (const character of managedCharacters) {
  const manifest = JSON.parse(
    readFileSync(join(root, `design/floating-neighborhood-v2/haven/${character}/progression.json`), 'utf8'),
  );
  manifests.set(character, manifest);
  if (
    manifest.schemaVersion !== 2 ||
    manifest.character !== character ||
    manifest.stageCount !== 5 ||
    manifest.stages?.length !== 5
  ) {
    throw new Error(`${character} Haven progression must contain exactly five stages.`);
  }
  manifest.stages.forEach((stage, index) => {
    if (stage.id !== index || stage.key !== `${character}_haven_stage_${index}`) {
      throw new Error(`${character} Haven stage ${index} lost its contiguous ID/key contract.`);
    }
    for (const field of ['name', 'narrative', 'floor', 'landmark', 'props', 'palette', 'lighting', 'density']) {
      if (!stage[field] || (Array.isArray(stage[field]) && stage[field].length === 0)) {
        throw new Error(`${character} Haven stage ${index} is missing ${field}.`);
      }
    }
  });
  if (JSON.stringify(manifest.generationOrder) !== JSON.stringify(expectedOrder)) {
    throw new Error(`${character} Haven generation order must be endpoint-first: 0, 4, 2, 1, 3.`);
  }
  if (
    manifest.generation?.engine !== 'codex-built-in-imagegen' ||
    manifest.generation?.canonicalSize !== 2048 ||
    manifest.generation?.candidateCount !== 1 ||
    manifest.generation?.background?.toUpperCase() !== '#FF00FF' ||
    manifest.generation?.backgroundRemoval !== 'birefnet-matted-output'
  ) {
    throw new Error(`${character} Haven generation lost its Codex/chroma/BiRefNet contract.`);
  }
  const generated = new Set();
  for (const stage of expectedOrder) {
    const actual = manifest.referenceGraph?.[stage];
    const expected = expectedGraph[stage];
    if (!actual || actual.kind !== expected.kind) {
      throw new Error(`${character} Haven reference graph has an invalid Stage ${stage} node.`);
    }
    if (expected.between) {
      if (JSON.stringify(actual.between) !== JSON.stringify(expected.between)) {
        throw new Error(`${character} Haven Stage ${stage} must interpolate between ${expected.between.join(' and ')}.`);
      }
      if (!actual.between.every((reference) => generated.has(reference))) {
        throw new Error(`${character} Haven Stage ${stage} depends on an image that is generated later.`);
      }
    }
    generated.add(stage);
  }
}
const manifest = manifests.get('mossprout');
for (const exclusion of ['grass blades', 'bark veins', 'leaf-by-leaf canopies', 'realistic textures']) {
  if (!manifest.invariants?.exclude?.includes(exclusion)) {
    throw new Error(`Mossprout Haven manifest must explicitly exclude ${exclusion}.`);
  }
}

const generator = readFileSync(join(root, 'scripts/generate-haven-progression.py'), 'utf8');
for (const contract of [
  'codex-built-in-imagegen',
  'generationOrder',
  'endpoint_prompt',
  'interpolation_prompt',
  'stage-{reference}-chroma.png',
  'expectedOutputPath',
  'manifestSha256',
  'this script does not invoke that tool',
]) {
  if (!generator.includes(contract)) {
    throw new Error(`Haven generator lost contract: ${contract}`);
  }
}

const preparer = readFileSync(join(root, 'scripts/prepare-haven-progression.py'), 'utf8');
for (const contract of [
  'matted.png',
  'normalize_matte',
  'chroma_foreground_mask',
  'chroma-backed interior restore',
  'resize_rgba_premultiplied',
  'birefnet-matted-output',
  'stage-{stage_id}-alpha.png',
  '--skip-package',
  '--preserve-canvas',
]) {
  if (!preparer.includes(contract)) {
    throw new Error(`Haven preparation lost contract: ${contract}`);
  }
}

const promotion = readFileSync(join(root, 'scripts/promote-haven-progression.py'), 'utf8');
for (const contract of [
  '--candidate-dir',
  '--prepared-dir',
  'stage-{stage[\'id\']}-alpha.png',
  'run_prepared_promotion',
  'package-transparent-hex-tile.py',
  'restore(snapshot)',
  '--skip-bounds',
]) {
  if (!promotion.includes(contract)) {
    throw new Error(`Haven promotion lost contract: ${contract}`);
  }
}

const worldVisuals = readFileSync(join(root, 'utils/world-visuals.ts'), 'utf8');
for (const character of managedCharacters) {
  for (let stage = 0; stage < 5; stage += 1) {
    const assetKey = `floating_neighborhood_v2_${character}_haven_stage_${stage}_hex_tile`;
    for (const suffix of ['.webp', '_512.webp', '_256.webp']) {
      if (!existsSync(join(root, 'assets/images/katchimeras/world/hex', `${assetKey}${suffix}`))) {
        throw new Error(`${character} Haven runtime set is missing ${assetKey}${suffix}.`);
      }
    }
    for (const suffix of ['source.png', 'alpha.png']) {
      const filename = `floating-${character}_haven_stage_${stage}-${suffix}`;
      if (!existsSync(join(root, 'design/floating-neighborhood-v2', filename))) {
        throw new Error(`${character} Haven canonical set is missing ${filename}.`);
      }
    }
    if (!worldVisuals.includes(`${character}HavenTile(${stage},`)) {
      throw new Error(`${character} Haven runtime mapping is missing Stage ${stage}.`);
    }
  }
}

console.log('Haven art pipeline verified.');
