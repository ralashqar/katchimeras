import { islandFallbackResolution, islandFallbackReturn } from '@/constants/island-campaigns/helpers';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { resolve } from 'node:path';

import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { PETALIMP_BLOOM_CAMPAIGN, PETALIMP_ISLAND_CAMPAIGN_ID, PETALIMP_ISLAND_CHAPTERS, petalimpGrowthStyle, petalimpIslandChapterOrder, petalimpIslandChapterStatus, petalimpIslandResolutionConversationId, petalimpIslandReturnConversationId, petalimpIslandReturnLevel, petalimpIslandUpgradePanelState } from '@/constants/petalimp-island-campaign';
import { ISLAND_WAKE_ORDER, islandWakeBlocker, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { islandCampaignOpeningConversationId, islandCampaignPreviousStyle } from '@/constants/island-campaigns/helpers';
import { acknowledgeChapterReturn, completeChapter, completeIslandCampaign, completeRestoration, greetIslandFriend, restoreIslandLevel, revealIsland, startAndServeChapter } from './helpers/island-campaign';
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

test('Petalimp keeps prices out of her mouth and remembers the previous answer', () => {
  for (const chapter of PETALIMP_ISLAND_CHAPTERS) {
    for (const choice of chapter.choices) assert.doesNotMatch(choice.returnLine, /\d+ Glow/, `${choice.id} leaves the cost to the panel`);
    if (chapter.level === 1) {
      assert.equal(chapter.callbackLine, undefined);
      for (const choice of chapter.choices) assert.match(choice.returnLine, /gift/, `${choice.id} makes the first restoration a gift`);
    } else {
      for (const style of PETALIMP_BLOOM_CAMPAIGN.payoff.styles) {
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
  assert.equal(islandCampaignOpeningConversationId(PETALIMP_BLOOM_CAMPAIGN, 1, null), PETALIMP_ISLAND_CHAPTERS[0]!.conversationId);
  assert.equal(islandCampaignOpeningConversationId(PETALIMP_BLOOM_CAMPAIGN, 2, 'gentle'), `${PETALIMP_ISLAND_CHAPTERS[1]!.conversationId}:after-gentle`);
  let state = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 500 }, PETALIMP_BLOOM_CAMPAIGN, NOW), PETALIMP_BLOOM_CAMPAIGN, NOW);
  assert.equal(islandCampaignPreviousStyle(state, PETALIMP_BLOOM_CAMPAIGN, 2), null);
  state = completeChapter(restoreIslandLevel(completeRestoration(acknowledgeChapterReturn(startAndServeChapter(state, PETALIMP_BLOOM_CAMPAIGN, 1, NOW, 1), PETALIMP_BLOOM_CAMPAIGN, 1, NOW), PETALIMP_BLOOM_CAMPAIGN, 1, NOW), PETALIMP_BLOOM_CAMPAIGN, 1, NOW), PETALIMP_BLOOM_CAMPAIGN, 1, NOW);
  assert.equal(islandCampaignPreviousStyle(state, PETALIMP_BLOOM_CAMPAIGN, 2), 'curious');
  const log = petalimpIslandUpgradePanelState(state)!;
  assert.deepEqual(log.completedChapters.map((entry) => entry.level), [1]);
  assert.equal(log.completedChapters[0]?.summary, PETALIMP_ISLAND_CHAPTERS[0]!.summary, 'the log says what happened, not the last line said');
  // A friend never asks for Glow: the Mist pays it, her island is freed by playing.
  const waiting = petalimpIslandUpgradePanelState({ ...state, coins: 10 })!;
  assert.equal(waiting.status, 'available');
  assert.equal(waiting.stateLabel, 'Choose how this part of the garden should grow.');
  assert.doesNotMatch(waiting.voicedStateLabel, /Glow/);
  assert.equal(waiting.actionCost, 0);
  // Her second chapter plays as its levels once its story is heard: no beds, no request, no board.
  state = startAndServeChapter(state, PETALIMP_BLOOM_CAMPAIGN, 2, NOW);
  assert.equal(petalimpIslandUpgradePanelState(state)!.status, 'mission_available');
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
  assert.match(finalSession.insightResult?.reflection ?? '', /One small flower at a time/);
  assert.deepEqual(finalSession.insightResult?.supportingTraits, ['We went small']);
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
  assert.match(screen, /interactionNatureIslandId=\{pendingIslandCampaign\?\.campaign\.islandId \?\? null\}/,
    'every island narrative focuses its island instead of Mossprout');
  assert.match(screen, /preserveInteractionCameraOnExit=\{Boolean\(pendingIslandCampaign \|\| eventSelection \|\| interactionExitHandsOver\)\}/,
    'island handoffs retain the island close-up for restoration');
  assert.doesNotMatch(screen, /setPendingIslandCampaign\(null\);\s*openGarden\(activeOrderId/,
    'the Merge handoff cannot expose Mossprout focus between the narrative and route cover');
  assert.match(screen, /interactionRewardPulseKey=\{pendingIslandCampaign \? 0 : interactionRewardPulseKey\}/,
    'island conversations cannot shake the hidden Mossprout host');
  const canvas = readFileSync(resolve(root, 'components/katchadeck/world/kingdom-hex-canvas.tsx'), 'utf8');
  assert.match(canvas, /if \(preserveInteractionCameraOnExit\) \{[\s\S]*?onComplete\(\);[\s\S]*?return;/);
  assert.match(canvas, /if \(!interactionResidentId \|\| interactionNatureIslandId\) return null;/,
    'island narratives never project Mossprout as their visible interaction subject');
  assert.match(canvas, /showReaction=\{!upgradePresentation\.natureIslandId\}/,
    'nature islands can never render upgrade reaction speech over their tile');
  // Fitting the whole island tile into the viewport (a padded `focusFrame`
  // fit) computes a far lower scale than a resident close-up, since the
  // island's art is wide — the friend's island read as "far away" next to
  // Mossprout and Steppling. Frame it the same way instead: a fixed
  // near-max zoom centred on the tile, not a fit-to-frame. Not
  // `cameraMaximumScale` though — any resident interaction boosts that to
  // the egg/portrait rest zoom, which crops far too tight on a whole tile.
  assert.match(canvas, /if \(interactionNatureIslandId && islandFrame\) \{[\s\S]*?focusTutorialResident\([\s\S]*?islandFrame\.left \+ islandFrame\.width \/ 2,[\s\S]*?islandFrame\.top \+ islandFrame\.height \/ 2,[\s\S]*?anchorY: residentInteractionScreenAnchorY,[\s\S]*?zoom: KINGDOM_RENDERING\.havenMaxScale,/);
  const route = readFileSync(resolve(process.cwd(), 'components/katchadeck/world/katchimera-companion-route-screen.tsx'), 'utf8');
  const interaction = readFileSync(resolve(process.cwd(), 'components/katchadeck/world/companion-interaction-sheet.tsx'), 'utf8');
  assert.match(route, /suppressWorldSpeech=\{hostedNarrativeRequired\}/,
    'hosted friend-island stories suppress the reused companion speech layer for their full lifetime');
  assert.match(route, /hostedNarrativeOnly=\{hostedNarrativeRequired\}/,
    'hosted friend-island stories enter a narrative-only renderer instead of the Mossprout interaction page');
  assert.match(interaction, /showSpeechBubble=\{!props\.suppressWorldSpeech &&/,
    'suppressed island speech cannot mount while the narrative overlay prepares or hands off');
  assert.match(interaction, /props\.hostedNarrativeOnly && \(!conversationExperience \|\| route\.kind !== 'conversation'\)[\s\S]*?\? null/,
    'the narrative-only renderer stays blank before hydration and after conversation completion');
  assert.match(interaction, /!props\.hostedNarrativeOnly && dashboardRouteActive/,
    'Mossprout action UI cannot render during a friend-island narrative handoff');
  assert.match(canvas, /!upgradePresentation\?\.natureIslandId[\s\S]*?upgradePresentation\?\.creatureId === tile\.companion\.creature\.creatureId/,
    'nature-island upgrades never shake Mossprout as their celebration actor');
  assert.match(screen, /onCovered: closeResidentInteraction,[\s\S]*?navigate: \(\) => \{[\s\S]*?setSelectedUpgrade\(null\);[\s\S]*?router\.push/,
    'Merge navigation retains the island close-up until the source scene is covered');
  assert.match(screen, /onGarden=\{\(\) => \{ openGarden\(\); \}\}/,
    'the insufficient-Glow action cannot restore the upgrade camera before navigation begins');
  assert.doesNotMatch(screen, /resumePetalimpIslandCampaign/,
    'Petalimp markers and island taps cannot bypass the upgrade panel');
  assert.match(screen, /campaignState=\{islandCampaignPanelState\}/);
  assert.match(screen, /onCampaignAction=\{islandCampaignPanelState\?\.actionLabel \? handleIslandCampaignPanelAction : undefined\}/);
  assert.match(screen, /const handleUpgradeOfferPress[\s\S]{0,160}?openUpgradeOffer\(offer\)/,
    'every upgrade-marker press opens the shared panel first');
  assert.match(canvas, /!upgradeCameraCommitted\.current && !preserveUpgradeCamera/,
    'panel-to-island-story handoffs cannot briefly restore the overview camera');
});

test('an upgrade marker sits inside the camera gesture detector, not after it', () => {
  // A Pressable rendered outside the camera's GestureDetector subtree never
  // sees a touch that starts on it — the marker's own Pressable claims it
  // exclusively, so dragging from on top of a marker could not pan or pinch
  // the world at all. Every other world hit target (nature islands, the
  // gateway, memory plants) already lives inside the detector and drags
  // through it fine; markers need the same placement, not new gesture code.
  const canvas = readFileSync(resolve(root, 'components/katchadeck/world/kingdom-hex-canvas.tsx'), 'utf8');
  const detectorOpen = canvas.indexOf('<GestureDetector');
  const detectorClose = canvas.indexOf('</GestureDetector>');
  const markerRender = canvas.indexOf('upgradeOffers.map((offer) => {');
  assert.ok(detectorOpen >= 0 && detectorClose > detectorOpen, 'the camera GestureDetector is present');
  assert.ok(markerRender >= 0, 'the upgrade-marker render block is present');
  assert.ok(markerRender > detectorOpen && markerRender < detectorClose,
    'WorldUpgradeMarker must render between the GestureDetector\'s open and close tags');
  assert.equal(canvas.indexOf('upgradeOffers.map((offer) => {', markerRender + 1), -1,
    'the marker render block must not also exist a second time outside the detector');
});

test('the campaign auto-transition guard never keys on mergeWorld.revision', () => {
  // That counter bumps on every command in the game, including ones with
  // nothing to do with a given campaign (an energy tick, an unrelated
  // merge). Keying the "already handled" guard on it meant the guard reset
  // itself the instant anything else happened in the game — even mid
  // conversation — so the same narrative could be torn down and reopened
  // before it ever reached its own completion callback. Its chapter would
  // then never persist as complete, and the whole reward beat would replay
  // forever, once per unrelated tick and again every time the Kingdom
  // screen remounted. The guard must key on the campaign's own `status`
  // instead, which only changes when this chapter's own progress does.
  const screen = readFileSync(resolve(root, 'components/katchadeck/roster/katchimera-kingdom-screen.tsx'), 'utf8');
  assert.doesNotMatch(screen, /campaignAutoTransitionRef[\s\S]{0,400}mergeWorld\.revision/,
    'no campaign auto-transition key may depend on the global revision counter');
  assert.match(screen, /const key = `return:\$\{campaign\.campaignId\}:\$\{chapter\.level\}:\$\{status\}`/);
  // The chapter is in the key: fired keys are kept in a set (two friends' stories can run at once), so a key without
  // its level would stop the same friend's next stage from ever continuing on its own.
  assert.match(screen, /const key = `restore:\$\{campaign\.campaignId\}:\$\{chapter\.level\}:\$\{status\}`/);
  assert.match(screen, /const key = `restore-board:\$\{campaign\.campaignId\}:\$\{chapter\.level\}:\$\{status\}`/);
  assert.match(screen, /const key = `resolution:\$\{campaign\.campaignId\}:\$\{chapter\.level\}:\$\{status\}`/);
});

test('island narrative completion cannot leak into Mossprout action-card rewards', () => {
  const completion = readFileSync(resolve(root, 'game/katchimeras/action-completion.ts'), 'utf8');
  const questHook = readFileSync(resolve(root, 'hooks/use-kingdom-quests.ts'), 'utf8');
  assert.match(completion, /definition\.tags\?\.includes\('island-campaign'\) && !session\.actionOrigin/,
    'the durable action boundary rejects campaign-owned dialogue without an explicit action origin');
  assert.match(questHook, /definition\.tags\?\.includes\('island-campaign'\) && !session\.actionOrigin/,
    'the conversation recovery effect does not repeatedly submit campaign-owned dialogue');
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

test('the mist reveal is free, once, and atomically queues the unknown resident discovery', () => {
  const initial = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 100 };
  const result = reduceMergeWorld(initial, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId: 'reveal-once', now: NOW });
  assert.equal(result.changed, true);
  assert.equal(result.state.coins, 100, 'a friend’s mist lifts by playing, never for Glow');
  assert.equal(result.state.haven.mossproutNatureIslands['bloom-garden'], 0);
  assert.equal(result.state.haven.mossproutNatureIslandReveals['bloom-garden']?.paid, 0);
  assert.equal(result.storyWorldMutationReceipt?.transition, 'island_reveal');
  assert.equal(result.state.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.discoveryRevealSeenAt, null);
  const replay = reduceMergeWorld(result.state, { type: 'revealMossproutNatureIsland', islandId: 'bloom-garden', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    residentSkinId: 'petalimp', cost: 40, receiptId: 'reveal-once', now: NOW + 1 });
  assert.equal(replay.state.coins, 100);
  assert.equal(replay.storyWorldMutationReceipt?.id, 'reveal-once');
});

test('Petalimp card is earned only after the complete four-level Welcome Garden story', () => {
  let state = revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 });
  state = reduceMergeWorld(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: NOW + 1 }).state;
  for (const level of [1, 2, 3, 4] as const) {
    state = startAndServeChapter(state, PETALIMP_BLOOM_CAMPAIGN, level, NOW + level);
    state = acknowledgeReturn(state, level);
    state = completeRestoration(state, PETALIMP_BLOOM_CAMPAIGN, level, NOW + 20 + level);
    state = restoreIslandLevel(state, PETALIMP_BLOOM_CAMPAIGN, level, NOW + 30 + level);
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
  assert.equal(migrated.version, 25);
  assert.ok(migrated.haven.mossproutNatureIslandReveals['bloom-garden']);
  assert.equal(normalizeMergeWorldState(JSON.parse(JSON.stringify(migrated)), NOW).ownedKatchimeraCards.filter((card) => card.cardId === 'petalimp').length, 0);
});

test('Petalimp is available immediately while every other island sleeps until she is home', () => {
  assert.equal(ISLAND_WAKE_ORDER[0]?.islandId, 'bloom-garden');
  assert.equal(MOSSPROUT_CAMPAIGN_EPISODES[1]?.guestSkinId, 'fernip');
  const fresh = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 1000 };
  assert.equal(islandWakeState(fresh, 'bloom-garden'), 'open');
  assert.equal(islandWakeState(fresh, 'wildgrowth-grove'), 'sleeping');
  const wildgrowthReveal = worldUpgradeOffers(fresh).find((offer) => offer.id === 'nature:wildgrowth-grove');
  assert.equal(wildgrowthReveal?.eligible, false);
  assert.equal(wildgrowthReveal?.sleepingSkinId, 'fernip');
  assert.match(wildgrowthReveal?.lockedReason ?? '', /Bring Petalimp home first/);
  assert.equal(reduceMergeWorld(fresh, { type: 'upgradeMossproutNatureIsland', islandId: 'wildgrowth-grove', level: 1, now: NOW }).changed, false);
  const home = completeIslandCampaign(fresh, PETALIMP_BLOOM_CAMPAIGN, NOW);
  assert.equal(islandWakeState(home, 'bloom-garden'), 'revealed');
  assert.equal(islandWakeBlocker(home, 'wildgrowth-grove'), null, 'Petalimp being home is what lets the next island wake');
});

test('Petalimp speaks in the Mist’s voice rules: no exclamation near the Mist, the wisps named once per chapter, the Mist always capitalised', () => {
  const campaign = PETALIMP_BLOOM_CAMPAIGN;
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
  for (const line of [copy.discoveryDialogue, copy.revealReactionLine, copy.mistDescription, copy.wakeHandoffLine, copy.sleepingHint, islandFallbackReturn(campaign, 'x'), islandFallbackResolution(campaign, 1), islandFallbackResolution(campaign, 4), ...(copy.wispLines ? [copy.wispLines.firstStrike, ...copy.wispLines.fell, copy.wispLines.last] : [])]) {
    assert.doesNotMatch(line, /\bmist\b/, line);
    if (/Mist/.test(line)) assert.doesNotMatch(line, /!/, line);
  }
  assert.ok(copy.wispLines && copy.wispLines.fell.length >= 3, 'four wisps need three falling lines before the last');
});

test('Petalimp\u2019s island is played as authored levels: two a chapter, each with its Seed Pod, the Colour Thief last', async () => {
  const { regionLadder } = await import('@/constants/island-campaigns/ladder');
  const ladder = regionLadder(PETALIMP_BLOOM_CAMPAIGN);
  assert.equal(ladder[0]!.mission.title, 'Lift the Mist');
  for (const level of [1, 2, 3, 4]) assert.equal(ladder.filter((rung) => rung.chapterLevel === level).length, 2, `chapter ${level} has two levels`);
  assert.ok(ladder.every((rung) => rung.mission.encounter.spawners.some((spawner) => spawner.id === 'pod')), 'every level has its Seed Pod');
  assert.ok(ladder.every((rung) => !rung.mission.encounter.cache), 'no piece ever arrives by itself');
  assert.equal(ladder.at(-1)!.mission.title, 'The Colour Thief');
  assert.equal(ladder.at(-1)!.boss, true);
});

test('a save mid-board or mid-request from before the levels reads as its chapter\u2019s levels', () => {
  let state = greetIslandFriend(revealBloom({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 500 }), PETALIMP_BLOOM_CAMPAIGN, NOW + 1);
  state = startAndServeChapter(state, PETALIMP_BLOOM_CAMPAIGN, 1, NOW + 2);
  assert.equal(petalimpIslandChapterStatus(state, 1), 'mission_available');
  assert.equal(petalimpIslandUpgradePanelState(state)!.action, 'enter_mist');
});
