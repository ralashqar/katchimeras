import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SHARED_WORLD_TILES } from '@/constants/shared-world';
import { mergeLessonEvidenceReady } from '@/features/content-flow/merge-lesson-recipe';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { GLOW_ECHO_IDS, GLOW_REPEAT_ECHO_IDS, GLOW_GATEWAY_ID, GLOW_ORDER_IDS, glowGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryBoardStep, glowDiscoveryLessonReady, GLOW_LESSON, GLOW_REPEAT_LESSON } from '@/features/onboarding/glow-discovery-flow';
import { createContentFlowRun, reduceContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';

const NOW = Date.UTC(2026, 8, 3, 12);
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

test('Glow teaches a repeatable loop, survives every reload, and stops at an unhatched shared-world Egg', () => {
  let state = firstBloom();
  state = apply(state, { type: 'prepareGlowDiscoveryLesson', now: NOW });
  const beforePrepare = state;
  assert.equal(reduceMergeWorld(state, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false);
  const spawn = { type: 'tapGenerator', generatorId: 'wild-garden', spendEnergy: false, seed: 'glow:1', now: NOW } as const;
  const spawnStep = glowDiscoveryBoardStep('lesson.spawn');
  assert.ok(spawnStep);
  assert.equal(mergeFtueAllowsCommand(spawnStep, state, spawn), true);
  assert.equal(mergeFtueAllowsCommand(spawnStep, state, { ...spawn, generatorId: 'wrong-generator' }), false);
  state = apply(state, spawn);
  for (const [index, echoId] of GLOW_ECHO_IDS.entries()) {
    const from = cells(state, index + 1)[0];
    const to = state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === echoId);
    const command = { type: 'move', from, to, now: NOW } as const;
    const step = glowDiscoveryBoardStep(index === 0 ? 'lesson.seed' : 'lesson.sprout');
    assert.ok(step);
    assert.equal(mergeFtueAllowsCommand(step, state, command), true);
    assert.equal(mergeFtueAllowsCommand(step, state, { ...command, from: to, to: from }), false);
    state = apply(state, command);
    assert.equal(state.board[to].locked, false);
  }
  state = apply(state, { type: 'serveOrder', orderId: GLOW_ORDER_IDS[0], now: NOW });
  assert.equal(state.coins, 20);
  assert.ok(state.activeOrders.some((order) => order.id === GLOW_ORDER_IDS[1]));
  assert.equal(reduceMergeWorld(state, { type: 'serveOrder', orderId: GLOW_ORDER_IDS[0], now: NOW }).changed, false);
  state = apply(state, { type: 'prepareGlowDiscoveryLesson', now: NOW });
  assert.equal(state.glowDiscoveryLesson?.spawnedAt, undefined);
  assert.equal(reduceMergeWorld(state, { type: 'prepareGlowDiscoveryLesson', now: NOW }).changed, false);
  assert.equal(state.activeOrders.find((order) => order.id === GLOW_ORDER_IDS[1])?.requirements[0].definitionId, 'nature:garden:6');
  // Every tap, higher-tier locked match, and Serve has an exclusive cue after reload.
  for (const beat of GLOW_REPEAT_LESSON) {
    state = reload(state);
    assert.equal(glowDiscoveryLessonReady(beat.id, state), false, beat.id);
    const step = glowDiscoveryBoardStep(beat.id, state)!;
    assert.ok(step.cue, beat.id);
    assert.ok(step.spotlight, beat.id);
    assert.equal(step.interaction?.mode, 'exclusive', beat.id);
    const command: MergeWorldCommand = beat.kind === 'spawn' ? spawn : beat.kind === 'match'
      ? { type: 'move', from: cells(state, Number(beat.definitionId.split(':').at(-1)))[0], to: state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === beat.echoId), now: NOW }
      : { type: 'serveOrder', orderId: GLOW_ORDER_IDS[1], now: NOW };
    assert.equal(mergeFtueAllowsCommand(step, state, command), true, beat.id);
    assert.equal(mergeFtueAllowsCommand(step, state, { type: 'tapGenerator', generatorId: 'wrong-generator', spendEnergy: false, seed: 'wrong', now: NOW }), false);
    state = apply(state, command);
    assert.equal(glowDiscoveryLessonReady(beat.id, state), true, beat.id);
    // Render the old journal node against the newly committed board, before its
    // asynchronous completion event: immediately project the next authored target.
    const betweenSteps = glowDiscoveryBoardStep(beat.id, state)!;
    const nextBeat = GLOW_REPEAT_LESSON[GLOW_REPEAT_LESSON.indexOf(beat) + 1];
    if (nextBeat) {
      assert.deepEqual(betweenSteps, glowDiscoveryBoardStep(nextBeat.id, state), beat.id);
      assert.ok(betweenSteps.spotlight, beat.id);
      assert.ok(betweenSteps.cue, beat.id);
      // Even a journal several steps behind cannot rewind the presentation.
      assert.deepEqual(glowDiscoveryBoardStep('lesson.repeat.spawn', state), betweenSteps);
    } else {
      assert.equal(betweenSteps.interaction?.mode, 'blocked', beat.id);
    }
    assert.equal(mergeFtueAllowsCommand(betweenSteps, state, spawn), false, beat.id);
    if (beat.kind === 'match') assert.ok(!state.board.some((cell) => cell.mist?.kind === 'echo' && cell.mist.id === beat.echoId));
  }
  assert.ok(!state.board.some((cell) => cell.mist?.kind === 'echo' && ['mossprout-plant-echo', 'mossprout-flower-echo', 'mossprout-garden-echo'].includes(cell.mist.id)));
  assert.ok(state.coins >= 40);
  const earnedGlow = state.coins;
  assert.deepEqual(state.glowDiscoveryLesson?.servedOrderIds, [...GLOW_ORDER_IDS]);
  assert.equal(state.generators['wild-garden'].forcedDropDefinitionId, null);
  assert.equal(state.haven.movementEgg.status, beforePrepare.haven.movementEgg.status);
  const purchase = { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'test:mist-reveal', now: NOW } as const;
  const boardBeforePurchase = state.board;
  const generatorsBeforePurchase = state.generators;
  state = apply(state, purchase);
  assert.equal(state.coins, earnedGlow - 40);
  assert.equal(reduceMergeWorld(state, purchase).changed, false);
  assert.equal(state.unlockedCharacters.includes('steppling'), false);
  assert.equal(state.storyWorldMutationReceipts[0]?.target.kind, 'haven_tile');
  const receipt = reduceMergeWorld(state, purchase).storyWorldMutationReceipt;
  assert.equal(receipt?.coinCost, 40);
  assert.deepEqual(receipt?.target, { kind: 'haven_structure', structureId: 'steppling-home' });
  assert.equal(state.worldUnlocks?.[GLOW_GATEWAY_ID].transferredAt, null);
  assert.equal(state.worldUnlocks?.[GLOW_GATEWAY_ID].hatchedAt, null);
  assert.equal(reduceMergeWorld(state, { type: 'hatchWorldEgg', targetId: GLOW_GATEWAY_ID, now: NOW }).changed, false);
  assert.equal(state.companionDiscovery.records.filter((record) => record.characterId === 'steppling').length, 0);
  assert.deepEqual(state.board, boardBeforePurchase);
  assert.deepEqual(state.generators, generatorsBeforePurchase);
});

test('tutorial overrides Shell rewards and repairs missing sources without deleting items', () => {
  let state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state.generators['wild-garden'] = { ...state.generators['wild-garden'], forcedDropDefinitionId: null, level: 4 };
  state.characterActivityOpportunities = [{ id: 'shell-basket', familyId: 'mossprout', dayId: '2026-09-03', generatorId: 'wild-garden', dropDefinitionIds: ['nature:waterside:1'], usedCount: 0, createdAt: NOW }];
  state.board.find((cell) => !cell.locked && !cell.mist && !cell.occupant)!.occupant = { kind: 'item', instanceId: 'legacy-wrong-shell', definitionId: 'nature:waterside:1' };
  state.glowDiscoveryLesson!.spawnedAt = NOW;
  const spawn = { type: 'tapGenerator', generatorId: 'wild-garden', activityOpportunityId: 'shell-basket', spendEnergy: false, seed: 'recovery', now: NOW } as const;
  for (const [index, echoId] of GLOW_ECHO_IDS.entries()) {
    state.board = state.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === `nature:garden:${index + 1}` ? { ...cell, occupant: null } : cell);
    state = reload(state);
    const step = glowDiscoveryBoardStep(index === 0 ? 'lesson.seed' : 'lesson.sprout', state)!;
    assert.equal(mergeFtueAllowsCommand(step, state, spawn), true);
    state = apply(state, spawn);
    assert.equal(state.characterActivityOpportunities[0].usedCount, 0);
    const from = cells(state, index + 1)[0];
    assert.notEqual(from, undefined);
    const to = state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === echoId);
    state = apply(state, { type: 'move', from, to, now: NOW });
  }
  assert.ok(state.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.instanceId === 'legacy-wrong-shell'));
  state.board = state.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:3' ? { ...cell, occupant: null } : cell);
  state = apply(state, { ...spawn, activityOpportunityId: 'stale-opportunity' });
  assert.equal(cells(state, 3).length, 1);
  state.glowDiscoveryLesson!.servedOrderIds = [...GLOW_ORDER_IDS];
  state.generators['wild-garden'].forcedDropDefinitionId = null;
  state = apply(state, spawn);
  assert.equal(state.characterActivityOpportunities[0].usedCount, 1);
  assert.equal(state.board.filter((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:waterside:1').length, 2);
});

test('old second-request saves upgrade safely and recover every missing higher-tier source', () => {
  let state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state.glowDiscoveryLesson = { preparedAt: NOW, spawnedAt: NOW, servedOrderIds: [GLOW_ORDER_IDS[0]] };
  state.coins = 20;
  const oldOrder = { ...state.activeOrders.find((order) => order.id === GLOW_ORDER_IDS[0])!, id: GLOW_ORDER_IDS[1] };
  state.activeOrders = [oldOrder];
  assert.equal(glowDiscoveryLessonReady('lesson.repeat.match-5', state), false);
  const originalHigherCells = [3, 4, 5].map((tier) => state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.definitionId === `nature:garden:${tier}`));
  state = apply(state, { type: 'prepareGlowDiscoveryLesson', now: NOW + 1 });
  assert.equal(state.coins, 20);
  assert.equal(state.activeOrders.length, 1);
  assert.equal(state.activeOrders[0].requirements[0].definitionId, 'nature:garden:6');
  assert.equal(state.glowDiscoveryLesson?.spawnedAt, undefined);
  for (const [index, slot] of originalHigherCells.entries()) assert.equal(state.board[slot].mist?.kind === 'echo' && state.board[slot].mist.id, GLOW_REPEAT_ECHO_IDS[index + 2]);
  const spawn = { type: 'tapGenerator', generatorId: 'wild-garden', activityOpportunityId: 'old-shell-reward', spendEnergy: false, seed: 'higher-recovery', now: NOW + 2 } as const;
  for (const [index, echoId] of GLOW_REPEAT_ECHO_IDS.entries()) {
    const tier = index + 1;
    state.board = state.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === `nature:garden:${tier}` ? { ...cell, occupant: null } : cell);
    state = reload(state);
    const step = glowDiscoveryBoardStep(`lesson.repeat.match-${tier}`, state)!;
    assert.equal(mergeFtueAllowsCommand(step, state, spawn), true);
    state = apply(state, spawn);
    state = apply(state, { type: 'move', from: cells(state, tier)[0], to: state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === echoId), now: NOW + 3 });
  }
  state.board = state.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'nature:garden:6' ? { ...cell, occupant: null } : cell);
  assert.equal(mergeFtueAllowsCommand(glowDiscoveryBoardStep('lesson.repeat.serve', state)!, state, spawn), true);
  state = apply(state, spawn);
  assert.equal(cells(state, 6).length, 1);
  state = apply(state, { type: 'serveOrder', orderId: GLOW_ORDER_IDS[1], now: NOW + 4 });
  assert.ok(state.coins >= 40);
  assert.equal(reduceMergeWorld(state, { type: 'prepareGlowDiscoveryLesson', now: NOW + 5 }).changed, false);
});

test('a full recovery board leaves input available to make room', () => {
  const state = apply(firstBloom(), { type: 'prepareGlowDiscoveryLesson', now: NOW });
  state.board = state.board.map((cell, index) => cell.locked || cell.occupant || cell.mist ? cell : { ...cell, occupant: { kind: 'item', instanceId: `shell:${index}`, definitionId: 'nature:waterside:1' } });
  const step = glowDiscoveryBoardStep('lesson.seed', state)!;
  assert.equal(step.interaction, undefined);
  assert.match(step.guide!.body!, /Merge or store/);
});

test('purchase requires restoration and enough Glow; saves keep their existing balance and islands', () => {
  const purchase = { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, now: NOW } as const;
  const fresh = createMossproutChapterZeroState(NOW);
  assert.equal(reduceMergeWorld(fresh, { type: 'unlockWorldTarget', targetId: '__proto__', now: NOW }).changed, false);
  assert.equal(reduceMergeWorld({ ...fresh, coins: 100 }, purchase).changed, false);
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
  assert.equal(glowGatewayState({ ...relationshipProjection, worldUnlocks: {}, storyWorldMutationReceipts: [] }), undefined);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /gatewayState = glowGatewayState\(mergeWorld\)/);
  assert.match(screen, /gateway: gatewayState/);
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
  assert.ok(visited.indexOf('garden.focus') < visited.indexOf('garden.open'));
  assert.ok(visited.indexOf('gateway.return') < visited.indexOf('gateway.buy'));
  assert.ok(!visited.some((id) => id.startsWith('steppling.') || id === 'world.choose' || id === 'egg.transfer'));
  assert.ok(visited.includes('lesson.repeat.prepare'));
  assert.ok(visited.includes('lesson.repeat.match-5'));
  assert.ok(visited.indexOf('lesson.repeat.serve') < visited.indexOf('gateway.ready'));
  assert.equal(GLOW_DISCOVERY_FLOW.migrations?.['lesson.repeat'], 'lesson.repeat.prepare');
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
  const invalid = { ...GLOW_DISCOVERY_FLOW, nodes: GLOW_DISCOVERY_FLOW.nodes.map((node) => node.id === 'lesson.spawn' ? { ...node, payload: { beat: { ...GLOW_LESSON[0], generatorId: 'missing-generator' } } } : node) };
  assert.ok(validateContentFlowDefinition(invalid).some((issue) => issue.message.includes('known generator')));
  for (const old of ['egg.transfer', 'world.choose', 'steppling.hatch', 'steppling.claim'] as const) assert.equal(GLOW_DISCOVERY_FLOW.migrations?.[old], 'gateway.egg');
});

test('shared-world tile layout and presentation keep one map and one Egg reveal', () => {
  assert.deepEqual(SHARED_WORLD_TILES['steppling-home'].coord, { q: 0, r: 0 });
  assert.equal(SHARED_WORLD_TILES['steppling-home'].residentVisible, false);
  assert.deepEqual(SHARED_WORLD_TILES['mossprout-home'].coord, { q: 0, r: 1 });
  const scene = readFileSync('components/katchadeck/world/mossprout-hex-neighborhood-scene.ts', 'utf8');
  assert.match(scene, /boundsLayers = \[\.\.\.rawLayers, lockedSteppling, revealedSteppling\]/);
  assert.match(scene, /'residentVisible' in entry && !entry.residentVisible/);
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /tutorialCameraReady && storyOperationsEnabled/);
  assert.match(canvas, /gateway === 'egg' && !upgradePresentation && !storySceneGuard/);
  assert.match(canvas, /<RevealedCompanionEgg\s+idleDiscovery/);
  const route = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  assert.doesNotMatch(route, /StepplingWorldScreen|world\.choose|Following the glow/);
});
