import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { resolve } from 'node:path';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { PETALIMP_ISLAND_CAMPAIGN_ID, PETALIMP_ISLAND_CHAPTERS, petalimpGrowthStyle, petalimpIslandChapterOrder, petalimpIslandChapterStatus, petalimpIslandResolutionConversationId, petalimpIslandReturnConversationId, petalimpIslandReturnLevel } from '@/constants/petalimp-island-campaign';
import { FERNIP_ISLAND_LOCK_REASON, fernipIslandJourneyUnlocked } from '@/constants/nature-island-unlocks';
import { visibleWorldUpgradeOffers, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { ConversationSession } from '@/types/companion-conversation';
import { emptyCompanionContentState, normaliseCompanionContentState } from '@/utils/companion-content';
import { answerConversation, continueConversation, createConversationSession } from '@/utils/companion-conversation';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const root = resolve(__dirname, '..');

function revealBloom(state: MergeWorldState, receiptId = 'test:bloom:reveal') {
  return reduceMergeWorld(state, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId, now: NOW }).state;
}
function startAndServe(state: MergeWorldState, level: MossproutNatureIslandLevel) {
  const selectedOptionId = PETALIMP_ISLAND_CHAPTERS.find((chapter) => chapter.level === level)!.choices[0]!.id;
  const order = petalimpIslandChapterOrder(level, selectedOptionId, NOW + level)!;
  const started = reduceMergeWorld(state, { type: 'activateIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    islandId: 'bloom-garden', residentSkinId: 'petalimp', level, selectedOptionId, orders: [order], now: NOW + level }).state;
  const campaign = started.islandCampaigns![PETALIMP_ISLAND_CAMPAIGN_ID]!;
  const chapter = campaign.chapters[String(level)]!;
  return { ...started, islandCampaigns: { ...started.islandCampaigns, [PETALIMP_ISLAND_CAMPAIGN_ID]: {
    ...campaign, chapters: { ...campaign.chapters, [String(level)]: { ...chapter, servedOrderIds: [...chapter.orderIds] } },
  } } };
}

function acknowledgeReturn(state: MergeWorldState, level: MossproutNatureIslandLevel) {
  return reduceMergeWorld(state, { type: 'ackIslandCampaignChapterReturn', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    level, now: NOW + 20 + level }).state;
}

test('Petalimp has four story-led openings, choice-specific requests, returns, and payoffs', () => {
  assert.deepEqual(PETALIMP_ISLAND_CHAPTERS.map((chapter) => chapter.level), [1, 2, 3, 4]);
  for (const chapter of PETALIMP_ISLAND_CHAPTERS) {
    const opening = companionConversationDefinitionById.get(chapter.conversationId);
    const choice = chapter.choices[0]!;
    const returnConversation = companionConversationDefinitionById.get(petalimpIslandReturnConversationId(chapter.level, choice.id)!);
    const resolution = companionConversationDefinitionById.get(petalimpIslandResolutionConversationId(chapter.level, choice.id,
      chapter.level === 4 ? 'gentle' : undefined)!);
    assert.equal(opening?.format, 'narrative');
    assert.equal(opening?.speakerSkinId, 'petalimp');
    assert.equal(opening?.nodes[0]?.kind, 'choice');
    if (opening?.nodes[0]?.kind === 'choice') {
      assert.match(opening.nodes[0].prompt, /\n\n/);
      assert.equal(opening.nodes[0].options.length, 3);
    }
    assert.equal(returnConversation?.format, 'narrative');
    assert.ok(returnConversation?.tags?.includes('return'));
    assert.equal(resolution?.format, 'narrative');
    assert.ok(resolution?.tags?.includes('required-narrative-overlay'));
    const authoredOrder = petalimpIslandChapterOrder(chapter.level, choice.id, NOW)!;
    const fallbackOrder = petalimpIslandChapterOrder(chapter.level, NOW)!;
    assert.notEqual(authoredOrder.title, fallbackOrder.title);
    assert.deepEqual(authoredOrder.requirements, fallbackOrder.requirements);
    const order = authoredOrder;
    assert.equal(order.recipientSkinId, 'petalimp');
    assert.equal(order.storyArcId, PETALIMP_ISLAND_CAMPAIGN_ID);
  }
  const finalResolution = companionConversationDefinitionById.get(
    petalimpIslandResolutionConversationId(4, PETALIMP_ISLAND_CHAPTERS[3]!.choices[0]!.id, 'gentle')!,
  );
  assert.ok(finalResolution?.nodes.some((node) => node.kind === 'insight_reveal' && node.persistence === 'offer_save'));
  assert.equal(petalimpGrowthStyle(['begin-small', 'belong-change', 'pace-pause', 'change-help']), 'curious');
});

test('Petalimp choices play as dialogue and the finale resolves the accumulated growth insight', () => {
  const opening = companionConversationDefinitionById.get(PETALIMP_ISLAND_CHAPTERS[0]!.conversationId)!;
  let openingSession: ConversationSession = {
    ...createConversationSession({ definition: opening, formId: 'mossprout', dayId: '2026-09-08', createdAt: NOW }),
    dialoguePresentation: true,
  };
  openingSession = answerConversation(openingSession, opening, 'begin-small', NOW + 1).session;
  assert.equal(openingSession.turns.at(-1)?.optionId, 'begin-small');
  assert.equal(openingSession.currentNodeId, 'end-begin-small');
  openingSession = continueConversation(openingSession, opening, NOW + 2);
  assert.equal(openingSession.status, 'completed');

  const finalId = petalimpIslandResolutionConversationId(4, 'change-progress', 'gentle')!;
  const finalDefinition = companionConversationDefinitionById.get(finalId)!;
  let finalSession: ConversationSession = {
    ...createConversationSession({ definition: finalDefinition, formId: 'mossprout', dayId: '2026-09-08', createdAt: NOW }),
    dialoguePresentation: true,
  };
  finalSession = answerConversation(finalSession, finalDefinition, 'see-growth-insight', NOW + 1).session;
  assert.equal(finalSession.currentNodeId, 'insight');
  assert.equal(finalSession.insightResult?.resultId, 'gentle-grower');
  assert.match(finalSession.insightResult?.reflection ?? '', /small, kind next step/);
  assert.deepEqual(finalSession.insightResult?.supportingTraits, ['We began with small steps']);
  finalSession = continueConversation(finalSession, finalDefinition, NOW + 2);
  assert.equal(finalSession.currentNodeId, 'end');
});

test('fresh Bloom Garden uses one ordinary mystery panel without leaking Petalimp', () => {
  const state = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 100 };
  const offer = worldUpgradeOffers(state).find((candidate) => candidate.id === 'nature:bloom-garden')!;
  assert.equal(offer.transition, 'island_reveal');
  assert.equal(offer.nextLevel, 0);
  assert.equal(offer.action, 'Clear mist');
  assert.equal(offer.nextName, 'A forgotten garden');
  assert.equal(JSON.stringify(offer).toLowerCase().includes('petalimp'), false);
  const panel = readFileSync(resolve(root, 'components/katchadeck/world/world-upgrade-panel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /preUpgradeAction|Meet Petalimp/);
  const screen = readFileSync(resolve(root, 'components/katchadeck/roster/katchimera-kingdom-screen.tsx'), 'utf8');
  assert.match(screen, /presentation\.natureIslandReveal/);
  assert.doesNotMatch(screen, /preUpgradeActionLabel/);
  assert.match(screen, /interactionNatureIslandId=\{pendingIslandCampaignLevel \? PETALIMP_ISLAND_ID : null\}/,
    'every Petalimp narrative focuses Bloom Garden instead of Mossprout');
  assert.match(screen, /preserveInteractionCameraOnExit=\{Boolean\(pendingIslandCampaignLevel\)\}/,
    'Petalimp handoffs retain the Bloom Garden close-up for restoration');
  assert.doesNotMatch(screen, /setPendingIslandCampaignLevel\(null\);\s*openGarden\(activeOrderId/,
    'the Merge handoff cannot expose Mossprout focus between the narrative and route cover');
  assert.match(screen, /interactionRewardPulseKey=\{pendingIslandCampaignLevel \? 0 : interactionRewardPulseKey\}/,
    'Petalimp conversations cannot shake the hidden Mossprout host');
  const canvas = readFileSync(resolve(root, 'components/katchadeck/world/kingdom-hex-canvas.tsx'), 'utf8');
  assert.match(canvas, /if \(preserveInteractionCameraOnExit\) \{[\s\S]*?onComplete\(\);[\s\S]*?return;/);
  assert.match(canvas, /if \(!interactionResidentId \|\| interactionNatureIslandId\) return null;/,
    'island narratives never project Mossprout as their visible interaction subject');
  assert.match(canvas, /showReaction=\{!upgradePresentation\.natureIslandId\}/,
    'nature islands can never render upgrade reaction speech over their tile');
  const route = readFileSync(resolve(process.cwd(), 'components/katchadeck/world/katchimera-companion-route-screen.tsx'), 'utf8');
  const interaction = readFileSync(resolve(process.cwd(), 'components/katchadeck/world/companion-interaction-sheet.tsx'), 'utf8');
  assert.match(route, /suppressWorldSpeech=\{hostedNarrativeRequired\}/,
    'hosted friend-island stories suppress the reused companion speech layer for their full lifetime');
  assert.match(interaction, /showSpeechBubble=\{!props\.suppressWorldSpeech &&/,
    'suppressed island speech cannot mount while the narrative overlay prepares or hands off');
  assert.match(canvas, /!upgradePresentation\?\.natureIslandId[\s\S]*?upgradePresentation\?\.creatureId === tile\.companion\.creature\.creatureId/,
    'nature-island upgrades never shake Mossprout as their celebration actor');
  assert.match(screen, /onCovered: closeResidentInteraction,[\s\S]*?navigate: \(\) => \{[\s\S]*?setSelectedUpgrade\(null\);[\s\S]*?router\.push/,
    'Merge navigation retains the island close-up until the source scene is covered');
  assert.match(screen, /onGarden=\{\(\) => \{ openGarden\(\); \}\}/,
    'the insufficient-Glow action cannot restore the upgrade camera before navigation begins');
});

test('paid world upgrades spend visibly from the persistent top-bar Glow pill', () => {
  const screen = readFileSync(resolve(root, 'components/katchadeck/roster/katchimera-kingdom-screen.tsx'), 'utf8');
  assert.match(screen, /const node = glowCurrencyArtRef\.current/);
  assert.match(screen, /setDisplayedGlow\(presentation\.showCoins \? mergeWorldRef\.current\.coins \+ presentation\.coinCost/);
  assert.match(screen, /animateValue: Boolean\(upgradePresentation\?\.showCoins && upgradePresentation\.coinCost > 0\)/);
  assert.match(screen, /valueAnimationDurationMs: reduceMotion \? 180 : 650/);
  assert.match(screen, /seedPlantingFtueActive = ftueStepId === 'world\.garden_arrival' \|\| ftueStepId === 'world\.seed_planted'/);
  assert.match(screen, /artTargetRef: glowCurrencyArtRef/);
});

test('mist reveal spends 40 Glow once and atomically queues the unknown resident discovery', () => {
  const initial = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 100 };
  const result = reduceMergeWorld(initial, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId: 'reveal-once', now: NOW });
  assert.equal(result.changed, true);
  assert.equal(result.state.coins, 60);
  assert.equal(result.state.haven.mossproutNatureIslands['bloom-garden'], 0);
  assert.equal(result.state.haven.mossproutNatureIslandReveals['bloom-garden']?.paid, 40);
  assert.equal(result.storyWorldMutationReceipt?.transition, 'island_reveal');
  assert.equal(result.state.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.discoveryRevealSeenAt, null);
  const replay = reduceMergeWorld(result.state, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId: 'reveal-once', now: NOW + 1 });
  assert.equal(replay.state.coins, 60);
  assert.equal(replay.storyWorldMutationReceipt?.id, 'reveal-once');
});

test('every request and Petalimp return happen before its matching restoration', () => {
  let state = revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 500 });
  state = reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: NOW + 1 }).state;
  state = startAndServe(state, 1);
  assert.equal(petalimpIslandChapterStatus(state, 1), 'return_ready');
  assert.equal(worldUpgradeOffers(state).find((offer) => offer.id === 'nature:bloom-garden')!.eligible, false);
  state = acknowledgeReturn(state, 1);
  assert.equal(petalimpIslandChapterStatus(state, 1), 'restoration_ready');
  const levelOne = worldUpgradeOffers(state).find((offer) => offer.id === 'nature:bloom-garden')!;
  assert.equal(levelOne.nextLevel, 1); assert.equal(levelOne.cost, 0); assert.equal(levelOne.economyMode, 'free');
  const before = state.coins;
  state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 1,
    economyMode: 'free', receiptId: 'restore:first', now: NOW + 2 }).state;
  assert.equal(state.coins, before);
  assert.equal(petalimpIslandChapterStatus(state, 1), 'resolution_ready');
  state = reduceMergeWorld(state, { type: 'completeIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, level: 1, now: NOW + 3 }).state;
  const levelTwo = worldUpgradeOffers(state).find((offer) => offer.id === 'nature:bloom-garden')!;
  assert.equal(levelTwo.nextLevel, 2); assert.equal(levelTwo.cost, 60); assert.equal(levelTwo.eligible, false);
  state = startAndServe(state, 2);
  assert.equal(petalimpIslandChapterStatus(state, 2), 'return_ready');
  state = acknowledgeReturn(state, 2);
  assert.equal(petalimpIslandChapterStatus(state, 2), 'restoration_ready');
  state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level: 2,
    receiptId: 'grow:two', now: NOW + 4 }).state;
  assert.equal(state.coins, before - 60);
  assert.equal(petalimpIslandChapterStatus(state, 2), 'resolution_ready');
});

test('a served Petalimp request becomes one persistent island return note without waking legacy Mossprout story', () => {
  let state = revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 500 });
  state = reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: NOW + 1 }).state;
  const order = petalimpIslandChapterOrder(1, NOW + 2)!;
  state = reduceMergeWorld(state, { type: 'activateIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    islandId: 'bloom-garden', residentSkinId: 'petalimp', level: 1, orders: [order], now: NOW + 2 }).state;

  const waitingOffer = worldUpgradeOffers(state).find((offer) => offer.id === 'nature:bloom-garden')!;
  assert.equal(waitingOffer.eligible, false);
  assert.equal(waitingOffer.markerSkinId, 'petalimp');
  assert.equal(visibleWorldUpgradeOffers([waitingOffer], undefined, null).length, 1, 'Petalimp remains visible while the request is active');

  const board = [...state.board];
  let cursor = 0;
  for (const requirement of order.requirements) for (let count = 0; count < requirement.quantity; count += 1) {
    while (board[cursor]?.locked || board[cursor]?.occupant) cursor += 1;
    board[cursor] = { ...board[cursor]!, occupant: { kind: 'item', instanceId: `petalimp:${cursor}`, definitionId: requirement.definitionId } };
    cursor += 1;
  }
  const served = reduceMergeWorld({ ...state, board }, { type: 'serveOrder', orderId: order.id, now: NOW + 3 }).state;
  assert.equal(petalimpIslandReturnLevel(served), 1);
  assert.ok(served.externalRewardReceipts.some((receipt) => receipt.kind === 'story_order_served' && receipt.sourceId === PETALIMP_ISLAND_CAMPAIGN_ID));
  assert.equal(served.externalRewardReceipts.some((receipt) => receipt.kind === 'conversation' && receipt.sourceId === order.chapterId), false);

  const mergeScreen = readFileSync(resolve(root, 'components/katchadeck/games/merge-world-screen.tsx'), 'utf8');
  assert.match(mergeScreen, /title: 'Meet me at Bloom Garden'/);
  assert.match(mergeScreen, /portraitSkinId: 'petalimp'/);
  assert.doesNotMatch(mergeScreen, /servedOrder\?\.storyArcId === 'island-campaign:petalimp-bloom'[\s\S]{0,300}?router\.dismissTo/);
  assert.match(mergeScreen, /returnToPetalimpIsland[\s\S]*?router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/,
    'the Petalimp return clears the old interaction stack instead of revealing Mossprout');
  const provider = readFileSync(resolve(root, 'features/merge-world/merge-world-provider.tsx'), 'utf8');
  assert.match(provider, /receipt\.sourceId === PETALIMP_ISLAND_CAMPAIGN_ID\) return/);
  assert.match(provider, /servedOrder\?\.storyArcId === PETALIMP_ISLAND_CAMPAIGN_ID\) return relationships/);
  assert.match(provider, /servedOrder\?\.storyArcId !== PETALIMP_ISLAND_CAMPAIGN_ID[\s\S]*?reconcileFeaturedStory/,
    'Petalimp orders never reconcile the legacy Mossprout journey');

  const content = normaliseCompanionContentState({
    ...emptyCompanionContentState(),
    conversationSignals: [{
      id: 'conversation-signal:merge:mossprout:petalimp-bloom-level-1', kind: 'bond', familyId: 'mossprout',
      sourceId: 'petalimp-bloom-level-1', dayId: '2026-09-08', createdAt: NOW, expiresAt: NOW + 1000,
    }],
  });
  assert.equal(content.conversationSignals.length, 0, 'old Petalimp receipts cannot interrupt the island return');
});

test('Petalimp card is earned only after the complete four-level Welcome Garden story', () => {
  let state = revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 });
  state = reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: NOW + 1 }).state;
  for (const level of [1, 2, 3, 4] as const) {
    state = startAndServe(state, level);
    state = acknowledgeReturn(state, level);
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'bloom-garden', level,
      ...(level === 1 ? { economyMode: 'free' as const } : {}), now: NOW + 30 + level }).state;
    assert.equal(petalimpIslandChapterStatus(state, level), 'resolution_ready');
    assert.equal(state.ownedKatchimeraCards.some((card) => card.cardId === 'petalimp'), false);
    state = reduceMergeWorld(state, { type: 'completeIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
      level, now: NOW + 40 + level }).state;
    if (level < 4) assert.equal(state.ownedKatchimeraCards.some((card) => card.cardId === 'petalimp'), false);
  }
  assert.equal(state.ownedKatchimeraCards.find((card) => card.cardId === 'petalimp')?.acquisition, 'island_campaign');
  assert.equal(state.islandCampaigns![PETALIMP_ISLAND_CAMPAIGN_ID]!.cardRevealSeenAt, null);
});

test('v22 campaign saves migrate to a visible garden without duplicate ownership', () => {
  const raw = createInitialMergeWorldState(NOW, ['mossprout']);
  (raw as { version: number }).version = 22;
  raw.haven.mossproutNatureIslands['bloom-garden'] = 2;
  const migrated = normalizeMergeWorldState(JSON.parse(JSON.stringify(raw)), NOW);
  assert.equal(migrated.version, 23);
  assert.ok(migrated.haven.mossproutNatureIslandReveals['bloom-garden']);
  assert.equal(normalizeMergeWorldState(JSON.parse(JSON.stringify(migrated)), NOW).ownedKatchimeraCards.filter((card) => card.cardId === 'petalimp').length, 0);
});

test('legacy in-progress chapters resume at the correct return boundary', () => {
  let state = revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 500 });
  state = reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: NOW + 1 }).state;
  state = startAndServe(state, 1);
  const raw = JSON.parse(JSON.stringify(state));
  delete raw.islandCampaigns[PETALIMP_ISLAND_CAMPAIGN_ID].chapters['1'].selectedOptionId;
  delete raw.islandCampaigns[PETALIMP_ISLAND_CAMPAIGN_ID].chapters['1'].returnConversationSeenAt;
  const migrated = normalizeMergeWorldState(raw, NOW + 10);
  assert.equal(petalimpIslandChapterStatus(migrated, 1), 'return_ready');
  assert.equal(migrated.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.chapters['1']?.selectedOptionId, null);
  assert.equal(migrated.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.chapters['1']?.returnConversationSeenAt, null);
});

test('Petalimp is available immediately while Fernip inherits the Journey Day 2 island lock', () => {
  assert.equal(MOSSPROUT_CAMPAIGN_EPISODES[1]?.guestSkinId, 'fernip');
  assert.match(FERNIP_ISLAND_LOCK_REASON, /Journey Day 2/);
  assert.equal(fernipIslandJourneyUnlocked({ journeyDays: [] }), false);
  assert.equal(fernipIslandJourneyUnlocked({ journeyDays: [{ familyId: 'mossprout', beatId: 'quiet-patch:pond-knock', status: 'complete' }] }), true);
});
