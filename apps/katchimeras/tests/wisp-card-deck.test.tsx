import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WISP_RARITY } from '@/constants/wisp-rarity';
import type { WispPackInstance } from '@/types/wisp-lantern';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const reduced of [false, true]) test(`friend celebration grows a card before the pack deck (reduced motion: ${reduced})`, async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const motion = nativeMotionHarness();
  const mocks = {
    'react-native': { ...nativeViews, Text: 'Text', ScrollView: 'ScrollView' },
    'react-native-reanimated': { ...motion.animated, FadeOut: motion.animated.FadeIn, ZoomIn: motion.animated.FadeIn, useReducedMotion: () => reduced },
    '@/components/katchadeck/collection/collectible-card-deck': { CollectibleCardDeck: 'Deck' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'Rays' },
    '@/components/katchadeck/world/companion-achievement-celebration': { CelebrationParticles: 'Particles' },
    '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/wisp-card-art': { WISP_RARITY },
    '@/components/themed-text': { ThemedText: 'Text' },
    './wisp-collection-card': { WispCollectionCard: 'WispCard' },
  };
  const sequence = loadNativeModule('components/katchadeck/world/discovery-reward-sequence.tsx', mocks);
  const module = loadNativeModule('components/katchadeck/wisps/wisp-card-deck.tsx', {
    ...mocks,
    '@/components/katchadeck/world/discovery-reward-sequence': sequence,
  });
  const pack: WispPackInstance = {
    id: 'test-pack', definitionId: 'lantern-pouch', definitionVersion: 1, scope: 'local-lantern-v1',
    seed: 1, grantedAt: 1, openedAt: 2, revealed: 0, focusedCardIndex: 1,
    outcomes: [{ id: 'dewdrop', discovered: true, echoes: 0 }, { id: 'dewdrop', discovered: false, echoes: 1 }, { id: 'crystal', discovered: false, echoes: 5 }],
  };
  let focused = -1;
  let completed = 0;
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(module.WispPackReveal as React.ComponentType<any>, { pack, onFocus: (index: number) => { focused = index; }, onDone: () => completed++ })); });
  assert.equal(renderer.root.findAllByType('Particles' as any).length, reduced ? 0 : 1);
  assert.equal(renderer.root.findAllByType('Deck' as any).length, reduced ? 1 : 0);
  if (!reduced) {
    const hero = renderer.root.findByType('WispCard' as any);
    assert.equal(hero.props.wispId, 'dewdrop', 'the shared hero is the selected card itself');
    assert.equal(hero.props.back, undefined, 'the card grows face-up');
    assert.equal(renderer.root.findByType('Particles' as any).props.tier, 3, 'exact friend confetti');
    assert.equal(renderer.root.findByType('Rays' as any).props.rotationDurationMs, 18000);
    await act(async () => context.mock.timers.tick(1149));
    assert.equal(renderer.root.findAllByType('Deck' as any).length, 0);
    await act(async () => context.mock.timers.tick(1));
  }
  assert.equal(renderer.root.findAllByType('Particles' as any).length, 0);
  const deck = renderer.root.findByType('Deck' as any);
  assert.equal(deck.props.selectedId, 'test-pack:card:1', 'saved selection resumes on the duplicate slot');
  assert.equal(new Set(deck.props.cards.map((card: { id: string }) => card.id)).size, 3);
  await act(async () => deck.props.onSelect(deck.props.cards[2], 2));
  assert.equal(focused, 2);
  assert.equal(completed, 0, 'browsing does not consume the reveal');
  let face!: ReactTestRenderer;
  await act(async () => { face = create(deck.props.renderCard(deck.props.cards[0], 0, { width: 250 }, true)); });
  assert.equal(face.root.findByType('WispCard' as any).props.back, undefined);
  await act(async () => face.update(deck.props.renderCard(deck.props.cards[1], 1, { width: 250 }, true)));
  assert.equal(face.root.findAllByType('Particles' as any).length, 0, 'browsing does not restart the opening celebration');
  await act(async () => renderer.root.findByProps({ label: 'Keep 3 cards' }).props.onPress());
  assert.equal(completed, 1);
  await act(async () => { face.unmount(); renderer.unmount(); });
});

test('shared deck navigation selects card identity and bounds its arrows', async () => {
  const module = loadNativeModule('components/katchadeck/collection/collectible-card-deck.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/home/today-deck/deck-slot': { DeckVisualSlot: 'Slot', DeckCardHitTarget: 'Hit', deckSlotStyles: {} },
    '@/components/katchadeck/home/today-deck/deck-navigation': { resolveDeckStride: () => 230 },
    '@/components/katchadeck/home/today-deck/use-deck-controller': { useDeckController: ({ days, onSelect }: any) => ({ focusedIndex: { value: 0 }, swipeGesture: {}, navigateToIndex: (index: number) => onSelect(days[index].id) }) },
  });
  const cards = [{ id: 'petalimp' }, { id: 'fernip' }];
  const Deck = module.CollectibleCardDeck as React.ComponentType<any>;
  let selected = '';
  const props = { cards, onSelect: (card: { id: string }) => { selected = card.id; }, renderCard: (card: { id: string }) => React.createElement('Card', { id: card.id }) };
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Deck {...props} selectedId="petalimp" />); });
  assert.equal(renderer.root.findByProps({ accessibilityLabel: 'Previous card' }).props.disabled, true);
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Next card' }).props.onPress());
  assert.equal(selected, 'fernip');
  await act(async () => renderer.update(<Deck {...props} selectedId={selected} />));
  assert.equal(renderer.root.findByProps({ accessibilityLabel: 'Next card' }).props.disabled, true);
  await act(async () => renderer.root.findByProps({ accessibilityLabel: 'Previous card' }).props.onPress());
  assert.equal(selected, 'petalimp');
  await act(async () => renderer.unmount());
});
