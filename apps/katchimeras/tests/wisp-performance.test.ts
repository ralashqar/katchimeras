import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRST_BATTLE } from '@/constants/last-clearing-battle';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { missionWispTarget, reuseLiveWispTarget } from '@/features/mission-mechanics/wisp-target';
import { createLanesState, laneAlive, laneArrived, laneColumn, lanesViews, type LanesMechanic } from '@/features/mission-mechanics/lanes';

test('live wisp targets keep identity on merge commits but refresh on scene changes', () => {
  const mechanic = resolveMechanic(FIRST_BATTLE);
  let state = createMechanicState(mechanic);
  const live = { get: () => state, subscribe: () => () => {} };
  const input = { key: 'attempt-1', host: FIRST_BATTLE, mechanicState: state, node: null, boardMetrics: null, window: missionWindow(), live };
  const before = missionWispTarget(input);
  state = { ...state, strikes: 1 };
  const after = missionWispTarget({ ...input, mechanicState: state });
  assert.equal(reuseLiveWispTarget(before, after), before);
  assert.equal(before.live!.get(), state, 'new mechanic state is available through the live channel');
  assert.equal(reuseLiveWispTarget(before, null), null);
  for (const change of [{ key: 'attempt-2' }, { revealNonce: 1 }, { settled: false }]) {
    const next = missionWispTarget({ ...input, ...change });
    assert.equal(reuseLiveWispTarget(before, next), next);
  }
  const nonLive = missionWispTarget({ ...input, live: undefined });
  assert.equal(reuseLiveWispTarget(before, nonLive), nonLive, 'non-live missions retain their prop updates');
});

test('linear shield lookup matches pairwise guarding with multiple guards, deaths and future arrivals', () => {
  const original = resolveMechanic(FIRST_BATTLE);
  assert.equal(original.kind, 'lanes');
  if (original.kind !== 'lanes') return;
  const mechanic: LanesMechanic = { ...original, wisps: Array.from({ length: 60 }, (_, index) => ({
    ...original.wisps[0]!, id: `w-${index}`, column: index % 5, at: index * 100, hp: 5, shield: index % 4 === 0,
  })) };
  for (let clock = 0; clock < 7_000; clock += 300) {
    const state = createLanesState(mechanic);
    state.clock = clock;
    state.wisps = state.wisps.map((wisp, index) => ({ ...wisp, damage: index % 7 === 0 ? 5 : 0, column: (index + Math.floor(clock / 300)) % 5 }));
    const actual = lanesViews(mechanic, state);
    for (let i = 0; i < actual.length; i++) {
      const expected = mechanic.wisps.some((other, j) => j !== i && other.shield && laneArrived(mechanic, state, j) && laneAlive(mechanic, state, j) && Math.abs(laneColumn(mechanic, state, j) - laneColumn(mechanic, state, i)) <= 1);
      assert.equal(Boolean(actual[i]!.guarded), expected, `wisp ${i} at ${clock}`);
    }
  }
});
