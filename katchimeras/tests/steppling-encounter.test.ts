import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { GLOW_GATEWAY_ID, glowGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { stepplingEggReady, stepplingStepFeedOffer, stepplingStepsBond, STEPPLING_INTENT_OPTIONS, STEPPLING_MOVEMENT_OPTIONS, type StepplingEggAction } from '@/features/onboarding/steppling-egg-policy';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_PARCEL_REWARD_ID } from '@/features/content-flow/steppling-day-one-flow';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { createContentFlowRun, reduceContentFlow, contentFlowEffectKey } from '@/features/content-flow/content-flow-interpreter';
import type { MergeWorldState } from '@/types/merge-world';
import { sharedResidentAnchor, sharedResidentCenterY, residentArtLayerId, usesSharedResidentStage, SHARED_EGG_REST_ZOOM, SHARED_RESIDENT_SCREEN_ANCHOR_Y } from '@/components/katchadeck/world/shared-resident-presentation';
import { MOSSPROUT_WORLD_EGG_REST_ZOOM } from '@/features/onboarding/mossprout-ftue-script';
import { stepplingDayOneConversation } from '@/constants/steppling-day-one-conversation';
import { createConversationSession, answerConversation, continueConversation, validateConversationDefinitions } from '@/utils/companion-conversation';
import { emptyCompanionBondState, syncCompanionBondEvent } from '@/utils/companion-bond';
import { worldEggReadyEffectsVisible } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { IDLE_TODAY_HATCH_PRESENTATION, type TodayHatchPhase } from '@/utils/today-hatch-presentation';
import { createEggHapticSequence, type EggHapticCue } from '@/utils/egg-haptic-sequence';

test('shake haptics stay light and continuous through cracks, then stop before hatch', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const cues: EggHapticCue[] = [];
  const sequence = createEggHapticSequence((cue) => cues.push(cue), false);
  sequence.advance('preparing');
  assert.deepEqual(cues, []);
  sequence.advance('shaking');
  t.mock.timers.tick(300);
  assert.deepEqual(cues, ['shake', 'shake', 'shake', 'shake']);
  sequence.advance('cracking');
  sequence.advance('cracking');
  t.mock.timers.tick(200);
  assert.equal(cues.length, 6);
  sequence.advance('crossfading_subject');
  sequence.advance('crossfading_subject');
  t.mock.timers.tick(500);
  assert.deepEqual(cues.slice(6), ['hatch']);
  sequence.advance('subject_settling');
  sequence.advance('subject_settling');
  assert.deepEqual(cues.slice(6), ['hatch', 'settle']);
  sequence.stop();
});

test('shake haptics cancel cleanly, restart once, and are bounded if a hatch stalls', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const cues: EggHapticCue[] = [];
  const sequence = createEggHapticSequence((cue) => cues.push(cue), false);
  sequence.advance('shaking');
  sequence.stop();
  sequence.stop();
  t.mock.timers.tick(1000);
  assert.deepEqual(cues, ['shake']);
  sequence.advance('shaking');
  sequence.advance('shaking');
  t.mock.timers.tick(100);
  assert.equal(cues.length, 3);
  sequence.advance('idle');
  t.mock.timers.tick(1000);
  assert.equal(cues.length, 3);
  sequence.advance('shaking');
  t.mock.timers.tick(20000);
  assert.equal(cues.length, 83);
  t.mock.timers.tick(20000);
  assert.equal(cues.length, 83);
  sequence.stop();
});

test('reduced motion gets one shake cue and retains the hatch and settling cues', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const cues: EggHapticCue[] = [];
  const sequence = createEggHapticSequence((cue) => cues.push(cue), true);
  sequence.advance('shaking');
  sequence.advance('cracking');
  t.mock.timers.tick(1000);
  sequence.advance('crossfading_subject');
  sequence.advance('subject_settling');
  assert.deepEqual(cues, ['shake', 'hatch', 'settle']);
  sequence.stop();
});

test('waiting Egg rays are mutually exclusive with every hatch phase and resident handoff', () => {
  const ready = { readyToHatch: true, hatchPresentation: null, companionVisible: false };
  assert.equal(worldEggReadyEffectsVisible(ready), true);
  assert.equal(worldEggReadyEffectsVisible(null), false);
  assert.equal(worldEggReadyEffectsVisible({ ...ready, readyToHatch: false }), false);
  assert.equal(worldEggReadyEffectsVisible({ ...ready, companionVisible: true }), false);
  for (const phase of ['preparing', 'shaking', 'cracking', 'crossfading_subject', 'subject_settling', 'awaiting_claim'] as TodayHatchPhase[]) {
    assert.equal(worldEggReadyEffectsVisible({ ...ready, hatchPresentation: { ...IDLE_TODAY_HATCH_PRESENTATION, phase } }), false);
  }
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /showReadyEffects = worldEggReadyEffectsVisible\(presentation\)/);
  assert.match(canvas, /showReadyEffects \? <>\s*<RotatingRadialSunburst/);
});

test('Steppling uses shared prompt, Bond landing and hatch phase haptics', () => {
  const host = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const steppling = readFileSync('features/onboarding/use-steppling-encounter.ts', 'utf8');
  const original = readFileSync('features/today/use-today-hatch-reveal-controller.ts', 'utf8');
  const card = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const questions = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(host, /onEnergyTokenArrive=\{stepplingEncounter.feedController.handleEnergyTokenArrive\}/);
  assert.match(card, /if \(locked\) return/);
  assert.match(card, /action.id.startsWith\('egg.'\)\) playEggActionHaptic\(\)/);
  assert.match(questions, /useSharedActionPanelLifecycle/);
  assert.match(readFileSync('features/today/use-shared-action-panel-lifecycle.ts', 'utf8'), /playEggActionHaptic\(\)/);
  assert.match(steppling, /hatchHaptics.advance\(next as TodayHatchPhase\)/);
  assert.match(steppling, /timers.forEach\(clearTimeout\)/);
  assert.match(original, /hatchHaptics.advance\('shaking'\)/);
  assert.match(original, /hatchHaptics.advance\('crossfading_subject'\)/);
  assert.match(original, /hatchHaptics.advance\('subject_settling'\)/);
  assert.match(original, /const clearTimers = useCallback\(\(\) => \{\s*hatchHaptics.stop\(\)/);
  assert.match(steppling, /value !== 'active'\) hatchHaptics.stop\(\)/);
  const haptics = readFileSync('features/today/egg-haptics.ts', 'utf8');
  assert.match(haptics, /cue === 'shake' \? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Heavy/);
  assert.match(steppling, /readyToHatch: stepplingEggReady\(feedingEgg \?\? egg\) && !hatching && !egg\?\.hatchedAt/);
});

const NOW = Date.UTC(2026, 8, 4, 12);
function revealed(): MergeWorldState {
  const state = createMossproutChapterZeroState(NOW);
  return { ...state, worldUnlocks: { [GLOW_GATEWAY_ID]: { unlockedAt: NOW, destination: 'steppling', paid: 40, transferredAt: null, hatchedAt: null } } };
}
const reload = (state: MergeWorldState) => normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);
const act = (state: MergeWorldState, action: StepplingEggAction) => reduceMergeWorld(state, { type: 'stepplingEgg', action, now: NOW });
function begun() {
  return act(act(revealed(), { kind: 'begin', sourceDayId: '2026-09-03' }).state, { kind: 'intent', answer: 'own-pace' }).state;
}
function hatch(state: MergeWorldState) {
  const started = act(state, { kind: 'hatch' });
  assert.equal(started.changed, true);
  return act(reload(started.state), { kind: 'finish' }).state;
}
const grant = (state: MergeWorldState) => reduceMergeWorld(state, { type: 'grantGeneratorParcel', generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_REWARD_ID, dayId: '2026-09-04', now: NOW });

test('Egg needs revealed mist, has three choices, and cannot hatch from intent alone', () => {
  assert.equal(act(createMossproutChapterZeroState(NOW), { kind: 'begin', sourceDayId: '2026-09-03' }).changed, false);
  assert.equal(STEPPLING_INTENT_OPTIONS.length, 3);
  assert.equal(STEPPLING_MOVEMENT_OPTIONS.length, 3);
  assert.equal(stepplingEggReady(begun().stepplingEgg), false);
  assert.equal(act(begun(), { kind: 'hatch' }).changed, false);
  assert.equal(act(begun(), { kind: 'finish' }).changed, false);
});

test('invalid saved hatch intent cannot lock an unready Egg', () => {
  const state = begun();
  state.stepplingEgg = { ...state.stepplingEgg!, hatchStartedAt: NOW, fedSteps: -9 };
  const restored = reload(state);
  assert.equal(restored.stepplingEgg?.hatchStartedAt, null);
  assert.equal(restored.stepplingEgg?.fedSteps, 0);
  assert.equal(act(revealed(), { kind: 'begin', sourceDayId: '2026-02-31' }).changed, false);
  assert.equal(act(revealed(), { kind: 'begin', sourceDayId: '2026-99-99' }).changed, false);
});

test('Steppling uses the original full-sized Egg renderer and shared feed/hatch tech', () => {
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const controller = readFileSync('features/onboarding/use-steppling-encounter.ts', 'utf8');
  assert.match(canvas, /<RevealedCompanionEgg idleDiscovery=\{!discoveredEggInteraction\} fullSize eggSkinId="moss"/);
  assert.match(canvas, /const growthProgress = fullSize \? 1 :/);
  assert.match(controller, /useEggFeedController\(\)/);
  assert.match(controller, /HATCH_PHASE_DELAYS_MS/);
  assert.match(controller, /hatchPresentation: open && \(hatching \|\| egg\?\.hatchedAt\)/);
});

test('both world residents share tile placement, full-size Egg framing and the hosted camera', () => {
  for (const family of ['mossprout', 'steppling']) assert.equal(usesSharedResidentStage(family), true);
  assert.equal(SHARED_EGG_REST_ZOOM, MOSSPROUT_WORLD_EGG_REST_ZOOM);
  assert.equal(SHARED_RESIDENT_SCREEN_ANCHOR_Y, 0.46);
  assert.deepEqual(sharedResidentAnchor({ left: 100, top: 200, width: 400, height: 500 }), { x: 300, y: 445 });
  assert.equal(sharedResidentCenterY(445), 445 - 8 - 139 / 2);
  assert.equal(residentArtLayerId('family:steppling', 'steppling'), 'structure:steppling-home');
  assert.equal(residentArtLayerId('family:mossprout', 'mossprout'), 'family:mossprout');
  const scene = readFileSync('components/katchadeck/world/mossprout-hex-neighborhood-scene.ts', 'utf8');
  assert.match(scene, /mainLayer\.residentAnchor = sharedResidentAnchor\(mainLayer\.frame\)/);
  assert.match(scene, /revealedSteppling\.residentAnchor = sharedResidentAnchor\(revealedSteppling\.frame\)/);
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /if \(interactionResidentId\) interactionOriginSnapshotRef\.current = origin;\s*else animateToCameraSnapshot/);
  assert.match(canvas, /focusTutorialResident\(anchor.x, sharedResidentCenterY\(anchor.y\), \{\s*anchorY: SHARED_EGG_SCREEN_ANCHOR_Y,\s*zoom: SHARED_EGG_REST_ZOOM/);
  assert.doesNotMatch(canvas, /anchorY: 0\.31|zoom: 1\.7/);
});

test('Egg question UI is shared, and hatching automatically enters regular resident interaction', () => {
  const first = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const second = readFileSync('components/katchadeck/world/steppling-encounter-panel.tsx', 'utf8');
  for (const source of [first, second]) {
    assert.match(source, /<EggActionDock bottomInset=\{/);
    assert.match(source, /<EggQuestionPanel/);
  }
  assert.match(first, /export function EggQuestionPanel[\s\S]*?<InlineCheckInPanel/);
  assert.doesNotMatch(second, /INTENT_CARDS|MOVEMENT_CARDS|Meet Steppling|StepplingDayOnePanel/);
  const controller = readFileSync('features/onboarding/use-steppling-encounter.ts', 'utf8');
  assert.match(controller, /phase !== 'awaiting_claim'[\s\S]*?void finish\(\)/);
  assert.match(controller, /egg: feedingEgg \?\? egg/);
  const world = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(world, /selectResident\(resident.creature.creatureId\);\s*closeStepplingEgg\(\)/);
  assert.doesNotMatch(world, /StepplingDayOnePanel|stepplingDayOpen/);
});

test('Day 1 runs through the regular conversation engine for every movement choice', () => {
  assert.deepEqual(validateConversationDefinitions([stepplingDayOneConversation]), []);
  for (const { id } of STEPPLING_MOVEMENT_OPTIONS) {
    let session = createConversationSession({ definition: stepplingDayOneConversation, formId: 'steppling', dayId: '2026-09-04', createdAt: NOW });
    for (let guard = 0; guard < 20 && session.status !== 'completed'; guard += 1) {
      const node = stepplingDayOneConversation.nodes.find((candidate) => candidate.id === session.currentNodeId);
      if (session.pendingReply !== undefined || node?.kind === 'end') session = continueConversation(session, stepplingDayOneConversation, NOW);
      else session = answerConversation(session, stepplingDayOneConversation, node?.id === 'reflection' ? id : node?.kind === 'choice' ? (node.options.find((option) => option.id === 'skip') ?? node.options[0]).id : 'continue', NOW).session;
      session = JSON.parse(JSON.stringify(session));
    }
    assert.equal(session.status, 'completed');
    assert.equal(session.turns.find((turn) => turn.nodeId === 'reflection')?.optionId, id);
  }
});

test('step feeding is explicit, capped, repeat-safe and bound to the original source day', () => {
  let state = begun();
  const coins = state.coins; const energy = state.energy;
  state = act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 230 }).state;
  assert.equal(state.stepplingEgg?.fedSteps, 230);
  assert.equal(act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 230 }).changed, false);
  assert.equal(act(state, { kind: 'feed', sourceDayId: '2026-09-04', observedSteps: 2000 }).changed, false);
  assert.equal(act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: NaN }).changed, false);
  state = act(reload(state), { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 9000 }).state;
  assert.equal(state.stepplingEgg?.fedSteps, 500);
  assert.equal(state.coins, coins); assert.deepEqual(state.energy, energy);
  assert.equal(act(state, { kind: 'begin', sourceDayId: '2026-09-04' }).changed, false);
  const hatched = reload(hatch(state));
  assert.equal(glowGatewayState(hatched), 'open');
  assert.equal(hatched.companionDiscovery.records.filter((record) => record.characterId === 'steppling').length, 1);
  assert.equal(act(hatched, { kind: 'finish' }).changed, false);
  assert.equal(hatched.generators['journey-locker'], undefined);
  assert.equal(hatched.arrivals.some((arrival) => arrival.generatorId === 'journey-locker'), false);
});

test('all movement reflections, including rest, hatch without fabricating steps', () => {
  for (const { id } of STEPPLING_MOVEMENT_OPTIONS) {
    const ready = act(begun(), { kind: 'alternative', answer: id }).state;
    assert.equal(ready.stepplingEgg?.fedSteps, 0);
    assert.equal(stepplingEggReady(ready.stepplingEgg), true);
    assert.equal(glowGatewayState(reload(hatch(ready))), 'open');
  }
});

test('steps pay one Bond per 300, rounded cumulatively, independently of the hatch threshold', () => {
  for (const [steps, bond] of [[0, 0], [1, 1], [299, 1], [300, 1], [301, 2], [500, 2], [5444, 19], [-2, 0], [NaN, 0], [Infinity, 0]]) {
    assert.equal(stepplingStepsBond(steps), bond);
  }
  let state = begun();
  assert.deepEqual(stepplingStepFeedOffer(state.stepplingEgg, 5444), { steps: 5444, bond: 19 });
  state = reload(act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 100 }).state);
  assert.deepEqual(stepplingStepFeedOffer(state.stepplingEgg, 100), { steps: 0, bond: 0 });
  assert.deepEqual(stepplingStepFeedOffer(state.stepplingEgg, 200), { steps: 100, bond: 0 });
  assert.deepEqual(stepplingStepFeedOffer(state.stepplingEgg, 5444), { steps: 5344, bond: 18 });
  state = reload(act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 5444 }).state);
  assert.equal(state.stepplingEgg?.fedSteps, 500);
  assert.equal(state.stepplingEgg?.bondFedSteps, 5444);
  assert.equal(stepplingEggReady(state.stepplingEgg), true);
  assert.deepEqual(stepplingStepFeedOffer(state.stepplingEgg, 5444), { steps: 0, bond: 0 });
  assert.equal(act(state, { kind: 'feed', sourceDayId: '2026-09-03', observedSteps: 5444 }).changed, false);
});

test('second Egg beat has only the steps card or automatic shared fallback', () => {
  const panel = readFileSync('components/katchadeck/world/steppling-encounter-panel.tsx', 'utf8');
  assert.doesNotMatch(panel, /Find my own pace|Check steps|steps fed\.|Feed yesterday’s steps|setAlternative|stepsMessage/);
  assert.match(panel, /movementFallback = displayedSteps != null && stepOffer.steps === 0/);
  assert.match(panel, /stepCount=\{stepOffer.steps\} stepEnergy=\{stepOffer.bond\}/);
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  assert.match(repository, /syncCompanionBondEvent\(bond, \{ id: 'steppling:egg:steps'[\s\S]*?points: stepplingStepsBond/);
});

test('steps launch the shared Bond batch from the right-hand reward section into the Egg', () => {
  const card = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const controller = readFileSync('features/onboarding/use-steppling-encounter.ts', 'utf8');
  const payload = readFileSync('features/today/egg-bond-feed.ts', 'utf8');
  assert.match(card, /action.id === 'egg.feed_steps' \? bondSourceRef : cardRef/);
  assert.match(card, /sourceRef.current\?\.measureInWindow/);
  assert.match(card, /<View collapsable=\{false\} ref=\{bondSourceRef\} style=\{styles.energyValueGroup\}>/);
  assert.match(controller, /stepplingStepFeedOffer\(egg, action.observedSteps\).bond/);
  assert.match(controller, /startEggFeed\(from, eggBondFeedPayload\(bondAmount, from\), arrive\)/);
  assert.match(payload, /currencyFrom, energyAmount: amount, energyOnly: true/);
  assert.match(controller, /feedExpressionKey: eggFeedLaunchKey/);
  assert.match(controller, /if \(!ok\) \{ releaseFeedPanel\(\); return; \}\s*setFeedback\(\(value\) => value \+ 1\)/);
  assert.match(controller, /!ok \|\| reduceMotion \|\| bondAmount <= 0/);
  assert.doesNotMatch(controller, /DASHBOARD_STAT_ART.steps|framelessImage: true/);
});

test('persisted step rewards reconcile once across partial feeds and retries', () => {
  let bond = emptyCompanionBondState();
  let paid = 0;
  for (const total of [100, 100, 200, 300, 301, 500, 5444, 5444]) {
    const result = syncCompanionBondEvent(bond, {
      id: 'steppling:egg:steps', creatureId: 'companion:steppling', kind: 'check_in_completed',
      points: stepplingStepsBond(total), occurredAt: NOW, dayId: '2026-09-03',
    });
    paid += result.points;
    bond = JSON.parse(JSON.stringify(result.state));
  }
  assert.equal(paid, 19);
  assert.equal(bond.events.length, 1);
  assert.equal(bond.events[0].points, 19);
});

test('parcel persists and remains unopened on a full board; installs only once in empty space', () => {
  let state = grant(hatch(act(begun(), { kind: 'alternative', answer: 'rest' }).state)).state;
  assert.equal(grant(state).changed, false);
  state = reload(state);
  assert.ok(state.arrivals.some((arrival) => arrival.generatorId === 'journey-locker'));
  state.board = state.board.map((cell, index) => cell.occupant || cell.locked || cell.mist ? cell : { ...cell, occupant: { kind: 'item', instanceId: `full:${index}`, definitionId: 'nature:garden:1' } });
  const command = { type: 'claimArrival' as const, arrivalId: STEPPLING_PARCEL_REWARD_ID, now: NOW };
  const full = reduceMergeWorld(state, command);
  assert.equal(full.changed, false);
  assert.equal(full.state.arrivals.find((arrival) => arrival.id === STEPPLING_PARCEL_REWARD_ID)?.claimedAt, null);
  const freeCell = state.board.findIndex((cell) => !cell.locked && !cell.mist && cell.occupant?.kind === 'item');
  state.board[freeCell] = { ...state.board[freeCell], occupant: null };
  const opened = reduceMergeWorld(state, command);
  assert.deepEqual(opened.spawnedGenerator, { generatorId: 'journey-locker', cell: freeCell });
  assert.equal(opened.state.unlockedChains.includes('adventure:trail'), true);
  assert.equal(reduceMergeWorld(reload(opened.state), command).changed, false);
  assert.equal(grant(reload(opened.state)).changed, false);
  assert.equal(opened.state.board.filter((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'journey-locker').length, 1);
});

test('unclaimed generator parcel survives arrival history truncation', () => {
  const state = grant(revealed()).state;
  const parcel = state.arrivals.find((arrival) => arrival.generatorId)!;
  state.arrivals.push(...Array.from({ length: 50 }, (_, index) => ({ ...parcel, generatorId: undefined, id: `old:${index}`, claimedAt: NOW })));
  assert.ok(reload(state).arrivals.some((arrival) => arrival.id === parcel.id));
});

test('Day 1 is a normal resumable journey; every answer reaches one parcel effect', () => {
  assert.deepEqual(validateContentFlowDefinition(STEPPLING_DAY_ONE_FLOW), []);
  assert.equal(STEPPLING_DAY_ONE_FLOW.metadata.kind, 'journey_day');
  assert.equal(STEPPLING_DAY_ONE_FLOW.nodes.some((node) => node.kind === 'route' || node.kind === 'task' || node.kind === 'presentation'), false);
  for (const { id } of STEPPLING_MOVEMENT_OPTIONS) {
    let run = createContentFlowRun(STEPPLING_DAY_ONE_FLOW, { runId: `test:${id}`, now: NOW });
    for (let guard = 0; guard < STEPPLING_DAY_ONE_FLOW.nodes.length && run.nodeId !== 'parcel'; guard++) {
      const node = STEPPLING_DAY_ONE_FLOW.nodes.find((item) => item.id === run.nodeId)!;
      assert.equal(node.kind, 'scene');
      if (node.kind !== 'scene') break;
      const actionId = node.id === 'reflection' ? id : (node.actions?.find((action) => action.id === 'skip') ?? node.actions![0]).id;
      run = reduceContentFlow(STEPPLING_DAY_ONE_FLOW, JSON.parse(JSON.stringify(run)), { type: 'submit_scene', actionId }).run;
    }
    assert.equal(run.nodeId, 'parcel');
    assert.equal(run.variables.movementChoice, id);
    run = reduceContentFlow(STEPPLING_DAY_ONE_FLOW, run, { type: 'effect_completed', effectKey: contentFlowEffectKey(run, 'parcel'), result: { rewardId: STEPPLING_PARCEL_REWARD_ID } }).run;
    assert.equal(run.status, 'completed');
  }
});
