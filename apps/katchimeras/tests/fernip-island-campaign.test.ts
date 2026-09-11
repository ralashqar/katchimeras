import assert from 'node:assert/strict';
import test from 'node:test';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { FERNIP_ISLAND_CAMPAIGN_ID, FERNIP_ISLAND_ID, FERNIP_WILDGROWTH_CAMPAIGN } from '@/constants/island-campaigns/fernip-wildgrowth';
import { islandCampaignChapterOrder, islandCampaignChapterStatus, islandCampaignOpeningConversationId, islandCampaignPayoffStyle, islandCampaignPreviousStyle, islandCampaignResolutionConversationId, islandCampaignReturnConversationId, islandCampaignUpgradePanelState } from '@/constants/island-campaigns/helpers';
import { islandWakeBlocker, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import { acknowledgeChapterReturn, completeChapter, completeIslandCampaign, completeRestoration, greetIslandFriend, restoreIslandLevel, revealIsland, startAndServeChapter } from './helpers/island-campaign';

const NOW = Date.parse('2026-09-11T12:00:00Z');
const fernip = FERNIP_WILDGROWTH_CAMPAIGN;
const worldBeforeFernip = () => buildPlayerProfileFixtures(NOW).find((fixture) => fixture.id === 'fixture:kingdom-before-fernip')!.domains.mergeWorld.state;

test('Fernip has four story-led openings, each on a restoration board, with choice-specific requests, returns and payoffs', () => {
  assert.deepEqual(fernip.chapters.map((chapter) => chapter.level), [1, 2, 3, 4]);
  assert.equal(fernip.campaignId, FERNIP_ISLAND_CAMPAIGN_ID);
  assert.equal(fernip.islandId, FERNIP_ISLAND_ID);
  for (const chapter of fernip.chapters) {
    assert.ok(chapter.restoration, `level ${chapter.level} plays on the board`);
    const opening = companionConversationDefinitionById.get(chapter.conversationId);
    const choice = chapter.choices[0]!;
    const returnConversation = companionConversationDefinitionById.get(islandCampaignReturnConversationId(fernip, chapter.level, choice.id)!);
    const resolution = companionConversationDefinitionById.get(islandCampaignResolutionConversationId(fernip, chapter.level, choice.id, chapter.level === 4 ? 'unhurried' : undefined)!);
    assert.equal(opening?.format, 'narrative');
    assert.equal(opening?.speakerSkinId, 'fernip');
    assert.equal(opening?.nodes[0]?.kind, 'choice');
    if (opening?.nodes[0]?.kind === 'choice') {
      assert.match(opening.nodes[0].prompt, /\n\n/);
      assert.equal(opening.nodes[0].options.length, 3);
    }
    assert.equal(returnConversation?.format, 'narrative');
    assert.ok(returnConversation?.tags?.includes('return'));
    assert.equal(resolution?.format, 'narrative');
    assert.ok(resolution?.tags?.includes('required-narrative-overlay'));
    const authored = islandCampaignChapterOrder(fernip, chapter.level, choice.id, NOW)!;
    const fallback = islandCampaignChapterOrder(fernip, chapter.level, NOW)!;
    assert.notEqual(authored.title, fallback.title);
    assert.deepEqual(authored.requirements, fallback.requirements, 'every answer asks for the same items');
    assert.equal(authored.recipientSkinId, 'fernip');
    assert.equal(authored.storyArcId, FERNIP_ISLAND_CAMPAIGN_ID);
  }
  const finalResolution = companionConversationDefinitionById.get(islandCampaignResolutionConversationId(fernip, 4, fernip.chapters[3]!.choices[0]!.id, 'unhurried')!);
  assert.ok(finalResolution?.nodes.some((node) => node.kind === 'insight_reveal' && node.persistence === 'offer_save'));
  // The last answer weighs more: one playful answer in the middle loses to a sheltered finale.
  assert.equal(islandCampaignPayoffStyle(fernip, ['rest-slow', 'near-games', 'letgo-mess', 'remember-safe']), 'playful');
  assert.equal(islandCampaignPayoffStyle(fernip, ['rest-play', 'near-silence', 'letgo-someone', 'remember-safe']), 'sheltered');
  assert.equal(islandCampaignPayoffStyle(fernip, ['rest-slow', 'near-silence', 'letgo-mess', 'remember-safe']), 'unhurried', 'two quiet answers outweigh one weighted finale');
});

test('Fernip’s boards grow with the grove and only ever ask for what the Locker and the Basket can make', () => {
  const boards = fernip.chapters.map((chapter) => chapter.restoration!);
  assert.deepEqual(boards.map((board) => board.rows), [3, 3, 4, 4], 'the window widens for the thicket');
  assert.deepEqual(boards.map((board) => board.merges), [5, 7, 8, 9], 'the bar lengthens every stage');
  assert.deepEqual(boards.map((board) => board.echoes.length), [2, 2, 3, 3], 'more of the grove is misted each time');
  assert.deepEqual(boards.map((board) => board.items.length), [4, 5, 6, 7], 'and more pieces are waiting in it');
  const deliveries = fernip.chapters.map((chapter) => chapter.fallbackOrder.requirements.map((requirement) => MERGE_ITEMS_BY_ID.get(requirement.definitionId)!.name));
  assert.deepEqual(deliveries, [['Plant'], ['Flower', 'Sprout'], ['Rare Flower', 'Boot'], ['Magical Plant', 'Hiking Gear']]);
  for (const chapter of fernip.chapters) {
    for (const requirement of chapter.fallbackOrder.requirements) {
      const chainId = MERGE_ITEMS_BY_ID.get(requirement.definitionId)!.chainId;
      assert.ok(chainId === 'nature:garden' || chainId === 'adventure:trail', `${requirement.definitionId} is on a chain open before Shellio`);
    }
    // Every misted cell holds something a delivery or the board can match, and every delivered item is wanted.
    for (const echo of chapter.restoration!.echoes) assert.ok(MERGE_ITEMS_BY_ID.get(echo.definitionId)?.nextItemId, `${echo.id} grows when matched`);
  }
});

test('Fernip keeps prices out of his mouth, remembers the previous answer, and sets every stage against the Mist', () => {
  for (const chapter of fernip.chapters) {
    assert.match(chapter.prompt, /Mist|\bthem\b|\bthey\b/, `level ${chapter.level} sets its scene against the Mist (by name, or as "them")`);
    for (const choice of chapter.choices) {
      assert.doesNotMatch(choice.returnLine, /\d+ Glow/, `${choice.id} leaves the cost to the panel`);
      assert.match(choice.returnLine, /(^|\. )Set (it|them) /, `${choice.id} tells the player to set the delivery down`);
    }
    if (chapter.level === 1) {
      assert.equal(chapter.callbackLine, undefined);
      for (const choice of chapter.choices) assert.match(choice.returnLine, /gift/, `${choice.id} makes the first restoration a gift`);
    } else {
      for (const style of fernip.payoff.styles) {
        assert.ok(chapter.callbackLine?.[style], `level ${chapter.level} remembers a ${style} answer`);
        const variant = companionConversationDefinitionById.get(`${chapter.conversationId}:after-${style}`);
        assert.ok(variant, `${chapter.conversationId}:after-${style} is registered`);
        const node = variant?.nodes[0];
        if (node?.kind === 'choice') {
          assert.ok(node.prompt.startsWith(chapter.callbackLine![style]!));
          assert.equal(node.helperText, undefined, 'no mechanics hint under a personal question');
          assert.deepEqual(node.options.map((option) => option.id), chapter.choices.map((choice) => choice.id));
        }
      }
    }
  }
  assert.equal(fernip.copy.actionLabels.continue_restoring, 'Back to the ferns');
  assert.equal(fernip.copy.stateLabels.board_open, 'Driving off the Mist');
  assert.equal(fernip.copy.stateLabels.delivery_requested, 'Requested in Merge');
  assert.ok(fernip.copy.speech?.available && fernip.copy.speech.delivery_requested, 'he voices the board states');
  assert.equal(islandCampaignOpeningConversationId(fernip, 1, null), fernip.chapters[0]!.conversationId);
  assert.equal(islandCampaignOpeningConversationId(fernip, 2, 'playful'), `${fernip.chapters[1]!.conversationId}:after-playful`);
});

test('the grove sleeps until Petalimp is home, then plays every stage on the board and wakes the nursery', () => {
  const beforePetalimp = buildPlayerProfileFixtures(NOW).find((fixture) => fixture.id === 'fixture:kingdom-before-petalimp')!.domains.mergeWorld.state;
  assert.equal(islandWakeState(beforePetalimp, FERNIP_ISLAND_ID), 'sleeping');
  assert.equal(islandWakeBlocker(beforePetalimp, FERNIP_ISLAND_ID)?.residentSkinId, 'petalimp');

  const world = worldBeforeFernip();
  assert.equal(islandWakeState(world, FERNIP_ISLAND_ID), 'open');
  let state = greetIslandFriend(revealIsland({ ...world, coins: 900 }, fernip, NOW), fernip, NOW + 1);
  assert.equal(islandCampaignChapterStatus(state, fernip, 1), 'available');
  assert.equal(islandCampaignPreviousStyle(state, fernip, 2), null);
  // Stage 1: the board opens for free, the request is the delivery, the restore is his gift.
  state = startAndServeChapter(state, fernip, 1, NOW + 2, 2);
  assert.equal(islandCampaignChapterStatus(state, fernip, 1), 'board_open');
  const panel = islandCampaignUpgradePanelState(state, fernip)!;
  assert.equal(panel.stateLabel, 'Driving off the Mist');
  assert.equal(panel.speech, fernip.chapters[0]!.choices[2]!.returnLine, 'the return line greets the delivery on the panel');
  state = completeChapter(restoreIslandLevel(completeRestoration(acknowledgeChapterReturn(state, fernip, 1, NOW + 3), fernip, 1, NOW + 4), fernip, 1, NOW + 5), fernip, 1, NOW + 6);
  assert.equal(islandCampaignChapterStatus(state, fernip, 1), 'complete');
  assert.equal(islandCampaignPreviousStyle(state, fernip, 2), 'sheltered');
  // Stage 2 costs Glow up front, asked for in his voice and never in a return line.
  const cost = mossproutNatureIslandLevelDefinition(FERNIP_ISLAND_ID, 2)!.coinCost;
  const waiting = islandCampaignUpgradePanelState({ ...state, coins: 10 }, fernip)!;
  assert.equal(waiting.status, 'available');
  assert.match(waiting.voicedStateLabel, new RegExp(`10 of ${cost} Glow`));
  assert.match(islandCampaignUpgradePanelState({ ...state, coins: cost }, fernip)!.voicedStateLabel, /Whenever you feel like it/);

  const home = completeIslandCampaign({ ...world, coins: 900 }, fernip, NOW + 100);
  assert.ok(home.ownedKatchimeraCards.some((card) => card.cardId === 'fernip' && card.acquisition === 'island_campaign'), 'Fernip is home');
  assert.equal(home.haven.mossproutNatureIslands[FERNIP_ISLAND_ID], 4);
  assert.deepEqual(([1, 2, 3, 4] as const).map((level) => islandCampaignChapterStatus(home, fernip, level)), ['complete', 'complete', 'complete', 'complete']);
  assert.equal(islandWakeState(home, 'seed-nursery'), 'open', 'the nursery wakes next');
});

test('Fernip speaks in the Mist’s voice rules: no exclamation near the Mist, the wisps named once per chapter, the Mist always capitalised', () => {
  const campaign = FERNIP_WILDGROWTH_CAMPAIGN;
  const lines = (chapter: (typeof campaign.chapters)[number], choice: (typeof chapter.choices)[number]) =>
    [chapter.prompt, ...Object.values(chapter.callbackLine ?? {}), choice.reply, choice.openingConclusion, choice.returnLine, choice.resolutionLine];
  for (const chapter of campaign.chapters) {
    for (const choice of chapter.choices) {
      for (const line of lines(chapter, choice)) {
        if (/Mist/.test(line)) assert.doesNotMatch(line, /!/, `${chapter.title} · ${choice.id}: ${line}`);
        assert.doesNotMatch(line, /\bmist\b/, `${chapter.title} · ${choice.id} names the Mist as weather: ${line}`);
      }
      const named = [chapter.prompt, choice.openingConclusion].join('\n').match(/Mistwisps?/g)?.length ?? 0;
      assert.ok(named <= 1, `${chapter.title} · ${choice.id} names the Mistwisps ${named} times before the board`);
    }
  }
  const copy = campaign.copy;
  for (const line of [copy.discoveryDialogue, copy.revealReactionLine, copy.mistDescription, copy.wakeHandoffLine, copy.sleepingHint, copy.fallbackReturn('x'), copy.fallbackResolution(1), copy.fallbackResolution(4), ...(copy.wispLines ? [copy.wispLines.firstStrike, ...copy.wispLines.fell, copy.wispLines.last] : [])]) {
    assert.doesNotMatch(line, /\bmist\b/, line);
    if (/Mist/.test(line)) assert.doesNotMatch(line, /!/, line);
  }
  assert.ok(copy.wispLines && copy.wispLines.fell.length >= 3, 'four wisps need three falling lines before the last');
});
