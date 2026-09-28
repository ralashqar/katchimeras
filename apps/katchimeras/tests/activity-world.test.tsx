import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import type { MergeWorldState } from '@/types/merge-world';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('activity world loads without a provider, ignores stale reads and releases subscriptions', async () => {
  const listeners = new Set<(state: MergeWorldState) => void>();
  const resets = new Set<(state: MergeWorldState) => void>();
  let read!: (state: MergeWorldState) => void;
  const api = loadNativeModule('features/activities/use-activity-world.ts', {
    '@/utils/merge-world/repository': {
      loadMergeWorldState: () => new Promise<MergeWorldState>(resolve => { read = resolve; }),
      subscribeMergeWorldSnapshots: (fn: (state: MergeWorldState) => void) => { listeners.add(fn); return () => listeners.delete(fn); },
      subscribeMergeWorldResets: (fn: (state: MergeWorldState) => void) => { resets.add(fn); return () => resets.delete(fn); },
    },
  }) as unknown as typeof import('@/features/activities/use-activity-world');
  let observed!: ReturnType<typeof api.useActivityWorld>;
  function Consumer() { observed = api.useActivityWorld(); return null; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Consumer />); });
  assert.equal(observed.loading, true);
  const latest = { revision: 5 } as MergeWorldState;
  await act(async () => listeners.forEach(fn => fn(latest)));
  await act(async () => read({ revision: 4 } as MergeWorldState));
  assert.equal(observed.state, latest);
  const reset = { revision: 0 } as MergeWorldState;
  await act(async () => resets.forEach(fn => fn(reset)));
  assert.equal(observed.state, reset);
  await act(async () => tree.unmount());
  assert.equal(listeners.size + resets.size, 0);
});
