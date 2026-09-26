import { encounterFromRestoration } from '@/features/encounter/adapt';
import { withSolvedBudget } from '@/features/encounter/budget';
import { EXTRA_RUNGS } from './extra-rungs';
import { islandLevel, lanesPatternSpecs, MIST_LEVEL_SPEC, PETALIMP_LEVEL_SPECS, type IslandLevelSpec } from './island-levels';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterDefinition, type EncounterDifficulty } from '@/types/encounter';
import type { MossproutNatureIslandLevel } from '@/types/merge-world';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';
import type { IslandCampaignChapter, IslandCampaignDefinition, RegionMissionDefinition } from './types';

/**
 * A region's ladder: every rung of every chapter, in order. A chapter
 * authored with `missions` gives them as they are; a chapter with a
 * restoration board (the friends' islands from before the pivot) gives that
 * board read as an encounter, its chosen request now the cache; a chapter
 * with neither gets one made from the template, so no island stands with an
 * empty ladder. The last rung of a chapter raises the island; the last of
 * the final chapter is the boss.
 */
export type RegionRung = {
  index: number;
  chapterLevel: MossproutNatureIslandLevel;
  mission: RegionMissionDefinition;
  /** Clearing it raises the island to the chapter's level. */
  lastOfChapter: boolean;
  boss: boolean;
};

/** The storage key a chapter's board has always used (`features/island-restoration`), so a saved board resumes. */
const restorationStorageKey = (campaignId: string, level: number) => `katchimeras.mist-mission.${campaignId}.${level}.v1`;

const CHAPTER_DIFFICULTY: readonly EncounterDifficulty[] = ['calm', 'thick', 'thick', 'dark'];
const TEMPLATE_CHAIN = 'nature:garden';

/** A rung made for a chapter with no board of its own: the campaign's garden, a Seed Pod, Mist to wear down, Dark Wisps that grow with the level. */
export function templateEncounter(campaign: IslandCampaignDefinition, chapter: IslandCampaignChapter): EncounterDefinition {
  const level = chapter.level;
  const tierOne = `${TEMPLATE_CHAIN}:1`;
  const tierTwo = `${TEMPLATE_CHAIN}:2`;
  const wisps = [
    { id: 'keeper', hp: 2 + level, placement: { kind: 'tile' as const, fx: 0.52, fy: 0.24, size: 0.22 }, behaviour: level >= 2 ? { kind: 'shrouder' as const, every: 3 } : { kind: 'plain' as const } },
    { id: 'ember', hp: 2, placement: { kind: 'tile' as const, fx: 0.26, fy: 0.38, size: 0.18 }, behaviour: level >= 4 ? { kind: 'mender' as const, every: 3 } : { kind: 'plain' as const } },
  ];
  return {
    id: `${campaign.campaignId}:rung:${level}`,
    storageKey: `katchimeras.encounter.${campaign.campaignId}.${level}.v1`,
    rows: 4,
    difficulty: CHAPTER_DIFFICULTY[level - 1] ?? 'thick',
    seed: { items: [{ cell: 36, definitionId: tierOne }, { cell: 37, definitionId: tierOne }, { cell: 38, definitionId: tierOne }, { cell: 39, definitionId: tierOne }, { cell: 31, definitionId: tierTwo }], echoes: [], veiled: [] },
    mist: [
      { cell: 30, type: 'light' },
      ...(level >= 2 ? [{ cell: 32, type: 'dense' as const }] : []),
      ...(level >= 3 ? [{ cell: 16, type: 'root' as const, holds: { kind: 'item' as const, definitionId: tierTwo } }] : []),
    ],
    spawners: [{ id: 'pod', generatorId: 'wild-garden', cell: 40, charges: 4, drops: [tierOne], recharge: { kind: 'merges', every: 3, amount: 1 } }],
    // A Sprout deals one, a Plant two: the wisps want a few real merges, not two lucky ones.
    mechanic: { kind: 'dark-wisps', wisps, damageByTier: [1, 1, 2, 3] },
    required: wisps.reduce((sum, wisp) => sum + wisp.hp, 0),
    wisps: [],
    objective: { kind: 'wisps' },
    // Read off the board by the search (`withSolvedBudget`): the shortest play and a margin.
    resolve: null,
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: { glow: 0, xp: 0 },
    lines: campaign.copy.wispLines ?? ISLAND_WISP_LINES,
  };
}

/**
 * A chapter's levels, in order: the campaign's own (`missions`, a pack's), the bundled authored levels
 * (`island-levels.ts`), a board with a clock or a mechanic of its own read as it is, else two from the pattern.
 * A plain restoration board from before the pivot is no longer played: its pieces arrived by delivery, which is gone.
 */
export function chapterMissions(campaign: IslandCampaignDefinition, chapter: IslandCampaignChapter): RegionMissionDefinition[] {
  return [...chapterBoards(campaign, chapter), ...(EXTRA_RUNGS[campaign.campaignId]?.[chapter.level] ?? [])]
    .map((mission) => ({ ...mission, encounter: withSolvedBudget(mission.encounter, { rush: mission.rush }) }));
}

/** The levels before their Resolve is read (the budget generator solves these). */
export function chapterBoards(campaign: IslandCampaignDefinition, chapter: IslandCampaignChapter): RegionMissionDefinition[] {
  if (chapter.missions?.length) return [...chapter.missions];
  const lines = campaign.copy.wispLines ?? ISLAND_WISP_LINES;
  const authored = BUNDLED_LEVEL_SPECS[campaign.campaignId]?.[chapter.level as 1 | 2 | 3 | 4];
  if (authored?.length) return authored.map((spec, index) => islandLevel(campaign.campaignId, `c${chapter.level}-${index + 1}`, spec, lines));
  if (chapter.restoration && (chapter.restoration.rush || chapter.restoration.mechanic)) {
    const rush = Boolean(chapter.restoration.rush);
    const encounter = encounterFromRestoration(chapter.restoration, campaign.campaignId, chapter.level, restorationStorageKey(campaign.campaignId, chapter.level), chapter.fallbackOrder.requirements, CHAPTER_DIFFICULTY[chapter.level - 1]);
    return [{ id: encounter.id, title: chapter.title, objective: rush ? `Strike down ${chapter.restoration.rush!.goal} wisps before the clock runs out.` : 'Clear the Mist over the island.', difficulty: encounter.difficulty, encounter, rewards: { glow: 0, xp: 0 }, ...(rush ? { rush: true } : {}) }];
  }
  // Plants that shoot, everywhere (Sept 2026): an island without its own levels plays the Lanes pattern.
  return lanesPatternSpecs(chapter.level, campaign.residentName).map((spec, index) => islandLevel(campaign.campaignId, `c${chapter.level}-${index + 1}`, spec, lines));
}

/** Bundled islands whose levels are written out by hand. */
const BUNDLED_LEVEL_SPECS: Readonly<Record<string, Partial<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>>>> = {
  'island-campaign:petalimp-bloom': PETALIMP_LEVEL_SPECS,
  // Fernip's own levels were territory battles (the Water chain); his island plays the Lanes pattern now.
};

/** The id of a friend's first level, the one that lifts the Mist off their island. */
export const mistLevelId = (campaignId: string) => `${campaignId}:mist`;
export const isMistLevel = (missionId: string) => missionId.endsWith(':mist');

/**
 * Before a friend's story there is their island under the Mist: level one is
 * clearing it. A calm board from the template (or the campaign's own), and
 * winning it is what reveals the island. It costs nothing and belongs to no
 * chapter (`chapterLevel` 0), so it never raises the island itself.
 */
export function mistLevel(campaign: IslandCampaignDefinition): RegionMissionDefinition {
  const encounter = withSolvedBudget(mistLevelBoard(campaign));
  return { id: encounter.id, title: 'Lift the Mist', objective: MIST_LEVEL_SPEC.objective, difficulty: 'calm', encounter, rewards: { glow: 0, xp: 0 } };
}

/** The mist level's board before its budget is read (the budget generator solves this). */
export function mistLevelBoard(campaign: IslandCampaignDefinition): EncounterDefinition {
  // Level one of every friend: two Mistwisps in lanes and the light Mist, played by Light.
  return islandLevel(campaign.campaignId, 'mist', MIST_LEVEL_SPEC, campaign.copy.wispLines ?? ISLAND_WISP_LINES).encounter;
}

const ladders = new WeakMap<IslandCampaignDefinition, RegionRung[]>();

export function regionLadder(campaign: IslandCampaignDefinition): RegionRung[] {
  const known = ladders.get(campaign);
  if (known) return known;
  const rungs: RegionRung[] = [{ index: 0, chapterLevel: 0, mission: mistLevel(campaign), lastOfChapter: true, boss: false }];
  const finalLevel = campaign.chapters[campaign.chapters.length - 1]?.level;
  for (const chapter of campaign.chapters) {
    const missions = chapterMissions(campaign, chapter);
    missions.forEach((mission, index) => {
      const lastOfChapter = index === missions.length - 1;
      rungs.push({ index: rungs.length, chapterLevel: chapter.level, mission, lastOfChapter, boss: lastOfChapter && chapter.level === finalLevel && mission.difficulty === 'boss' });
    });
  }
  ladders.set(campaign, rungs);
  return rungs;
}

export function regionRung(campaign: IslandCampaignDefinition, missionId: string): RegionRung | null {
  return regionLadder(campaign).find((rung) => rung.mission.id === missionId) ?? null;
}
