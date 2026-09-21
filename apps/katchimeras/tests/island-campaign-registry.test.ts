import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import {
  activeIslandCampaign,
  activeIslandCampaigns,
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

test('two friends’ stories in progress: both are seen, so a finished board continues on its own whoever’s it is', () => {
  // A pack's island (the Wander Trail) wakes on its own condition, so its story can run alongside the friend the wake
  // order has open. The screen's automatic continuations once looked only at the first story in campaign order, so
  // the other friend's finished board waited for the player to tap the island and press a free Restore.
  const [first, second] = ISLAND_CAMPAIGNS;
  assert.ok(first && second);
  let state = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 };
  state = greetIslandFriend(revealIsland(state, first, NOW), first, NOW + 1);
  // The wake order will not reveal two ordered friends at once, so the second story is written in by hand, the way a
  // pack island's own wake condition puts one there: the same greeted record, under the other friend's ids.
  const greeted = JSON.parse(JSON.stringify(state.islandCampaigns![first.campaignId])
    .replaceAll(first.campaignId, second.campaignId).replaceAll(first.islandId, second.islandId).replaceAll(first.residentSkinId, second.residentSkinId));
  state = { ...state, islandCampaigns: { ...state.islandCampaigns, [second.campaignId]: greeted },
    haven: { ...state.haven, mossproutNatureIslandReveals: { ...state.haven.mossproutNatureIslandReveals, [second.islandId]: state.haven.mossproutNatureIslandReveals[first.islandId] } } };
  assert.deepEqual(activeIslandCampaigns(state).map((story) => story.campaign.campaignId), [first.campaignId, second.campaignId], 'every story in progress, in campaign order');
  assert.equal(activeIslandCampaign(state)?.campaign, first, 'the single lookup is only ever the first of them');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  // Both stories are seen, but only the friend in focus continues on its own: a friend who cannot go on right now
  // leaves the player on the map, never in another friend's story.
  assert.match(screen, /const stories = activeIslandCampaigns\(mergeWorld\);\s*const story = restorationFocusCampaignId\s*\? stories\.find\(\(candidate\) => candidate\.campaign\.campaignId === restorationFocusCampaignId\)\s*: stories\.length === 1 \? stories\[0\] : undefined;\s*if \(story && advance\(story\)/, 'the screen continues the friend in focus, whoever they are');
  assert.doesNotMatch(screen, /for \(const story of ordered\)/, 'and never falls through to another friend');
  assert.match(screen, /const campaignAutoTransitionRef = useRef\(new Set<string>\(\)\);/, 'and remembers what has fired per friend, chapter and status, so two stories cannot replay each other’s scenes');
  assert.doesNotMatch(screen, /activeIslandCampaign\(mergeWorld\)/);
});
