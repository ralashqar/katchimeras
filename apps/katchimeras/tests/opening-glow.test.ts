import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { createMossproutBasketParcelState, createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { GLOW_ORDER_IDS, MOSSPROUT_BASKET_ARRIVAL_ID } from '@/utils/merge-world/glow-discovery-policy';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { GLOW_DISCOVERY_FLOW, GLOW_LESSON, glowDiscoveryBoardStep, glowDiscoveryLessonReady } from '@/features/onboarding/glow-discovery-flow';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { mossproutFtueAction, mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { GLOW } from '@/constants/glow';

const NOW = Date.UTC(2026, 8, 12, 9);
const reload = (state: ReturnType<typeof createMossproutChapterZeroState>) => normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);

test('the first light is earned once per run when the last wisp falls, and pays the first restore', () => {
  let state = createMossproutBasketParcelState(NOW);
  assert.equal(state.coins, 0, 'nothing is pre-filled: the light is earned');
  const granted = reduceMergeWorld(state, { type: 'grantOpeningGlow', receiptId: 'ftue-1:opening-glow', amount: GLOW.firstRestorationCost, now: NOW });
  assert.equal(granted.changed, true);
  assert.equal(granted.state.coins, 20);
  assert.deepEqual(granted.state.openingGlow, { receiptId: 'ftue-1:opening-glow', amount: 20, grantedAt: NOW });
  state = reload(granted.state);
  assert.deepEqual(state.openingGlow, granted.state.openingGlow, 'survives a reload');
  assert.equal(reduceMergeWorld(state, { type: 'grantOpeningGlow', receiptId: 'ftue-1:opening-glow', amount: 20, now: NOW + 1 }).changed, false, 'the flow effect and the world screen’s repair may both ask; only one grants');
  assert.equal(reduceMergeWorld(state, { type: 'grantOpeningGlow', receiptId: 'other', amount: 20, now: NOW + 1 }).changed, false);
  const restored = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, receiptId: 'test:first-restore', now: NOW });
  assert.equal(restored.changed, true, restored.message);
  assert.equal(restored.state.coins, 0, 'exactly the first restore');
  // The flow keeps it right after the lift, before the Egg.
  const ids = MOSSPROUT_FTUE_FLOW.nodes.map((node) => node.id);
  assert.ok(ids.indexOf('world.mist_lift') < ids.indexOf('effect.haven.opening_glow') && ids.indexOf('effect.haven.opening_glow') < ids.indexOf('world.egg_intro'));
  const lift = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'world.mist_lift');
  assert.equal(lift?.kind === 'scene' ? lift.actions[0]?.next : null, 'effect.haven.opening_glow');
  const bootstrap = readFileSync('features/content-flow/content-flow-bootstrap.ts', 'utf8');
  assert.match(bootstrap, /registerContentFlowEffect\('haven\.opening_glow', async \(\{ run, effectKey \}\) => \{[\s\S]*?ensureStoredOpeningGlow\(`\$\{sourceId\}:opening-glow`\)/, 'the effect keys the grant to the run');
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  assert.match(repository, /export async function ensureStoredOpeningGlow\(receiptId: string, amount = GLOW\.firstRestorationCost, now = Date\.now\(\)\)/);
});

test('the planted memory goes straight to the offer, and nothing on the way can strand the player', () => {
  assert.equal(mossproutFtueAction('world.seed_planted', 'world.acknowledge_seed_dormant')?.nextStepId, 'world.first_bloom_offer');
  assert.equal(mossproutFtueStep('world.seed_planted')?.cue, undefined, 'nothing to tap');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /'world\.seed_planted': 0,/, 'the moment the Seed is in the ground, the offer: no beat, no Continue');
  assert.match(screen, /if \(ftueStepId === 'world\.seed_planted' && !firstSeedPlanted\) return;/, 'never before the Seed is in the ground');
  assert.match(screen, /&& \(ftueStepId !== 'world\.seed_planted' \|\| firstSeedPlacementFailed\) \? \(/, 'nothing is shown for the beat unless the planting failed');
  assert.match(screen, /\(ftueStepId !== 'world\.seed_planted' \|\| firstSeedPlacementFailed\)\s*&& \(ftueStepId !== 'world\.first_seed_grew'/, 'the only button the beat can show is the retry');
  assert.match(screen, /ftueStepId === 'world\.seed_planted' && firstSeedPlacementFailed\s*\? 'Retry Planting'/);
  assert.doesNotMatch(screen, /gardenWorldBottomCtaActive = \(ftueStepId === 'world\.seed_planted' && \(firstSeedPlacementFailed \|\| firstSeedPlanted\)\)/);
  // The lift: the light is seen arriving; the offer: repaired under the same receipt if the wallet is short.
  assert.match(screen, /if \(ftueStepId !== OPENING_MIST_LIFT_STEP_ID\) return;[\s\S]*?ensureStoredOpeningGlow\(`\$\{activeFtueRunId \?\? 'current'\}:opening-glow`\)[\s\S]*?openingGlow\.launch\(from, glowCurrencyArtRef\.current\);/);
  assert.match(screen, /if \(mergeWorld\.coins >= GLOW\.firstRestorationCost\) return;[\s\S]*?void repairFirstLight\(\);/, 'a short wallet at the offer is repaired');
  assert.match(screen, /ftueStepId === 'world\.first_bloom_offer'\s*\? 'Try again'/, 'and a failed repair shows a way to retry');
  const route = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  assert.match(route, /void advanceFtueActionDurably\(\{ expectedStepId: 'world\.seed_planted', actionId: 'world\.acknowledge_seed_dormant'/, 'the advance is the acknowledgement, not a Garden visit');
  assert.match(screen, /onOpenGarden=\{ftueStepId \? undefined : openGarden\}/, 'the Merge button waits for the Garden lesson');
  assert.match(screen, /havenMergeBoardActive && !ftueStepId \? \(/);
  const runtime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  assert.match(runtime, /run\.scriptVersion < 50 && run\.stepId === 'merge\.serve_sprout'[\s\S]*?stepId: 'world\.first_bloom_offer'/, 'a run parked on the old request continues at the offer');
});

test('the Garden opens bare: locked cells, the sleeping echoes, no request, and the Basket in a parcel', () => {
  const state = createMossproutBasketParcelState(NOW);
  assert.equal(state.board.some((cell) => cell.occupant != null), false, 'nothing on the board');
  assert.equal(state.board.some((cell) => cell.mist?.kind === 'echo'), true, 'the sleeping pieces wait under the Mist');
  assert.deepEqual(state.generators, {});
  assert.deepEqual(state.activeOrders, []);
  const parcel = state.arrivals.find((arrival) => arrival.id === MOSSPROUT_BASKET_ARRIVAL_ID);
  assert.ok(parcel, 'the Basket arrives by parcel');
  assert.equal(parcel.generatorId, 'wild-garden');
  assert.equal(parcel.claimedAt, null);
  assert.deepEqual(reload(state).arrivals.map((arrival) => arrival.id), [MOSSPROUT_BASKET_ARRIVAL_ID], 'a generator parcel survives a reload');
  const prepared = reduceMergeWorld(state, { type: 'prepareGlowDiscoveryLesson', now: NOW });
  assert.equal(prepared.changed, true, prepared.message);
  assert.equal(prepared.state.activeOrders[0]?.id, GLOW_ORDER_IDS[1], 'the request is on the tray before the Basket is out');
  const first = glowDiscoveryBoardStep(GLOW_LESSON[0].id, prepared.state)!;
  assert.equal(first.id, 'glow.lesson.single.parcel');
  assert.deepEqual(first.cue, { kind: 'tap', target: { kind: 'tray_parcel', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID } });
  assert.equal(mergeFtueAllowsCommand(first, prepared.state, { type: 'claimArrival', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, prepared.state, { type: 'tapGenerator', generatorId: 'wild-garden', now: NOW, seed: 'x' }), false, 'nothing but the parcel');
  assert.equal(glowDiscoveryLessonReady('lesson.single.parcel', prepared.state), false);
  const claimed = reduceMergeWorld(prepared.state, { type: 'claimArrival', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID, now: NOW + 1 });
  assert.equal(claimed.changed, true, claimed.message);
  assert.equal(claimed.spawnedGenerator?.generatorId, 'wild-garden');
  assert.equal(claimed.state.generatorUnlockReceipts.some((receipt) => receipt.generatorId === 'wild-garden' && receipt.seenAt == null), true, 'its reward page greets it');
  assert.equal(glowDiscoveryLessonReady('lesson.single.parcel', claimed.state), true);
  assert.equal((GLOW_DISCOVERY_FLOW.nodes.find((node) => node.id === 'lesson.single.prepare') as { next?: string } | undefined)?.next, 'lesson.single.parcel');
  const route = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  assert.equal(route.match(/installMossproutOnboardingMergeWorld\(Date\.now\(\), ftueWispForRun\(run\), \{ preserveHaven: true, basketParcel: true \}\)/g)?.length, 2);
});
