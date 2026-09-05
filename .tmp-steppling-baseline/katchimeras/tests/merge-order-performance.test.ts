import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { createSelectorStore, reuseShallowRows, reuseShallowValue } from '../utils/merge-world/selector-store';
import type { MergeRailInteractionGate } from '../features/onboarding/merge-ftue';
import { createMossproutChapterZeroState } from '../utils/merge-world/onboarding';
import { mergeOrderItemReadiness, readyMergeOrderIds, reduceMergeWorld } from '../utils/merge-world/engine';
import type { MergeWorldState } from '../types/merge-world';

const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
const source = ts.createSourceFile('screen.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name: string) {
  let declaration: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name
      && node.initializer && ts.isCallExpression(node.initializer)) declaration = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, `${name} is a useCallback declaration`);
  assert.equal(declaration.expression.getText(source), 'useCallback');
  return declaration;
}

test('tray event callbacks do not depend on changing board snapshots or flight objects', () => {
  assert.equal(callback('startServeAnimation').arguments[1].getText(source), '[]');
  assert.equal(callback('openParcel').arguments[1].getText(source), '[dispatch]');
  assert.doesNotMatch(callback('openCharacterReturn').arguments[1].getText(source), /state/);
});

test('real coin arrivals sum token amounts locally, preserve haptics, and ignore cancelled flights', () => {
  const code = ts.transpileModule(`(${callback('handleCoinArrive').arguments[0].getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const coinPresentation = createSelectorStore<number | null>(100);
  let foreground = true;
  let haptics = 0;
  const activeServeOrderRef = { current: {} as object | null };
  const arrive = runInNewContext(code, {
    coinPresentation, activeServeOrderRef, stateRef: { current: { coins: 100 } },
    isAppForeground: () => foreground, process: { env: { EXPO_OS: 'ios' } },
    Haptics: { ImpactFeedbackStyle: { Light: 'light' }, impactAsync: () => { haptics++; } },
    // No screen state setters exist in this environment: they must not be used.
  }) as (amount: number, window: number, index: number, total: number) => void;
  [3, 3, 3, 2, 2].forEach((amount, index) => arrive(amount, 260, index, 13));
  assert.equal(coinPresentation.getSnapshot(), 113);
  assert.equal(haptics, 5);
  foreground = false;
  arrive(3, 260, 0, 13);
  foreground = true;
  activeServeOrderRef.current = null;
  arrive(3, 260, 0, 13);
  assert.equal(coinPresentation.getSnapshot(), 113);
  assert.equal(haptics, 5);
});

test('the actual stable serve callback reads the latest board and rejects overlapping flights', async () => {
  const declaration = callback('startServeAnimation');
  const code = ts.transpileModule(`(${declaration.arguments[0].getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let foreground = true;
  let deferMeasurement = false;
  const pendingMeasures: (() => void)[] = [];
  const flights: { items: { instanceId: string }[] }[] = [];
  const env = {
    stateRef: { current: { marker: 'old' } },
    activeServeRef: { current: false }, activeParcelRef: { current: false },
    visualGenerationRef: { current: 0 }, coinPayoutStartedRef: { current: false },
    boardMetricsRef: { current: { geometry: {}, x: 0, y: 0 } },
    screenRef: {}, coinArtRef: {}, serveNonceRef: { current: 0 }, activeServeOrderRef: { current: null },
    isAppForeground: () => foreground,
    mergeOrderServingCells: (state: { marker: string }) => [{ cell: 0, definitionId: 'seed', instanceId: state.marker }],
    measureViewInWindow: () => new Promise((resolve) => {
      const done = () => resolve({ x: 10, y: 10, width: 40, height: 40 });
      if (deferMeasurement) pendingMeasures.push(done); else done();
    }),
    mergeCellCenter: () => ({ x: 20, y: 20 }),
    setServeHiddenItemIds: () => {},
    setServeFlight: (flight: { items: { instanceId: string }[] }) => flights.push(flight),
  };
  const serve = runInNewContext(code, env) as (order: unknown, targets: unknown[]) => Promise<boolean>;
  const order = { id: 'order', reward: { coins: 10 } };
  env.stateRef.current = { marker: 'latest' };
  assert.equal(await serve(order, [{ x: 100, y: 100 }]), true);
  assert.equal(flights[0].items[0].instanceId, 'latest');
  assert.equal(await serve(order, [{ x: 100, y: 100 }]), false);
  env.activeServeRef.current = false;
  env.activeParcelRef.current = true;
  assert.equal(await serve(order, [{ x: 100, y: 100 }]), false);
  env.activeParcelRef.current = false;
  foreground = false;
  assert.equal(await serve(order, [{ x: 100, y: 100 }]), false);

  foreground = true;
  deferMeasurement = true;
  const interrupted = serve(order, [{ x: 100, y: 100 }]);
  // Mirrors the screen's background cleanup while native measurement is pending.
  env.visualGenerationRef.current++;
  env.activeServeRef.current = false;
  pendingMeasures.forEach((done) => done());
  assert.equal(await interrupted, false);
  assert.equal(flights.length, 1, 'an old measurement cannot restart a cancelled flight');
});

test('equivalent FTUE gates and unchanged trays preserve props; changed targets/readiness do not', () => {
  const gate: MergeRailInteractionGate = { kind: 'serve', orderId: 'one' };
  assert.equal(reuseShallowValue<MergeRailInteractionGate>(gate, { ...gate }), gate);
  assert.notEqual(reuseShallowValue<MergeRailInteractionGate>(gate, { kind: 'serve', orderId: 'two' }), gate);
  assert.notEqual(reuseShallowValue<MergeRailInteractionGate>(gate, { kind: 'locked' }), gate);
  const rows = Array.from({ length: 6 }, (_, index) => ({ id: String(index), ready: false, itemReadiness: [false] }));
  const onServe = () => true;
  const props = rows.map((entry) => ({ entry, onServe, effectsActive: true }));
  for (let spawn = 0; spawn < 50; spawn++) {
    const stableRows = reuseShallowRows(rows, rows.map((row) => ({ ...row, itemReadiness: [false] })));
    stableRows.forEach((entry, index) => assert.equal(reuseShallowValue(props[index], { entry, onServe, effectsActive: true }), props[index]));
  }
  const updated = reuseShallowRows(rows, rows.map((row, index) => index === 2 ? { ...row, ready: true, itemReadiness: [true] } : row));
  assert.equal(updated.filter((entry, index) => entry !== rows[index]).length, 1);
});

test('real spawn commands preserve the order row when its requested item is unchanged', () => {
  let state = createMossproutChapterZeroState(1000);
  const selectRows = (snapshot: MergeWorldState) => {
    const ready = readyMergeOrderIds(snapshot);
    return snapshot.activeOrders.map((order) => ({ id: order.id, order, ready: ready.has(order.id), itemReadiness: mergeOrderItemReadiness(snapshot, order) }));
  };
  const before = selectRows(state);
  assert.ok(before.length > 0);
  for (let index = 0; index < 5; index++) {
    const result = reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', seed: `burst:${index}`, now: 1100 + index });
    assert.equal(result.changed, true);
    state = result.state;
    assert.equal(reuseShallowRows(before, selectRows(state)), before);
  }
});

test('native wiring virtualizes trays and gates rotating ready rays while retaining baked glow', () => {
  const rail = readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8');
  const surface = readFileSync('components/katchadeck/games/merge-play-surface.tsx', 'utf8');
  const rays = readFileSync('components/katchadeck/ui/radial-sunburst.tsx', 'utf8');
  assert.match(rail, /entries\.map\(\(entry, index\)/);
  assert.match(rail, /mounted \? <LayoutAnimationConfig skipEntering skipExiting>/);
  assert.match(rail, /effectsActive=\{effectsActive && visible\}/);
  assert.match(rail, /const effectsActive = active && foreground/);
  assert.match(rail, /RotatingRadialSunburst active=\{effectsActive\} baseOpacity=\{0.86\} rotationDurationMs=\{32_000\} size=\{READY_RAYS_SIZE\}/);
  assert.match(rail, /const READY_RAYS_SIZE = 148/);
  assert.match(rail, /readyRays:.*top: TRAY_HEIGHT - 23.2 - 110.4 \/ 2 - READY_RAYS_SIZE \/ 2.*zIndex: 1/);
  assert.match(rail, /characterLayer:.*zIndex: 2/);
  assert.match(rail, /source=\{READY_GLOW_ART\}/);
  assert.doesNotMatch(rail, /readyGlow:.*boxShadow/);
  assert.match(rays, /if \(reduceMotion \|\| !active\)/);
  assert.match(rays, /releaseLoop\(\);\s+cancelAnimation\(rotation\);\s+cancelAnimation\(breath\)/);
  assert.match(rail, /if \(!surfaceActive \|\| serveInFlight === false\)/);
  assert.match(rail, /attempt !== serveAttemptRef\.current/);
  assert.match(surface, /interactionGate=\{retainedRailGate.current\}/);
  assert.match(screen, /effectsActive=\{active\}/);
  assert.match(screen, /servingOrderId=\{serveFlight \? activeServeOrderRef.current/);
});
