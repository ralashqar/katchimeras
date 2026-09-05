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

const createPosePrompt = (seed, variant) => {
  if (seed.triggerCategory === 'home' || seed.triggerSubtype === 'home_evening') {
    return 'slouchy cozy pose with asymmetrical lean, tucked limbs, soft head tilt, and blanket-like clingy appeal';
  }

  if (seed.topLevelType === 'activity' || seed.triggerCategory === 'movement' || seed.triggerCategory === 'sport') {
    return 'mid-hop or forward-lean action pose with off-axis twist, springy limbs, and strong silhouette flow';
  }

  if (
    seed.triggerCategory === 'cafe' ||
    seed.triggerCategory === 'food_spot' ||
    seed.triggerCategory === 'commerce'
  ) {
    return 'bouncy asymmetrical mascot pose with torso turn, lifted paw, head tilt, and playful weight shift';
  }

  if (seed.topLevelType === 'landmark' || seed.triggerCategory === 'global_landmark') {
    return 'confident dynamic pose with torso twist, lifted chest, head tilt, and expressive ears, tail, or plume';
  }

  if (variant.creatureKind === 'spirit') {
    return 'curved hovering pose with flowing S-line, gentle drift, and readable floating gesture';
  }

  return 'appealing asymmetrical mascot pose with slight lean, torso turn, head tilt, and one lifted limb';
};

const createExpressionPrompt = (seed) => {
  if (seed.triggerCategory === 'home' || seed.triggerSubtype === 'home_evening') {
    return 'sleepy relaxed smile with half-lidded eyes, soft cheeks, and cozy low-energy charm';
  }

  if (seed.triggerCategory === 'cafe' || seed.triggerCategory === 'food_spot') {
    return 'delighted or smug-cute expression with lifted cheeks, bright eyes, and playful mouth asymmetry';
  }

  if (seed.triggerCategory === 'commerce') {
    return 'overfocused cute expression with determined brows, tiny concentrated mouth, and competent gremlin energy';
  }

  if (seed.topLevelType === 'activity' || seed.triggerCategory === 'movement' || seed.triggerCategory === 'sport') {
    return 'proud energized expression with bright eyes, confident brows, and active cheek lift';
  }

  if (seed.topLevelType === 'landmark' || seed.triggerCategory === 'global_landmark') {
    return 'wide-eyed delighted expression with wonder, charged curiosity, and clear facial acting';
  }

  return 'curious warm expression with clear cheek lift, readable brow shape, and appealing mascot charm';
};

const createShadingPrompt = () =>
  'cartoony proportions with believable premium shading, realistic lighting response on stylized materials, clean studio key light, soft fill light, controlled rim light, grounded contact shadows, subtle bounce light, richer eye gloss, richer shading on glow core and hero motif, simplified body surfaces';

const createVisualDescription = (seed, variant) =>
  `${variant.name} is a cute ${variant.creatureKind} tied to ${title(seed.triggerSubtype).toLowerCase()} encounters, with ${variant.visualMotifs.join(
    ', '
  )}, a ${seed.visualTone} mood, dramatically oversized luminous eyes, a visible inner glow core, head-dominant mascot proportions, and premium stylized game-mascot presence`;

const createPromptHooks = (seed, variant) => [
  seed.promptBase,
  ...variant.visualMotifs,
  seed.visualTone,
  'dramatically oversized glossy luminous eyes',
  'visible inner glow core',
  'head-dominant rounded mascot silhouette',
  'exaggerated chunky readable proportions',
  createPosePrompt(seed, variant),
  createExpressionPrompt(seed),
  createShadingPrompt(),
  'one overscaled signature encounter motif',
  'premium stylized 3D mascot creature render',
];

const createImagePrompt = (seed, variant) => {
  const visualDescription = createVisualDescription(seed, variant);
  const posePrompt = createPosePrompt(seed, variant);
  const expressionPrompt = createExpressionPrompt(seed);
  const shadingPrompt = createShadingPrompt();
  return `${visualDescription} ${seed.promptBase}. Include ${variant.visualMotifs.join(
    ', '
  )}. Premium stylized 3D mascot creature render, premium stylized game mascot CGI, Fortnite-inspired silhouette clarity without combat energy, Royal Match-inspired facial readability and charm, dramatically oversized glossy luminous eyes, visible inner glow core, head-dominant rounded mascot silhouette, exaggerated chunky readable proportions, top-heavy body design, short simplified limbs, oversized paws and feet, tiny compressed mouth and nose, one overscaled signature encounter motif, ${posePrompt}, ${expressionPrompt}, expressive cartoony facial acting, bold color blocking, clean simplified material rendering, clean stylized lighting, ${shadingPrompt}, polished mobile-game render quality, single creature, three-quarter view, simple premium habitat hint only, no text, no frame, no extra creatures, no human, no weapon, no UI overlay, no extreme chibi proportions, no photorealism, no realistic animal anatomy, no hyper-detailed texture realism, no moody cinematic realism, no cheap toy-commercial plastic look, no aggressive monster face, avoid full battle-game hero energy.`;
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
