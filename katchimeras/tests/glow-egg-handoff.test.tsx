import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryScene, glowDiscoveryLocksCamera } from '../features/onboarding/glow-discovery-flow';
import { createContentFlowRun, reduceContentFlow } from '../features/content-flow/content-flow-interpreter';
import { createMossproutChapterZeroState } from '../utils/merge-world/onboarding';
import type { ContentFlowRun } from '../types/content-flow';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const reveal = (): ContentFlowRun => ({ ...createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'handoff' }), nodeId: 'gateway.egg', phase: 'awaiting_input' });

test('Meet the egg saves acceptance once and waits for encounter readiness across relaunch', () => {
  assert.equal(glowDiscoveryScene('gateway.egg')?.view.actionLabel, 'Meet the egg');
  let run = reduceContentFlow(GLOW_DISCOVERY_FLOW, reveal(), { type: 'submit_scene', actionId: 'done' }).run;
  assert.equal(run.nodeId, 'egg.enter'); assert.equal(run.status, 'active');
  run = JSON.parse(JSON.stringify(run));
  run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'submit_scene', actionId: 'done' }).run;
  assert.equal(run.nodeId, 'egg.enter');
  assert.equal(glowDiscoveryScene(run.nodeId), null);
  assert.equal(glowDiscoveryLocksCamera(run), true);
  const event = { eventId: 'entered', type: 'glow.egg.entered', runId: run.runId, nodeId: run.nodeId, payload: {}, occurredAt: Date.now() };
  run = reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'record_event', event }).run;
  assert.equal(run.status, 'completed');
  assert.equal(glowDiscoveryLocksCamera(run), false);
  assert.equal(reduceContentFlow(GLOW_DISCOVERY_FLOW, run, { type: 'record_event', event }).run.status, 'completed');
});

test('legacy accepted reveal resumes an unopened egg but never replays a visited or hatched encounter', () => {
  const runtime = loadNativeModule('features/onboarding/glow-discovery-runtime.ts', {
    '@/features/content-flow/content-flow-director': {}, '@/features/content-flow/content-flow-repository': {},
    '@/utils/merge-world/repository': {}, '@/utils/merge-world/glow-discovery-policy': { glowGatewayState: () => 'egg' },
    './glow-discovery-flow': { GLOW_DISCOVERY_FLOW },
  });
  const world = createMossproutChapterZeroState();
  const old = { ...reveal(), definitionVersion: 4, nodeId: 'complete', phase: 'completed', status: 'completed', completedAt: 123 };
  const pending = runtime.migrateGlowEggHandoff(old, world);
  assert.equal(pending.nodeId, 'egg.enter'); assert.equal(pending.completedAt, null);
  assert.equal(runtime.migrateGlowEggHandoff(pending, world), pending);
  assert.equal(runtime.migrateGlowEggHandoff({ ...old, definitionVersion: 5 }, world).status, 'completed');
  assert.equal(runtime.migrateGlowEggHandoff(old, { ...world, stepplingEgg: { sourceDayId: '2026-09-04' } }), old);
  assert.equal(runtime.migrateGlowEggHandoff(old, { ...world, companionDiscovery: { records: [{ characterId: 'steppling' }] } }), old);
});

test('egg handoff waits for the host, opens once, and retries a failed readiness save without replaying entry', async () => {
  let entries = 0; let acknowledgements = 0; let preparations = 0; let fail = true;
  const module = loadNativeModule('features/onboarding/use-glow-egg-handoff.ts', {
    './glow-discovery-runtime': {
      recoverGlowEggHandoff: async () => {},
      acknowledgeGlowEggEntry: async () => { acknowledgements++; if (fail) throw new Error('disk'); },
    },
  });
  let result: { error: boolean; retry: () => void; onReady: () => void };
  const world = createMossproutChapterZeroState();
  const run = reduceContentFlow(GLOW_DISCOVERY_FLOW, reveal(), { type: 'submit_scene', actionId: 'done' }).run;
  const enter = async () => { entries++; return true; };
  const onOpening = () => { preparations++; };
  function Host({ focused, open, available, withEgg }: { focused: boolean; open: boolean; available: boolean; withEgg: boolean }) {
    const saved = React.useMemo(() => withEgg ? { ...world, stepplingEgg: { sourceDayId: '2026-09-04' } } : world, [withEgg]);
    result = module.useGlowEggHandoff({ run, world: saved, focused, available, open, enter, onOpening });
    return null;
  }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host focused={false} open={false} available withEgg={false} />); });
  assert.equal(entries, 0);
  await act(async () => tree!.update(<Host focused open={false} available={false} withEgg={false} />));
  assert.equal(entries, 0);
  await act(async () => tree!.update(<Host focused open={false} available withEgg={false} />));
  assert.equal(entries, 1); assert.equal(preparations, 1); assert.equal(acknowledgements, 0);
  await act(async () => tree!.update(<Host focused open available withEgg />));
  assert.equal(entries, 1); assert.equal(acknowledgements, 0, 'opening alone is not camera/layout readiness');
  await act(async () => { result!.onReady(); result!.onReady(); });
  assert.equal(acknowledgements, 1); assert.equal(result!.error, true);
  fail = false;
  await act(async () => result!.retry());
  await act(async () => result!.onReady());
  assert.equal(acknowledgements, 2); assert.equal(entries, 1);
  await act(async () => tree!.unmount());
});


test('committed Grow checkpoints repair a lagging story journal without replaying player choices', async () => {
  const { MOSSPROUT_FTUE_FLOW: definition, MOSSPROUT_FTUE_VARIANTS } = await import('../features/onboarding/mossprout-ftue-flow');
  let journal = { ...createContentFlowRun(definition, { runId: 'flow:grow' }), nodeId: 'companion.water_together', phase: 'awaiting_input' as const } as ContentFlowRun;
  let submissions = 0;
  const runtime = loadNativeModule('features/content-flow/ftue-content-flow-runtime.ts', {
    '@/features/onboarding/mossprout-ftue-flow': { MOSSPROUT_FTUE_VARIANTS },
    './content-flow-catalog': { contentFlowDefinition: (_id: string, version: number) => version === definition.version ? definition : undefined, registerContentFlowDefinition() {} },
    './story-variant-registry': { registerStoryVariantSet() {}, selectedStoryVariant: () => ({ definition }) },
    './content-flow-repository': {
      loadContentFlowRun: async () => journal,
      reduceContentFlowRunAtomically: async ({ reduce }: { reduce: (run: ContentFlowRun) => ContentFlowRun }) => { journal = reduce(journal); return { run: journal }; },
    },
    './content-flow-interpreter': {},
    './content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: Parameters<typeof reduceContentFlow>[2]) => {
      if (command.type === 'submit_scene') submissions++;
      journal = reduceContentFlow(definition, journal, command).run; return journal;
    } },
  });
  const ftue = { runId: 'grow', stepId: 'companion.first_rest', answers: {}, receipts: [
    { stepId: 'companion.water_together', actionId: 'companion.choose_garden_return', status: 'committed' },
    { stepId: 'companion.first_grow', actionId: 'companion.open_first_grow', status: 'committed' },
    { stepId: 'companion.first_notice', actionId: 'companion.skip_first_notice', status: 'committed' },
  ] };
  assert.equal((await runtime.reconcileFtueCheckpoint(ftue)).nodeId, 'companion.first_rest');
  assert.equal(submissions, 3);
  await runtime.reconcileFtueCheckpoint(ftue); assert.equal(submissions, 3);
  journal = { ...journal, nodeId: 'companion.first_notice', phase: 'awaiting_input' };
  assert.equal((await runtime.reconcileFtueCheckpoint({ ...ftue, receipts: [] })).nodeId, 'companion.first_notice', 'no fabricated choice');
  journal = { ...journal, definitionVersion: 47, nodeId: 'companion.water_together' };
  assert.equal((await runtime.reconcileFtueCheckpoint({ ...ftue, answers: { 'companion.choose_water_together': { optionId: 'already_good' } } })).nodeId, 'companion.first_rest');
  assert.equal(submissions, 3, 'old completed water offer does not replay the new Grow introduction');
  for (const nodeId of ['companion.water_together', 'companion.first_grow', 'companion.first_notice']) {
    journal = { ...journal, definitionVersion: 48, nodeId, phase: 'awaiting_input' };
    const oldComplete = { ...ftue, receipts: [{ stepId: 'companion.first_notice', actionId: 'companion.complete_first_notice', status: 'committed' }] };
    assert.equal((await runtime.reconcileFtueCheckpoint(oldComplete)).nodeId, 'companion.first_rest', 'old completed noticing never reopens Bond coaching');
    assert.equal(submissions, 3);
  }
  journal = { ...journal, definitionVersion: 48, nodeId: 'companion.first_notice', phase: 'awaiting_input' };
  assert.equal((await runtime.reconcileFtueCheckpoint({ ...ftue, stepId: 'companion.first_notice', receipts: [] })).nodeId, 'companion.first_notice', 'unanswered old noticing stays available');
});


test('reopening Mossprout after FTUE does not replay the mist exit from its saved receipt', async () => {
  const { useFtueMistHandoff } = await import('../features/onboarding/use-ftue-mist-handoff');
  type Run = NonNullable<Parameters<typeof useFtueMistHandoff>[0]['run']>;
  const complete: Run = { runId: 'mossprout-run', status: 'complete', stepId: 'complete', receipts: [
    { actionId: 'companion.tend_garden', status: 'committed' } as Run['receipts'][number],
  ] };
  let exits = 0; let pending = false;
  const onHandoff = async () => { exits++; };
  function Host({ run, active = true, handoffActive = false }: { run: Run | null; active?: boolean; handoffActive?: boolean }) {
    pending = useFtueMistHandoff({ run, active, handoffActive, onHandoff }); return null;
  }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host run={null} />); });
  await act(async () => tree!.update(<Host run={complete} />));
  assert.equal(exits, 0); assert.equal(pending, false, 'loading a completed profile does not claim the interaction');
  for (let i = 0; i < 3; i++) {
    await act(async () => tree!.update(<Host run={complete} active={false} />));
    await act(async () => tree!.update(<Host run={{ ...complete }} />));
  }
  assert.equal(exits, 0); assert.equal(pending, false);
  const meditating: Run = { ...complete, status: 'active', stepId: 'companion.meditating', receipts: [] };
  await act(async () => tree!.update(<Host run={meditating} />));
  await act(async () => tree!.update(<Host run={complete} />));
  assert.equal(exits, 1, 'the live meditation-to-mist handoff still exits once');
  await act(async () => tree!.update(<Host run={{ ...complete }} />));
  assert.equal(exits, 1); assert.equal(pending, false);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Host run={complete} />); });
  assert.equal(exits, 1); assert.equal(pending, false, 'new interaction mounts do not repeat the handoff');
  await act(async () => tree!.update(<Host run={meditating} />));
  await act(async () => tree!.update(<Host run={complete} handoffActive />));
  assert.equal(exits, 1, 'explicit Explore action already owns its exit');
  await act(async () => tree!.unmount());
});


test('completed noticing shows Bond coaching once, persists it, and continues to rest; skipping bypasses it', async () => {
  const { MOSSPROUT_FTUE_FLOW: definition } = await import('../features/onboarding/mossprout-ftue-flow');
  const { mossproutFtueAction, mossproutFtueStep } = await import('../features/onboarding/mossprout-ftue-script');
  const initial: ContentFlowRun = { ...createContentFlowRun(definition, { runId: 'notice-bond' }), nodeId: 'companion.first_notice', phase: 'awaiting_input' };
  let run = reduceContentFlow(definition, initial, { type: 'submit_scene', actionId: 'companion.complete_first_notice' }).run;
  assert.equal(run.nodeId, 'companion.notice_bond_spotlight');
  assert.equal(mossproutFtueAction('companion.first_notice', 'companion.complete_first_notice')?.nextStepId, run.nodeId);
  assert.equal(run.phase, 'awaiting_input');
  run = reduceContentFlow(definition, JSON.parse(JSON.stringify(run)), { type: 'retry' }).run;
  assert.equal(run.nodeId, 'companion.notice_bond_spotlight');
  const step = mossproutFtueStep(run.nodeId)!;
  assert.equal(step.navigation?.lock, true);
  assert.equal(step.actions[0].title, 'Continue');
  assert.ok((step.guide.title + ' ' + step.guide.body).length <= 120);
  run = reduceContentFlow(definition, run, { type: 'submit_scene', actionId: step.actions[0].id }).run;
  assert.equal(run.nodeId, 'companion.first_rest');
  assert.equal(reduceContentFlow(definition, run, { type: 'submit_scene', actionId: step.actions[0].id }).run.nodeId, 'companion.first_rest');
  assert.equal(reduceContentFlow(definition, initial, { type: 'submit_scene', actionId: 'companion.skip_first_notice' }).run.nodeId, 'companion.first_rest');
});


test('shared Bond coachmark sits below its target and protects Continue against duplicate presses and save failures', async () => {
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/onboarding/companion-ftue-coachmark.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'react-native-reanimated': { ...motion.animated, FadeOut: motion.animated.FadeIn },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/egg-avatar/egg-avatar': { EggAvatar: 'EggAvatar' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    '@/constants/theme': { KatchaDeckUI: { typography: { ftueHeroTitle: {} } } },
    '@/features/egg-avatar/egg-avatar-provider': { useEggAvatar: () => ({ equippedFaceId: 'gentle-smile', equippedSkinId: 'moss' }) },
    '../../../assets/images/katchimeras/merge-world/ui/ftue-hand.webp': 1,
  }, { requestAnimationFrame: (fn: () => void) => { fn(); return 1; }, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {} });
  const Coach = module.CompanionFtueCoachmark as React.ComponentType<Record<string, unknown>>;
  let attempts = 0; let rejectSave: (error: Error) => void = () => {};
  const onContinue = () => { attempts++; return attempts === 1 ? new Promise<void>((_resolve, reject) => { rejectSave = reject; }) : Promise.resolve(); };
  const targetRef = { current: { measureInWindow: (cb: (...args: number[]) => void) => cb(40, 60, 240, 48) } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Coach buttonLabel="Continue" message={[{ text: 'Your Bond grew.' }]} onContinue={onContinue} placement="below" targetRef={targetRef} />); });
  const callout = tree!.root.findByProps({ accessibilityLiveRegion: 'polite' });
  assert.ok(callout.props.style[1].top > 108, 'explanation is below the Bond bar');
  const press = tree!.root.findByType('Pressable' as React.ElementType).props.onPress;
  let pending: Promise<void>;
  await act(async () => { pending = press(); void press(); });
  assert.equal(attempts, 1);
  assert.equal(tree!.root.findByType('Pressable' as React.ElementType).props.disabled, true);
  await act(async () => { rejectSave(new Error('disk')); await pending; });
  assert.equal(tree!.root.findAllByType('Text' as React.ElementType).some((text) => text.props.children === 'Try again'), true);
  await act(async () => tree!.root.findByType('Pressable' as React.ElementType).props.onPress());
  assert.equal(attempts, 2);
  assert.equal(tree!.root.findByType('Pressable' as React.ElementType).props.disabled, false);
  await act(async () => tree!.unmount());
});
