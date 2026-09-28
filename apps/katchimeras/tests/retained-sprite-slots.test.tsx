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

test('every piece has its own sprite view: a retired view never completes a stale motion or keeps its recoil, and a piece raised in place crossfades to its new art', async () => {
  const motion = nativeMotionHarness();
  const recoil = new Map<string, (kind?: 'impact') => void>();
  let mounts = 0;
  const completed: string[] = [];
  const onComplete = (operation: number, id: string) => completed.push(`${operation}:${id}`);
  const Sprite = loadNativeModule('components/katchadeck/games/feastle-persistent-merge-board.tsx', {}, {
    ...motion.animated, ...React,
    interpolate: (value: number, input: number[], output: number[]) => {
      if (value <= input[0]!) return output[0];
      for (let i = 1; i < input.length; i++) if (value <= input[i]!) {
        const fraction = (value - input[i - 1]!) / (input[i]! - input[i - 1]!);
        return output[i - 1]! + fraction * (output[i]! - output[i - 1]!);
      }
      return output.at(-1);
    },
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
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    withSpring: (to: number, _options: unknown, done?: (finished: boolean) => void) => motion.animated.withTiming(to, { duration: 100 }, done),
    recordMergeRender: (name: string) => { if (name === 'sprite-mount') mounts++; },
    spriteRecoil: { subscribe: (id: string, callback: (kind?: 'impact') => void) => { recoil.set(id, callback); return () => { recoil.delete(id); }; } },
    RECOIL_SQUASH_MS: 50, MERGE_SPRITE_SURFACE_SCALE: 2,
    MOVE_SPRING: {}, SWAP_SPRING: {},
    StyleSheet: { absoluteFill: {} },
    MERGE_ITEMS_BY_ID: new Map([['seed', { tier: 1 }], ['sprout', { tier: 2 }]]),
    LEVEL_UP_MS: 640, LEVEL_DOWN_MS: 420, LEVEL_UP_PALETTE: {},
    UpgradeBurst: 'UpgradeBurst',
    styles: { sprite: {}, spriteArtSurface: {} },
    PersistentMergeItemArt: 'ItemArt', PersistentGeneratorArt: 'GeneratorArt',
  }, 'PersistentSprite').PersistentSprite as unknown as React.ComponentType<any>;
  const shared = { value: 0 };
  const stable = { cellSize: 60, activeDragId: { value: '' }, dragEpoch: shared, dragPhase: shared,
    dragTranslationX: shared, dragTranslationY: shared, grabX: shared, grabY: shared,
    entranceDelay: null, generatorLevel: 1, matchHint: null, reduceMotion: false,
    projectionGridHeight: 300, projectionInset: 0, onComplete };
  // As the board draws them: one view per piece, keyed by the piece.
  function Fixture({ items, token, definitionId = 'seed', moving = true }: { items: Item[]; token: number; definitionId?: string; moving?: boolean }) {
    return <>{items.map(item => <Sprite key={item.id} {...stable} active instanceId={item.id}
      baseX={100} baseY={200} occupant={{ kind: 'item', instanceId: item.id, definitionId }}
      motion={moving ? { kind: 'move', startX: 0, startY: 0, token, operationId: token } : undefined} />)}</>;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Fixture items={[{ id: 'a' }]} token={1} />); });
  assert.equal(mounts, 1);
  // Retired while a completion is pending: nothing completes for it, and it stops listening for recoil.
  await act(async () => tree.update(<Fixture items={[]} token={1} />));
  motion.advance(500);
  assert.equal(completed.length, 0);
  assert.equal(recoil.size, 0);
  assert.equal(motion.activeAnimationCount(), 0);
  for (let i = 2; i <= 6; i++) {
    const id = `new-${i}`;
    await act(async () => tree.update(<Fixture items={[{ id }]} token={i} />));
    assert.deepEqual([...recoil.keys()], [id]);
    await act(async () => motion.advance(200));
    assert.equal(completed.at(-1), `${i}:${id}`);
    await act(async () => tree.update(<Fixture items={[]} token={i} />));
  }
  assert.equal(mounts, 6, 'each new piece mounts a view of its own, never one another piece left behind');
  await act(async () => tree.update(<Fixture items={[{ id: 'interrupted' }]} token={21} />));
  await act(async () => tree.update(<Fixture items={[{ id: 'replacement' }]} token={22} />));
  await act(async () => motion.advance(200));
  assert.equal(completed.includes('21:interrupted'), false, 'a replaced piece never completes');
  assert.equal(completed.at(-1), '22:replacement');
  // Raised a tier where it stands (Bloom): the old art shows beside the new while they cross, then only the new.
  await act(async () => tree.update(<Fixture items={[{ id: 'bloom' }]} token={30} moving={false} />));
  await act(async () => tree.update(<Fixture items={[{ id: 'bloom' }]} token={30} definitionId="sprout" moving={false} />));
  const arts = () => tree.root.findAllByType('ItemArt' as any).map((node) => node.props.definitionId);
  assert.deepEqual(arts().sort(), ['seed', 'sprout'], 'crossing: the Seed going, the Sprout coming');
  assert.equal(tree.root.findAllByType('UpgradeBurst' as any).length, 1, 'raised: the upgrade energy rises');
  await act(async () => motion.advance(800));
  assert.deepEqual(arts(), ['sprout'], 'settled: only the Sprout');
  assert.equal(tree.root.findAllByType('UpgradeBurst' as any).length, 0);
  const artScale = () => tree.root.findAllByType('AnimatedView' as any)
    .flatMap(node => [node.props.style].flat()).find(style => style?.read?.().transform?.some((part: any) => 'scaleX' in part))
    .read().transform.find((part: any) => 'scale' in part).scale;
  const normalScale = artScale();
  await act(async () => recoil.get('bloom')!('impact'));
  await act(async () => motion.advance(90));
  assert.ok(artScale() > normalScale, 'wall expands on impact');
  await act(async () => motion.advance(110));
  assert.ok(artScale() < normalScale, 'wall compresses after the burst');
  await act(async () => motion.advance(160));
  assert.equal(artScale(), normalScale, 'wall settles at its original size');
  await act(async () => recoil.get('bloom')!('impact'));

  await act(async () => tree.unmount());
  assert.equal(recoil.size, 0);
  assert.equal(motion.activeAnimationCount(), 0, 'unmount cancels impact animation');
});
