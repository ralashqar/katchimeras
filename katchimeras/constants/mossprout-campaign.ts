import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MossproutStoryFactKey } from '@/types/relationship-progression';

export const MOSSPROUT_CAMPAIGN_VERSION = 2;

export type MossproutCampaignEpisode = {
  beatId: string;
  chapterId: string;
  episodeNumber: number;
  unlockGardenDay: number;
  title: string;
  completionMode: 'story' | 'merge';
  openingConversationId: string;
  resolutionConversationId: string | null;
  objectiveId: string | null;
  mergeOrderId: string | null;
  requirements: readonly { definitionId: string; quantity: number }[];
  optionalAction: 'goal' | 'reflection' | 'playful' | null;
};

export const MOSSPROUT_CAMPAIGN_EPISODES: readonly MossproutCampaignEpisode[] = [
  episode(1, 1, 'quiet-patch:first-flower', 'mossprout:chapter:quiet-patch', 'A Little Place to Begin', 'merge',
    'mossprout:objective:first-sprout', 'mossprout:chapter-0:first-sprout', [{ definitionId: 'nature:garden:2', quantity: 1 }], 'goal'),
  episode(2, 7, 'quiet-patch:pond-knock', 'mossprout:chapter:quiet-patch', 'The Pond Knocked Twice', 'story', null, null, [], 'playful'),
  episode(3, 8, 'returning-pond:place-for-rain', 'mossprout:chapter:dry-pond', 'A Place for Rain', 'merge',
    'mossprout:objective:place-for-rain', 'merge-story:mossprout:dry-pond:place-for-rain', [{ definitionId: 'nature:waterside:2', quantity: 1 }], null),
  episode(4, 11, 'returning-pond:bank-that-holds', 'mossprout:chapter:dry-pond', 'A Bank That Holds', 'merge',
    'mossprout:objective:bank-that-holds', 'merge-story:mossprout:dry-pond:bank-that-holds', [{ definitionId: 'nature:garden:3', quantity: 1 }], null),
  episode(5, 14, 'returning-pond:rain-garden', 'mossprout:chapter:dry-pond', 'The Little Rain Garden', 'merge',
    'mossprout:objective:little-rain-garden', 'merge-story:mossprout:dry-pond:little-rain-garden', [
      { definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 },
    ], null),
  episode(6, 15, 'memory-nursery:nursery-key', 'mossprout:chapter:memory-nursery', 'The Nursery Key', 'merge',
    'mossprout:objective:nursery-key', 'merge-story:mossprout:memory-nursery:nursery-key', [
      { definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 },
    ], 'reflection'),
  episode(7, 17, 'memory-nursery:keepsake-root', 'mossprout:chapter:memory-nursery', 'A Keepsake Takes Root', 'merge',
    'mossprout:objective:keepsake-root', 'merge-story:mossprout:memory-nursery:keepsake-root', [
      { definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 },
    ], 'goal'),
  episode(8, 19, 'memory-nursery:garden-remembers', 'mossprout:chapter:memory-nursery', 'What the Garden Remembers', 'merge',
    'mossprout:objective:garden-remembers', 'merge-story:mossprout:memory-nursery:garden-remembers', [
      { definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 },
    ], 'playful'),
  episode(9, 21, 'memory-nursery:lantern-bank', 'mossprout:chapter:memory-nursery', 'The Lantern Bank', 'merge',
    'mossprout:objective:lantern-bank', 'merge-story:mossprout:memory-nursery:lantern-bank', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }], 'reflection'),
  episode(10, 22, 'heartwood:mirror-for-rain', 'mossprout:chapter:heartwood', 'A Mirror for Rain', 'merge',
    'mossprout:objective:mirror-for-rain', 'merge-story:mossprout:heartwood:mirror-for-rain', [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }], null),
  episode(11, 24, 'heartwood:rings-of-attention', 'mossprout:chapter:heartwood', 'Rings of Attention', 'merge',
    'mossprout:objective:rings-of-attention', 'merge-story:mossprout:heartwood:rings-of-attention', [
      { definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:4', quantity: 1 },
    ], null),
  episode(12, 26, 'heartwood:place-that-holds', 'mossprout:chapter:heartwood', 'A Place That Holds', 'merge',
    'mossprout:objective:place-that-holds', 'merge-story:mossprout:heartwood:place-that-holds', [
      { definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'nature:keepsake:5', quantity: 1 },
    ], 'playful'),
  episode(13, 28, 'heartwood:heartwood', 'mossprout:chapter:heartwood', 'Heartwood', 'merge',
    'mossprout:objective:heartwood', 'merge-story:mossprout:heartwood:heartwood', [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }], null),
] as const;

function episode(
  episodeNumber: number,
  unlockGardenDay: number,
  beatId: string,
  chapterId: string,
  title: string,
  completionMode: MossproutCampaignEpisode['completionMode'],
  objectiveId: string | null,
  mergeOrderId: string | null,
  requirements: MossproutCampaignEpisode['requirements'],
  optionalAction: MossproutCampaignEpisode['optionalAction'],
): MossproutCampaignEpisode {
  const prefix = `mossprout:campaign-v2:${beatId}`;
  return {
    beatId, chapterId, episodeNumber, unlockGardenDay, title, completionMode, objectiveId, mergeOrderId, requirements, optionalAction,
    openingConversationId: `${prefix}:opening`,
    resolutionConversationId: completionMode === 'merge' ? `${prefix}:resolution` : null,
  };
}

export const mossproutCampaignEpisodeByBeatId = new Map(MOSSPROUT_CAMPAIGN_EPISODES.map((episodeDefinition) => [episodeDefinition.beatId, episodeDefinition]));
export const mossproutCampaignEpisodeByOpeningId = new Map(MOSSPROUT_CAMPAIGN_EPISODES.map((episodeDefinition) => [episodeDefinition.openingConversationId, episodeDefinition]));
export const mossproutCampaignEpisodeByResolutionId = new Map(MOSSPROUT_CAMPAIGN_EPISODES.flatMap((episodeDefinition) => episodeDefinition.resolutionConversationId
  ? [[episodeDefinition.resolutionConversationId, episodeDefinition] as const]
  : []));

export function nextMossproutCampaignEpisode(completedBeatIds: readonly string[]) {
  const completed = new Set(completedBeatIds);
  return MOSSPROUT_CAMPAIGN_EPISODES.find((episodeDefinition) => !completed.has(episodeDefinition.beatId)) ?? null;
}

export function mossproutCampaignEpisodeAvailable(episodeDefinition: MossproutCampaignEpisode | null, activeGardenDays: number) {
  // activeGardenDays counts days already played; select for the day about to begin.
  return Boolean(episodeDefinition && activeGardenDays + 1 >= episodeDefinition.unlockGardenDay);
}

export const MOSSPROUT_STORY_FACT_BY_OPTION_ID: Readonly<Record<string, { key: MossproutStoryFactKey; value: string }>> = {
  'promise-quiet': { key: 'garden_promise', value: 'quiet' },
  'promise-surprise': { key: 'garden_promise', value: 'surprise' },
  'promise-care': { key: 'garden_promise', value: 'care' },
  'rest-welcome': { key: 'garden_promise', value: 'quiet' },
  'rest-weather': { key: 'garden_promise', value: 'quiet' },
  'rest-return': { key: 'garden_promise', value: 'quiet' },
  'rest-gift': { key: 'garden_promise', value: 'quiet' },
  'wonder-welcome': { key: 'garden_promise', value: 'surprise' },
  'wonder-weather': { key: 'garden_promise', value: 'surprise' },
  'wonder-return': { key: 'garden_promise', value: 'surprise' },
  'wonder-gift': { key: 'garden_promise', value: 'surprise' },
  'tend-welcome': { key: 'garden_promise', value: 'care' },
  'tend-weather': { key: 'garden_promise', value: 'care' },
  'tend-return': { key: 'garden_promise', value: 'care' },
  'tend-gift': { key: 'garden_promise', value: 'care' },
  'approach-knock': { key: 'pond_approach', value: 'knock' },
  'approach-mud': { key: 'pond_approach', value: 'mud' },
  'approach-help': { key: 'pond_approach', value: 'help' },
  'priority-shelter': { key: 'pond_priority', value: 'shelter' },
  'priority-colour': { key: 'pond_priority', value: 'colour' },
  'priority-water': { key: 'pond_priority', value: 'water' },
  'welcome-small-lives': { key: 'welcome_style', value: 'small_lives' },
  'welcome-visitors': { key: 'welcome_style', value: 'visitors' },
  'welcome-quiet': { key: 'welcome_style', value: 'quiet' },
  'memory-keep': { key: 'memory_style', value: 'keep' },
  'memory-plant': { key: 'memory_style', value: 'plant' },
  'memory-release': { key: 'memory_style', value: 'release' },
  'lantern-home': { key: 'lantern_for', value: 'home' },
  'lantern-visitors': { key: 'lantern_for', value: 'visitors' },
  'lantern-lost-things': { key: 'lantern_for', value: 'lost_things' },
  'sanctuary-shelter': { key: 'sanctuary_purpose', value: 'shelter' },
  'sanctuary-welcome': { key: 'sanctuary_purpose', value: 'welcome' },
  'sanctuary-remember': { key: 'sanctuary_purpose', value: 'remember' },
};

export const MOSSPROUT_RESIDENT_BY_OPTION_ID: Readonly<Record<string, KatchimeraSkinId>> = {
  'resident-petalimp': 'petalimp',
  'resident-fernip': 'fernip',
  'resident-blossle': 'blossle',
  'resident-amberleaf': 'amberleaf',
  'resident-drizzlet': 'drizzlet',
  'resident-mistle': 'mistle',
  'resident-driftkin': 'driftkin',
  'resident-tempesto': 'tempesto',
};

export function validMossproutCoStar(value: unknown): value is KatchimeraSkinId {
  return typeof value === 'string' && [
    'petalimp', 'fernip', 'blossle', 'amberleaf', 'drizzlet', 'mistle', 'driftkin', 'tempesto',
  ].includes(value);
}
