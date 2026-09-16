import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition, JourneyUnlockCondition } from '@/types/companion-journey-chapter';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { MOSSPROUT_CAMPAIGN_EPISODES, type MossproutCampaignEpisode } from '@/constants/mossprout-campaign';
import { MOSSPROUT_JOURNEY_WISP_IDS } from '@/utils/journey-wisp-affinity';
import { MOSSPROUT_ARC_ONE_BEATS, MOSSPROUT_ARC_ONE_LINES, OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { MOSSPROUT_OLD_GROVE } from '@/constants/story-tiles/mossprout-old-grove';

/**
 * Mossprout's one arc: the Garden campaign's thirteen beats and Growing
 * Again's seven episodes as a single chapter on the journey system. Every
 * campaign beat is generated from `MOSSPROUT_CAMPAIGN_EPISODES`, so its ids,
 * titles, orders, guests and conversations are the ones saves already carry:
 * an opening episode (the beat's opening conversation, then its Garden orders)
 * and a resolution episode (unlocked once the orders are served; the beat's
 * wisp reward, habitat stage and reflecting pause; the campaign's optional
 * action cards are not carried over, the arc's own episodes and the daily
 * cards hold that place). A
 * beat's guest is a face on its orders, never a gate: the conversation
 * resolver already speaks around a friend who is not home yet. The first
 * beat is the first session itself. Growing Again's episodes sit
 * between the beats at named anchors.
 *
 * Completing a resolution episode also advances his story summary (the
 * beat, the chapter, the habitat stage) the way the campaign day did, so the
 * Garden, the islands and the Haven read what they always read.
 */
const HOUR = 60 * 60 * 1000;
export const MOSSPROUT_ONE_ARC_REFLECT_MS = 4 * HOUR;
export const resolutionEpisodeId = (beatId: string) => `${beatId}:resolution`;
export const beatIdOf = (episodeId: string) => episodeId.replace(/:resolution$/, '');
const done = (episodeId: string): JourneyUnlockCondition => ({ kind: 'episode_complete', episodeId });
const HABITAT_STAGE: Readonly<Record<number, 1 | 2 | 3 | 4>> = { 2: 1, 5: 2, 9: 3, 13: 4 };

function guestOf(episode: MossproutCampaignEpisode): KatchimeraSkinId | null {
  return episode.guestSkinId && episode.guestSkinId !== 'matched' ? episode.guestSkinId : null;
}

/** A campaign beat as two episodes: the opening with its orders, and the resolution once they are served. */
function campaignEpisodes(episode: MossproutCampaignEpisode, previousId: string): readonly JourneyEpisodeDefinition[] {
  const guest = guestOf(episode);
  const orderIds = episode.mergeOrders.map((order) => order.id);
  const opening: JourneyEpisodeDefinition = {
    id: episode.beatId, title: episode.title, flavour: 'adventure',
    conversationId: episode.openingConversationId,
    unlock: [done(previousId), { kind: 'since_previous', ms: MOSSPROUT_ONE_ARC_REFLECT_MS }],
    reflectMs: 0,
    ...(episode.mergeOrders.length ? { consequences: [{ kind: 'garden_orders', objectiveId: episode.objectiveId ?? `mossprout:objective:${episode.beatId}`, storyArcId: episode.chapterId, orders: episode.mergeOrders, ...(guest ? { recipientSkinId: guest } : {}) }] } : {}),
  };
  const resolution: JourneyEpisodeDefinition = {
    id: resolutionEpisodeId(episode.beatId), title: episode.title, flavour: 'companion',
    conversationId: episode.resolutionConversationId!,
    unlock: [done(episode.beatId), ...(orderIds.length ? [{ kind: 'orders_served' as const, orderIds }] : [])],
    reflectMs: MOSSPROUT_ONE_ARC_REFLECT_MS,
    ...(HABITAT_STAGE[episode.episodeNumber] ? { habitatStage: HABITAT_STAGE[episode.episodeNumber] } : {}),
    // The beat is done when its resolution is: the story summary the campaign wrote moves on with it.
    completes: { kind: 'campaign_beat', beatId: episode.beatId },
    consequences: [
      ...(episode.episodeNumber >= 2 && episode.episodeNumber <= 9 ? [{ kind: 'wisp_reward' as const, rewardId: `mossprout:journey-wisp:${episode.beatId}`, candidateWispIds: MOSSPROUT_JOURNEY_WISP_IDS, fallbackWispId: 'sprout' as const }] : []),
    ],
  };
  return [opening, resolution];
}

/** Growing Again's episodes, each anchored to the campaign beat it follows. */
const arc = (id: string, title: string, flavour: JourneyEpisodeDefinition['flavour'], anchorId: string, unlock: readonly JourneyUnlockCondition[], extra: Partial<JourneyEpisodeDefinition> = {}): JourneyEpisodeDefinition => ({
  id, title, flavour, unlock: [done(anchorId), ...unlock], reflectMs: 0, beats: MOSSPROUT_ARC_ONE_BEATS[id]!, ...extra,
});
const ARC_AFTER: Readonly<Record<string, (anchorId: string) => JourneyEpisodeDefinition>> = {
  'quiet-patch:first-flower': (anchor) => arc('tiny-beginnings', 'Tiny Beginnings', 'personal', anchor, [{ kind: 'since_previous', ms: 4 * HOUR }]),
  'quiet-patch:pond-knock': (anchor) => arc('wrong-with-the-mist', 'Something Is Wrong With the Mist', 'adventure', anchor, [{ kind: 'mist_cleared', tileId: 'steppling-home' }, { kind: 'since_previous', ms: 4 * HOUR }]),
  'returning-pond:rain-garden': (anchor) => arc('petalimp', 'Petalimp', 'relationship', anchor, [{ kind: 'friend_home', residentSkinId: 'petalimp' }, { kind: 'bond_level', level: 2 }]),
  'memory-nursery:lantern-bank': (anchor) => arc('old-garden', 'The Old Garden', 'companion', anchor, [{ kind: 'bond_level', level: 3 }, { kind: 'evidence', count: 8 }],
    { consequence: { kind: 'reveal_story_tile', tileId: MOSSPROUT_OLD_GROVE.id } }),
  'heartwood:mirror-for-rain': (anchor) => arc('grove-kept', 'What the Grove Kept', 'companion', anchor, [{ kind: 'interactions', count: 3, since: 'previous_episode' }],
    { consequence: { kind: 'grant', generatorId: 'wild-garden', rewardId: 'journey:mossprout:grove-kept:seed' } }),
  'heartwood:rings-of-attention': (anchor) => arc('wisp-in-the-grove', 'The Wisp in the Grove', 'adventure', anchor, [{ kind: 'since_previous', ms: 8 * HOUR }],
    { consequence: { kind: 'mist_mission', tileId: MOSSPROUT_OLD_GROVE.id, mission: OLD_GROVE_MISSION } }),
  'heartwood:heartwood': (anchor) => arc('growing-again', 'Growing Again', 'relationship', anchor, [{ kind: 'bond_level', level: 4 }]),
};

function buildEpisodes(): readonly JourneyEpisodeDefinition[] {
  const [first, ...rest] = MOSSPROUT_CAMPAIGN_EPISODES;
  // The first session's farewell already began his first rest; the episode itself starts no pause.
  const episodes: JourneyEpisodeDefinition[] = [{ id: first!.beatId, title: first!.title, flavour: 'companion', dayOne: true, unlock: [{ kind: 'day_one_complete' }], reflectMs: 0 }];
  const insertAfter = (beatId: string, anchorId: string) => { const make = ARC_AFTER[beatId]; if (make) episodes.push(make(anchorId)); };
  insertAfter(first!.beatId, first!.beatId);
  let previousId = first!.beatId;
  for (const episode of rest) {
    const pair = campaignEpisodes(episode, previousId);
    episodes.push(...pair);
    previousId = pair[pair.length - 1]!.id;
    insertAfter(episode.beatId, previousId);
  }
  return episodes;
}

export const MOSSPROUT_CHAPTER: CompanionJourneyChapterDefinition = {
  familyId: 'mossprout',
  chapterId: 'mossprout-arc-1',
  title: 'Growing Again',
  purpose: MOSSPROUT_ARC_ONE_LINES.purpose,
  episodes: buildEpisodes(),
  reflectMs: MOSSPROUT_ONE_ARC_REFLECT_MS,
  dayOne: { flowId: 'mossprout-ftue', runId: 'mossprout-ftue' },
  generatorId: 'wild-garden',
  evidence: 'water',
  bondRewards: [
    { level: 2, kind: 'episode', id: 'petalimp', label: 'Petalimp' },
    { level: 3, kind: 'place', id: MOSSPROUT_OLD_GROVE.id, label: 'The Old Grove' },
    { level: 4, kind: 'episode', id: 'growing-again', label: 'Growing Again' },
  ],
  lines: {
    foreshadow: MOSSPROUT_ARC_ONE_LINES.foreshadow,
    complete: MOSSPROUT_ARC_ONE_LINES.complete,
    checkIn: [['noticed', 'I noticed something living'], ['rest', 'I took a quiet moment']],
    lifeIcon: 'leaf.fill',
    hints: { ...MOSSPROUT_ARC_ONE_LINES.hints, orders_served: 'Serve what I asked for on the Garden first. Then I will tell you how it went.' },
  },
};

/** The one-arc chapter by its working name. */
export const MOSSPROUT_ONE_ARC_CHAPTER = MOSSPROUT_CHAPTER;
