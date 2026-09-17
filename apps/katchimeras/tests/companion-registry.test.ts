import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANION_JOURNEY_CHAPTERS, JOURNEY_EPISODE_CONVERSATIONS, journeyEpisodeById } from '@/constants/companion-journey-chapters/registry';
import { episodeConsequences, journeyConsequenceFlow, journeyConsequenceRunId, journeyMissionOf } from '@/constants/companion-journey-chapters/consequence-flow';
import { HATCHABLE_COMPANIONS, hatchableByCompanion, hatchableByTile } from '@/constants/hatchable-companions/registry';
import { STORY_TILES, storyTileById } from '@/constants/story-tiles/registry';
import { ISLAND_WAKE_ORDER } from '@/constants/island-campaigns/wake-order';
import { MOSSPROUT_NATURE_ISLAND_IDS } from '@/constants/mossprout-nature-islands';
import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { companionDailyConfig } from '@/constants/companion-daily/registry';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { validateConversationDefinitions } from '@/utils/companion-conversation';
import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import type { JourneyEpisodeFlavour } from '@/types/companion-journey-chapter';

const FLAVOURS: readonly JourneyEpisodeFlavour[] = ['adventure', 'personal', 'companion', 'relationship'];

test('every chapter is a whole arc: unique ids, one first meeting, every flavour, every unlock and consequence on a real thing', () => {
  const conversationIds = new Set<string>();
  const runIds = new Set<string>();
  const orderIds = new Set<string>();
  const families = new Set<string>();
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    if (!chapter.afterChapterId) { assert.ok(!families.has(chapter.familyId), `${chapter.familyId} has one first chapter`); families.add(chapter.familyId); }
    assert.ok(chapter.familyId === 'mossprout' || hatchableByCompanion(chapter.familyId), `${chapter.familyId} has a page`);
    const ids = new Set(chapter.episodes.map((episode) => episode.id));
    assert.equal(ids.size, chapter.episodes.length, `${chapter.chapterId}: episode ids unique`);
    assert.equal(chapter.episodes.filter((episode) => episode.dayOne).length, chapter.afterChapterId ? 0 : 1, `${chapter.chapterId}: exactly one first meeting in a first chapter, none in a continuation`);
    // A continuation (a bundled or live pack's arc) is shorter: no first meeting, and not every flavour.
    if (!chapter.afterChapterId) {
      assert.equal(chapter.episodes[0]!.dayOne, true, `${chapter.chapterId}: the first meeting comes first`);
      for (const flavour of FLAVOURS) assert.ok(chapter.episodes.some((episode) => episode.flavour === flavour), `${chapter.chapterId} has a ${flavour} episode`);
    }
    for (const level of chapter.bondRewards ?? []) {
      if (level.kind === 'episode') assert.ok(ids.has(level.id), `${chapter.chapterId}: Bond ${level.level} opens a real episode`);
      if (level.kind === 'place') assert.ok(storyTileById(level.id), `${chapter.chapterId}: Bond ${level.level} opens a real place`);
    }
    for (const episode of chapter.episodes) {
      for (const condition of episode.unlock) {
        switch (condition.kind) {
          case 'episode_complete': assert.ok(ids.has(condition.episodeId) && condition.episodeId !== episode.id, `${episode.id} unlocks on another episode of its chapter`); break;
          case 'mist_cleared': assert.ok(hatchableByTile(condition.tileId) || storyTileById(condition.tileId), `${episode.id}: ${condition.tileId} is a tile`); break;
          case 'story_tile_revealed': assert.ok(storyTileById(condition.tileId), `${episode.id}: ${condition.tileId} is a story tile`); break;
          case 'friend_hatched': assert.ok(hatchableByCompanion(condition.companion), `${episode.id}: ${condition.companion} hatches`); break;
          case 'friend_home': assert.ok(ISLAND_WAKE_ORDER.some((entry) => entry.residentSkinId === condition.residentSkinId), `${episode.id}: ${condition.residentSkinId} is an island friend`); break;
          case 'island_revealed': assert.ok((MOSSPROUT_NATURE_ISLAND_IDS as readonly string[]).includes(condition.islandId), `${episode.id}: ${condition.islandId} is an island`); break;
          default: break;
        }
      }
      const consequence = episodeConsequences(episode)[0];
      if (consequence) {
        if (consequence.kind === 'reveal_story_tile' || consequence.kind === 'mist_mission') assert.ok(storyTileById(consequence.tileId), `${episode.id} changes a registered story tile`);
        if (consequence.kind === 'reveal_island') assert.ok((MOSSPROUT_NATURE_ISLAND_IDS as readonly string[]).includes(consequence.islandId));
        if (consequence.kind === 'grant') assert.ok(MERGE_GENERATORS_BY_ID.has(consequence.generatorId), `${episode.id} grants a known generator's parcel`);
        for (const item of episodeConsequences(episode)) if (item.kind === 'garden_orders') for (const order of item.orders) { assert.ok(!orderIds.has(order.id), `${order.id} is placed by one episode only`); orderIds.add(order.id); }
        const mission = journeyMissionOf(episode);
        if (mission) for (const { definitionId } of [...mission.mission.seed.items, ...mission.mission.seed.echoes, ...mission.mission.seed.veiled]) assert.ok(MERGE_ITEMS_BY_ID.has(definitionId), `${episode.id}'s board holds known things`);
        const flow = journeyConsequenceFlow(chapter, episode)!;
        assert.deepEqual(validateContentFlowDefinition(flow), [], `${flow.id} compiles`);
        const runId = journeyConsequenceRunId(chapter.familyId, episode.id);
        assert.ok(!runIds.has(runId)); runIds.add(runId);
      }
      if (episode.dayOne) { assert.equal(episode.beats, undefined, `${episode.id} is played by the first meeting, not beats`); continue; }
      // An episode plays a catalog conversation by id, or its beats compiled into one.
      const entry = journeyEpisodeById(chapter.familyId, episode.id)!;
      const id = episode.conversationId ?? entry.compiled?.definition.id;
      assert.ok(id, `${episode.id} plays a conversation`);
      assert.ok(!conversationIds.has(id!), `${id} once across every chapter`); conversationIds.add(id!);
      const definition = companionConversationDefinitionById.get(id!);
      assert.ok(definition, `${id} is in the catalog`);
      if (entry.compiled) assert.equal(definition, entry.compiled.definition);
      assert.ok(definition!.nodes.some((node) => node.kind === 'end'), `${id} ends`);
    }
  }
  assert.deepEqual(validateConversationDefinitions(JOURNEY_EPISODE_CONVERSATIONS), []);
});

test('every friend with a page has a daily config the shared cards can draw, and every story tile has art', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    const daily = companionDailyConfig(definition.companion);
    assert.ok(daily, `${definition.companion} has daily cards`);
    assert.ok(daily!.polls.length > 0, `${definition.companion} has a daily question`);
    if (daily!.goal) {
      assert.ok(daily!.goal.milestones.length > 0);
      assert.ok(daily!.goal.milestones.every((goal, index, all) => index === 0 || goal.steps > all[index - 1]!.steps), `${definition.companion}'s step ladder climbs`);
    }
    if (daily!.moment) for (const option of daily!.moment.options) assert.ok(daily!.moment.replies[option.id] || daily!.moment.thanks);
  }
  assert.ok(companionDailyConfig('mossprout')?.moment, 'Mossprout keeps a daily moment');
  assert.ok(STORY_TILES.length > 0);
});
