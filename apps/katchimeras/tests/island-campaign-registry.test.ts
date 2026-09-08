import assert from 'node:assert/strict';
import test from 'node:test';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import {
  activeIslandCampaign,
  activeIslandCampaignReturn,
  islandCampaignChapterOrder,
  islandCampaignConversationDefinitions,
  islandCampaignPanelPresentation,
  islandCampaignPayoffStyle,
  islandCampaignResolutionConversationId,
  islandCampaignReturnConversationId,
  pendingIslandCampaignCardReveal,
  pendingIslandCampaignDiscovery,
} from '@/constants/island-campaigns/helpers';
import {
  ISLAND_CAMPAIGNS,
  isIslandCampaignChapterId,
  isIslandCampaignId,
  islandCampaignForIsland,
  islandCampaignForOffer,
  islandCampaignForResident,
  islandCampaignReturnNoteId,
  parseIslandCampaignReturnNoteId,
} from '@/constants/island-campaigns/registry';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { completeIslandCampaign, greetIslandFriend, revealIsland, startAndServeChapter } from './helpers/island-campaign';

const NOW = Date.parse('2026-09-08T12:00:00Z');

test('every island campaign is fully authored and internally consistent', () => {
  const conversationIds = new Set<string>();
  for (const campaign of ISLAND_CAMPAIGNS) {
    assert.ok(mossproutNatureIslandById.has(campaign.islandId), `${campaign.campaignId} names a real island`);
    assert.equal(campaign.chapters.length, 4);
    assert.deepEqual(campaign.chapters.map((chapter) => chapter.level), [1, 2, 3, 4]);
    for (const chapter of campaign.chapters) {
      assert.equal(chapter.choices.length, 3, `${campaign.campaignId} level ${chapter.level} offers three answers`);
      assert.match(chapter.prompt, /\n\n/, 'prompts separate the situation from the question');
      assert.ok(!conversationIds.has(chapter.conversationId), `${chapter.conversationId} is unique`);
      conversationIds.add(chapter.conversationId);
      for (const order of [chapter.fallbackOrder, ...chapter.choices.map((choice) => choice.order)]) {
        for (const requirement of order.requirements) {
          assert.ok(MERGE_ITEMS_BY_ID.has(requirement.definitionId), `${requirement.definitionId} exists in the merge catalog`);
        }
      }
      for (const choice of chapter.choices) {
        assert.ok(campaign.payoff.styles.includes(choice.style), `${choice.id} uses a declared style`);
        assert.ok(campaign.payoff.insights[choice.style], `${choice.style} has an insight`);
        assert.ok(campaign.payoff.insightChoices[choice.style], `${choice.style} has a payoff choice`);
      }
    }
    for (const definition of islandCampaignConversationDefinitions(campaign)) {
      assert.equal(companionConversationDefinitionById.get(definition.id)?.id, definition.id, `${definition.id} is registered`);
      assert.equal(definition.speakerSkinId, campaign.residentSkinId);
    }
    assert.doesNotMatch(campaign.copy.mistNextName.toLowerCase(), new RegExp(campaign.residentSkinId), 'mist copy never names the friend');
    assert.doesNotMatch(campaign.copy.mistDescription.toLowerCase(), new RegExp(campaign.residentSkinId), 'mist copy never names the friend');
  }
});

test('registry lookups resolve islands, residents, offers, orders and notes', () => {
  const campaign = ISLAND_CAMPAIGNS[0]!;
  assert.equal(islandCampaignForIsland(campaign.islandId), campaign);
  assert.equal(islandCampaignForResident(campaign.residentSkinId), campaign);
  assert.equal(islandCampaignForOffer(`nature:${campaign.islandId}`), campaign);
  assert.equal(islandCampaignForOffer('haven:mossprout'), null);
  assert.equal(isIslandCampaignId(campaign.campaignId), true);
  assert.equal(isIslandCampaignId('mossprout:casual-garden'), false);
  const order = islandCampaignChapterOrder(campaign, 2, campaign.chapters[1]!.choices[1]!.id, NOW)!;
  assert.equal(isIslandCampaignChapterId(order.chapterId), true);
  assert.equal(order.storyArcId, campaign.campaignId);
  assert.equal(order.recipientSkinId, campaign.residentSkinId);
  const noteId = islandCampaignReturnNoteId(campaign, 3);
  assert.deepEqual(parseIslandCampaignReturnNoteId(noteId), { campaign, level: 3 });
  assert.equal(parseIslandCampaignReturnNoteId('chat-note:mossprout:day'), null);
  assert.equal(islandCampaignReturnConversationId(campaign, 1, campaign.chapters[0]!.choices[0]!.id), `${campaign.chapters[0]!.conversationId}:return:${campaign.chapters[0]!.choices[0]!.id}`);
  assert.equal(islandCampaignResolutionConversationId(campaign, 4, campaign.chapters[3]!.choices[2]!.id, campaign.payoff.styles[0]),
    `${campaign.chapters[3]!.conversationId}:restored:${campaign.chapters[3]!.choices[2]!.id}:${campaign.payoff.styles[0]}`);
});

test('payoff style weights the final chapter and breaks ties in declared order', () => {
  const campaign = ISLAND_CAMPAIGNS[0]!;
  const [first, second] = campaign.payoff.styles;
  const pick = (level: number, style: string) => campaign.chapters[level - 1]!.choices.find((choice) => choice.style === style)!.id;
  assert.equal(islandCampaignPayoffStyle(campaign, [pick(1, first!), pick(2, second!), pick(3, first!), pick(4, second!)]), second);
  assert.equal(islandCampaignPayoffStyle(campaign, [pick(1, second!), pick(2, first!)]), first);
  assert.equal(islandCampaignPayoffStyle(campaign, []), first);
});

test('island friends never arrive through journey parcels', () => {
  for (const campaign of ISLAND_CAMPAIGNS) {
    assert.notEqual(nextUnearnedMossproutResident([], campaign.residentSkinId), campaign.residentSkinId);
    assert.notEqual(nextUnearnedMossproutResident([]), campaign.residentSkinId);
  }
});

test('a complete campaign earns the friend card once and reports through the generic selectors', () => {
  const campaign = ISLAND_CAMPAIGNS[0]!;
  let state = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 };
  assert.equal(activeIslandCampaign(state), null);
  state = revealIsland(state, campaign, NOW);
  assert.equal(pendingIslandCampaignDiscovery(state)?.campaign, campaign);
  state = greetIslandFriend(state, campaign, NOW + 1);
  assert.equal(pendingIslandCampaignDiscovery(state), null);
  assert.equal(activeIslandCampaign(state)?.status, 'available');
  assert.equal(islandCampaignPanelPresentation(state, campaign)?.actionLabel, campaign.copy.actionLabels.start_story);
  state = startAndServeChapter(state, campaign, 1, NOW + 2);
  assert.deepEqual(activeIslandCampaignReturn(state), { campaign, level: 1 });
  state = completeIslandCampaign({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 }, campaign, NOW);
  assert.equal(state.ownedKatchimeraCards.filter((card) => card.cardId === campaign.residentSkinId).length, 1);
  assert.equal(state.ownedKatchimeraCards[0]?.acquisition, 'island_campaign');
  assert.ok(state.mossproutResidentSkinIds.includes(campaign.residentSkinId));
  assert.equal(pendingIslandCampaignCardReveal(state)?.campaign, campaign);
  assert.equal(activeIslandCampaign(state), null);
  assert.equal(islandCampaignPanelPresentation(state, campaign), null);
});
