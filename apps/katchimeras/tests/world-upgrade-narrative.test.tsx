import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_STORIES, upgradeSpeaker } from '@/features/world-upgrades/world-upgrade-stories';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('required splash alternates portraits and cannot close before final saved Continue', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-narrative.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', Modal: 'Modal', ScrollView: 'ScrollView' },
    'react-native-reanimated': { ...motion.animated, withSpring: (to: number) => motion.animated.withTiming(to, { duration: 300 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) },
    './haven-character-portrait': { HavenCharacterPortrait: host('Portrait') },
    '@/constants/katcha-ui': { KatchaUI: { type: { companionCardTitle: { fontFamily: 'Fredoka' }, companionDisplay: { fontFamily: 'Fredoka' }, companionBody: { fontFamily: 'Manrope' } } } },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/constants/katchimera-skins': { katchimeraSkinById }, '@/game/days/visuals': { getCreatureVisual: () => ({ source: 1 }) },
    '@/features/world-upgrades/world-upgrade-stories': { WORLD_UPGRADE_STORIES, upgradeSpeaker },
    '@/features/world-upgrades/world-upgrade-progress': { upgradeCompletedLevel: () => 1 },
  });
  const Narrative = module.WorldUpgradeNarrative as React.ComponentType<Record<string, unknown>>;
  const world = createInitialMergeWorldState(Date.UTC(2026, 8, 6), ['mossprout']);
  const story = WORLD_UPGRADE_STORIES[0]; let closed = 0; let fail = false; const saved: number[] = [];
  const props = { offer: { ...worldUpgradeOffers(world)[0], currentLevel: 1, eligible: false }, world, required: true,
    onClose: () => closed++, saveRead: async (_id: string, count: number) => { if (fail) throw new Error('offline'); saved.push(count); } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Narrative {...props} />); });
  const visible = () => tree!.root.findAllByType(host('Text')).map((node) => node.props.children);
  const button = () => tree!.root.findByType(host('Button'));
  const modal = tree!.root.findByType(host('Modal'));
  assert.equal(modal.props.statusBarTranslucent, true); assert.equal(modal.props.navigationBarTranslucent, true);
  assert.ok(visible().includes(story.before[0].text)); assert.ok(!visible().includes(story.before[1].text));
  assert.equal(tree!.root.findAllByType(host('Pressable')).filter((node) => node.props.accessibilityLabel === 'Close story history').length, 0);
  await act(async () => modal.props.onRequestClose()); assert.equal(closed, 0, 'Back cannot dismiss required story');
  const escape = tree!.root.findAllByType(host('AnimatedView')).find((node) => node.props.onAccessibilityEscape)!;
  await act(async () => escape.props.onAccessibilityEscape()); assert.equal(closed, 0);
  await act(async () => { button().props.onPress(); button().props.onPress(); });
  assert.deepEqual(saved, [2], 'rapid taps reveal only one next line');
  const portraits = tree!.root.findAllByType(host('Portrait'));
  assert.equal(portraits.length, 2);
  assert.equal(portraits[0].parent!.parent!.props.style[1].flexDirection, 'row-reverse');
  assert.equal(portraits[1].parent!.parent!.props.style[1], false);
  assert.ok(visible().includes(story.before[1].text)); assert.ok(!visible().includes(story.before[2].text));
  await act(async () => tree!.root.findByType(host('ScrollView')).props.onScroll({ nativeEvent: { contentOffset: { y: 0 }, layoutMeasurement: { height: 100 }, contentSize: { height: 400 } } }));
  assert.deepEqual(saved, [2], 'scroll never advances');
  fail = true; await act(async () => button().props.onPress());
  assert.equal(button().props.label, 'Try again'); assert.ok(!visible().includes(story.before[2].text)); assert.equal(closed, 0);
  fail = false; await act(async () => button().props.onPress());
  await act(async () => button().props.onPress());
  assert.ok(visible().includes(story.after[0].text)); assert.equal(closed, 0, 'revealing final line does not acknowledge it');
  assert.equal(button().props.label, 'Continue');
  fail = true; await act(async () => button().props.onPress()); assert.equal(closed, 0, 'final save failure keeps required gate');
  fail = false; await act(async () => button().props.onPress()); assert.equal(closed, 1);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Narrative {...props} world={{ ...world, upgradeStoryRead: { [story.id]: 4 } }} />); });
  assert.ok(visible().includes(story.after[0].text)); assert.equal(button().props.label, 'Continue', 'resume still requires final acknowledgement');
  await act(async () => tree!.root.findByType(host('Modal')).props.onRequestClose()); assert.equal(closed, 1);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Narrative {...props} required={false} />); });
  await act(async () => tree!.root.findByType(host('Modal')).props.onRequestClose()); assert.equal(closed, 2, 'manual history can close');
  await act(async () => tree!.unmount());
  let releaseSave!: () => void;
  const pendingSave = new Promise<void>((resolve) => { releaseSave = resolve; });
  await act(async () => { tree = create(<Narrative {...props} world={{ ...world, upgradeStoryRead: { [story.id]: 4 } }} saveRead={() => pendingSave} />); });
  await act(async () => button().props.onPress());
  await act(async () => tree!.unmount());
  await act(async () => releaseSave());
  assert.equal(closed, 2, 'an interrupted save cannot acknowledge an unmounted story or dismiss a newer one');
});
