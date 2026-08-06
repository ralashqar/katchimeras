import { canonicalFamilyId, katchimeraFamilies, katchimeraSkinById } from '@/constants/katchimera-skins';
import { katchimeraRoles } from '@/constants/katchimera-roles';
import type { KatchimeraBondLevel } from '@/constants/katchimera-roles';
import type { HomeVisualKey } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { KingdomCreature } from '@/types/kingdom';
import { companionBondProgress, type CompanionBondState } from '@/utils/companion-bond';
import { identityForCreature } from '@/utils/katchimera-identity';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { completedQuestCount } from '@/utils/quests/experiences/difficulty';
import { questDefinition, questPresentation } from '@/utils/quests/definitions';

export type GameHubCategory = 'movement' | 'trivia' | 'words' | 'calm' | 'timing' | 'memory' | 'puzzle' | 'rhythm';

export type GameCatalogEntry = {
  questId: string;
  familyId: KatchimeraFamilyId;
  companionName: string;
  title: string;
  description: string;
  category: GameHubCategory;
  categoryLabel: string;
  estimatedMinutes: number;
  artworkKey: string;
  visualKey: HomeVisualKey | null;
  minimumBondLevel: KatchimeraBondLevel;
};

export type OwnedGameCompanion = {
  familyId: KatchimeraFamilyId;
  creatureId: string;
  name: string;
  visualKey: HomeVisualKey;
  bondLevel: number;
};

export type GameHubItem = GameCatalogEntry & {
  creatureId: string | null;
  displayCompanionName: string;
  displayVisualKey: HomeVisualKey | null;
  locked: boolean;
  lockReason: string | null;
  playedToday: boolean;
  lastPlayedAt: number | null;
};

function categoryFor(kind: NonNullable<ReturnType<typeof questDefinition>>['execution']): GameHubCategory {
  if (!kind || kind.kind === 'evidence') return 'puzzle';
  if (kind.kind === 'live_steps') return 'movement';
  if (kind.kind === 'trivia') return 'trivia';
  if (kind.kind === 'word_game' || kind.kind === 'word_connect') return 'words';
  if (kind.kind === 'paced_breathing') return 'calm';
  if (kind.kind === 'timing_zone') return 'timing';
  if (kind.kind === 'pattern_memory' || kind.kind === 'matching') return 'memory';
  if (kind.kind === 'rhythm') return 'rhythm';
  return 'puzzle';
}

const CATEGORY_LABELS: Record<GameHubCategory, string> = {
  movement: 'Movement', trivia: 'Trivia', words: 'Words', calm: 'Calm', timing: 'Timing', memory: 'Memory', puzzle: 'Puzzle', rhythm: 'Rhythm',
};

export const gameCatalog: readonly GameCatalogEntry[] = katchimeraRoles.flatMap((role) => {
  const family = katchimeraFamilies.find((candidate) => candidate.id === role.familyId);
  return role.miniGameQuestIds.flatMap((questId) => {
    const definition = questDefinition(questId);
    if (!definition?.execution || definition.execution.kind === 'evidence') return [];
    const category = categoryFor(definition.execution);
    const presentation = questPresentation(definition);
    return [{
      questId,
      familyId: role.familyId,
      companionName: role.displayName,
      title: definition.title,
      description: definition.hint,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      estimatedMinutes: presentation.estimatedMinutes,
      artworkKey: presentation.artworkKey ?? questId.replace(/^quest-/, ''),
      visualKey: family?.anchorVisualKey ?? null,
      minimumBondLevel: definition.minimumBondLevel ?? 1,
    } satisfies GameCatalogEntry];
  });
});

export function gameCatalogEntry(questId: string): GameCatalogEntry | null {
  return gameCatalog.find((entry) => entry.questId === questId) ?? null;
}

export function buildGameHubItems(input: {
  companions: readonly OwnedGameCompanion[];
  questState: CompanionQuestState;
  dayId: string;
}): GameHubItem[] {
  const companionByFamily = new Map(input.companions.map((companion) => [
    canonicalFamilyId(companion.familyId) ?? companion.familyId,
    companion,
  ]));
  return gameCatalog.map((entry) => {
    const companion = companionByFamily.get(entry.familyId) ?? null;
    const prerequisiteMissing = entry.questId === 'quest-step-time-trial' && companion
      ? completedQuestCount(input.questState.quests, 'quest-step-sprint', companion.creatureId, input.questState.attempts) < 1
      : false;
    const lockReason = !companion
      ? `Hatch ${entry.companionName} to unlock this game.`
      : companion.bondLevel < entry.minimumBondLevel
        ? `Reach bond level ${entry.minimumBondLevel} with ${companion.name}.`
        : prerequisiteMissing
          ? 'Complete the one-minute step challenge once to unlock this time trial.'
          : null;
    const attempts = companion
      ? input.questState.attempts.filter((attempt) => attempt.questId === entry.questId && attempt.creatureId === companion.creatureId)
      : [];
    return {
      ...entry,
      creatureId: companion?.creatureId ?? null,
      displayCompanionName: companion?.name ?? entry.companionName,
      displayVisualKey: companion?.visualKey ?? entry.visualKey,
      locked: Boolean(lockReason),
      lockReason,
      playedToday: attempts.some((attempt) => attempt.dayId === input.dayId && attempt.status === 'succeeded'),
      lastPlayedAt: attempts.reduce<number | null>((latest, attempt) => Math.max(latest ?? 0, attempt.endedAt ?? attempt.startedAt ?? 0) || null, null),
    };
  });
}

export function buildOwnedGameCompanions(
  creatures: readonly KingdomCreature[],
  bond: CompanionBondState,
): OwnedGameCompanion[] {
  const seen = new Set<string>();
  const owned: OwnedGameCompanion[] = [];
  for (const creature of creatures) {
    const identity = identityForCreature({ ...creature, encounterProfileId: null });
    if (!identity || seen.has(identity.familyId)) continue;
    seen.add(identity.familyId);
    owned.push({
      familyId: identity.familyId,
      creatureId: identity.companionId,
      name: katchimeraSkinById.get(identity.skinId)?.displayName ?? creature.name,
      visualKey: creature.visualKey,
      bondLevel: companionBondProgress(bond, identity.companionId).level,
    });
  }
  return owned;
}

export function sortPlayableGames(items: readonly GameHubItem[]): GameHubItem[] {
  return [...items].sort((left, right) => (right.lastPlayedAt ?? 0) - (left.lastPlayedAt ?? 0));
}

export function selectTodayCareGame(
  items: readonly GameHubItem[],
  dayId: string,
  excludedQuestIds: ReadonlySet<string> = new Set(),
): GameHubItem | null {
  const playable = items.filter((item) => !item.locked && item.creatureId && !excludedQuestIds.has(item.questId));
  if (!playable.length) return null;
  const unplayedToday = playable.filter((item) => !item.playedToday);
  // Today Care is a discovery queue, not an endless replay prompt. Once every
  // available game has been completed today, leave the slot to another action.
  if (!unplayedToday.length) return null;
  const pool = unplayedToday;
  const neverPlayed = pool.filter((item) => item.lastPlayedAt == null);
  const mostRecentAt = Math.max(...pool.map((item) => item.lastPlayedAt ?? 0));
  const notMostRecent = mostRecentAt > 0 && pool.length > 1
    ? pool.filter((item) => (item.lastPlayedAt ?? 0) < mostRecentAt)
    : pool;
  const rotationPool = neverPlayed.length ? neverPlayed : notMostRecent.length ? notMostRecent : pool;
  return [...rotationPool].sort((left, right) => {
    return stableHash(`${dayId}:${left.questId}`) - stableHash(`${dayId}:${right.questId}`);
  })[0] ?? null;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
