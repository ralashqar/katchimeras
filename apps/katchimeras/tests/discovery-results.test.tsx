import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { CHAIN_HOMES } from '@/features/encounter/chain-homes';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { frontierReclaimTimber, FRONTIER_TILES } from '@/constants/frontier-tiles';

test('every introduction grants supplies with victory, once, without a pending salvage choice', () => {
  for (const home of CHAIN_HOMES) {
    const state = createInitialMergeWorldState(0);
    const command = { type: 'completeEncounter' as const, missionId: `frontier:${home.tileId}`, receiptId: `intro:${home.chain}`,
      katchimeraId: 'mossprout', helperWispId: null, difficulty: 'calm' as const, now: 10,
      outcome: { cleared: true, grade: 'bright' as const, resolveLeft: null, actions: 20, merges: 10, continues: 0, rescued: false } };
    const won = reduceMergeWorld(state, command);
    const timber = frontierReclaimTimber(FRONTIER_TILES.find(tile => tile.id === home.tileId)!) + 4;
    assert.equal(won.encounterCleared?.reclaimed?.timber, timber);
    assert.equal(won.state.chainProgress?.salvage[command.missionId], 'timber');
    assert.equal(won.state.materials!.timber, (state.materials?.timber ?? 0) + timber);
    assert.equal(reduceMergeWorld(won.state, command).state.materials!.timber, won.state.materials!.timber);
    assert.equal(reduceMergeWorld(won.state, { ...command, receiptId: 'replay' }).state.materials!.timber, won.state.materials!.timber);
  }
});

test('normal intro results expose one Continue action in a viewport-bounded scrollable card', async () => {
  const clock = nativeMotionHarness();
  let continued = 0;
  const module = loadNativeModule('components/katchadeck/world/battle-reward-card.tsx', {
    'react-native': { ...nativeViews, Text: 'Text', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 320, height: 568 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    'react-native-reanimated': { ...clock.animated, default: { ...clock.animated.default, Text: 'AnimatedText' }, withSpring: (to: number) => to },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/utils/merge-world/repository': { claimStoredFrontierSalvage: () => { throw new Error('No separate claim in intro results'); } },
    '@/constants/ftue-scene-layers': { FTUE_SCENE_LAYERS: { hero: 100 } },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: {} },
    '@/constants/glow': { GLOW: { name: 'Glow' } },
    '@/constants/katcha-ui': { KatchaUI: { type: { label: {}, display: {}, title: {} } } },
  });
  const Card = module.BattleRewardCard as React.ComponentType<any>;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Card reward={{ key: 'intro', title: 'Storm Garden', stars: 3, glow: 30, timber: 8, xp: 18 }} onContinue={() => continued++} />); });
  const buttons = tree.root.findAllByType('Button' as any);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]!.props.label, 'Continue');
  assert.equal(buttons[0]!.props.style.height, 60, 'button cannot inflate an unbounded card');
  const scroll = tree.root.findByType('ScrollView' as any);
  assert.equal(scroll.props.style.flexGrow, 0);
  assert.equal(scroll.parent!.props.style[1].maxHeight, 458);
  await act(async () => { buttons[0]!.props.onPress(); });
  assert.equal(continued, 1);
  await act(async () => tree.unmount());
});
