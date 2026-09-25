import { applyEpisodeCompletes } from '@/features/companion/journey-consequence-state';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MOSSPROUT_CHAPTER, resolutionEpisodeId } from '@/constants/companion-journey-chapters/mossprout';
import { journeyChapterFor } from '@/constants/companion-journey-chapters/registry';
import { mossproutGardenActivity, mossproutGardenRequestPreviews, mossproutResolvedBeatDayIds } from '@/features/companion/mossprout-garden-activity';
import { completeMossproutBeat } from '@/game/katchimeras/mossprout-beats';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { journeyConsequenceFlow, episodeConsequences } from '@/constants/companion-journey-chapters/consequence-flow';
import { journeyEpisodeConversation } from '@/constants/companion-journey-chapters/episode-conversation';
import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { validateConversationDefinitions } from '@/utils/companion-conversation';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { journeyChapterState, journeyConditionHolds } from '@/features/companion/journey-triggers';
import { emptyRelationshipProgressState, mossproutStory } from '@/game/katchimeras/relationship-progression';
import { emptyCompanionBondState } from '@/utils/companion-bond';
import { emptyCompanionContentState } from '@/utils/companion-content';
import type { JourneyEpisodeFlavour } from '@/types/companion-journey-chapter';
import type { MergeWorldState, MergeExternalRewardReceipt } from '@/types/merge-world';
import type { RelationshipProgressState } from '@/types/relationship-progression';

const NOW = Date.UTC(2026, 8, 17, 9);
const HOUR = 60 * 60 * 1000;
const CHAPTER = MOSSPROUT_CHAPTER;
const ids = CHAPTER.episodes.map((episode) => episode.id);

test('the one arc is the Garden campaign and Growing Again in one order: every beat twice, every arc episode at its anchor, ids saves already carry', () => {
  assert.equal(CHAPTER.episodes[0]!.id, MOSSPROUT_CAMPAIGN_EPISODES[0]!.beatId, 'the first session is episode one');
  assert.equal(CHAPTER.episodes[0]!.dayOne, true);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  for (const beat of MOSSPROUT_CAMPAIGN_EPISODES.slice(1)) {
    const opening = CHAPTER.episodes.find((episode) => episode.id === beat.beatId)!;
    const resolution = CHAPTER.episodes.find((episode) => episode.id === resolutionEpisodeId(beat.beatId))!;
    assert.ok(opening && resolution, `${beat.beatId} is an opening and a resolution`);
    assert.equal(opening.conversationId, beat.openingConversationId);
    assert.equal(resolution.conversationId, beat.resolutionConversationId);
    assert.equal(ids.indexOf(resolution.id), ids.indexOf(opening.id) + 1, 'the resolution follows its opening');
    const orders = episodeConsequences(opening).find((item) => item.kind === 'garden_orders');
    assert.ok(orders && orders.kind === 'garden_orders' && orders.orders.length === beat.mergeOrders.length, `${beat.beatId} places its orders`);
    assert.ok(resolution.unlock.some((condition) => condition.kind === 'orders_served' && condition.orderIds.length === beat.mergeOrders.length), `${beat.beatId} resolves once its orders are served`);
    // A guest is a face on the orders, never a gate: the campaign never waited for one, and its resolver speaks around a friend not yet home.
    if (beat.guestSkinId && beat.guestSkinId !== 'matched') assert.equal(orders.recipientSkinId, beat.guestSkinId, `${beat.beatId}'s orders carry its guest`);
    assert.ok(!opening.unlock.some((condition) => condition.kind === 'friend_home'), `${beat.beatId} does not wait for a guest`);
    const wisp = episodeConsequences(resolution).find((item) => item.kind === 'wisp_reward');
    assert.equal(Boolean(wisp), beat.episodeNumber >= 2 && beat.episodeNumber <= 9, `${beat.beatId} wisp reward`);
    if (wisp?.kind === 'wisp_reward') assert.equal(wisp.rewardId, `mossprout:journey-wisp:${beat.beatId}`, 'the reward id the campaign used');
  }
  assert.deepEqual(CHAPTER.episodes.filter((episode) => episode.habitatStage).map((episode) => [episode.id, episode.habitatStage]),
    [['quiet-patch:pond-knock:resolution', 1], ['returning-pond:rain-garden:resolution', 2], ['memory-nursery:lantern-bank:resolution', 3], ['heartwood:heartwood:resolution', 4]]);
  const after = (arcId: string, anchor: string) => assert.equal(ids[ids.indexOf(anchor) + 1], arcId, `${arcId} follows ${anchor}`);
  after('tiny-beginnings', 'quiet-patch:first-flower');
  after('wrong-with-the-mist', 'quiet-patch:pond-knock:resolution');
  after('petalimp', 'returning-pond:rain-garden:resolution');
  after('old-garden', 'memory-nursery:lantern-bank:resolution');
  after('grove-kept', 'heartwood:mirror-for-rain:resolution');
  after('wisp-in-the-grove', 'heartwood:rings-of-attention:resolution');
  after('growing-again', 'heartwood:heartwood:resolution');
  assert.equal(CHAPTER.episodes.length, 1 + 12 * 2 + 7);
  for (const flavour of ['adventure', 'personal', 'companion', 'relationship'] as JourneyEpisodeFlavour[]) assert.ok(CHAPTER.episodes.some((episode) => episode.flavour === flavour));
  // Every unlock names an earlier episode; the campaign chain runs through the resolutions, not through the arc episodes.
  for (const episode of CHAPTER.episodes) for (const condition of episode.unlock) {
    if (condition.kind !== 'episode_complete') continue;
    assert.ok(ids.indexOf(condition.episodeId) < ids.indexOf(episode.id), `${episode.id} unlocks on an earlier episode`);
    if (MOSSPROUT_CAMPAIGN_EPISODES.some((beat) => beat.beatId === episode.id)) assert.ok(!['tiny-beginnings', 'wrong-with-the-mist', 'petalimp', 'old-garden', 'grove-kept', 'wisp-in-the-grove', 'growing-again'].includes(condition.episodeId), `${episode.id} does not wait on an arc episode`);
  }
});

test('every episode plays: catalog conversations by id, authored beats compiled, every order once and made of known things, every consequence flow compiling', () => {
  const orderIds: string[] = [];
  for (const episode of CHAPTER.episodes) {
    if (episode.dayOne) continue;
    if (episode.conversationId) {
      assert.ok(companionConversationDefinitionById.has(episode.conversationId), `${episode.conversationId} is in the catalog`);
      assert.equal(journeyEpisodeConversation(CHAPTER, episode), null, 'a catalog conversation is not recompiled');
    } else {
      const compiled = journeyEpisodeConversation(CHAPTER, episode)!;
      assert.ok(compiled, `${episode.id} compiles`);
      assert.deepEqual(validateConversationDefinitions([compiled.definition]), []);
    }
    for (const consequence of episodeConsequences(episode)) {
      if (consequence.kind !== 'garden_orders') continue;
      for (const order of consequence.orders) {
        orderIds.push(order.id);
        for (const requirement of order.requirements) assert.ok(MERGE_ITEMS_BY_ID.has(requirement.definitionId), `${order.id} asks for a known thing`);
      }
    }
    const flow = journeyConsequenceFlow(CHAPTER, episode);
    if (episodeConsequences(episode).length) assert.deepEqual(validateContentFlowDefinition(flow!), [], `${episode.id}'s consequences compile`);
    else assert.equal(flow, null);
  }
  assert.equal(new Set(orderIds).size, orderIds.length, 'no Garden order is placed by two episodes');
  const withWisp = CHAPTER.episodes.find((episode) => episode.id === 'memory-nursery:nursery-key:resolution')!;
  const flow = journeyConsequenceFlow(CHAPTER, withWisp)!;
  assert.deepEqual(flow.nodes.map((node) => node.id), ['wisp', 'wisp:reveal', 'complete'], 'the wisp reward and its reveal');
  assert.equal(flow.entryNodeId, 'wisp');
  // Two consequences chain: a fixture with the wisp reward and a parcel.
  const chained = journeyConsequenceFlow(CHAPTER, { ...withWisp, id: 'fixture', consequences: [...episodeConsequences(withWisp), { kind: 'grant', generatorId: 'wild-garden', rewardId: 'journey:fixture:gift' }] })!;
  assert.deepEqual(chained.nodes.map((node) => node.id), ['wisp', 'wisp:reveal', '1.grant', 'complete'], 'consequences chain in order');
});

function withEpisodes(done: readonly string[], at = NOW - 10 * HOUR): RelationshipProgressState {
  return { ...emptyRelationshipProgressState(), journeyEpisodes: Object.fromEntries(done.map((id, index) => [`mossprout:${id}`, { familyId: 'mossprout' as const, episodeId: id, completedAt: at + index, answers: {}, facts: {} }])) };
}
const served = (world: MergeWorldState, orderIds: readonly string[]): MergeWorldState => ({ ...world, externalRewardReceipts: [...world.externalRewardReceipts, ...orderIds.map((id): MergeExternalRewardReceipt => ({
  id: `merge-story-served:${id}`, kind: 'story_order_served', characterId: 'mossprout', amount: 20, createdAt: NOW - HOUR, appliedAt: NOW - HOUR }))] });
const facts = (relationships: RelationshipProgressState, world: MergeWorldState) => ({ familyId: 'mossprout', now: NOW, world, relationships, bond: emptyCompanionBondState(), content: emptyCompanionContentState(), dayOneComplete: true });

test('the live chapter is the one arc, and the Garden reads the beat under way from it: one order at a time, drops steered, served ones marked', () => {
  assert.equal(journeyChapterFor('mossprout'), CHAPTER);
  const world = createInitialMergeWorldState(NOW);
  const pondKnock = MOSSPROUT_CAMPAIGN_EPISODES[1]!;
  const orderIds = pondKnock.mergeOrders.map((order) => order.id);
  assert.equal(mossproutGardenActivity(withEpisodes(['quiet-patch:first-flower']), world).status, 'idle', 'no beat opened: the Garden is its own');
  const opened = mossproutGardenActivity(withEpisodes(['quiet-patch:first-flower', pondKnock.beatId]), world);
  assert.equal(opened.status, 'activity_in_progress');
  assert.equal(opened.episode?.id, pondKnock.beatId);
  assert.deepEqual(opened.activity && { objectiveId: opened.activity.objectiveId, first: opened.activity.mergeOrderId, all: opened.activity.mergeOrderIds, served: opened.activity.servedOrderIds, generator: opened.activity.generatorId, opportunity: opened.activity.opportunityId },
    { objectiveId: pondKnock.objectiveId, first: orderIds[0], all: orderIds, served: [], generator: 'wild-garden', opportunity: `mossprout:${pondKnock.beatId}:campaign` });
  assert.ok(opened.activity!.dropDefinitionIds.length > 0, 'the Basket is steered toward what the orders need');
  const halfway = mossproutGardenActivity(withEpisodes(['quiet-patch:first-flower', pondKnock.beatId]), served(world, orderIds.slice(0, 1)));
  assert.equal(halfway.activity?.mergeOrderId, orderIds[1], 'the next unserved order is the one placed');
  assert.deepEqual(mossproutGardenRequestPreviews(halfway).map((item) => [item.id, item.badge, item.served]), [[orderIds[0], '1 OF 2', true], [orderIds[1], '2 OF 2', false]]);
  assert.equal(mossproutGardenActivity(withEpisodes(['quiet-patch:first-flower', pondKnock.beatId, resolutionEpisodeId(pondKnock.beatId)]), served(world, orderIds)).status, 'idle', 'resolved: the Garden is its own again');
  assert.deepEqual(mossproutResolvedBeatDayIds(withEpisodes(['quiet-patch:first-flower', pondKnock.beatId, resolutionEpisodeId(pondKnock.beatId)], Date.UTC(2026, 8, 17, 12)), (at) => new Date(at).toISOString().slice(0, 10)), ['2026-09-17']);
});

test('resolving a beat writes the story summary the campaign day wrote, once: the beat, the chapter, the objective, the habitat stage, what comes next', () => {
  const pondKnock = MOSSPROUT_CAMPAIGN_EPISODES[1]!;
  const before = emptyRelationshipProgressState();
  const after = completeMossproutBeat(before, pondKnock.beatId, NOW);
  const story = mossproutStory(after, NOW);
  assert.deepEqual(story.completedBeatIds, [MOSSPROUT_CAMPAIGN_EPISODES[0]!.beatId, pondKnock.beatId], 'the beats are sequential: the first session counts too');
  assert.deepEqual(story.completedObjectiveIds, [pondKnock.objectiveId]);
  assert.equal(story.activeBeatId, MOSSPROUT_CAMPAIGN_EPISODES[2]!.beatId);
  assert.equal(story.habitatStage, 1, 'the second beat grows the home');
  assert.deepEqual(story.completedChapterIds, [pondKnock.chapterId], 'The Quiet Patch closes with its second beat');
  assert.equal(completeMossproutBeat(after, pondKnock.beatId, NOW + 1), after, 'once');
  assert.equal(completeMossproutBeat(before, 'nowhere', NOW), before);
  // The chapter's completion hook applies it when a resolution episode is recorded, and only then.
  const resolution = CHAPTER.episodes.find((episode) => episode.id === resolutionEpisodeId(pondKnock.beatId))!;
  const opening = CHAPTER.episodes.find((episode) => episode.id === pondKnock.beatId)!;
  assert.deepEqual(resolution.completes, { kind: 'campaign_beat', beatId: pondKnock.beatId }, 'the resolution says which beat it completes, as data');
  assert.equal(opening.completes, undefined);
  assert.ok(mossproutStory(applyEpisodeCompletes(before, resolution, NOW), NOW).completedBeatIds?.includes(pondKnock.beatId));
  assert.equal(applyEpisodeCompletes(before, opening, NOW), before, 'an opening changes no summary');
  const last = MOSSPROUT_CAMPAIGN_EPISODES.at(-1)!;
  const done = mossproutStory(completeMossproutBeat(MOSSPROUT_CAMPAIGN_EPISODES.slice(1).reduce((state, beat) => completeMossproutBeat(state, beat.beatId, NOW), before), last.beatId, NOW), NOW);
  assert.equal(done.activeBeatId, 'heartwood:complete');
  assert.equal(done.habitatStage, 4);
});
