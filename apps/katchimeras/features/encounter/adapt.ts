import type { RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import { wispsForClearing } from '@/features/onboarding/corruption-wisps';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { JourneyMissionDefinition } from '@/types/companion-journey-chapter';
import { ENCOUNTER_DEFAULT_GRADES, type EncounterCache, type EncounterDefinition, type EncounterDifficulty } from '@/types/encounter';
import type { MergeOrderRequirement } from '@/types/merge-world';
import { ISLAND_WISP_LINES } from '@/features/onboarding/corruption-wisps';

/**
 * Every board from before the pivot, read as an encounter. Nothing here
 * changes how such a board plays: no Mist of its own, no spawner, no budget
 * (`resolve: null`), the wisps and mechanic it was authored with. What the
 * pivot adds is authored on new boards, or given to an old one by hand.
 */
export function encounterFromMission(mission: JourneyMissionDefinition | HatchableMissionDefinition, difficulty: EncounterDifficulty = 'calm'): EncounterDefinition {
  return {
    id: mission.id,
    storageKey: mission.storageKey,
    rows: 4,
    difficulty,
    seed: mission.seed,
    mist: [],
    spawners: [],
    ...(mission.mechanic ? { mechanic: mission.mechanic } : {}),
    required: mission.required,
    wisps: mission.wisps,
    objective: { kind: 'wisps' },
    resolve: null,
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: { glow: 0, xp: 0 },
    guides: mission.guides,
    lines: mission.lines,
    ...(mission.barTitle ? { barTitle: mission.barTitle } : {}),
    ...('camera' in mission && mission.camera ? { camera: mission.camera } : {}),
  };
}

/** The storage key a chapter's board has always used; the encounter keeps it so a saved board resumes. */
export function restorationEncounterId(campaignId: string, level: number): string {
  return `${campaignId}:restoration:${level}`;
}

/**
 * A chapter's restoration board as an encounter. Its Main Board delivery
 * becomes the board's cache: the chosen request's pieces when there is one,
 * else twins of the board's highest pieces, landing on the delivery cells.
 * A rush chapter keeps its clock and has no cache.
 */
export function encounterFromRestoration(definition: RestorationBoardDefinition, campaignId: string, level: number, storageKey: string, request?: readonly MergeOrderRequirement[] | null, difficulty: EncounterDifficulty = 'calm'): EncounterDefinition {
  const cache: EncounterCache | undefined = definition.rush
    ? undefined
    : definition.request
      ? { contents: { kind: 'twins', max: definition.request.max ?? 2 }, landOn: definition.deliveryCells }
      : request?.length
        ? { contents: { kind: 'items', items: request.map((entry) => ({ definitionId: entry.definitionId, quantity: entry.quantity })) }, landOn: definition.deliveryCells }
        : undefined;
  return {
    id: restorationEncounterId(campaignId, level),
    storageKey,
    rows: definition.rows,
    difficulty,
    seed: {
      items: definition.items,
      echoes: definition.echoes.map((echo) => ({ cell: echo.cell, id: echo.id, definitionId: echo.definitionId })),
      veiled: [],
    },
    mist: [],
    spawners: [],
    ...(cache ? { cache } : {}),
    mechanic: definition.mechanic ?? { kind: 'glow-strikes', flight: 'item' },
    required: definition.merges,
    wisps: wispsForClearing(definition.merges),
    objective: { kind: 'wisps' },
    resolve: null,
    grades: ENCOUNTER_DEFAULT_GRADES,
    rewards: { glow: 0, xp: 0 },
    lines: ISLAND_WISP_LINES,
  };
}

/** The encounter as its mechanic sees it: the host every board's rules are resolved through. */
export function encounterMechanicHost(encounter: EncounterDefinition): { required: number; wisps: EncounterDefinition['wisps']; mechanic?: EncounterDefinition['mechanic'] } {
  return { required: encounter.required, wisps: encounter.wisps, ...(encounter.mechanic ? { mechanic: encounter.mechanic } : {}) };
}
