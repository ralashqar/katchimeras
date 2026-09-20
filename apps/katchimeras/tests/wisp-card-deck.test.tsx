import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WISP_RARITY } from '@/constants/wisp-rarity';
import type { WispPackInstance } from '@/types/wisp-lantern';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const reduced of [false, true]) test(`a pack's card joins its deck on one page: the pack shrinks, the card grows and slides in (reduced motion: ${reduced})`, async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/wisps/wisp-card-deck.tsx', {
    'react-native': { ...nativeViews, Text: 'Text', ScrollView: 'ScrollView' },
    'expo-image': { Image: 'Image' },
    'react-native-reanimated': { ...motion.animated, Easing: { ...motion.animated.Easing, back: () => (x: number) => x }, FadeOut: motion.animated.FadeIn, useReducedMotion: () => reduced },
    '@/components/katchadeck/collection/collectible-card-deck': { CollectibleCardDeck: 'Deck' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'Rays' },
    '@/components/katchadeck/world/companion-achievement-celebration': { CelebrationParticles: 'Particles' },
    '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/wisp-card-art': { WISP_RARITY, WISP_CARD_ART: { pack: 'pack-art' } },
    './wisp-collection-card': { WispCollectionCard: 'WispCard' },
    './wisp-pack-handoff': { WISP_PACK_HANDOFF_SCALE: 0.72 },
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
  // No separate reward screen any more: the deck and its action are there from the first frame.
  const deck = () => renderer.root.findByType('Deck' as any);
  assert.equal(deck().props.selectedId, 'test-pack:card:1', 'saved selection resumes on the duplicate slot');
  assert.equal(new Set(deck().props.cards.map((card: { id: string }) => card.id)).size, 3);
  assert.ok(renderer.root.findByProps({ label: 'Keep 3 cards' }), 'the deck page owns the action; nothing pops in later to replace it');
  assert.equal(renderer.root.findAllByType('Particles' as any).length, reduced ? 0 : 1);
  const packs = () => renderer.root.findAllByType('Image' as any).filter(node => node.props.source === 'pack-art');
  assert.equal(packs().length, reduced ? 0 : 1, 'the opened pack is carried onto this page');

  let arriving!: ReactTestRenderer;
  await act(async () => { arriving = create(deck().props.renderCard(deck().props.cards[1], 1, { width: 250 }, true)); });
  assert.equal(arriving.root.findByType('WispCard' as any).props.wispId, 'dewdrop');
  assert.equal(arriving.root.findByType('WispCard' as any).props.back, undefined, 'the card arrives face-up');
  if (!reduced) {
    assert.equal(renderer.root.findByType('Particles' as any).props.tier, 3, 'exact friend confetti');
    assert.equal(renderer.root.findByType('Rays' as any).props.rotationDurationMs, 18000);
    const packMotion = () => renderer.root.findAllByType('AnimatedView' as any).find(node => node.findAllByType('Image' as any).some(image => image.props.source === 'pack-art') && node.props.style?.read)!.props.style.read();
    const cardMotion = () => arriving.root.findByType('AnimatedView' as any).props.style.read();
    assert.ok(Math.abs(packMotion().transform[0].scale - 0.72) < 1e-9, 'the pack starts at the scale the sealed stage handed it over at');
    assert.equal(packMotion().opacity, 1, 'and is still fully there: no snap');
    assert.ok(cardMotion().transform[1].scale < 0.3 && cardMotion().opacity === 0, 'the card starts small inside it');
    await act(async () => { motion.advance(170); });
    assert.ok(packMotion().transform[0].scale < 0.72 && packMotion().opacity > 0 && packMotion().opacity < 1, 'the pack is scaling down');
    assert.ok(cardMotion().transform[1].scale > 0.3 && cardMotion().opacity > 0, 'while the card scales in');
    await act(async () => { motion.advance(170); });
    assert.equal(packMotion().opacity, 0);
    assert.ok(cardMotion().transform[1].scale > 1.1, 'the card has grown, lifted over the deck');
    assert.ok(cardMotion().transform[0].translateY < -30);
    await act(async () => { motion.advance(360 + 420); });
    assert.ok(Math.abs(cardMotion().transform[1].scale - 1) < 1e-9 && Math.abs(cardMotion().transform[0].translateY) < 1e-9, 'then it slides down into the deck’s middle slot');
    await act(async () => context.mock.timers.tick(339));
    assert.equal(packs().length, 1);
    await act(async () => context.mock.timers.tick(1));
    assert.equal(packs().length, 0, 'the pack leaves the tree once it has shrunk away');
    await act(async () => context.mock.timers.tick(809));
    assert.equal(renderer.root.findAllByType('Particles' as any).length, 1);
    await act(async () => context.mock.timers.tick(1));
    assert.equal(renderer.root.findAllByType('Particles' as any).length, 0);
    await act(async () => context.mock.timers.tick(60));
  }
  assert.equal(renderer.root.findAllByType('Particles' as any).length, 0, 'the celebration is a moment behind the deck, not a screen');
  assert.equal(packs().length, 0, 'the pack is gone once the card has arrived');
  await act(async () => deck().props.onSelect(deck().props.cards[2], 2));
  assert.equal(focused, 2);
  assert.equal(completed, 0, 'browsing does not consume the reveal');
  // Browsed away and back, the card's slot mounts again: it is simply there, its arrival never replays.
  let again!: ReactTestRenderer;
  await act(async () => { again = create(deck().props.renderCard(deck().props.cards[1], 1, { width: 250 }, true)); });
  const settled = again.root.findAllByType('AnimatedView' as any).find(node => node.props.style?.read)?.props.style.read();
  if (settled) { assert.ok(Math.abs(settled.transform[1].scale - 1) < 1e-9); assert.equal(settled.opacity, 1); }
  assert.equal(again.root.findAllByType('Particles' as any).length, 0, 'browsing does not restart the opening celebration');
  await act(async () => renderer.root.findByProps({ label: 'Keep 3 cards' }).props.onPress());
  assert.equal(completed, 1);
  await act(async () => { arriving.unmount(); again.unmount(); renderer.unmount(); });
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
