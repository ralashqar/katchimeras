import { encounterFromRestoration } from '@/features/encounter/adapt';
import { withSolvedBudget } from '@/features/encounter/budget';
import { EXTRA_RUNGS } from './extra-rungs';
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

/** The rungs a chapter gives: its own, the board it had, or one from the template. */
export function chapterMissions(campaign: IslandCampaignDefinition, chapter: IslandCampaignChapter): RegionMissionDefinition[] {
  return [...chapterOwnMissions(campaign, chapter), ...(EXTRA_RUNGS[campaign.campaignId]?.[chapter.level] ?? [])];
}

function chapterOwnMissions(campaign: IslandCampaignDefinition, chapter: IslandCampaignChapter): RegionMissionDefinition[] {
  if (chapter.missions?.length) return chapter.missions.map((mission) => ({ ...mission, encounter: withSolvedBudget(mission.encounter, { rush: mission.rush }) }));
  if (chapter.restoration) {
    const rush = Boolean(chapter.restoration.rush);
    const adapted = encounterFromRestoration(chapter.restoration, campaign.campaignId, chapter.level, restorationStorageKey(campaign.campaignId, chapter.level), chapter.fallbackOrder.requirements, CHAPTER_DIFFICULTY[chapter.level - 1]);
    const encounter = withSolvedBudget(adapted, { rush });
    return [{ id: encounter.id, title: chapter.title, objective: rush ? `Strike down ${chapter.restoration.rush!.goal} wisps before the clock runs out.` : 'Clear the Mist over the island.', difficulty: encounter.difficulty, encounter, rewards: { glow: 0, xp: 0 }, ...(rush ? { rush: true } : {}) }];
  }
  const encounter = withSolvedBudget(templateEncounter(campaign, chapter));
  return [{ id: encounter.id, title: chapter.title, objective: 'Drive the Dark Wisps off the island.', difficulty: encounter.difficulty, encounter, rewards: { glow: 0, xp: 0 } }];
}

const ladders = new WeakMap<IslandCampaignDefinition, RegionRung[]>();

export function regionLadder(campaign: IslandCampaignDefinition): RegionRung[] {
  const known = ladders.get(campaign);
  if (known) return known;
  const rungs: RegionRung[] = [];
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
