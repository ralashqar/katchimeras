import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { SHARED_WORLD_TILES } from '@/constants/shared-world';
import { mergeLessonEvidenceReady } from '@/features/content-flow/merge-lesson-recipe';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { GLOW_ECHO_IDS, GLOW_GATEWAY_ID, GLOW_ORDER_IDS, glowGatewayState, glowDiscoveryOrder } from '@/utils/merge-world/glow-discovery-policy';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryAllowsGarden, glowDiscoveryBoardStep, glowDiscoveryLessonReady, glowDiscoveryRevealLocked, glowDiscoveryLocksCamera, GLOW_LESSON } from '@/features/onboarding/glow-discovery-flow';
import { ftueLocksCamera } from '@/features/onboarding/ftue-camera-policy';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import { worldActionScene } from '@/features/content-flow/story-world-operations';
import { createContentFlowRun, reduceContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';

const NOW = Date.UTC(2026, 8, 3, 12);

test('Glow Garden handoff stays actionable under the world navigation lock, including lesson resume', () => {
  for (const nodeId of ['garden.open', 'lesson.prepare', 'lesson.spawn', 'lesson.repeat.serve']) {
    assert.equal(glowDiscoveryLocksCamera({ nodeId, status: 'active' }), true);
    assert.equal(glowDiscoveryAllowsGarden({ nodeId, status: 'active' }), true);
    assert.equal(glowDiscoveryAllowsGarden({ nodeId, status: 'failed_recoverable' }), true);
    assert.equal(glowDiscoveryAllowsGarden({ nodeId, status: 'completed' }), false);
  }
  for (const nodeId of ['gateway.focus', 'gateway.offer', 'gateway.buy', 'gateway.egg', 'egg.enter']) {
    assert.equal(glowDiscoveryAllowsGarden({ nodeId, status: 'active' }), false);
  }
  assert.equal(glowDiscoveryAllowsGarden(null), false);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /disabled=\{navigationLocked && !glowDiscoveryAllowsGarden\(glowRun\)/);
  assert.match(screen, /if \(!glowReady \|\| !stepplingLesson.ready\) return null;[\s\S]*<KingdomHexCanvas/);
});
test('meditation handoff hides normal interaction UI before the durable FTUE step advances', () => {
  const source = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  assert.match(source, /import \{[^}]*\buseState\b[^}]*\} from 'react';/);
  assert.match(source, /setMistHandoffActive\(true\);[\s\S]*?await advanceFtueActionDurably\(\{ expectedStepId: 'companion.meditating'/);
  assert.match(source, /if \(mistHandoffActive \|\| pendingMistExit\) return <View/);
  assert.match(source, /catch \{\s*setMistHandoffError\(true\)/);
  assert.doesNotMatch(source, /finally\([^;]*setMistHandoffActive\(false\)/);
});
test('enough Glow highlights the HUD with an actionable Egg bubble instead of a banner', () => {
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const guide = readFileSync('components/katchadeck/games/merge-glow-ready-guide.tsx', 'utf8');
  assert.doesNotMatch(screen, /40 Glow ready/);
  assert.match(screen, /view.kind === 'return' && !serveFlight \? <MergeGlowReadyGuide/);
  assert.match(screen, /currencyRef=\{coinHudRef\}/);
  assert.match(screen, /await submitGlowAction\(glowScene.actionId\);\s*returnFromGarden\(\);/);
  assert.match(guide, /roundedMultiCutoutSegments\(\[layout.target\]/);
  assert.match(guide, /<MergeFtueEggGuide anchor=\{layout.target\}/);
  assert.match(guide, /label="Let’s go!" loading=\{busy\}/);
  assert.match(guide, /catch \{ setError\(true\); setBusy\(false\); \}/);
  const bubble = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.match(bubble, /eggGuideContentRow: \{[^\n]*flexShrink: 0/);
  assert.match(bubble, /eggGuideActionRow: \{[^\n]*flexShrink: 0/);
  assert.match(bubble, /width: hideAvatar \? calloutWidth - 24 : calloutWidth - 24 - 76 - 9/);
  assert.doesNotMatch(bubble, /minHeight: estimatedHeight/);
  assert.match(bubble, /onLayout=\{\(event\) => setMeasuredHeight/);
});
test('Egg reveal keeps the camera locked through final Continue and recovery, then releases it', () => {
  const nodes = GLOW_DISCOVERY_FLOW.nodes.filter((node) => node.id.startsWith('gateway.purchase.') || ['gateway.return', 'gateway.buy', 'gateway.egg', 'complete'].includes(node.id));
  assert.ok(nodes.some((node) => node.id === 'gateway.egg'));
  for (const { id: nodeId } of nodes) {
    for (const status of ['active', 'failed_recoverable'] as const) {
      assert.equal(glowDiscoveryRevealLocked({ nodeId, status }), true, `${nodeId}:${status}`);
      assert.equal(glowDiscoveryRevealLocked(JSON.parse(JSON.stringify({ nodeId, status }))), true);
    }
    assert.equal(glowDiscoveryRevealLocked({ nodeId, status: 'completed' }), false);
  }
  assert.equal(glowDiscoveryRevealLocked(null), false);
  assert.equal(glowDiscoveryRevealLocked({ nodeId: 'garden.open', status: 'active' }), false);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const guide = readFileSync('components/katchadeck/world/glow-gateway-guide.tsx', 'utf8');
  assert.match(screen, /cameraLocked=\{ftueLocksCamera\(ftueStep\) \|\| glowDiscoveryLocksCamera\(glowRun\)/);
  assert.match(guide, /!glowDiscoveryLocksCamera\(run\) \? <Pressable/);
});
test('every guided step locks camera input until it advances, with an author opt-out', () => {
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    assert.equal(ftueLocksCamera(step), step.id !== 'complete', step.id);
    assert.equal(ftueLocksCamera({ ...step, lockCamera: false }), false);
  }
  assert.equal(ftueLocksCamera(null), false);
  for (const node of GLOW_DISCOVERY_FLOW.nodes) {
    assert.equal(glowDiscoveryLocksCamera({ nodeId: node.id, status: 'active' }), true, node.id);
    assert.equal(glowDiscoveryLocksCamera({ nodeId: node.id, status: 'failed_recoverable' }), true);
    assert.equal(glowDiscoveryLocksCamera({ nodeId: node.id, status: 'completed' }), false);
  }
  const scene = worldActionScene({ id: 'free', actionId: 'next', next: 'complete', view: {
    kind: 'goal', actionLabel: 'Continue', guide: { eyebrow: '', title: '', body: '' }, lockCamera: false,
  } });
  assert.ok(scene.kind === 'scene');
  assert.equal((scene.payload?.worldAction as { lockCamera: boolean }).lockCamera, false);
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /interactionEnabled && !cameraLocked && !storyCameraInputLocked \? \(/);
  assert.match(canvas, /residentInteractionEnabled && !cameraLocked \? camera.focusResident/);
});
const reload = (state: MergeWorldState) => normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);
const cells = (state: MergeWorldState, tier: number) => state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === `nature:garden:${tier}` ? [index] : []);
function apply(state: MergeWorldState, command: MergeWorldCommand) {
  const result = reduceMergeWorld(state, command);
  assert.equal(result.changed, true, `${command.type}: ${result.message}`);
  return reload(result.state);
}
function firstBloom() {
  let state = createMossproutChapterZeroState(NOW);
  assert.equal(state.coins, 0);
  for (const tier of [1, 1, 2]) {
    const [from, to] = cells(state, tier);
    state = apply(state, { type: 'move', from, to, now: NOW });
  }
  state = apply(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:first-sprout', now: NOW });
  assert.equal(state.coins, 20);
  state = apply(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, receiptId: 'test:first-restore', now: NOW });
  assert.equal(state.coins, 0);
  assert.deepEqual(Object.values(state.haven.mossproutNatureIslands), [0, 0, 0, 0, 0, 0]);
  return state;
}

test('one Glow request starts with two Seeds, survives reloads, and pays for mist', () => {
  let state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  assert.equal(state.activeOrders.filter((order) => order.storyArcId === 'mossprout:glow-discovery').length, 1);
  assert.equal(state.activeOrders.some((order) => order.id === GLOW_ORDER_IDS[0]), false);
  const order = state.activeOrders.find((order) => order.id === GLOW_ORDER_IDS[1])!;
  assert.deepEqual(order.requirements, [{ definitionId: 'nature:garden:5', quantity: 1 }]);
  assert.equal(order.reward.coins, 40);
  assert.equal(state.board.some((cell) => cell.mist?.kind === 'echo' && cell.mist.definitionId === 'nature:garden:1'), false);
  assert.equal(reduceMergeWorld(state, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false);
  const spawn = { type: 'tapGenerator', generatorId: 'wild-garden', spendEnergy: false, seed: 'single', now: NOW } as const;
  for (let count = 0; count < 2; count++) {
    const step = glowDiscoveryBoardStep('lesson.single.spawn', state)!;
    assert.equal(mergeFtueAllowsCommand(step, state, spawn), true);
    state = apply(state, spawn);
    assert.equal(cells(state, 1).length, count + 1);
    assert.equal(glowDiscoveryLessonReady('lesson.single.spawn', state), count === 1);
  }
  for (const beat of GLOW_LESSON.slice(1)) {
    const step = glowDiscoveryBoardStep(beat.id, state)!;
    assert.ok(step.cue);
    assert.ok(step.spotlight);
    const command: MergeWorldCommand = beat.kind === 'pair'
      ? { type: 'move', from: cells(state, 1)[0], to: cells(state, 1)[1], now: NOW }
      : beat.kind === 'match'
        ? { type: 'move', from: cells(state, Number(beat.definitionId.split(':').at(-1)))[0], to: state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === beat.echoId), now: NOW }
        : { type: 'serveOrder', orderId: GLOW_ORDER_IDS[1], now: NOW };
    assert.equal(mergeFtueAllowsCommand(step, state, command), true, beat.id);
    state = apply(state, command);
    assert.equal(glowDiscoveryLessonReady(beat.id, state), true, beat.id);
    if (beat.kind !== 'serve') assert.deepEqual(glowDiscoveryBoardStep('lesson.single.spawn', state), glowDiscoveryBoardStep(beat.id, state), 'stale journal projects the current target');
  }
  assert.deepEqual(state.glowDiscoveryLesson?.servedOrderIds, [GLOW_ORDER_IDS[1]]);
  assert.ok(state.coins >= 40, 'the single request covers the unlock, even without bonus Glow');
  const earnedGlow = state.coins;
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, null);
  assert.equal(reduceMergeWorld(state, { type: 'serveOrder', orderId: GLOW_ORDER_IDS[1], now: NOW }).changed, false);
  const board = state.board;
  state = apply(state, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'single:unlock', now: NOW });
  assert.equal(state.coins, earnedGlow - 40);
  assert.equal(glowGatewayState(state), 'egg');
  assert.deepEqual(state.board, board);
  assert.equal(state.worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, null);
  assert.equal(reduceMergeWorld(state, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'single:unlock', now: NOW }).changed, false);
});

test('old unfinished lessons become one request without deleting items or charging Glow', () => {
  const migrations = GLOW_DISCOVERY_FLOW.migrations as Record<string, string>;
  for (const id of ['lesson.prepare', 'lesson.spawn', 'lesson.seed', 'lesson.sprout', 'lesson.serve', 'lesson.repeat.prepare', 'lesson.repeat.spawn', ...[1, 2, 3, 4, 5].map((tier) => `lesson.repeat.match-${tier}`), 'lesson.repeat.serve']) {
    assert.equal(migrations[id], 'lesson.single.prepare', `resume ${id} through the new board setup`);
  }
  for (const servedOrderIds of [[], [GLOW_ORDER_IDS[0]]]) {
    const original = firstBloom();
    original.glowDiscoveryLesson = { preparedAt: NOW, servedOrderIds, guidedOrderIndex: 1 };
    original.coins = servedOrderIds.length ? 20 : 0;
    original.activeOrders = [glowDiscoveryOrder(0, NOW), { ...glowDiscoveryOrder(1, NOW), requirements: [{ definitionId: 'nature:garden:6', quantity: 1 }], reward: { coins: 20, energy: 0, mergeXp: 15, friendshipXp: 0 } }];
    const occupied = original.board.filter((cell) => cell.occupant).map((cell) => cell.occupant);
    const upgraded = apply(original, { type: 'prepareGlowDiscoveryLesson', now: NOW });
    assert.equal(upgraded.coins, original.coins);
    assert.deepEqual(upgraded.board.filter((cell) => cell.occupant).map((cell) => cell.occupant), occupied);
    assert.equal(upgraded.activeOrders.length, 1);
    assert.equal(upgraded.activeOrders[0].id, GLOW_ORDER_IDS[1]);
    assert.equal(upgraded.activeOrders[0].requirements[0].definitionId, 'nature:garden:5');
    assert.equal(upgraded.glowDiscoveryLesson?.layoutVersion, 2);
    assert.equal(reduceMergeWorld(upgraded, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false);
  }
  const completed = firstBloom();
  completed.glowDiscoveryLesson = { preparedAt: NOW, servedOrderIds: [...GLOW_ORDER_IDS] };
  assert.equal(reduceMergeWorld(completed, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false, 'completed legacy requests are never replayed');
});

test('a lost Sprout is rebuilt from two Seeds, even with an upgraded generator and Shell opportunity', () => {
  let state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state.generators['wild-garden'] = { ...state.generators['wild-garden'], level: 4, forcedDropDefinitionId: null };
  state.characterActivityOpportunities = [{ id: 'shell-basket', familyId: 'mossprout', dayId: '2026-09-03', generatorId: 'wild-garden', dropDefinitionIds: ['nature:waterside:1'], usedCount: 0, createdAt: NOW }];
  const spawn = { type: 'tapGenerator', generatorId: 'wild-garden', activityOpportunityId: 'shell-basket', spendEnergy: false, seed: 'repair', now: NOW } as const;
  for (let count = 0; count < 2; count++) {
    assert.equal(mergeFtueAllowsCommand(glowDiscoveryBoardStep('lesson.single.match-2', state)!, state, spawn), true);
    state = apply(state, spawn);
    assert.equal(cells(state, 1).length, count + 1);
    assert.equal(cells(state, 2).length, 0);
  }
  const merge = { type: 'move', from: cells(state, 1)[0], to: cells(state, 1)[1], now: NOW } as const;
  assert.equal(mergeFtueAllowsCommand(glowDiscoveryBoardStep('lesson.single.match-2', state)!, state, merge), true);
  state = apply(state, merge);
  assert.equal(cells(state, 2).length, 1);
  assert.equal(state.characterActivityOpportunities[0].usedCount, 0);
});

test('a full recovery board leaves input available to make room', () => {
  const state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state.board = state.board.map((cell, index) => cell.locked || cell.occupant || cell.mist ? cell : { ...cell, occupant: { kind: 'item', instanceId: `shell:${index}`, definitionId: 'nature:waterside:1' } });
  const step = glowDiscoveryBoardStep('lesson.single.seeds', state)!;
  assert.equal(step.interaction, undefined);
  assert.match(step.guide!.body!, /Merge or store/);
});

test('purchase only requires enough Glow; saves keep their existing balance and islands', () => {
  const purchase = { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, now: NOW } as const;
  const fresh = createMossproutChapterZeroState(NOW);
  assert.equal(reduceMergeWorld(fresh, { type: 'unlockWorldTarget', targetId: '__proto__', now: NOW }).changed, false);
  assert.equal(reduceMergeWorld({ ...fresh, coins: 100 }, purchase).changed, true);
  const restored = firstBloom();
  const poor = { ...restored, coins: 39 };
  assert.equal(reduceMergeWorld(poor, purchase).changed, false);
  assert.equal(poor.coins, 39);
  const old = { ...restored, coins: 275, haven: { ...restored.haven, mossproutNatureIslands: { ...restored.haven.mossproutNatureIslands, 'seed-nursery': 3 as const } } };
  assert.equal(reload(old).coins, 275);
  assert.equal(reload(old).haven.mossproutNatureIslands['seed-nursery'], 3);
});

test('paid mist stays revealed with an Egg despite relationship stage zero or story completion', () => {
  const paid = apply({ ...firstBloom(), coins: 40 }, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'persisted:mist', now: NOW });
  const relationshipProjection = { ...paid, haven: { ...paid.haven, tileStages: { mossprout: 0 as const } } };
  assert.equal(glowGatewayState(relationshipProjection), 'egg');
  assert.equal(glowGatewayState(reload(relationshipProjection)), 'egg');
  assert.equal(reload(relationshipProjection).worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, null);
  const repaired = reload({ ...relationshipProjection, worldUnlocks: {} });
  assert.equal(glowGatewayState(repaired), 'egg');
  assert.equal(repaired.coins, paid.coins);
  assert.equal(repaired.worldUnlocks?.[GLOW_GATEWAY_ID].paid, 40);
  assert.equal(repaired.worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, null);
  assert.equal(reduceMergeWorld(repaired, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'persisted:mist', now: NOW }).changed, false);
  // The restored Garden structure still makes unpaid mist available even if the relationship projection resets.
  assert.equal(glowGatewayState({ ...relationshipProjection, worldUnlocks: {}, storyWorldMutationReceipts: [] }), 'locked');
  assert.equal(glowGatewayState(createInitialMergeWorldState(NOW, ['mossprout'])), 'locked');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /gatewayState = glowGatewayState\(mergeWorld\)/);
  assert.match(screen, /gateway: stepplingEncounter.open \? 'egg' as const : gatewayState/);
});

test('setup boundaries never fall back to a spawner spotlight', () => {
  for (const node of ['lesson.prepare', 'lesson.repeat.prepare']) {
    const step = glowDiscoveryBoardStep(node, firstBloom())!;
    assert.equal(step.spotlight, undefined);
    assert.equal(step.cue, undefined);
    assert.equal(step.interaction?.mode, 'blocked');
    assert.ok(step.id.startsWith('glow.lesson.'));
  }
});

test('hosted meditation hands off to the existing map without a transition curtain', () => {
  const route = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const handoff = route.slice(route.indexOf('const continueToMist'), route.indexOf("if (run.stepId === 'companion.garden_intro')"));
  const hosted = handoff.slice(handoff.indexOf('if (hostedInHaven)'), handoff.indexOf('const accepted = transitionTo'));
  assert.match(handoff, /await advanceFtueActionDurably[\s\S]*?await startGlowDiscovery[\s\S]*?if \(hostedInHaven\)/);
  assert.match(hosted, /onHostedClose\?\.\(\)/);
  assert.match(handoff, /finally \{ ftueHandoffRef.current = false/);
  assert.doesNotMatch(hosted, /transitionTo|router\./);
  const camera = GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === 'gateway.focus');
  assert.equal(camera?.kind, 'presentation');
  assert.equal(camera?.payload?.zoom, 1.2);
  assert.equal(camera?.payload?.durationMs, 900);
});

test('locked tutorial matches retain half mist and spotlight cutouts survive measurement', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.doesNotMatch(board, /vineBound|mist.id.startsWith\('glow:'/);
  assert.match(board, /lockedDefinitionId \|\| rootbound \|\| residentCard \? <Image[^\n]*source=\{DREAM_MIST_LOWER\}/);
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.match(overlay, /spotlightReady = Boolean\(spotlight && currentLayout\?\.spotlightFrames.length\)/);
  assert.match(overlay, /onReadinessChange\?\.\(Boolean\(\(!cue && !spotlight\) \|\| presentationReady\)\)/);
});

test('preparing an existing board never replaces occupied cells or duplicates ownership', () => {
  const state = firstBloom();
  const full = { ...state, board: state.board.map((cell, index) => ({ ...cell, mist: null, occupant: { kind: 'item' as const, instanceId: `existing:${index}`, definitionId: 'nature:garden:1' } })) };
  assert.equal(reduceMergeWorld(full, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false);
  assert.ok(full.board.every((cell) => cell.occupant.instanceId.startsWith('existing:')));
  const existing = { ...state, coins: 40, companionDiscovery: { ...state.companionDiscovery, records: [...state.companionDiscovery.records, { characterId: 'steppling' as const, source: 'legacy_grandfather' as const, gateId: 'gate-2-steppling', pathId: null, discoveredAt: NOW, revealSeenAt: NOW, firstOrderCompletedAt: NOW, permanentFeatureId: null }] } };
  const opened = apply(existing, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, now: NOW });
  assert.equal(opened.worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, NOW);
  assert.equal(reduceMergeWorld(opened, { type: 'hatchWorldEgg', targetId: GLOW_GATEWAY_ID, now: NOW }).changed, false);
});

test('discovery story has valid capabilities and resumes through each persisted boundary', () => {
  assert.deepEqual(validateContentFlowDefinition(GLOW_DISCOVERY_FLOW), []);
  let run = createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'glow-test', now: NOW });
  const visited: string[] = [];
  for (let i = 0; run.status !== 'completed' && i < 40; i++) {
    run = JSON.parse(JSON.stringify(run));
    visited.push(run.nodeId);
    const { pendingWork: work } = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'retry' });
    const node = GLOW_DISCOVERY_FLOW.nodes.find((candidate) => candidate.id === run.nodeId)!;
    if (work.kind === 'presentation') run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'presentation_acknowledged', presentationKey: work.key }).run;
    else if (work.kind === 'effect') run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'effect_completed', effectKey: work.key }).run;
    else if (node.kind === 'scene') run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'submit_scene', actionId: node.actions[0].id }).run;
    else if (node.kind === 'task') run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'record_event', event: { eventId: `event:${i}`, type: node.requirements[0].event.type, runId: run.runId, nodeId: run.nodeId, occurredAt: NOW, payload: {} } }).run;
    else assert.fail(`Unhandled ${node.id}`);
  }
  assert.equal(run.status, 'completed');
  assert.ok(visited.indexOf('gateway.purchase.commit') < visited.indexOf('gateway.purchase.reveal'));
  assert.ok(visited.indexOf('gateway.purchase.reveal') < visited.indexOf('gateway.egg'));
  assert.ok(visited.indexOf('gateway.focus') < visited.indexOf('garden.open'));
  assert.ok(!visited.includes('garden.focus'));
  assert.ok(!visited.includes('gateway.goal'));
  assert.ok(!visited.includes('gateway.return'), 'camera completion cannot gate the upgrade');
  assert.ok(visited.indexOf('gateway.offer') < visited.indexOf('gateway.buy'));
  assert.ok(!visited.some((id) => id.startsWith('steppling.') || id === 'world.choose' || id === 'egg.transfer'));
  assert.ok(visited.includes('lesson.single.prepare'));
  assert.ok(visited.includes('lesson.single.match-4'));
  assert.ok(!visited.includes('lesson.repeat.serve'));
  assert.ok(visited.indexOf('lesson.single.serve') < visited.indexOf('gateway.ready'));
  assert.equal((GLOW_DISCOVERY_FLOW.migrations as Record<string, string>)['lesson.repeat'], 'lesson.single.prepare');
});

test('a prior unlock carries into the shared reveal for free, even with a different receipt', () => {
  let state = { ...firstBloom(), coins: 40 };
  state = apply(state, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, now: NOW });
  const result = reduceMergeWorld(state, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'migrated:reveal', now: NOW });
  assert.equal(result.storyWorldMutationReceipt?.coinCost, 0);
  assert.equal(result.storyWorldMutationReceipt?.fromLevel, 1);
  assert.equal(result.state.coins, 0);
  assert.equal(reload(result.state).storyWorldMutationReceipts.at(-1)?.id, 'migrated:reveal');
  assert.equal(result.state.worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, null);
});

test('lesson evidence requires a real spawn and validates authored references', () => {
  assert.equal(mergeLessonEvidenceReady(GLOW_LESSON[0], { spawned: false, remainingEchoIds: [...GLOW_ECHO_IDS], servedOrderIds: [] }), false);
  assert.equal(mergeLessonEvidenceReady(GLOW_LESSON[0], { spawned: true, remainingEchoIds: [...GLOW_ECHO_IDS], servedOrderIds: [] }), true);
  const invalid = { ...GLOW_DISCOVERY_FLOW, nodes: GLOW_DISCOVERY_FLOW.nodes.map((node) => node.id === 'lesson.single.spawn' ? { ...node, payload: { beat: { ...GLOW_LESSON[0], generatorId: 'missing-generator' } } } : node) };
  assert.ok(validateContentFlowDefinition(invalid).some((issue) => issue.message.includes('known generator')));
  for (const old of ['egg.transfer', 'world.choose', 'steppling.hatch', 'steppling.claim'] as const) assert.equal(GLOW_DISCOVERY_FLOW.migrations?.[old], 'gateway.egg');
});

test('shared-world tile layout and presentation keep one map and one Egg reveal', () => {
  assert.deepEqual(SHARED_WORLD_TILES['steppling-home'].coord, { q: 0, r: 0 });
  assert.equal(SHARED_WORLD_TILES['steppling-home'].residentVisible, false);
  assert.deepEqual(SHARED_WORLD_TILES['mossprout-home'].coord, { q: 0, r: 1 });
  const scene = readFileSync('components/katchadeck/world/mossprout-hex-neighborhood-scene.ts', 'utf8');
  assert.match(scene, /boundsLayers = \[\.\.\.rawLayers, lockedSteppling, revealedSteppling, \.\.\.natureBoundsLayers\]/);
  assert.match(scene, /'residentVisible' in entry && !entry.residentVisible/);
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /tutorialCameraReady && storyOperationsEnabled/);
  assert.match(canvas, /gateway === 'egg' \|\| discoveredEggInteraction\) && !upgradePresentation && !storySceneGuard/);
  assert.match(canvas, /<RevealedCompanionEgg\s+idleDiscovery/);
  const route = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  assert.doesNotMatch(route, /StepplingWorldScreen|world\.choose|Following the glow/);
});
