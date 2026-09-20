import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import { normalizeWispState } from '@/utils/wisp-state';
import { upgradeLanternWorld } from '@/features/wisps/lantern-world';
import * as upgradePanelModel from '@/features/upgrade-stage/upgrade-panel-model';
import * as lanternLevels from '@/constants/wisp-lantern-levels';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fixture = () => buildPlayerProfileFixtures().find(f => f.id === 'fixture:lantern-level-2-ready')!;

test('hub groups packs, preserves navigation, and hands growing the Lantern to the upgrade stage', async () => {
  const state = normalizeWispState(JSON.parse(fixture().domains.keyValue.values['katchimera.wisps.v2']));
  const module = loadNativeModule('components/katchadeck/wisps/wisp-lantern-hub.tsx', {
    'react-native': { ...nativeViews, ScrollView: 'ScrollView', Text: 'Text', Pressable: 'Pressable' },
    'expo-image': { Image: 'Image' }, 'react-native-reanimated': nativeMotionHarness().animated,
    '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/wisp-lantern-art': { LANTERN_LEVEL_ART: { 1: 1, 2: 2, 3: 3 } },
    '@/constants/wisp-card-art': { WISP_CARD_ART: { pack: 1 } },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/world/companion-achievement-celebration': { CelebrationParticles: 'Particles' },
    './wisp-card-deck': { WispCollectionDeck: 'Deck' }, './wisp-collection-card': { WispCollectionCard: 'Card' }, './wisp-companion': { WispCompanion: 'Wisp' },
    '@/utils/game-clock': { gameNow: () => Date.now() },
  });
  let opened = ''; let upgradeOpens = 0;
  const props = { world: fixture().domains.mergeWorld.state, state, ownedIds: Object.keys(state.inventory), pending: false, errorView: null, onClose() {}, onGarden() {}, onOpen: (id: string) => { opened = id; }, onCommand() {}, onOpenUpgrade: () => { upgradeOpens++; }, onResidents() {}, onEquip() {} };
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(module.WispLanternHub as React.ComponentType<any>, props)); });
  const homeScroll = renderer!.root.findByType('ScrollView' as any);
  const buttons = () => renderer!.root.findAllByType('Button' as any);
  assert.equal(buttons().filter(b => b.props.label === 'Open').length, 2);
  await act(async () => buttons().find(b => b.props.label === 'Open')!.props.onPress());
  assert.equal(opened, 'fixture:pack:0');
  await act(async () => buttons().find(b => b.props.label === 'Upgrade ready')!.props.onPress());
  assert.equal(upgradeOpens, 1, 'growing the Lantern leaves the hub for the shared upgrade stage');
  assert.equal(renderer!.root.findAllByType('ScrollView' as any).length, 1, 'the hub keeps no upgrade page of its own');
  await act(async () => renderer!.update(React.createElement(module.WispLanternHub as React.ComponentType<any>, { ...props, world: upgradeLanternWorld(props.world, 2) })));
  assert.ok(renderer!.root.findAllByType('Image' as any).some(i => i.props.source === 2));
  assert.ok(buttons().some(b => b.props.label === 'Upgrade'), 'level 2 is not ready for level 3 yet');
  await act(async () => renderer!.root.findAllByProps({ accessibilityRole: 'tab' })[1].props.onPress());
  await act(async () => renderer!.root.findByProps({ accessibilityLabel: 'View Little Lantern Visitors' }).props.onPress());
  assert.equal(renderer!.root.findAllByType('Deck' as any).length, 1);
  await act(async () => renderer!.root.findByProps({ accessibilityLabel: 'Back to collection' }).props.onPress());
  assert.equal(renderer!.root.findAllByProps({ accessibilityRole: 'tab' })[1].props.accessibilityState.selected, true);
  assert.equal(renderer!.root.findAllByType('ScrollView' as any)[0], homeScroll);
  await act(async () => renderer!.unmount());
});

test('the Lantern grows on the shared upgrade stage: free milestones, a pinned action, and the next level after', async () => {
  const motion = nativeMotionHarness(); const frames: (() => void)[] = [];
  const globals = { setTimeout, clearTimeout, requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} };
  const pan: Record<string, () => unknown> = { enabled: () => pan, activeOffsetY: () => pan, onUpdate: () => pan, onEnd: () => pan };
  const shared = {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', ScrollView: 'ScrollView', Platform: { OS: 'ios' }, AccessibilityInfo: { setAccessibilityFocus() {} }, findNodeHandle: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': motion.animated,
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-haptics': { notificationAsync: async () => undefined, NotificationFeedbackType: { Success: 'success' } },
    'react-native-gesture-handler': { Gesture: { Pan: () => pan }, GestureDetector: ({ children }: { children: React.ReactNode }) => children },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/katcha-surface': { KatchaSurfaceProvider: ({ children }: { children: React.ReactNode }) => children },
    '@/components/katchadeck/world/companion-achievement-celebration': { CelebrationParticles: 'Particles' },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 42 } },
    '@/constants/katcha-ui': { KatchaUI: { touchTarget: 44, radius: { pill: 999 }, type: { companionCardTitle: {}, companionBody: {}, label: {} } } },
    '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/upgrade-panel': { UpgradePanelUI: new Proxy({ motion: { enter: 260, exit: 140, settle: 300 } } as Record<string, unknown>, { get: (tokens, key: string) => key in tokens ? tokens[key] : ['#000', '#000', '#000'] }) },
    '@/constants/wisp-lantern-levels': lanternLevels,
    '@/features/upgrade-stage/upgrade-panel-model': upgradePanelModel,
    '@/features/upgrade-stage/upgrade-level-art': { lanternLevelArt: (level: number) => 900 + level },
  };
  const rows = loadNativeModule('components/katchadeck/upgrade/upgrade-rows.tsx', shared, globals);
  const dock = loadNativeModule('components/katchadeck/upgrade/upgrade-dock.tsx', { ...shared, './upgrade-rows': rows }, globals);
  const module = loadNativeModule('components/katchadeck/wisps/wisp-lantern-upgrade-panel.tsx', {
    ...shared, '@/components/katchadeck/upgrade/upgrade-dock': dock, '@/components/katchadeck/upgrade/upgrade-rows': rows,
  }, globals);
  const Panel = module.WispLanternUpgradePanel as React.ComponentType<any>;
  const layout = upgradeStageLayout({ width: 390, height: 844 }, { top: 59, bottom: 34 });
  let upgraded = 0; let gardens = 0; let closes = 0;
  const props = { world: fixture().domains.mergeWorld.state, layout, bottomInset: 34, onClose: () => { closes++; }, onGarden: () => { gardens++; }, onUpgrade: async (level: number) => { upgraded = level; } };
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(<Panel {...props} />); });
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); });
  const buttons = () => renderer!.root.findAllByType('Button' as any);
  const texts = () => renderer!.root.findAllByType('Text' as any).map((node) => [node.props.children].flat().filter((child) => typeof child === 'string' || typeof child === 'number').join(''));
  assert.ok(texts().includes('Gathering') && texts().includes('100%'), 'the hero row shows the level being reached, the title bar how close it is');
  const pictures = () => renderer!.root.findAllByType('Image' as any).map((node) => node.props.source).filter((source) => typeof source === 'number' && source > 900);
  assert.deepEqual(pictures(), [901, 901], 'the hero and the reached slot show the Lantern as it is; the next one is not pictured');
  assert.ok(texts().includes('Resident Wisps') && texts().includes('3') && texts().includes('+1'), 'a stat reads its value and what the level adds');
  assert.ok(texts().includes('2 / 2') && texts().includes('10 / 10'), 'both milestones read complete');
  assert.equal(buttons().some((b) => b.props.label === 'Go'), false, 'nothing left to go and do');
  const action = buttons().find((b) => b.props.accessibilityLabel === 'Upgrade to Level 2, free')!;
  assert.equal(action.props.label, 'Upgrade'); assert.ok(texts().includes('Free'));
  assert.equal(action.props.disabled, false); assert.equal(action.props.cost, undefined, 'a free milestone shows no price');
  await act(async () => { await action.props.onPress(); });
  assert.equal(upgraded, 2); assert.equal(closes, 0, 'the panel stays up across the upgrade');
  await act(async () => renderer!.update(<Panel {...props} world={upgradeLanternWorld(props.world, 2)} />));
  assert.ok(texts().includes('Brighter Light'), 'the hero row moves on to the next level');
  assert.deepEqual(pictures(), [902, 901, 902], 'and the Lantern it shows is the one just gained');
  assert.equal(renderer!.root.findAllByType('AnimatedView' as any).length, 2, 'the gained slot pops once, beside the panel itself');
  assert.equal(buttons().find((b) => b.props.accessibilityLabel === 'Upgrade to Level 3, free')!.props.disabled, true);
  const slots = () => renderer!.root.findAllByProps({ accessibilityRole: 'radio' }).filter((node) => typeof node.type === 'string');
  await act(async () => slots()[0].props.onPress());
  assert.ok(texts().includes('First Light') && texts().includes('Reached'), 'a reached level can be looked back at');
  assert.equal(buttons().some((b) => b.props.label === 'Upgrade'), false);
  await act(async () => { buttons().find((b) => b.props.label === 'Go')!.props.onPress(); motion.advance(140); });
  assert.equal(gardens, 1, 'an open milestone leads to the Garden once the panel has left');
  await act(async () => renderer!.unmount());
});
