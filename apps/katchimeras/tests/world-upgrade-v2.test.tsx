import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_STORIES, upgradePercent, upgradeSpeaker } from '@/features/world-upgrades/world-upgrade-stories';
import { reconcileUpgradeProgress } from '@/features/world-upgrades/world-upgrade-progress';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { LEGACY_WORLD_UPGRADE_FLOWS, WORLD_UPGRADE_FLOWS } from '@/features/world-upgrades/world-upgrade-flows';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.UTC(2026, 8, 6);
const initial = () => ({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 10000 });
test('shared dialogue portrait preserves the world-selector circle and art geometry', () => {
  const module = loadNativeModule('components/katchadeck/world/haven-character-portrait.tsx', {
    'react-native': nativeViews, 'expo-image': { Image: 'Image' },
  });
  for (const size of [156, 72]) {
    const portrait = module.HavenCharacterPortrait({ source: 42, size });
    const [circle, art] = portrait.props.children;
    assert.equal(portrait.props.style.width, size);
    assert.ok(Math.abs(circle.props.style.width - 112 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.borderRadius - 56 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.top - 20 * size / 156) < 1e-9);
    assert.equal(circle.props.style.borderColor, '#FFF6D8');
    assert.equal(art.props.style.width, size); assert.equal(art.props.source, 42);
  }
});
test('every authored purchase has a unique complete story and valid live speakers', () => {
  assert.equal(WORLD_UPGRADE_STORIES.length, 26);
  assert.equal(new Set(WORLD_UPGRADE_STORIES.map((story) => story.id)).size, 26);
  for (const offer of WORLD_UPGRADE_DEFINITIONS) {
    const story = WORLD_UPGRADE_STORIES.find((item) => item.offerId === offer.id && item.level === offer.nextLevel);
    assert.ok(story); assert.equal(story.before.length, 3); assert.equal(story.after.length, 1);
    for (const line of [...story.before, ...story.after]) { assert.ok(line.text.length); assert.ok(katchimeraSkinById.get(line.speaker)?.visualKey); }
    if (story.rewardSkinId) assert.equal(katchimeraSkinById.get(story.rewardSkinId)?.status, 'live');
  }
  const guest = WORLD_UPGRADE_STORIES.flatMap((story) => story.before).find((line) => line.speaker === 'steppling')!;
  assert.equal(upgradeSpeaker(guest, false).speaker, 'mossprout');
  assert.equal(upgradeSpeaker(guest, true).speaker, 'steppling');
  assert.ok(WORLD_UPGRADE_FLOWS.every((flow) => flow.version === 3));
  assert.ok(LEGACY_WORLD_UPGRADE_FLOWS.every((flow) => flow.version === 2));
});
test('Glow percent cannot signal affordable before exact cost', () => {
  assert.deepEqual([0, 10, 19.99, 20, 40].map((balance) => upgradePercent(balance, 20)), [0, 50, 99, 100, 100]);
  assert.equal(upgradePercent(0, 0), 100); assert.equal(upgradePercent(-1, 20), 0);
  const offers = worldUpgradeOffers(initial());
  assert.equal(offers.find((offer) => offer.id === 'haven:mossprout')?.maxLevel, 4);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.maxLevel, 1);
});
test('milestone grant is atomic with payment, survives reload and cannot be duplicated', () => {
  let state = initial();
  for (const [islandId, skinId] of [['bloom-garden', 'petalimp'], ['orchard-grove', 'amberleaf'], ['wildgrowth-grove', 'fernip']] as const) {
    for (const level of [1, 2, 3, 4] as const) {
      const command = { type: 'upgradeMossproutNatureIsland' as const, islandId, level, now: NOW, receiptId: `v2:${islandId}:${level}` };
      if (level === 4) {
        const failed = reduceMergeWorld({ ...state, coins: 0 }, command);
        assert.equal(failed.changed, false); assert.equal(failed.state.upgradeSkinGrants?.[`nature:${islandId}:4`], undefined);
      }
      state = reduceMergeWorld(state, command).state;
      const paid = state.coins;
      state = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);
      assert.equal(reduceMergeWorld(state, command).state.coins, paid);
      assert.equal(state.upgradeSkinGrants?.[`nature:${islandId}:4`]?.skinId, level === 4 ? skinId : undefined);
    }
  }
  assert.equal(Object.keys(state.upgradeSkinGrants ?? {}).length, 3);
  const migrated = normalizeMergeWorldState({ ...state, upgradeSkinGrants: undefined }, NOW);
  assert.deepEqual(migrated.upgradeSkinGrants, state.upgradeSkinGrants);
  const alreadyOwned = reconcileUpgradeProgress({ ...state, upgradeSkinGrants: {}, ownedKatchimeraCards: [
    ...state.ownedKatchimeraCards, { cardId: 'petalimp', familyId: 'mossprout', acquisition: 'story_resident', sourceReceiptId: 'existing', acquiredAt: NOW, coinCost: 0 },
  ] });
  assert.equal(alreadyOwned.upgradeSkinGrants?.['nature:bloom-garden:4']?.skinId, 'petalimp', 'existing art cards do not prevent the wardrobe unlock');
  assert.equal(alreadyOwned.ownedKatchimeraCards.filter((card) => card.cardId === 'petalimp').length, 1, 'no duplicate collectible is created');
});
test('read cursors clamp to available dialogue and do not mutate currency or tiles', () => {
  const state = initial();
  const reconciled = reconcileUpgradeProgress({ ...state, upgradeStoryRead: { 'nature:seed-nursery:1': 500, 'nature:seed-nursery:4': 2, bogus: 8 } });
  assert.deepEqual(reconciled.upgradeStoryRead, { 'nature:seed-nursery:1': 3 });
  assert.equal(reconciled.coins, state.coins); assert.deepEqual(reconciled.haven, state.haven);
});

test('panel waits for exit animation, keeps shortage explicit, and reading never buys', async () => {
  const motion = nativeMotionHarness(); const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const readCalls: unknown[] = [];
  const frames: (() => void)[] = [];
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-panel.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', Modal: 'Modal', ScrollView: 'ScrollView', AccessibilityInfo: { setAccessibilityFocus() {} }, findNodeHandle: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { ...motion.animated, withSpring: (to: number) => motion.animated.withTiming(to, { duration: 300 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-image': { Image: host('Image') },
    './world-upgrade-narrative': { WorldUpgradeNarrative: host('Narrative') },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 42 } },
    '@/constants/katcha-ui': { KatchaUI: { type: { companionCardTitle: { fontFamily: 'Fredoka' }, companionDisplay: { fontFamily: 'Fredoka' }, companionBody: { fontFamily: 'Manrope' } } } },
    '@/constants/theme': { AppFontFamilies: { fredokaBold: 'Fredoka' } },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/constants/game-ui': { GameUI: { type: { title: {}, body: {} }, color: { ink: '#000', inkSecondary: '#333', danger: '#900' } } },
    '@/constants/katchimera-skins': { katchimeraSkinById }, '@/game/days/visuals': { getCreatureVisual: () => ({ source: 1 }) },
    '@/features/world-upgrades/world-upgrade-stories': { WORLD_UPGRADE_STORIES, upgradeSpeaker, worldUpgradeStory: (id: string, level: number) => WORLD_UPGRADE_STORIES.find((story) => story.offerId === id && story.level === level) },
    '@/features/world-upgrades/world-upgrade-progress': { upgradeCompletedLevel: () => 0 },
    '@/utils/merge-world/repository': { saveUpgradeStoryRead: async (...args: unknown[]) => { readCalls.push(args); } },
    '@/components/katchadeck/onboarding/companion-ftue-coachmark': { CompanionFtueCoachmark: host('Coachmark') },
  }, { setTimeout, clearTimeout, requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} });
  const Panel = module.WorldUpgradePanel as React.ComponentType<Record<string, unknown>>;
  let closes = 0; let purchases = 0;
  const world = { ...initial(), coins: 0 };
  const props = { world, offer: worldUpgradeOffers(world)[0], busy: false, actionRef: { current: null }, onClose: () => closes++, onConfirm: () => purchases++, onGarden() {}, saveRead: async (...args: unknown[]) => { readCalls.push(args); } };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Panel {...props} />); motion.advance(400); });
  const panelMotion = () => tree!.root.findByType(host('AnimatedView')).props.style[2].read();
  assert.equal(panelMotion().opacity, 0, 'cold mount is invisible until native layout completes');
  assert.equal(panelMotion().transform[0].scale, 1, 'first scroll measurement happens at full scale');
  const scroller = tree!.root.findByType(host('ScrollView'));
  assert.equal(scroller.props.removeClippedSubviews, false);
  await act(async () => scroller.props.onLayout({ nativeEvent: { layout: { width: 0, height: 0 } } }));
  assert.equal(frames.length, 0, 'empty native layout cannot begin the entrance');
  const measuredViews = tree!.root.findAllByType(host('View')).filter((node) => node.props.onLayout);
  await act(async () => {
    measuredViews[0].props.onLayout({ nativeEvent: { layout: { height: 650 } } });
    measuredViews[1].props.onLayout({ nativeEvent: { layout: { height: 86 } } });
    scroller.props.onContentSizeChange(332, 440);
  });
  assert.equal(tree!.root.findByType(host('AnimatedView')).props.style[1].height, 530, 'card fits complete content instead of stopping at 480');
  await act(async () => scroller.props.onLayout({ nativeEvent: { layout: { width: 332, height: 440 } } }));
  assert.equal(panelMotion().opacity, 0, 'valid layout still waits for a frame');
  await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(300); });
  assert.equal(panelMotion().opacity, 1); assert.equal(panelMotion().transform[0].scale, 1);
  await act(async () => scroller.props.onLayout({ nativeEvent: { layout: { width: 332, height: 440 } } }));
  assert.equal(frames.length, 0, 'later content layouts do not restart the entrance');
  assert.equal(scroller.props.scrollEnabled, false, 'no scrolling when the complete content fits');
  await act(async () => scroller.props.onContentSizeChange(332, 700));
  assert.equal(tree!.root.findByType(host('AnimatedView')).props.style[1].height, 650, 'larger content uses all space below the stable top');
  await act(async () => scroller.props.onLayout({ nativeEvent: { layout: { width: 332, height: 560 } } }));
  assert.equal(scroller.props.scrollEnabled, true, 'scroll only when content exceeds the screen');
  await act(async () => scroller.props.onContentSizeChange(332, 440));
  await act(async () => scroller.props.onLayout({ nativeEvent: { layout: { width: 332, height: 440 } } }));
  assert.equal(tree!.root.findByType(host('AnimatedView')).props.style[1].height, 530);
  assert.equal(frames.length, 0, 'resizing does not replay the bounce');
  const buy = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!;
  assert.equal(buy.props.disabled, true); assert.equal(buy.props.cost.amount, 20);
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 0);
  assert.ok(!tree!.root.findAllByType(host('Text')).some((node) => node.props.children === WORLD_UPGRADE_STORIES[0].before[0].text), 'base info contains no dialogue');
  assert.equal(readCalls.length, 0, 'opening base info does not mark story read');
  const storyButton = tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Expand story history')!;
  await act(async () => storyButton.props.onPress());
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 1);
  await act(async () => tree!.root.findByType(host('Narrative')).props.onClose());
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 0);
  assert.equal(readCalls.length, 0); assert.equal(purchases, 0);
  const close = tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Close upgrade')!;
  await act(async () => { close.props.onPress(); close.props.onPress(); motion.advance(139); });
  assert.equal(closes, 0);
  await act(async () => motion.advance(1)); assert.equal(closes, 1);
  await act(async () => tree!.unmount());
  const affordable = { ...props, world: { ...world, coins: 20 } };
  await act(async () => { tree = create(<Panel {...affordable} busy />); });
  const busyClose = tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Close upgrade')!;
  await act(async () => { busyClose.props.onPress(); motion.advance(150); });
  assert.equal(closes, 1, 'busy purchase cannot be dismissed');
  await act(async () => tree!.update(<Panel {...affordable} />));
  const confirm = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!;
  await act(async () => { confirm.props.onPress(); confirm.props.onPress(); motion.advance(139); });
  assert.equal(purchases, 0);
  await act(async () => motion.advance(1)); assert.equal(purchases, 1, 'rapid taps spend once after exit');
  await act(async () => tree!.update(<Panel {...affordable} error="Please retry" />));
  const retry = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Try again')!;
  assert.equal(retry.props.disabled, false, 'failure restores an actionable panel');
  await act(async () => tree!.unmount());
  const saved = { ...world, upgradeStoryRead: { 'haven:mossprout:1': 2 } };
  const beforeResume = readCalls.length;
  await act(async () => { tree = create(<Panel {...props} world={saved} />); });
  assert.equal(readCalls.length, beforeResume, 'resuming does not reset the saved cursor');
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 0, 'saved progress never puts dialogue in the base card');
  await act(async () => tree!.unmount());
});
