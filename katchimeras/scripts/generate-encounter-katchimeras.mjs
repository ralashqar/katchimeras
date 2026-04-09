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

const lowerTitle = (value) => title(value).toLowerCase();

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

const createIdentityInsight = (seed, variant) => {
  if (seed.topLevelType === 'landmark') {
    return `${variant.name} reflects the part of you that changes when a rare place becomes real.`;
  }

  if (seed.topLevelType === 'activity') {
    return `${variant.name} reflects the momentum that builds when your body commits to a stronger day.`;
  }

  return `${variant.name} reflects the way repeated ${lowerTitle(
    seed.triggerSubtype
  )} moments quietly shape who you are becoming.`;
};

const createUnlockLine = (seed, variant) => {
  if (seed.topLevelType === 'landmark') {
    return `A rare encounter with ${title(seed.triggerSubtype)} brought ${variant.name} into your deck today.`;
  }

  if (seed.topLevelType === 'activity') {
    return `Today's ${lowerTitle(seed.triggerSubtype)} revealed ${variant.name}.`;
  }

  return `Today's ${lowerTitle(seed.triggerSubtype)} path revealed ${variant.name}.`;
};

const createRepeatLine = (seed, variant) =>
  `Returning to ${lowerTitle(seed.triggerSubtype)} is deepening ${variant.name}'s line in your deck.`;

const createRareLine = (seed, variant) => {
  if (seed.topLevelType === 'landmark') {
    return `${variant.name} marks a rare memory-tier encounter that your deck will keep differently.`;
  }

  return `A rarer form of ${variant.name} can appear when this pattern becomes more distinctive over time.`;
};

const createRestorativeLine = (seed, variant) => {
  if (seed.topLevelType === 'activity') {
    return `Even after bigger movement, ${variant.name} reminds you that recovery is part of real progress.`;
  }

  if (seed.triggerCategory === 'park' || seed.triggerSubtype === 'park') {
    return `${variant.name} reminds you that calmer green moments still count as a meaningful day.`;
  }

  if (seed.triggerCategory === 'cafe' || seed.triggerSubtype === 'coffee_shop') {
    return `${variant.name} reminds you that warmth, pause, and routine can still move your life forward.`;
  }

  return `${variant.name} reminds you that quieter moments still become part of your deck.`;
};

const createProgressLine = (seed, variant) => {
  if (seed.topLevelType === 'landmark') {
    return `${variant.name} turns a memorable place into lasting identity progress.`;
  }

  if (seed.topLevelType === 'activity') {
    return `${variant.name} shows that your effort is no longer abstract. It is starting to take shape.`;
  }

  return `${variant.name} shows that your everyday choices are becoming something visible and collectible.`;
};

const createStorySeed = (seed, variant) => {
  const source = seed.sourceExamples[0] ?? lowerTitle(seed.triggerSubtype);

  if (seed.topLevelType === 'landmark') {
    return `After standing near ${title(
      seed.triggerSubtype
    )}, ${variant.name} followed the memory home and settled into your deck.`;
  }

  if (seed.topLevelType === 'activity') {
    return `Somewhere in the middle of your ${lowerTitle(
      seed.triggerSubtype
    )}, ${variant.name} appeared and kept pace with the rest of the day.`;
  }

  return `After time around ${source}, ${variant.name} emerged as the small living mark that this day left behind.`;
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
      identityInsight: createIdentityInsight(seed, variant),
      unlockLine: createUnlockLine(seed, variant),
      repeatLine: createRepeatLine(seed, variant),
      rareLine: createRareLine(seed, variant),
      restorativeLine: createRestorativeLine(seed, variant),
      progressLine: createProgressLine(seed, variant),
      storySeed: createStorySeed(seed, variant),
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
