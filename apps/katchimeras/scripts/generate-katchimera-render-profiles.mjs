import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data', 'katchimeras');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

const catalog = readJson('catalog.json');
const familyProfiles = readJson('family-profiles.json');
const stageProfiles = readJson('stage-profiles.json');
const habitatModifiers = readJson('habitat-modifiers.json');
const styleGuide = readJson('image-style-guide.json');

const familyMap = Object.fromEntries(familyProfiles.map((entry) => [entry.familyId, entry]));
const stageMap = Object.fromEntries(stageProfiles.map((entry) => [entry.stageId, entry]));
const habitatMap = Object.fromEntries(habitatModifiers.map((entry) => [entry.habitatId, entry]));

function compact(items) {
  return items.filter(Boolean);
}

const renderProfiles = catalog.map((entry) => {
  const family = familyMap[entry.familyId];
  const stage = stageMap[entry.stageId];
  const habitat = habitatMap[entry.habitatAspectId];

  const caption = `${stage.captionPrefix}: ${family.caption}, ${habitat.captionSuffix}.`;
  const motivationalQuote = `${family.motivationalQuote} ${stage.quoteModifier}`;
  const userFacingDescription = `${family.userFacingDescription} ${habitat.descriptionModifier} ${stage.descriptionModifier}`;
  const visualDescription = `${family.visualDescription} ${habitat.visualModifier} ${stage.visualModifier}`;

  const promptParts = compact([
    `${family.name}, ${family.subtitle.toLowerCase()}`,
    family.imagePrompt,
    habitat.promptModifier,
    stage.promptModifier,
    family.signatureDetails.join(', '),
    styleGuide.positiveStyleTokens.join(', '),
    `palette hints: ${[...family.paletteHints, ...habitat.paletteShift].join(', ')}`,
    styleGuide.negativeStyleTokens.join(', '),
  ]);

  return {
    id: entry.id,
    familyId: entry.familyId,
    habitatAspectId: entry.habitatAspectId,
    stageId: entry.stageId,
    displayName: `${family.name} ${entry.stageTitle}`,
    subtitle: family.subtitle,
    caption,
    userFacingDescription,
    motivationalQuote,
    deckRole: family.deckRole,
    lifestyleMatch: family.lifestyleMatch,
    associatedLifestyleProperties: family.associatedLifestyleProperties,
    visualDescription,
    imagePrompt: promptParts.join('. '),
    paletteHints: [...new Set([...family.paletteHints, ...habitat.paletteShift])],
    signatureDetails: family.signatureDetails,
    styleGuideId: styleGuide.styleId
  };
});

const outPath = path.join(dataDir, 'render-profiles.json');
fs.writeFileSync(outPath, `${JSON.stringify(renderProfiles, null, 2)}\n`);

console.log(`Generated ${renderProfiles.length} render profiles at ${outPath}`);
