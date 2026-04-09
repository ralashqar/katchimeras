import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data', 'katchimeras');

const families = JSON.parse(fs.readFileSync(path.join(dataDir, 'families.json'), 'utf8'));
const habitats = JSON.parse(fs.readFileSync(path.join(dataDir, 'habitats.json'), 'utf8'));
const stages = JSON.parse(fs.readFileSync(path.join(dataDir, 'stages.json'), 'utf8'));

const rarityRank = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
};

function pickHigherRarity(a, b) {
  return rarityRank[a] >= rarityRank[b] ? a : b;
}

function unique(items) {
  return [...new Set(items)];
}

const catalog = [];

for (const family of families) {
  for (const habitat of habitats) {
    for (const stage of stages) {
      const entry = {
        id: `${family.id}_${habitat.id}_${stage.id}`,
        familyId: family.id,
        familyName: family.name,
        habitatAspectId: habitat.id,
        habitatAspectTitle: habitat.title,
        stageId: stage.id,
        stageTitle: stage.title,
        archetype: family.archetype,
        silhouette: family.silhouette,
        temperament: family.temperament,
        motionSignature: family.motionSignature,
        baseRarity: pickHigherRarity(family.baseRarity, stage.defaultRarity),
        habitatBiasMatch: family.habitatBias.includes(habitat.id),
        affinityProfile: {
          activityLevel: unique(family.vectorAffinity.activityLevel),
          explorationStyle: unique([
            ...family.vectorAffinity.explorationStyle,
            ...(habitat.vectorBias.explorationStyle ?? []),
          ]),
          routineDepth: unique([
            ...family.vectorAffinity.routineDepth,
            ...(habitat.vectorBias.routineDepth ?? []),
          ]),
          placeAffinity: unique([
            ...family.vectorAffinity.placeAffinity,
            ...(habitat.vectorBias.placeAffinity ?? []),
          ]),
          timeAffinity: unique([
            ...family.vectorAffinity.timeAffinity,
            ...(habitat.vectorBias.timeAffinity ?? []),
          ]),
          recoveryBalance: unique(habitat.vectorBias.recoveryBalance ?? []),
          tempo: unique(habitat.vectorBias.tempo ?? []),
        },
        visualProfile: {
          familyTraits: family.visualTraits,
          habitatMotifs: habitat.motifs,
          backplateTags: habitat.backplateTags,
          stageMarkers: stage.visualMarkers,
        },
        unlockHint: `${stage.title} form of ${family.name} aligned to ${habitat.title}.`,
      };

      catalog.push(entry);
    }
  }
}

const outPath = path.join(dataDir, 'catalog.json');
fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`Generated ${catalog.length} Katchimera catalog entries at ${outPath}`);
