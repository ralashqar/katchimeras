import assert from 'node:assert/strict';
import './helpers/enable-diagnostics';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { createMergeSaveDeadline } from '@/utils/merge-world/save-deadline';
import { createSelectorStore, selectedSnapshot, reuseShallowRows } from '@/utils/merge-world/selector-store';
import { createSerialWorkQueue } from '@/utils/merge-world/serial-work-queue';
import { beginCriticalInteractionWork, criticalInteractionWorkActive, waitForCriticalInteractionIdle } from '@/utils/critical-interaction';
import { MERGE_SPRITE_SURFACE_SCALE, mergeSpriteMotionFrame, spawnSpriteMotionFrame } from '@/utils/merge-board-motion';
import { worldTileImageLod } from '@/utils/world-image-resolution';
import { mergeWorldPendingPersistence } from '@/utils/merge-world/persistence-buffer';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { acquireLifecycleResource, foregroundLifecycleViolations, resetLifecycleResourcesForTests } from '@/utils/lifecycle-performance';
import { canReuseSpawnSprites, createMergeBoardEffects, MERGE_EFFECT_SLOT_IDS, mergeEffectRetentionMs } from '@/utils/merge-world/board-effects';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { rewardTokenClock, rewardTokenTiming } from '@/utils/merge-world/reward-flight';

test('reward batch timeline preserves stagger and freezes each coin at its endpoint', () => {
  for (const reduced of [false, true]) {
    for (const energy of [false, true]) {
      for (let index = 0; index < 5; index++) {
        const timing = rewardTokenTiming(index, reduced, energy);
        assert.equal(timing.arrivalMs, (reduced ? 400 : 670) + index * (reduced ? 25 : 65) + (energy ? 28 : 0));
        assert.equal(rewardTokenClock(-1, timing.arrivalMs), 0);
        assert.equal(rewardTokenClock(timing.arrivalMs - 1, timing.arrivalMs), timing.arrivalMs - 1);
        for (let elapsed = timing.arrivalMs; elapsed < timing.arrivalMs + 500; elapsed += 16) {
          assert.equal(rewardTokenClock(elapsed, timing.arrivalMs), timing.arrivalMs);
        }
      }
    }
  }
});

test('coin contacts update only the HUD and no longer start per-token hover loops', () => {
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const arrival = screen.slice(screen.indexOf('const handleCoinArrive'), screen.indexOf('const handleEnergyArrive'));
  assert.doesNotMatch(arrival, /setCoinPulseNonce|setPresentedCoins|setCoinValueAnimationDurationMs/);
  assert.match(arrival, /coinPresentation.publish/);
  assert.match(arrival, /Haptics.impactAsync/);
  const overlay = readFileSync('components/katchadeck/games/merge-serve-reward-overlay.tsx', 'utf8');
  assert.doesNotMatch(overlay, /withRepeat/);
  assert.match(overlay, /if \(!arrived \|\| notified.value\) return/);
  assert.match(overlay, /cancelAnimation\(elapsed\)/);
  assert.match(overlay, /cancelAnimation\(landed\)/);
});

test('burst pool preserves unchanged effects and notifies only its subscribers', () => {
  const pool = createMergeBoardEffects();
  let updates = 0;
  const unsubscribe = pool.subscribe(() => { updates++; });
  const first = pool.emit(1, 'spawn-origin');
  const second = pool.emit(8, 'spawn-settle');
  assert.equal(pool.getSnapshot()[0], first);
  assert.equal(pool.getSnapshot()[1], second);
  pool.retire(first.id);
  assert.equal(pool.getSnapshot()[0], second);
  const remaining = pool.getSnapshot();
  pool.retire(first.id);
  assert.equal(pool.getSnapshot(), remaining);
  assert.equal(updates, 3);
  unsubscribe();
  pool.clear();
  assert.equal(updates, 3);
});

test('rapid spawns share one origin burst without restarting it or notifying subscribers', () => {
  const pool = createMergeBoardEffects();
  let notifications = 0;
  pool.subscribe(() => notifications++);
  const first = pool.emit(3, 'spawn-origin');
  const snapshot = pool.getSnapshot();
  for (let tap = 0; tap < 20; tap++) assert.equal(pool.emit(3, 'spawn-origin'), first);
  assert.equal(pool.getSnapshot(), snapshot);
  assert.equal(notifications, 1);
  const other = pool.emit(4, 'spawn-origin');
  assert.notEqual(other, first);
  const landing = pool.emit(3, 'spawn-settle');
  assert.notEqual(landing, first);
  pool.retire(first.id);
  assert.notEqual(pool.emit(3, 'spawn-origin'), first);
  assert.equal(pool.getSnapshot().includes(landing), true);
});

test('landing particles use an idle clock while glow and ring keep their animation', () => {
  const source = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.match(source, /effect.kind === 'spawn-settle' \|\| reduceMotion \? idleParticleProgress : progress/);
  assert.match(source, /<MergeEffectParticle[\s\S]*?progress=\{particleProgress\}/);
  assert.match(source, /<MergeEffectGlow[^\n]*progress=\{progress\}/);
  assert.match(source, /<MergeEffectRing[^\n]*progress=\{progress\}/);
});

test('shared authored frames preserve every spawn and merge phase including terminal ghosts', () => {
  const source = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const body = source.match(/const authoredFrame = useDerivedValue\(\(\) => \{([\s\S]*?)\n  \},/);
  assert.ok(body);
  const sample = new Function('animating', 'activeMotionKind', 'progress', 'reduceMotion', 'spawnSpriteMotionFrame', 'mergeSpriteMotionFrame', body[1]);
  for (const reduced of [false, true]) {
    for (let step = 0; step <= 100; step++) {
      const p = step / 100;
      for (const kind of ['spawn', 'merge-source', 'merge-target', 'merge-result'] as const) {
        const frame = sample({ value: 1 }, { value: kind }, { value: p }, reduced, spawnSpriteMotionFrame, mergeSpriteMotionFrame);
        const expected = kind === 'spawn' ? spawnSpriteMotionFrame(p, reduced)
          : { ...mergeSpriteMotionFrame(kind, p, reduced), travel: p, arc: 0, settleY: 0 };
        assert.deepEqual(frame, expected);
      }
    }
  }
  assert.equal(sample({ value: 0 }, { value: 'spawn' }, { value: 0.5 }, false, spawnSpriteMotionFrame, mergeSpriteMotionFrame), null);
  const styles = source.slice(source.indexOf('const visualScale = useDerivedValue'), source.indexOf('function PersistentGeneratorArt'));
  assert.doesNotMatch(styles, /spawnSpriteMotionFrame\(|mergeSpriteMotionFrame\(/);
  assert.match(source, /useState\(\(\) => \(\{ ids: occupancyIdsFromState\(state\)/);
  assert.match(source, /\[initialSpriteDelays\] = useState\(\(\) => new Map/);
});

test('slot reuse cancels ownership of old effects even when earlier slots have expired', () => {
  const pool = createMergeBoardEffects();
  const old = pool.emit(0, 'merge');
  for (let index = 0; index < 5; index++) {
    const transient = pool.emit(index + 1, 'spawn-origin');
    pool.retire(transient.id);
  }
  const replacement = pool.emit(12, 'spawn-settle');
  assert.equal(old.id % 6, replacement.id % 6);
  assert.deepEqual(pool.getSnapshot(), [replacement]);
  const snapshot = pool.getSnapshot();
  pool.retire(old.id);
  assert.equal(pool.getSnapshot(), snapshot);
  for (let index = 0; index < 50; index++) pool.emit(index, 'spawn-origin');
  const slots = pool.getSnapshot().map((effect) => effect.id % MERGE_EFFECT_SLOT_IDS.length);
  assert.equal(slots.length, 6);
  assert.equal(new Set(slots).size, 6);
});

test('cleared effects cannot retire new effects after a scene remount', () => {
  const pool = createMergeBoardEffects();
  const before = pool.emit(1, 'spawn-origin');
  pool.clear();
  const empty = pool.getSnapshot();
  pool.clear();
  assert.equal(pool.getSnapshot(), empty);
  const after = pool.emit(2, 'spawn-settle');
  pool.retire(before.id);
  assert.deepEqual(pool.getSnapshot(), [after]);
  assert.ok(after.id > before.id);
});

test('effect retention preserves authored launch, landing and reduced-motion timings', () => {
  assert.equal(mergeEffectRetentionMs('spawn-origin', false), 520);
  assert.equal(mergeEffectRetentionMs('spawn-settle', false), 620);
  assert.equal(mergeEffectRetentionMs('merge', false), 700);
  for (const kind of ['spawn-origin', 'spawn-settle', 'merge'] as const) {
    assert.equal(mergeEffectRetentionMs(kind, true), 220);
  }
});

test('overlapping spawns reuse canonical sprites; external edits and merges require reconciliation', () => {
  let state = createMossproutChapterZeroState(1000);
  const snapshots = [];
  for (let index = 0; index < 5; index++) {
    const result = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', seed: `burst:${index}`, now: 1100 + index });
    assert.equal(result.changed, true);
    state = result.state;
    snapshots.push(state);
  }
  // Any landing order keeps the latest presented board, never its old snapshot.
  for (const index of [3, 0, 4, 1, 2]) {
    assert.equal(canReuseSpawnSprites('spawn', state.board, state.board), true);
    if (index !== 4) assert.equal(canReuseSpawnSprites('spawn', snapshots[index].board, state.board), false);
  }
  assert.equal(canReuseSpawnSprites('board', state.board, state.board), false);
  assert.equal(canReuseSpawnSprites('spawn', state.board, [...state.board]), false);
});

test('spawn effects have a local subscription and timers, while landing receipts remain immediate', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const effects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.doesNotMatch(board, /setBoardEffects|effectSequence/);
  assert.match(effects, /useSyncExternalStore\(controller.subscribe/);
  assert.match(effects, /useDisposableTimers\('merge:effect-slot'\)/);
  assert.match(effects, /return \(\) => timers.cancel\(timer\)/);
  for (const name of ['MergeBoardEffectSlot', 'MergeEffectGlow', 'MergeEffectRing', 'MergeEffectParticle']) {
    assert.ok(effects.includes(`const ${name} = memo(function ${name}`));
  }
  assert.match(board, /if \(!canReuseSpawnSprites[\s\S]*?const canonicalSprites = spritesFromState/);
  assert.match(board, /sprites: reconciledSprites,[\s\S]*?onCommandSettledRef.current\?\.\(/);
  assert.match(board, /!operation.remaining.has\(instanceId\)/);
  assert.match(board, /<MergeBoardFrameProbe active=\{busy\} dragPhase=\{dragPhase\} effectsActivity=\{effectsActivity\}/);
});

test('retained snapshots are distinct from active scene work across repeated switches', () => {
  resetLifecycleResourcesForTests();
  const retained = acquireLifecycleResource('retained_subscription', 'merge:world-snapshots');
  for (let cycle = 0; cycle < 30; cycle++) {
    const world = acquireLifecycleResource('world_canvas', 'haven');
    const worldOwner = acquireLifecycleResource('active_merge_provider', 'haven');
    assert.deepEqual(foregroundLifecycleViolations('world'), []);
    world(); worldOwner();
    const board = acquireLifecycleResource('merge_board', 'garden');
    const mergeOwner = acquireLifecycleResource('active_merge_provider', 'garden');
    assert.deepEqual(foregroundLifecycleViolations('merge'), []);
    board(); mergeOwner();
    assert.deepEqual(foregroundLifecycleViolations('today'), []);
  }
  retained();
});

test('continuous commands cannot move the first dirty save deadline', () => {
  let now = 0;
  let latestRevision = 0;
  const writes: number[] = [];
  const tasks = new Map<number, () => void>();
  const deadline = createMergeSaveDeadline(() => writes.push(latestRevision), (callback, ms) => {
    const at = now + ms;
    tasks.set(at, callback);
    return () => { tasks.delete(at); };
  });
  for (now = 0; now < 250; now += 10) { latestRevision++; deadline.enqueue(); }
  assert.deepEqual([...tasks.keys()], [250]);
  const drain = tasks.get(250)!;
  tasks.delete(250);
  drain();
  assert.deepEqual(writes, [25]);
  latestRevision++;
  deadline.enqueue();
  assert.deepEqual([...tasks.keys()], [500]);
  deadline.flush();
  assert.deepEqual(writes, [25, 26]);
  assert.equal(tasks.size, 0);
  deadline.enqueue();
  deadline.cancel();
  assert.equal(tasks.size, 0);
  assert.equal(writes.length, 2);
});

test('coalescing preserves the newest snapshot and all reward receipts', () => {
  const first = createMossproutChapterZeroState(1000);
  const newer = { ...first, revision: first.revision + 2 };
  const pending = mergeWorldPendingPersistence(mergeWorldPendingPersistence(null, newer, ['new']), first, ['old', 'new']);
  assert.equal(pending.state, newer);
  assert.deepEqual([...pending.receiptIds], ['new', 'old']);
});

test('coin selectors keep their snapshot on unrelated board changes', () => {
  const store = createSelectorStore({ coins: 12, board: [1] });
  const select = selectedSnapshot(store.getSnapshot, (state) => ({ coins: state.coins }), (a, b) => a.coins === b.coins);
  const initial = select();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications++; });
  store.publish({ coins: 12, board: [2] });
  assert.equal(select(), initial);
  store.publish({ coins: 13, board: [2] });
  assert.notEqual(select(), initial);
  assert.equal(select().coins, 13);
  store.publish(store.getSnapshot());
  assert.equal(notifications, 2);
  unsubscribe();
  store.publish({ coins: 14, board: [3] });
  assert.equal(notifications, 2);
});

test('unchanged order readiness reuses row and list identities', () => {
  const first = [{ id: 'one', ready: false, itemReadiness: [true, false] }, { id: 'two', ready: false, itemReadiness: [false] }];
  assert.equal(reuseShallowRows(first, first.map((row) => ({ ...row, itemReadiness: [...row.itemReadiness] }))), first);
  const changed = reuseShallowRows(first, [first[0], { ...first[1], ready: true, itemReadiness: [true] }]);
  assert.equal(changed[0], first[0]);
  assert.notEqual(changed[1], first[1]);
});

test('cancelled idle waits leave promptly without releasing another owner', async () => {
  const release = beginCriticalInteractionWork();
  const cancellation = new AbortController();
  const waiting = waitForCriticalInteractionIdle(cancellation.signal);
  cancellation.abort();
  await waiting;
  assert.equal(criticalInteractionWorkActive(), true);
  release();
  release();
  assert.equal(criticalInteractionWorkActive(), false);
});

test('drag-to-animation handoff keeps deferred work blocked', async () => {
  const drag = beginCriticalInteractionWork();
  let completed = false;
  const waiting = waitForCriticalInteractionIdle().then(() => { completed = true; });
  drag();
  const animation = beginCriticalInteractionWork();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(completed, false);
  animation();
  await waiting;
  assert.equal(completed, true);
});

test('a replacement art generation waits for the in-flight decode and skips cancelled work', async () => {
  const queue = createSerialWorkQueue();
  const events: string[] = [];
  let finishDecode!: () => void;
  const inFlight = new Promise<void>((resolve) => { finishDecode = resolve; });
  let cancelled = false;
  const old = queue.enqueue(async () => {
    events.push('old-decode');
    await inFlight;
    if (cancelled) { events.push('release-old'); return; }
    events.push('unwanted-next-decode');
  });
  await Promise.resolve();
  cancelled = true;
  const replacement = queue.enqueue(async () => { events.push('replacement-decode'); });
  assert.deepEqual(events, ['old-decode']);
  finishDecode();
  await Promise.all([old, replacement]);
  assert.deepEqual(events, ['old-decode', 'release-old', 'replacement-decode']);
  await assert.rejects(queue.enqueue(async () => { throw Error('decode failed'); }));
  await queue.enqueue(async () => { events.push('recovered'); });
  assert.equal(events.at(-1), 'recovered');
});

test('fixed sprite surfaces cover animation peaks and preserve final physical size', () => {
  for (let frame = 0; frame <= 100; frame++) {
    for (const reduced of [false, true]) {
      const scale = Math.max(spawnSpriteMotionFrame(frame / 100, reduced).scale, mergeSpriteMotionFrame('merge-result', frame / 100, reduced).scale);
      assert.ok(scale * 1.08 * 1.055 < MERGE_SPRITE_SURFACE_SCALE);
    }
  }
  for (const cellSize of [32, 48, 64, 90]) {
    assert.equal(cellSize * MERGE_SPRITE_SURFACE_SCALE / MERGE_SPRITE_SURFACE_SCALE, cellSize);
  }
});

test('settled image tiers include density and sharpness headroom', () => {
  assert.equal(worldTileImageLod(100, 1, 2), 'thumb');
  assert.equal(worldTileImageLod(200, 1, 2), 'medium');
  assert.equal(worldTileImageLod(200, 1.25, 3), 'full');
});

test('drag coordinates are filtered before stationary sprite style work', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const selector = board.match(/const dragPosition = useDerivedValue\(\(\) => \{([\s\S]*?)\n  \},/);
  assert.ok(selector);
  const activeDragId = { value: 'moving' };
  const dragPhase = { value: 1 };
  const grabX = { value: 20 }, grabY = { value: 30 };
  const dragTranslationX = { value: 0 }, dragTranslationY = { value: 0 };
  const read = new Function('instanceId', 'activeDragId', 'dragPhase', 'grabX', 'grabY', 'dragTranslationX', 'dragTranslationY', selector[1]);
  const position = (id: string) => read(id, activeDragId, dragPhase, grabX, grabY, dragTranslationX, dragTranslationY);
  for (let frame = 0; frame < 60; frame++) {
    dragTranslationX.value = frame;
    dragTranslationY.value = -frame;
    assert.equal(position('stationary'), null);
    assert.deepEqual(position('moving'), { x: 20 + frame, y: 30 - frame });
  }
  dragPhase.value = 2;
  assert.deepEqual(position('moving'), { x: 79, y: -29 });
  dragPhase.value = 0;
  assert.equal(position('moving'), null);
  const style = board.slice(board.indexOf('const animatedStyle = useAnimatedStyle', selector.index), board.indexOf('return <Animated.View pointerEvents="none"', selector.index));
  assert.doesNotMatch(style, /activeDragId|dragTranslationX|dragTranslationY|grabX|grabY|dragPhase/);
});

test('occupancy echoes are deduplicated but rejected drops still repair optimistic maps', () => {
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.match(board, /if \(!force && occupancyBoardRef.current === nextState.board\) return/);
  assert.match(board, /syncOccupancy\(state\)/);
  assert.match(board, /syncOccupancy\(nextState, true\)/);
  assert.equal((board.match(/occupancyIdsFromState\(nextState\)/g) ?? []).length, 1);
});

test('pooled bursts retain their glow without per-particle shadow blur or frame trigonometry', () => {
  const effects = readFileSync('components/katchadeck/games/merge-spawn-effects-layer.tsx', 'utf8');
  assert.match(effects, /source=\{SOFT_GLOW\}/);
  assert.doesNotMatch(effects, /boxShadow:/);
  const particle = effects.slice(effects.indexOf('const MergeEffectParticle'));
  const frame = particle.slice(particle.indexOf('const style = useAnimatedStyle'), particle.indexOf('return <Animated.View'));
  assert.doesNotMatch(frame, /Math\.(cos|sin)/);
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.doesNotMatch(board, /mistParticle:.*boxShadow/);
  const mist = board.slice(board.indexOf('function DreamMistParticle'), board.indexOf('function HoverCellOverlay'));
  assert.doesNotMatch(mist.slice(mist.indexOf('const style = useAnimatedStyle')), /Math\.(cos|sin)/);
  assert.match(board, /source=\{DREAM_MIST_LOWER\}/);
});

test('native integration retains ghost images and lifecycle flush paths', () => {
  const cache = readFileSync('hooks/use-merge-art-cache.ts', 'utf8');
  const provider = readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const world = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(cache, /plan.itemDefinitionIds, ...visibleItemDefinitionIds/);
  assert.match(cache, /workQueue.enqueue/);
  assert.match(cache, /cancellation.abort\(\)/);
  assert.match(cache, /retiredRef.current.splice\(0\).*image.release/);
  assert.match(provider, /receiptIds.length \|\| !bufferOrdinaryCommand/);
  assert.match(provider, /command.type === 'move' \|\| command.type === 'tapGenerator'/);
  assert.match(provider, /saveDeadlineRef.current\?\.cancel\(\)/);
  assert.match(board, /operationLeases.current.get\(operationId\)\?\.\(\)/);
  assert.doesNotMatch(board, /height: renderedSize|width: renderedSize/);
  assert.match(world, /!camera.isMoving.*setSettledImageScale/);
  assert.match(world, /!storyCameraInputLocked.*!upgradePresentation/);
  assert.equal((world.match(/const showMeditation = useExitRetention/g) ?? []).length, 2);
});
