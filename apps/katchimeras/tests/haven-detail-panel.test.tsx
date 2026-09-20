import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function load() {
  const motion = nativeMotionHarness(); const frames: (() => void)[] = [];
  const globals = { setTimeout, clearTimeout, requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} };
  const pan: Record<string, () => unknown> = { enabled: () => pan, activeOffsetY: () => pan, onUpdate: () => pan, onEnd: () => pan };
  const shared = {
    'react-native': { ...nativeViews, Platform: { OS: 'ios' }, Pressable: 'Pressable', Text: 'Text', ScrollView: 'ScrollView', AccessibilityInfo: { setAccessibilityFocus() {} }, findNodeHandle: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': motion.animated,
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-haptics': { notificationAsync: async () => undefined, NotificationFeedbackType: { Success: 'success' } },
    'react-native-gesture-handler': { Gesture: { Pan: () => pan }, GestureDetector: ({ children }: { children: React.ReactNode }) => children },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/katcha-surface': { KatchaSurfaceProvider: ({ children }: { children: React.ReactNode }) => children },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 42 } },
    '@/constants/katcha-ui': { KatchaUI: { touchTarget: 44, radius: { pill: 999 }, type: { companionCardTitle: {}, companionBody: {}, label: {} } } },
    '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/upgrade-panel': { UpgradePanelUI: new Proxy({ motion: { enter: 260, exit: 140, settle: 300 } } as Record<string, unknown>, { get: (tokens, key: string) => key in tokens ? tokens[key] : ['#000', '#000', '#000'] }) },
  };
  const rows = loadNativeModule('components/katchadeck/upgrade/upgrade-rows.tsx', shared, globals);
  const dock = loadNativeModule('components/katchadeck/upgrade/upgrade-dock.tsx', { ...shared, './upgrade-rows': rows }, globals);
  const module = loadNativeModule('components/katchadeck/world/haven-detail-panel.tsx', {
    ...shared, '@/components/katchadeck/upgrade/upgrade-dock': dock, '@/components/katchadeck/upgrade/upgrade-rows': rows,
  }, globals);
  return { module, motion, frames };
}

test('a Haven’s details dock on the upgrade stage: Restore hands over after the exit, a guided step cannot be closed', async () => {
  const { module, motion, frames } = load();
  const Panel = module.HavenDetailPanel as React.ComponentType<any>;
  const layout = upgradeStageLayout({ width: 390, height: 844 }, { top: 59, bottom: 34 });
  const calls: string[] = []; let registered: (() => void) | null = null;
  const props = {
    residentName: 'Feastle', level: 1, maxLevel: 3, nextCost: 400, glow: 240, upgrading: false, guided: false, artFor: (level: number) => 500 + level,
    levels: [{ level: 1, name: 'Quiet Hearth', description: 'A home with room to grow.', state: 'done' }, { level: 2, name: 'Warm Kitchen', description: 'The hearth is lit again.', state: 'next' }, { level: 3, name: 'Feast Hall', description: 'Room for everyone.', state: 'ahead' }],
    links: [{ label: 'Clearing story & history', onPress: () => calls.push('archive') }], layout, bottomInset: 34,
    registerDismiss: (dismiss: (() => void) | null) => { registered = dismiss; },
    onClose: () => calls.push('close'), onRestore: () => calls.push('restore'), onGarden: () => calls.push('garden'),
  };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Panel {...props} />); });
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); });
  const buttons = () => tree!.root.findAllByType('Button' as any);
  const texts = () => tree!.root.findAllByType('Text' as any).map((node) => [node.props.children].flat().filter((child) => typeof child === 'string' || typeof child === 'number').join(''));
  assert.ok(texts().includes('Warm Kitchen') && texts().includes('240 / 400') && texts().includes('60%'));
  const restore = buttons().find((b) => b.props.label === 'Restore')!;
  assert.equal(restore.props.disabled, true, 'short of Glow'); assert.equal(restore.props.cost.amount, 400);
  assert.equal(buttons().some((b) => b.props.label === 'Visit Feastle'), false, 'no Visit where the resident has no page');
  await act(async () => { buttons().find((b) => b.props.label === 'Tend garden')!.props.onPress(); motion.advance(140); });
  assert.deepEqual(calls, ['garden']);
  await act(async () => tree!.unmount());

  await act(async () => { tree = create(<Panel {...props} glow={900} onVisit={() => calls.push('visit')} />); });
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); });
  assert.ok(buttons().some((b) => b.props.label === 'Visit Feastle' && b.props.size === 'compact'));
  await act(async () => { buttons().find((b) => b.props.label === 'Restore')!.props.onPress(); motion.advance(139); });
  assert.deepEqual(calls, ['garden'], 'the hand-over waits for the exit');
  await act(async () => motion.advance(1));
  assert.deepEqual(calls, ['garden', 'restore']);
  await act(async () => tree!.unmount());

  await act(async () => { tree = create(<Panel {...props} glow={900} guided />); });
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); });
  assert.equal(tree!.root.findAllByProps({ accessibilityLabel: 'Close Haven details' }).length, 0, 'the guided restore has no close');
  assert.deepEqual(buttons().map((b) => b.props.label), ['Restore'], 'and offers only Restore');
  await act(async () => { registered?.(); motion.advance(200); });
  assert.equal(calls.includes('close'), false, 'a tap on the stage cannot close it either');
  await act(async () => tree!.unmount());

  const Hidden = module.UndiscoveredHavenPanel as React.ComponentType<any>;
  await act(async () => { tree = create(<Hidden layout={layout} bottomInset={34} registerDismiss={props.registerDismiss} onClose={props.onClose} />); });
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); });
  assert.ok(texts().includes('Hidden in the Dream Mist'));
  await act(async () => { registered?.(); motion.advance(140); });
  assert.equal(calls.at(-1), 'close', 'a tap on the stage closes the notice through its exit');
  await act(async () => tree!.unmount());
});
