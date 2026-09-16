import type { MergeWorldState } from '@/types/merge-world';
import type { RelationshipProgressState } from '@/types/relationship-progression';
import type { CompanionBondState } from '@/utils/companion-bond';
import type { CompanionContentState } from '@/utils/companion-content';
import type { CompanionJourneyChapterDefinition, JourneyBondReward, JourneyEpisodeDefinition, JourneyUnlockCondition } from '@/types/companion-journey-chapter';
import type { CompanionJourneyCycle } from '@/types/companion-journey-cycle';
import { COMPANION_BOND_LEVELS, companionBondProgress } from '@/utils/companion-bond';
import { companionIdForFamily, familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { conversationTraitTally } from '@/utils/companion-conversation';
import { theoryOfYou } from '@/utils/companion-theory';
import { hatchableByCompanion, hatchableByTile } from '@/constants/hatchable-companions/registry';
import { hatchableTileState } from '@/utils/merge-world/glow-discovery-policy';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { islandFriendHome } from '@/constants/island-campaigns/wake-order';
import { kingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import { currentJourneyCycle, journeyCycleReady } from '@/game/katchimeras/companion-journey-cycle';
import { journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { storyTileById, storyTileRevealed } from '@/constants/story-tiles/registry';
import type { KatchimeraFamilyId } from '@/types/katchimera';

/**
 * When an episode opens. Everything an unlock can ask about is a durable
 * fact the game already keeps: the world's tiles, islands and Eggs, the
 * Bond ledger, the conversation sessions, the relationship state and the
 * clock. One snapshot of those facts answers every condition of every
 * chapter, so the stage, the service and the tests agree.
 */
export type JourneyTriggerFacts = {
  familyId: string;
  now: number;
  world: MergeWorldState | null;
  relationships: RelationshipProgressState;
  bond: CompanionBondState;
  content: CompanionContentState;
  /** Whether the friend's first meeting has completed (the day-one flow, or the FTUE for Mossprout). */
  dayOneComplete: boolean;
};

export type JourneyEpisodeStatus = 'complete' | 'available' | 'reflecting' | 'locked';

export type JourneyEpisodeState = {
  episode: JourneyEpisodeDefinition;
  status: JourneyEpisodeStatus;
  blockedBy: readonly JourneyUnlockCondition[];
  /** What the friend says about a locked episode, from its first blocker. */
  hint: string | null;
  completedAt: number | null;
  /** When only time still blocks the episode: the moment it opens, and the moment the wait began. */
  opensAt: number | null;
  opensFrom: number | null;
};

export type JourneyChapterState = {
  chapter: CompanionJourneyChapterDefinition;
  episodes: readonly JourneyEpisodeState[];
  /** The first episode not yet complete, whatever its status. */
  next: JourneyEpisodeState | null;
  cycle: CompanionJourneyCycle | null;
  /** The friend is still reflecting after the last episode. */
  reflecting: boolean;
  /** Reflecting is over and the return has not been received. */
  returnReady: boolean;
  complete: boolean;
};

const DEFAULT_HINTS: Record<JourneyUnlockCondition['kind'], string> = {
  day_one_complete: 'Let’s finish our first meeting first.',
  episode_complete: 'There’s something to finish before that.',
  mist_cleared: 'Once that mist is cleared, I’ll have something to tell you.',
  friend_hatched: 'When that friend is home, I’ll have something to tell you.',
  friend_home: 'When that friend is home, I’ll have something to tell you.',
  island_revealed: 'Once that place is found again, I’ll have something to tell you.',
  places_restored: 'Bring a few more places back first. Then I’ll have something to tell you.',
  friends_home: 'Bring a few more friends home first. Then I’ll have something to tell you.',
  bond_level: 'I’ll tell you this one when we know each other a bit better.',
  interactions: 'Let’s share a few more small moments first.',
  evidence: 'Answer me a few more things first. I’m still working you out.',
  since_previous: 'I’m still thinking about the last one. Come back a little later.',
  story_tile_revealed: 'There’s somewhere I want to show you first.',
  orders_served: 'Serve what I asked for on the Garden first. Then I’ll have more to say.',
};

function completionOf(facts: JourneyTriggerFacts, episodeId: string) {
  return facts.relationships.journeyEpisodes?.[journeyEpisodeRecordId(facts.familyId, episodeId)] ?? null;
}

function familyInteractionsSince(facts: JourneyTriggerFacts, since: number): number {
  return facts.bond.events.filter((event) => familyIdFromCompanionId(event.creatureId) === facts.familyId && event.occurredAt > since).length;
}

function previousCompletedAt(chapter: CompanionJourneyChapterDefinition, index: number, facts: JourneyTriggerFacts, from: 'chapter_start' | 'previous_episode'): number {
  const earlier = chapter.episodes.slice(0, index).map((episode) => completionOf(facts, episode.id)?.completedAt ?? null).filter((at): at is number => at != null);
  if (!earlier.length) return 0;
  return from === 'chapter_start' ? Math.min(...earlier) : Math.max(...earlier);
}

/** Whether one condition holds for one episode of a chapter. */
export function journeyConditionHolds(condition: JourneyUnlockCondition, chapter: CompanionJourneyChapterDefinition, index: number, facts: JourneyTriggerFacts): boolean {
  const world = facts.world;
  switch (condition.kind) {
    case 'day_one_complete': return facts.dayOneComplete;
    case 'episode_complete': return completionOf(facts, condition.episodeId) != null;
    case 'mist_cleared': {
      if (!world) return false;
      const definition = hatchableByTile(condition.tileId);
      if (definition) { const state = hatchableTileState(world, definition); return state === 'egg' || state === 'open'; }
      return Boolean(world.worldUnlocks?.[condition.tileId] ?? world.worldUnlocks?.[`mist:${condition.tileId}`]);
    }
    case 'friend_hatched': {
      if (!world) return false;
      const definition = hatchableByCompanion(condition.companion);
      return Boolean((definition && hatchableEggProgress(world, definition)?.hatchedAt) || world.companionDiscovery.records.some((record) => record.characterId === condition.companion));
    }
    case 'friend_home': return world ? islandFriendHome(world, condition.residentSkinId) : false;
    case 'island_revealed': return world ? Boolean(world.haven.mossproutNatureIslandReveals?.[condition.islandId]) || (world.haven.mossproutNatureIslands[condition.islandId] ?? 0) > 0 : false;
    case 'places_restored': return world ? kingdomProgress(world).places.restored >= condition.count : false;
    case 'friends_home': return world ? kingdomProgress(world).friends.home >= condition.count : false;
    case 'bond_level': return companionBondProgress(facts.bond, companionIdForFamily(facts.familyId as KatchimeraFamilyId)).level >= condition.level;
    case 'interactions': return familyInteractionsSince(facts, previousCompletedAt(chapter, index, facts, condition.since ?? 'previous_episode')) >= condition.count;
    case 'evidence': return theoryOfYou(conversationTraitTally(facts.content.conversationSessions, companionConversationDefinitionById)).evidence >= condition.count;
    case 'since_previous': {
      const at = previousCompletedAt(chapter, index, facts, 'previous_episode');
      return at === 0 || facts.now - at >= condition.ms;
    }
    case 'story_tile_revealed': { const tile = storyTileById(condition.tileId); return Boolean(world && tile && storyTileRevealed(world, tile)); }
    case 'orders_served': {
      if (!world) return false;
      const served = new Set(world.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', '')));
      return condition.orderIds.every((orderId) => served.has(orderId));
    }
    default: return false;
  }
}

function bondPointsToLevel(facts: JourneyTriggerFacts, level: number): number {
  const threshold = COMPANION_BOND_LEVELS.find((item) => item.level === level)?.threshold ?? 0;
  return Math.max(0, threshold - companionBondProgress(facts.bond, companionIdForFamily(facts.familyId as KatchimeraFamilyId)).totalPoints);
}

/** The next thing the Bond ladder opens above the current level, or null at the top. */
export function nextBondReward(chapter: CompanionJourneyChapterDefinition | null, level: number): JourneyBondReward | null {
  return chapter?.bondRewards?.find((reward) => reward.level > level) ?? null;
}

/** The whole chapter's state: every episode's status, the next one, and the friend's rest. */
export function journeyChapterState(chapter: CompanionJourneyChapterDefinition, facts: JourneyTriggerFacts): JourneyChapterState {
  const cycle = currentJourneyCycle(facts.relationships, chapter.familyId);
  const reflecting = Boolean(cycle && cycle.returnedAt == null && !journeyCycleReady(facts.relationships, cycle, facts.now));
  const returnReady = Boolean(cycle && cycle.returnedAt == null && journeyCycleReady(facts.relationships, cycle, facts.now));
  const episodes = chapter.episodes.map((episode, index): JourneyEpisodeState => {
    const completion = completionOf(facts, episode.id);
    if (completion) return { episode, status: 'complete', blockedBy: [], hint: null, completedAt: completion.completedAt, opensAt: null, opensFrom: null };
    const blockedBy = episode.unlock.filter((condition) => !journeyConditionHolds(condition, chapter, index, facts));
    if (blockedBy.length) {
      const first = blockedBy[0]!;
      let hint = chapter.lines.hints?.[first.kind] ?? DEFAULT_HINTS[first.kind];
      if (first.kind === 'bond_level') {
        // How far: the friend says what the next level opens and how much Bond is left to it.
        const remaining = bondPointsToLevel(facts, first.level);
        if (remaining > 0) hint = `${hint} ${remaining} Bond to go.`;
      }
      // Only time left: the card can count it down.
      const timeOnly = blockedBy.every((condition) => condition.kind === 'since_previous');
      const opensFrom = timeOnly ? previousCompletedAt(chapter, index, facts, 'previous_episode') : null;
      const opensAt = timeOnly && opensFrom ? Math.max(...blockedBy.map((condition) => opensFrom + (condition.kind === 'since_previous' ? condition.ms : 0))) : null;
      return { episode, status: 'locked', blockedBy, hint, completedAt: null, opensAt, opensFrom };
    }
    return { episode, status: reflecting || returnReady ? 'reflecting' : 'available', blockedBy: [], hint: null, completedAt: null, opensAt: null, opensFrom: null };
  });
  // The first episode that has opened, in authored order; otherwise the first still waiting, for its hint.
  const next = episodes.find((item) => item.status === 'available' || item.status === 'reflecting') ?? episodes.find((item) => item.status !== 'complete') ?? null;
  return { chapter, episodes, next, cycle, reflecting, returnReady, complete: next == null };
}
