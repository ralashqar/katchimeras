import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryScene, glowDiscoveryLocksCamera } from '../features/onboarding/glow-discovery-flow';
import { createContentFlowRun, reduceContentFlow } from '../features/content-flow/content-flow-interpreter';
import { createMossproutChapterZeroState } from '../utils/merge-world/onboarding';
import type { ContentFlowRun } from '../types/content-flow';
import { STEPPLING_HATCHABLE } from '../constants/hatchable-companions/registry';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const reveal = (): ContentFlowRun => ({ ...createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'handoff' }), nodeId: 'gateway.egg', phase: 'awaiting_input' });

test('the reveal checkpoint saves entry once and waits for encounter readiness across relaunch', () => {
  assert.equal(glowDiscoveryScene('gateway.egg')?.view.actionLabel, 'Meet the Egg');
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

test('revealed eggs advance automatically only when focused and available, and retry failed saves', async () => {
  const { HATCHABLE_COMPANIONS } = await import('../constants/hatchable-companions/registry');
  for (const definition of HATCHABLE_COMPANIONS) {
    let submissions = 0;
    let fail = true;
    const module = loadNativeModule('features/onboarding/use-glow-egg-handoff.ts', {
      './hatchable-runtime': {
        recoverHatchableEggHandoff: async () => {},
        acknowledgeHatchableEggEntry: async () => {},
        submitHatchableAction: async (target: typeof definition, action: string) => {
          assert.equal(target.companion, definition.companion);
          assert.equal(action, 'done');
          submissions++;
          if (fail) throw new Error('disk');
        },
      },
      './steppling-egg-policy': { hatchableEggProgress: () => null },
      '@/constants/hatchable-companions/registry': { STEPPLING_HATCHABLE },
    });
    const run = reveal();
    const world = createMossproutChapterZeroState();
    let result: { error: boolean; retry: () => void };
    function Host({ focused, available }: { focused: boolean; available: boolean }) {
      result = module.useGlowEggHandoff({ run, world, definition, focused, available,
        open: false, enter: async () => true, onOpening: () => {} });
      return null;
    }
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Host focused={false} available />); });
    assert.equal(submissions, 0);
    await act(async () => tree!.update(<Host focused available={false} />));
    assert.equal(submissions, 0, 'the reveal must finish before entry');
    await act(async () => tree!.update(<Host focused available />));
    assert.equal(submissions, 1);
    assert.equal(result!.error, true);
    fail = false;
    await act(async () => result!.retry());
    assert.equal(submissions, 2);
    await act(async () => tree!.update(<Host focused available />));
    assert.equal(submissions, 2, 'a rerender must not repeat entry');
    await act(async () => tree!.unmount());
  }
});

test('legacy accepted reveal resumes an unopened egg but never replays a visited or hatched encounter', () => {
  const runtime = loadNativeModule('features/onboarding/hatchable-runtime.ts', {
    'react': {},
    '@/features/content-flow/content-flow-catalog': {}, '@/features/content-flow/content-flow-director': {}, '@/features/content-flow/content-flow-repository': {},
    '@/utils/merge-world/repository': {}, '@/utils/merge-world/glow-discovery-policy': { hatchableGatewayState: () => 'egg' },
    '@/constants/hatchable-companions/registry': { HATCHABLE_COMPANIONS: [STEPPLING_HATCHABLE], hatchableByCompanion: () => null },
    './steppling-egg-policy': { hatchableEggProgress: (world: { stepplingEgg?: unknown }) => world.stepplingEgg },
    './glow-discovery-flow': {}, './steppling-garden-lesson': {},
    './hatchable-flows': { hatchableFlows: () => ({ discovery: GLOW_DISCOVERY_FLOW }), HATCHABLE_LESSON_FINALE_NODE_IDS: ['closing', 'summary'], HATCHABLE_MISSION_CLEAR_NODE_ID: 'mission.clear', HATCHABLE_MISSION_CLEARED_EVENT: 'glow.mission.cleared', HATCHABLE_EGG_ENTERED_EVENT: 'glow.egg.entered' },
  });
  const world = createMossproutChapterZeroState();
  const old = { ...reveal(), definitionVersion: 4, nodeId: 'complete', phase: 'completed', status: 'completed', completedAt: 123 };
  const migrate = (run: unknown, current: unknown) => runtime.migrateHatchableEggHandoff(STEPPLING_HATCHABLE, run, current);
  const pending = migrate(old, world);
  assert.equal(pending.nodeId, 'egg.enter'); assert.equal(pending.completedAt, null);
  assert.equal(migrate(pending, world), pending);
  assert.equal(migrate({ ...old, definitionVersion: 5 }, world).status, 'completed');
  assert.equal(migrate(old, { ...world, stepplingEgg: { sourceDayId: '2026-09-04' } }), old);
  assert.equal(migrate(old, { ...world, companionDiscovery: { records: [{ characterId: 'steppling' }] } }), old);
});

test('egg handoff waits for the host, opens once, and retries a failed readiness save without replaying entry', async () => {
  let entries = 0; let acknowledgements = 0; let preparations = 0; let fail = true;
  const module = loadNativeModule('features/onboarding/use-glow-egg-handoff.ts', {
    './hatchable-runtime': {
      recoverHatchableEggHandoff: async () => {},
      acknowledgeHatchableEggEntry: async () => { acknowledgements++; if (fail) throw new Error('disk'); },
    },
    './steppling-egg-policy': { hatchableEggProgress: (world: { stepplingEgg?: unknown }) => world.stepplingEgg },
    '@/constants/hatchable-companions/registry': { STEPPLING_HATCHABLE },
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



test('shared Bond coachmark sits below its target and protects Continue against duplicate presses and save failures', async () => {
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/onboarding/companion-ftue-coachmark.tsx', {
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'react-native-reanimated': { ...motion.animated, FadeOut: motion.animated.FadeIn },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/egg-avatar/egg-avatar': { EggAvatar: 'EggAvatar' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    '@/constants/theme': { KatchaDeckUI: { typography: { ftueHeroTitle: {} } } },
    '@/features/egg-avatar/egg-avatar-provider': { useEggAvatar: () => ({ equippedFaceId: 'gentle-smile', equippedSkinId: 'moss' }) },
    '@incubator/art-merge-world/ui/ftue-hand.webp': 1,
  }, { requestAnimationFrame: (fn: () => void) => { fn(); return 1; }, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {} });
  const Coach = module.CompanionFtueCoachmark as React.ComponentType<Record<string, unknown>>;
  let attempts = 0; let rejectSave: (error: Error) => void = () => {};
  const onContinue = () => { attempts++; return attempts === 1 ? new Promise<void>((_resolve, reject) => { rejectSave = reject; }) : Promise.resolve(); };
  const targetRef = { current: { measureInWindow: (cb: (...args: number[]) => void) => cb(40, 60, 240, 48) } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Coach buttonLabel="Continue" message={[{ text: 'Your Bond grew.' }]} onContinue={onContinue} placement="below" targetRef={targetRef} />, { createNodeMock: () => ({ measureInWindow: (cb: (...args: number[]) => void) => cb(0, 0, 400, 800) }) }); });
  const callout = tree!.root.findByProps({ accessibilityLiveRegion: 'polite' });
  assert.ok(callout.props.style[1].top > 108, 'explanation is below the Bond bar');
  const press = tree!.root.findByType('Button' as React.ElementType).props.onPress;
  let pending: Promise<void>;
  await act(async () => { pending = press(); void press(); });
  assert.equal(attempts, 1);
  assert.equal(tree!.root.findByType('Button' as React.ElementType).props.disabled, true);
  await act(async () => { rejectSave(new Error('disk')); await pending; });
  assert.equal(tree!.root.findByType('Button' as React.ElementType).props.label, 'Try again');
  await act(async () => tree!.root.findByType('Button' as React.ElementType).props.onPress());
  assert.equal(attempts, 2);
  assert.equal(tree!.root.findByType('Button' as React.ElementType).props.disabled, false);
  await act(async () => tree!.unmount());
});
