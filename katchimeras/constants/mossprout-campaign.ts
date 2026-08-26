import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MossproutStoryFactKey } from '@/types/relationship-progression';

export const MOSSPROUT_CAMPAIGN_VERSION = 3;

export type MossproutCampaignOrder = {
  id: string;
  title: string;
  description: string;
  requirements: readonly { definitionId: string; quantity: number }[];
  coins: number;
};

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
  mergeOrders: readonly MossproutCampaignOrder[];
  requirements: readonly { definitionId: string; quantity: number }[];
  guestSkinId: KatchimeraSkinId | 'matched' | null;
  milestoneGateId: string | null;
  optionalAction: 'goal' | 'reflection' | 'playful' | null;
};

export const MOSSPROUT_CAMPAIGN_EPISODES: readonly MossproutCampaignEpisode[] = [
  episode(1, 1, 'quiet-patch:first-flower', 'mossprout:chapter:quiet-patch', 'A Little Place to Begin', 'mossprout:objective:first-sprout', [
    order('mossprout:chapter-0:first-sprout', 'The First Bloom', 'Bring two Sprouts together for our quiet patch.', [['nature:garden:3', 1]], 20),
  ], null, null, 'goal'),
  episode(2, 2, 'quiet-patch:pond-knock', 'mossprout:chapter:quiet-patch', 'The Pond Knocked Twice', 'mossprout:objective:pond-knock', [
    order('merge-story:mossprout:quiet-patch:listening-place', 'A Listening Place', 'Make a little waterside perch so we can listen without trampling the clues.', [['nature:waterside:2', 1]], 20),
    order('merge-story:mossprout:quiet-patch:path-for-water', 'A Path for Water', 'Give the hidden trickle a garden path back to the pond.', [['nature:garden:2', 1], ['nature:waterside:1', 1]], 25),
  ], 'matched', null, 'playful'),
  episode(3, 8, 'returning-pond:place-for-rain', 'mossprout:chapter:dry-pond', 'A Place for Rain', 'mossprout:objective:place-for-rain', [
    order('merge-story:mossprout:dry-pond:rain-catcher', 'A Rain Catcher', 'Make somewhere for the first drops to land.', [['nature:waterside:2', 1]], 20),
    order('merge-story:mossprout:dry-pond:first-puddle', 'The First Puddle', 'Join water and green growth so the rain has a reason to stay.', [['nature:waterside:2', 1], ['nature:garden:2', 1]], 25),
  ], 'drizzlet', null, null),
  episode(4, 11, 'returning-pond:bank-that-holds', 'mossprout:chapter:dry-pond', 'A Bank That Holds', 'mossprout:objective:bank-that-holds', [
    order('merge-story:mossprout:dry-pond:root-hold', 'A Root Hold', 'Grow roots strong enough to catch the loose bank.', [['nature:garden:3', 1]], 25),
    order('merge-story:mossprout:dry-pond:sheltered-edge', 'A Sheltered Edge', 'Build a green waterside edge where small lives can wait out weather.', [['nature:garden:3', 1], ['nature:waterside:2', 1]], 30),
  ], 'fernip', null, null),
  episode(5, 14, 'returning-pond:rain-garden', 'mossprout:chapter:dry-pond', 'The Little Rain Garden', 'mossprout:objective:little-rain-garden', [
    order('merge-story:mossprout:dry-pond:first-flower', 'The First Flower', 'Bring colour back to the pond bank.', [['nature:garden:4', 1]], 30),
    order('merge-story:mossprout:dry-pond:living-pool', 'A Living Pool', 'Finish a pool where flowers, water and tiny visitors belong together.', [['nature:waterside:3', 1], ['nature:garden:3', 1]], 40),
  ], 'petalimp', 'returning-pond', null),
  episode(6, 15, 'memory-nursery:nursery-key', 'mossprout:chapter:memory-nursery', 'The Nursery Key', 'mossprout:objective:nursery-key', [
    order('merge-story:mossprout:memory-nursery:ivy-gate', 'The Ivy Gate', 'Grow a living handle around the gate we nearly forgot.', [['nature:garden:5', 1]], 35),
    order('merge-story:mossprout:memory-nursery:breathing-bed', 'The Breathing Bed', 'Restore the one nursery bed that is still breathing.', [['nature:waterside:4', 1], ['nature:garden:3', 1]], 45),
  ], 'mistle', 'memory-nursery', 'reflection'),
  episode(7, 17, 'memory-nursery:keepsake-root', 'mossprout:chapter:memory-nursery', 'A Keepsake Takes Root', 'mossprout:objective:keepsake-root', [
    order('merge-story:mossprout:memory-nursery:small-keepsake', 'A Small Keepsake', 'Find a shape worth carrying forward.', [['nature:keepsake:2', 1]], 35),
    order('merge-story:mossprout:memory-nursery:keepsake-root', 'A Keepsake Takes Root', 'Plant the memory without asking it to stand still.', [['nature:keepsake:2', 1], ['nature:garden:3', 1]], 45),
  ], 'amberleaf', null, 'goal'),
  episode(8, 19, 'memory-nursery:garden-remembers', 'mossprout:chapter:memory-nursery', 'What the Garden Remembers', 'mossprout:objective:garden-remembers', [
    order('merge-story:mossprout:memory-nursery:name-memory', 'A Name Remembered', 'Wake one of the nursery labels.', [['nature:keepsake:3', 1]], 40),
    order('merge-story:mossprout:memory-nursery:water-memory', 'Water the Memory', 'Give the remembered plant enough water to take its new shape.', [['nature:keepsake:3', 1], ['nature:waterside:4', 1]], 50),
  ], 'blossle', null, 'playful'),
  episode(9, 21, 'memory-nursery:lantern-bank', 'mossprout:chapter:memory-nursery', 'The Lantern Bank', 'mossprout:objective:lantern-bank', [
    order('merge-story:mossprout:memory-nursery:first-light', 'The First Light', 'Build one low light to catch the path.', [['nature:keepsake:4', 1], ['nature:garden:4', 1]], 45),
    order('merge-story:mossprout:memory-nursery:memory-bloom', 'The Memory Bloom', 'Grow a lantern that remembers who it is guiding.', [['hybrid:memory-bloom', 1]], 55),
  ], 'driftkin', 'lantern-bank', 'reflection'),
  episode(10, 22, 'heartwood:mirror-for-rain', 'mossprout:chapter:heartwood', 'A Mirror for Rain', 'mossprout:objective:mirror-for-rain', [
    order('merge-story:mossprout:heartwood:still-reflection', 'A Still Reflection', 'Calm the pond enough to see what it is holding.', [['nature:waterside:4', 1], ['nature:keepsake:3', 1]], 45),
    order('merge-story:mossprout:heartwood:rain-mirror', 'The Rain Mirror', 'Make a mirror for the garden as it is now.', [['hybrid:rain-mirror', 1]], 60),
  ], 'tempesto', null, null),
  episode(11, 24, 'heartwood:rings-of-attention', 'mossprout:chapter:heartwood', 'Rings of Attention', 'mossprout:objective:rings-of-attention', [
    order('merge-story:mossprout:heartwood:living-rings', 'Living Rings', 'Wake the rings left by every return.', [['nature:garden:5', 1]], 50),
    order('merge-story:mossprout:heartwood:root-bridge', 'The Root Bridge', 'Turn the fallen trunk into a way forward.', [['nature:keepsake:4', 1], ['nature:garden:5', 1]], 60),
  ], 'matched', null, null),
  episode(12, 26, 'heartwood:place-that-holds', 'mossprout:chapter:heartwood', 'A Place That Holds', 'mossprout:objective:place-that-holds', [
    order('merge-story:mossprout:heartwood:first-shelter', 'The First Shelter', 'Shape a quiet threshold in the clearing.', [['nature:garden:6', 1]], 55),
    order('merge-story:mossprout:heartwood:memory-shelter', 'A Memory Shelter', 'Give old memories somewhere safe to keep growing.', [['nature:keepsake:5', 1]], 65),
  ], 'mistle', null, 'playful'),
  episode(13, 28, 'heartwood:heartwood', 'mossprout:chapter:heartwood', 'Heartwood', 'mossprout:objective:heartwood', [
    order('merge-story:mossprout:heartwood:living-pieces', 'The Living Pieces', 'Bring the garden and nursery into the clearing together.', [['nature:garden:7', 1], ['nature:keepsake:6', 1]], 60),
    order('merge-story:mossprout:heartwood:sanctuary', 'Heartwood Sanctuary', 'Grow the place every path has been leading toward.', [['hybrid:heartwood-sanctuary', 1]], 80),
  ], 'drizzlet', 'heartwood', null),
] as const;

function episode(
  episodeNumber: number,
  unlockGardenDay: number,
  beatId: string,
  chapterId: string,
  title: string,
  objectiveId: string | null,
  mergeOrders: readonly MossproutCampaignOrder[],
  guestSkinId: MossproutCampaignEpisode['guestSkinId'],
  milestoneGateId: string | null,
  optionalAction: MossproutCampaignEpisode['optionalAction'],
): MossproutCampaignEpisode {
  // Keep the v2 IDs stable so unfinished conversations resume after the v3
  // two-order migration instead of being replayed as different scenes.
  const prefix = `mossprout:campaign-v2:${beatId}`;
  return {
    beatId, chapterId, episodeNumber, unlockGardenDay, title, completionMode: 'merge', objectiveId,
    mergeOrderId: mergeOrders[0]?.id ?? null, mergeOrders, requirements: mergeOrders.at(-1)?.requirements ?? [],
    guestSkinId, milestoneGateId, optionalAction,
    openingConversationId: `${prefix}:opening`,
    resolutionConversationId: `${prefix}:resolution`,
  };
}

function order(
  id: string,
  title: string,
  description: string,
  requirements: readonly (readonly [definitionId: string, quantity: number])[],
  coins: number,
): MossproutCampaignOrder {
  return { id, title, description, requirements: requirements.map(([definitionId, quantity]) => ({ definitionId, quantity })), coins };
}

/** Supplies every campaign order independently while preserving one real merge. */
export function mossproutCampaignOrderDrops(episodeDefinition: MossproutCampaignEpisode): string[] {
  return episodeDefinition.mergeOrders.flatMap((mergeOrder) => mergeOrder.requirements.flatMap((requirement) => {
    const tierMatch = /^(.*):(\d+)$/.exec(requirement.definitionId);
    const tier = tierMatch ? Number(tierMatch[2]) : 1;
    const sourceDefinitionId = tierMatch && tier > 1 ? `${tierMatch[1]}:${tier - 1}` : requirement.definitionId;
    const sourceQuantity = requirement.quantity * (tier > 1 ? 2 : 1);
    return Array.from({ length: sourceQuantity }, () => sourceDefinitionId);
  }));
}

export const mossproutCampaignEpisodeByBeatId = new Map(MOSSPROUT_CAMPAIGN_EPISODES.map((episodeDefinition) => [episodeDefinition.beatId, episodeDefinition]));
export const mossproutCampaignEpisodeByObjectiveId = new Map(MOSSPROUT_CAMPAIGN_EPISODES.flatMap((episodeDefinition) => episodeDefinition.objectiveId
  ? [[episodeDefinition.objectiveId, episodeDefinition] as const]
  : []));
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
