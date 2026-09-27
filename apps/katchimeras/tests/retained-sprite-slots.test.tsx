import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { retainRenderSlots, useRetainedRenderSlots } from '@/hooks/use-retained-render-slots';
import { loadNativeModule, nativeMotionHarness } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Item = { id: string };
const identify = (item: Item) => item.id;

test('sprite allocation preserves live/retiring identities, reuses vacancies and never discards overflow', () => {
  const a = { id: 'a' }, b = { id: 'b' }, result = { id: 'result' };
  let slots = retainRenderSlots([], [a, b], identify);
  slots = retainRenderSlots(slots, [a, b, result], identify);
  assert.deepEqual(slots.map(s => s.id), ['a', 'b', 'result'], 'merge ghosts keep their slots until their animation ends');
  slots = retainRenderSlots(slots, [result], identify);
  const resultSlot = slots[2];
  for (let i = 0; i < 100; i++) {
    const piece = { id: `generated-${i}` };
    slots = retainRenderSlots(slots, [result, piece], identify);
    assert.equal(slots.length, 3);
    assert.equal(slots[2], resultSlot, 'an untouched sprite retains its exact slot');
    assert.equal(slots[0].id, piece.id);
    slots = retainRenderSlots(slots, [result], identify);
  }
  const many = Array.from({ length: 100 }, (_, i) => ({ id: `piece-${i}` }));
  slots = retainRenderSlots(slots, many, identify);
  assert.equal(slots.filter(s => s.active).length, many.length, 'gameplay sprites have no decorative overflow limit');
  assert.deepEqual(new Set(slots.filter(s => s.active).map(s => s.id)), new Set(many.map(identify)));
});

test('actual sprite views survive new identities, retire motion safely and unsubscribe from old recoil', async () => {
  const motion = nativeMotionHarness();
  const recoil = new Map<string, () => void>();
  let mounts = 0;
  const completed: string[] = [];
  const onComplete = (operation: number, id: string) => completed.push(`${operation}:${id}`);
  const Sprite = loadNativeModule('components/katchadeck/games/feastle-persistent-merge-board.tsx', {}, {
    ...motion.animated, ...React,
    Animated: motion.animated.default,
    useSharedValue: (initial: unknown) => {
      // Non-numeric motion kind values don't run animations.
      const scalar = React.useRef({ value: initial });
      const numeric = motion.animated.useSharedValue(typeof initial === 'number' ? initial : 0);
      return typeof initial === 'number' ? numeric : scalar.current;
    },
    useAnimatedReaction: () => {},
    useDerivedValue: (read: () => unknown) => ({ get value() { return read(); } }),
    scheduleOnUI: (work: () => void) => work(),
    withSpring: (to: number, _options: unknown, done?: (finished: boolean) => void) => motion.animated.withTiming(to, { duration: 100 }, done),
    recordMergeRender: (name: string) => { if (name === 'sprite-mount') mounts++; },
    spriteRecoil: { subscribe: (id: string, callback: () => void) => { recoil.set(id, callback); return () => { recoil.delete(id); }; } },
    RECOIL_SQUASH_MS: 50, MERGE_SPRITE_SURFACE_SCALE: 2,
    MOVE_SPRING: {}, SWAP_SPRING: {},
    styles: { sprite: {}, spriteArtSurface: {} },
    PersistentMergeItemArt: 'ItemArt', PersistentGeneratorArt: 'GeneratorArt',
  }, 'PersistentSprite').PersistentSprite as unknown as React.ComponentType<any>;
  const shared = { value: 0 };
  const stable = { cellSize: 60, activeDragId: { value: '' }, dragEpoch: shared, dragPhase: shared,
    dragTranslationX: shared, dragTranslationY: shared, grabX: shared, grabY: shared,
    entranceDelay: null, generatorLevel: 1, matchHint: null, reduceMotion: false,
    projectionGridHeight: 300, projectionInset: 0, onComplete };
  function Fixture({ items, token }: { items: Item[]; token: number }) {
    const slots = useRetainedRenderSlots(items, identify);
    return <>{slots.map(slot => <Sprite key={slot.key} {...stable} active={slot.active} instanceId={slot.id}
      baseX={100} baseY={200} occupant={{ kind: 'item', instanceId: slot.id, definitionId: 'test' }}
      motion={slot.active ? { kind: 'move', startX: 0, startY: 0, token, operationId: token } : undefined} />)}</>;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Fixture items={[{ id: 'a' }]} token={1} />); });
  const originalViews = tree.root.findAllByType('AnimatedView' as any);
  assert.equal(mounts, 1);
  // Retire while a completion is pending; replacement must not receive that completion.
  await act(async () => tree.update(<Fixture items={[]} token={1} />));
  motion.advance(500);
  assert.equal(completed.length, 0);
  assert.equal(recoil.size, 0);
  assert.equal(motion.activeAnimationCount(), 0);
  for (let i = 2; i <= 20; i++) {
    const id = `new-${i}`;
    await act(async () => tree.update(<Fixture items={[{ id }]} token={i} />));
    assert.deepEqual([...recoil.keys()], [id]);
    await act(async () => motion.advance(200));
    assert.equal(completed.at(-1), `${i}:${id}`);
    await act(async () => tree.update(<Fixture items={[]} token={i} />));
  }
  assert.equal(mounts, 1, '19 replacement items allocate no new sprite animation graph');
  await act(async () => tree.update(<Fixture items={[{ id: 'interrupted' }]} token={21} />));
  await act(async () => tree.update(<Fixture items={[{ id: 'replacement' }]} token={22} />));
  await act(async () => motion.advance(200));
  assert.equal(completed.includes('21:interrupted'), false, 'direct reuse also cancels the previous owner');
  assert.equal(completed.at(-1), '22:replacement');
  await act(async () => tree.update(<Fixture items={[{ id: 'hidden-then-shown' }]} token={23} />));
  await act(async () => tree.update(<Fixture items={[]} token={23} />));
  await act(async () => tree.update(<Fixture items={[{ id: 'hidden-then-shown' }]} token={23} />));
  await act(async () => motion.advance(200));
  assert.equal(completed.at(-1), '23:hidden-then-shown', 'a temporarily hidden item can resume the same motion token');
  await act(async () => tree.update(<Fixture items={[]} token={23} />));
  assert.deepEqual(tree.root.findAllByType('AnimatedView' as any), originalViews);
  assert.equal(motion.activeAnimationCount(), 0);
  await act(async () => tree.unmount());
  assert.equal(recoil.size, 0);
});
