import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('overlay keeps FTUE modal, uses player portrait, guards taps and finishes exit before reward callback', async () => {
  const motion = nativeMotionHarness();
  const timers = new Map<number, () => void>(); let serial = 0;
  const module = loadNativeModule('components/katchadeck/world/conversation-narrative-overlay.tsx', {
    'react-native': { ...nativeViews, Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', ScrollView: 'ScrollView' },
    'react-native-reanimated': { ...motion.animated,
      withTiming: (to: number, options = { duration: 180 }) => motion.animated.withTiming(to, options),
      withSpring: (to: number) => motion.animated.withTiming(to, { duration: 300 }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) },
    './narrative-presentation': { NarrativeDialogue: host('Dialogue'), narrativeStyles: {} },
    './haven-character-portrait': { HavenCharacterPortrait: host('Portrait') },
    '@/components/katchadeck/egg-avatar/egg-avatar': { EggAvatar: host('Egg') },
    '@/features/egg-avatar/egg-avatar-provider': { useEggAvatar: () => ({ equippedSkinId: 'cream', equippedFaceId: 'happy' }) },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map([['mossprout', { displayName: 'Mossprout', visualKey: 'mossprout' }]]) },
    '@/game/days/visuals': { getCreatureVisual: () => ({ source: 1 }) },
  }, { setTimeout: (fn: () => void) => { timers.set(++serial, fn); return serial; }, clearTimeout: (id: number) => timers.delete(id) });
  const Overlay = module.ConversationNarrativeOverlay as React.ComponentType<any>;
  let closed = 0; let rewarded = 0; let perform!: (action: () => unknown, exit?: boolean) => void;
  const props = { title: 'Mossprout', checkpoint: 'one', required: true, onClose: () => closed++,
    entries: [{ id: 'a', speaker: 'mossprout', text: 'Hello' }, { id: 'b', speaker: 'player', text: 'Hi' }],
    children: (run: typeof perform) => { perform = run; return React.createElement(host('ResultCard')); },
  };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Overlay {...props} />); });
  assert.equal(tree.root.findByType(host('Modal')).props.statusBarTranslucent, true);
  const scrolling = tree.root.findByType(host('ScrollView'));
  assert.equal(scrolling.findAllByType(host('ResultCard')).length, 1, 'results and dialogue share one scroll view');
  await act(async () => tree.root.findByType(host('Modal')).props.onRequestClose());
  assert.equal(closed, 0);
  assert.deepEqual(tree.root.findAllByType(host('Dialogue')).map((node) => node.props.right), [false, true]);
  assert.equal(tree.root.findAllByType(host('Dialogue'))[1].props.portrait.props.children.props.faceId, 'happy');
  await act(async () => { perform(() => { assert.equal(tree.root.findByType(host('Modal')).props.visible, false); rewarded++; }, true); perform(() => { rewarded++; }, true); });
  assert.equal(rewarded, 0);
  assert.equal(timers.size, 1);
  await act(async () => { motion.advance(180); for (const fn of timers.values()) fn(); timers.clear(); });
  assert.equal(rewarded, 1);
  await act(async () => perform(() => { throw new Error('disk full'); }));
  assert.ok(tree.root.findAllByType(host('Text')).some((node) => String(node.props.children).includes('Could not save')));
  await act(async () => { tree.update(<Overlay {...props} required={false} />); });
  await act(async () => tree.root.findByType(host('Modal')).props.onRequestClose());
  assert.equal(closed, 0);
  await act(async () => { for (const fn of timers.values()) fn(); timers.clear(); });
  assert.equal(closed, 1);
  await act(async () => perform(() => { rewarded++; }, true));
  await act(async () => tree.unmount());
  assert.equal(timers.size, 0, 'unmount cancels an unfinished exit callback');
  assert.equal(rewarded, 1);
  await act(async () => { tree = create(<Overlay {...props} inline />); });
  assert.equal(tree.root.findAllByType(host('Modal')).length, 0, 'one-off messages never mount a narrative modal');
  assert.equal(tree.root.findAllByType(host('Dialogue')).length, 0, 'the stage owns overhead speech for inline interactions');
  await act(async () => tree.unmount());

  await act(async () => { tree = create(<Overlay {...props} paced />); });
  assert.equal(tree.root.findAllByType(host('Dialogue')).length, 1, 'paced narrative starts with one speech bubble');
  assert.equal(tree.root.findAllByType(host('ResultCard')).length, 0, 'the result or choices wait behind the dialogue');
  const advanceTimer = async () => {
    const callback = [...timers.values()].at(-1);
    assert.ok(callback, 'paced dialogue schedules an automatic reading fallback');
    timers.clear();
    await act(async () => callback());
  };
  await advanceTimer();
  assert.equal(tree.root.findAllByType(host('Dialogue')).length, 2);
  assert.equal(tree.root.findAllByType(host('ResultCard')).length, 0);
  await advanceTimer();
  assert.equal(tree.root.findAllByType(host('ResultCard')).length, 1, 'controls animate in after the final reading beat');
  await act(async () => tree.unmount());
  assert.equal(timers.size, 0);
});


test('chained FTUE choices remain pressable through the real overlay and choice list', async () => {
  const motion = nativeMotionHarness();
  const timers = new Map<number, () => void>(); let serial = 0;
  const native = { ...nativeViews, Modal: 'Modal', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', useWindowDimensions: () => ({ width: 390 }) };
  const overlay = loadNativeModule('components/katchadeck/world/conversation-narrative-overlay.tsx', {
    'react-native': native,
    'react-native-reanimated': { ...motion.animated, withTiming: (to: number, options = { duration: 180 }) => motion.animated.withTiming(to, options), withSpring: (to: number) => motion.animated.withTiming(to, { duration: 300 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) },
    './narrative-presentation': { NarrativeDialogue: host('Dialogue'), narrativeStyles: {} },
    './haven-character-portrait': { HavenCharacterPortrait: host('Portrait') },
    '@/components/katchadeck/egg-avatar/egg-avatar': { EggAvatar: host('Egg') },
    '@/features/egg-avatar/egg-avatar-provider': { useEggAvatar: () => ({}) },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
    '@/game/days/visuals': { getCreatureVisual: () => null },
  }, { setTimeout: (fn: () => void) => { timers.set(++serial, fn); return serial; }, clearTimeout: (id: number) => timers.delete(id) });
  const choices = loadNativeModule('components/katchadeck/world/companion-choice-list.tsx', {
    'react-native': native,
    '@/components/themed-text': { ThemedText: host('Label') },
    '@/components/ui/icon-symbol': { IconSymbol: host('Icon') },
    '@/constants/katcha-ui': { KatchaUI: { companionScenePanel: {} } },
    '@/hooks/use-companion-adaptive-panel': { companionChoiceColumnCount: () => 1, COMPANION_CHOICE_GAP: 10 },
  });
  const saved = new Map<string, unknown>();
  let failSave = false;
  const storage = { getStoredJson: (key: string, fallback: unknown) => saved.get(key) ?? fallback,
    setStoredJson: (key: string, value: unknown) => { if (failSave) throw new Error('disk'); saved.set(key, value); } };
  const history = loadNativeModule('features/onboarding/ftue-narrative-history.ts', { '@/utils/app-storage': storage });
  const module = loadNativeModule('components/katchadeck/world/ftue-grow-dialogue.tsx', {
    './conversation-narrative-overlay': overlay,
    './companion-choice-list': choices,
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/features/onboarding/ftue-narrative-history': history,
    '@/utils/app-storage': storage,
  });
  const Grow = module.FtueGrowDialogue as React.ComponentType<any>;
  const props = { runId: 'touch-regression', id: 'garden-return', prompt: 'Garden', choices: [{ id: 'pleased', label: 'You look pleased.', reply: 'I am.' }],
    nextDialogue: { id: 'first-notice', prompt: 'What catches your attention?', choices: [{ id: 'light', label: 'Some light', reply: 'Well noticed.' }] }, onFinish: async () => {} };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Grow {...props} />); });
  const revealUntil = async (controlIsVisible: () => boolean) => {
    for (let attempt = 0; attempt < 12 && !controlIsVisible(); attempt++) {
      const screenTap = tree.root.findAllByProps({ accessibilityLabel: 'Continue dialogue' })[0];
      assert.ok(screenTap, 'the full narrative surface advances the paced FTUE');
      await act(async () => screenTap.props.onPress());
    }
    assert.ok(controlIsVisible(), 'the next control appears after the dialogue beats');
  };
  assert.equal(tree.root.findAllByType(host('Dialogue')).length, 1, 'the first FTUE beat appears on its own');
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 0, 'choices wait for the prompt');
  await revealUntil(() => tree.root.findAllByProps({ accessibilityRole: 'radio' }).length > 0);
  const pressChoice = async () => {
    const radio = tree.root.findByProps({ accessibilityRole: 'radio' });
    assert.equal(radio.props.disabled, false);
    for (let parent = radio.parent; parent; parent = parent.parent) assert.notEqual(parent.props.pointerEvents, 'none', 'choice has no locked ancestor');
    const label = radio.findByType(host('Label'));
    assert.equal(label.props.selectable, false);
    assert.equal(label.props.pointerEvents, 'none', 'label passes touches to its option');
    await act(async () => radio.props.onPress());
  };
  await pressChoice();
  await revealUntil(() => tree.root.findAllByProps({ accessibilityRole: 'radio' }).length > 0);
  assert.equal(tree.root.findByType(host('Label')).props.children, 'Some light');
  failSave = true;
  await pressChoice();
  assert.ok(tree.root.findAllByType(host('Text')).some((node) => String(node.props.children).includes('Could not save')));
  failSave = false;
  await pressChoice();
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 0);
  await revealUntil(() => tree.root.findAllByType(host('Button')).length > 0);
  assert.ok(tree.root.findAllByType(host('Dialogue')).some((node) => node.props.text === 'Well noticed.'));
  assert.equal(tree.root.findByType(host('Button')).props.label, 'Continue');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Grow {...props} />); });
  await revealUntil(() => tree.root.findAllByType(host('Button')).length > 0);
  assert.equal(tree.root.findByType(host('Button')).props.label, 'Continue', 'saved noticing answer resumes without another choice');
  await act(async () => tree.unmount());
  assert.equal(timers.size, 0, 'paced reveal timers are cancelled when the overlay closes');
});


test('Seed reveal uses the selected intention and keeps its celebration behind the card', async () => {
  const motion = nativeMotionHarness();
  let intent = 'calm';
  class TestKeyframe {
    frames: Record<number, unknown>;
    durationMs = 0;
    constructor(frames: Record<number, unknown>) { this.frames = frames; }
    duration(durationMs: number) { this.durationMs = durationMs; return this; }
  }
  const module = loadNativeModule('components/katchadeck/world/mossprout-seed-narrative-reward.tsx', {
    'react-native': nativeViews,
    'expo-image': { Image: host('Image') },
    'react-native-reanimated': { ...motion.animated, Keyframe: TestKeyframe, useReducedMotion: () => false },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: host('Card') },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: host('Rays') },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map(['calm', 'progress', 'unsure'].map((id) => [id, { name: `Seed ${id}`, art: { seed: id } }])) },
    '@/features/onboarding/mossprout-bond-share': { mossproutFirstSeedForIntent: (id: string) => ({ id, message: 'A beginning.' }) },
    '@/utils/onboarding-state': { loadOnboardingProfile: () => ({ mossproutAnswers: { growthIntentId: intent } }) },
    './companion-achievement-celebration': { CelebrationParticles: host('Particles') },
  });
  const Seed = module.MossproutSeedNarrativeReward as React.ComponentType;
  for (intent of ['calm', 'progress', 'unsure']) {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<Seed />); });
    const card = tree.root.findByType(host('Card'));
    assert.equal(card.props.title, `Seed ${intent}`);
    assert.match(card.props.subtitle, /Ready to plant in the Garden/);
    const artwork = React.Children.toArray(card.props.artwork.props.children) as React.ReactElement<Record<string, unknown>>[];
    assert.equal(artwork[1].props.source, intent);
    assert.equal(artwork[0].props.rotationDurationMs, 24_000);
    const entrance = card.parent!.props.entering as TestKeyframe;
    assert.deepEqual(Object.keys(entrance.frames), ['0', '68', '100'], 'the seed performs one overshoot before settling');
    assert.equal(entrance.durationMs, 440);
    assert.equal(tree.root.findByType(host('Particles')).props.layerStyle.zIndex, 0);
    assert.equal(card.parent!.props.style.zIndex, 1);
    await act(async () => tree.unmount());
  }
});


test('Garden handoff stays empty, advances automatically, and exposes retry only on failure', async () => {
  const loaded = loadNativeModule('components/katchadeck/world/garden-planting-handoff.tsx', {
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
  });
  const Handoff = loaded.GardenPlantingHandoff as React.ComponentType<any>;
  let calls = 0;
  let fail = false;
  const advance = async () => { calls++; return !fail; };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Handoff onContinue={advance} />); });
  assert.equal(calls, 1);
  assert.equal(tree.toJSON(), null, 'normal handoff has no CTA or entrance content');
  await act(async () => tree.update(<Handoff onContinue={advance} />));
  assert.equal(calls, 1, 'rerender does not repeat navigation');
  await act(async () => tree.unmount());
  fail = true;
  await act(async () => { tree = create(<Handoff onContinue={advance} />); });
  const retry = tree.root.findByType(host('Button'));
  assert.equal(retry.props.label, 'Try opening the Garden again');
  fail = false;
  await act(async () => retry.props.onPress());
  assert.equal(calls, 3);
  assert.equal(tree.toJSON(), null);
  await act(async () => tree.unmount());
});
