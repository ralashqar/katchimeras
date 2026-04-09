import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedsPath = path.join(__dirname, '..', 'data', 'katchimeras', 'encounter-seeds.json');
const outputPath = path.join(
  __dirname,
  '..',
  'data',
  'katchimeras',
  'encounter-katchimeras.json'
);

const title = (value) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const describeTrigger = (seed) => {
  if (seed.topLevelType === 'landmark') {
    return `a rare encounter with ${title(seed.triggerSubtype)}`;
  }

  if (seed.topLevelType === 'activity') {
    return `a strong ${title(seed.triggerSubtype).toLowerCase()}`;
  }

  return `${title(seed.triggerSubtype).toLowerCase()} visits`;
};

const createDescription = (seed, variant) => {
  if (seed.topLevelType === 'landmark') {
    return `${variant.name} appears after ${describeTrigger(
      seed
    )}. It captures the ${seed.theme} side of that moment and turns it into something collectible.`;
  }

  if (seed.topLevelType === 'activity') {
    return `${variant.name} appears when your day is driven by ${describeTrigger(
      seed
    )}. It captures the ${seed.theme} side of your momentum and turns it into something collectible.`;
  }

  return `${variant.name} appears when your day keeps returning to ${describeTrigger(
    seed
  )}. It captures the ${seed.theme} side of your routine and turns it into something collectible.`;
};

const createVisualDescription = (seed, variant) =>
  `${variant.name} is a cute ${variant.creatureKind} tied to ${title(seed.triggerSubtype).toLowerCase()} encounters, with ${variant.visualMotifs.join(
    ', '
  )}, a ${seed.visualTone} mood, and cozy-premium stylized 3D collectible presence.`;

const createPromptHooks = (seed, variant) => [
  seed.promptBase,
  ...variant.visualMotifs,
  seed.visualTone,
  'cute funny collectible creature',
  'cozy-premium stylized 3D companion',
];

const createImagePrompt = (seed, variant) => {
  const visualDescription = createVisualDescription(seed, variant);
  return `${visualDescription}. ${seed.promptBase}. Include ${variant.visualMotifs.join(
    ', '
  )}. Premium mobile game creature render, isolated subject, centered composition, 512x512 square image, no text, no frame, transparent-free dark-neutral backdrop.`;
};

const buildCatalog = (seeds) =>
  seeds.flatMap((seed) =>
    seed.variants.map((variant) => ({
      id: `${seed.topLevelType}_${seed.triggerSubtype}_${variant.idSuffix}`,
      seedId: seed.id,
      topLevelType: seed.topLevelType,
      triggerCategory: seed.triggerCategory,
      triggerSubtype: seed.triggerSubtype,
      theme: seed.theme,
      creatureKind: variant.creatureKind,
      name: variant.name,
      caption: variant.caption,
      userFacingDescription: createDescription(seed, variant),
      motivationalQuote: variant.motivationalQuote,
      baseRarity: seed.defaultRarity,
      variantSupport: seed.variantSupport,
      lifestyleSignals: seed.lifestyleSignals,
      sourceExamples: seed.sourceExamples,
      visualTone: seed.visualTone,
      visualMotifs: variant.visualMotifs,
      visualDescription: createVisualDescription(seed, variant),
      promptHooks: createPromptHooks(seed, variant),
      imagePrompt: createImagePrompt(seed, variant),
    }))
  );

const main = async () => {
  const seeds = JSON.parse(await fs.readFile(seedsPath, 'utf8'));
  const catalog = buildCatalog(seeds);

  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);

  console.log(
    `Generated ${catalog.length} encounter-based Katchimeras from ${seeds.length} seed groups.`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
