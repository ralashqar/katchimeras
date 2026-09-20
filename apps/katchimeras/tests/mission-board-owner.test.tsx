import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as mechanic from '@/features/mission-mechanics/mechanic';
import * as openingMissionState from '@/features/onboarding/opening-mission-state';
import * as engine from '@/utils/merge-world/engine';
import { loadNativeModule } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('one screen hosts every friend’s board: a board just switched to never shows, plays or saves the last one’s state', async () => {
  // Wanderling's board was mid-way (3 merges) when Petalimp's opened. The store loads in an effect, so for the render
  // that changed the key it still held Wanderling's board: the screen read 3 / 5 and a spent patch off it, recorded
  // that as Petalimp's progress and sent Petalimp's delivery request before a single merge.
  const storage = new Map<string, unknown>();
  const module = loadNativeModule('features/onboarding/use-opening-mission-board.ts', {
    '@/features/mission-mechanics/mechanic': mechanic,
    '@/utils/merge-world/engine': engine,
    './opening-mission-state': openingMissionState,
    '@/utils/app-storage': {
      flushDeferredStoredWrites() {},
      getStoredJson: (key: string, fallback: unknown) => storage.has(key) ? JSON.parse(JSON.stringify(storage.get(key))) : fallback,
      removeStoredValue: (key: string) => { storage.delete(key); },
      setStoredJsonDeferred: (key: string, value: unknown) => { storage.set(key, value); },
    },
  });
  const useMissionBoard = module.useMissionBoard as (key: string, runId: string | null, create: (now: number) => unknown) => { state: { updatedAt: number } | null; merges: number; placedDeliveries: number; send: (command: unknown) => unknown };
  const saveMission = module.saveMission as (key: string, runId: string, state: unknown, merges: number, placed?: number) => void;
  const NOW = Date.UTC(2026, 8, 20);
  const fresh = (now: number) => engine.createInitialMergeWorldState(now, ['mossprout']);
  saveMission('board.wanderling', 'run-w', fresh(NOW), 3, 1);

  const renders: { key: string; loaded: boolean; merges: number; placed: number }[] = [];
  let latest: ReturnType<typeof useMissionBoard> | null = null;
  function Host({ boardKey, runId }: { boardKey: string; runId: string }) {
    const store = useMissionBoard(boardKey, runId, fresh);
    latest = store;
    renders.push({ key: boardKey, loaded: store.state != null, merges: store.merges, placed: store.placedDeliveries });
    return null;
  }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host boardKey="board.wanderling" runId="run-w" />); });
  assert.deepEqual(renders.at(-1), { key: 'board.wanderling', loaded: true, merges: 3, placed: 1 }, 'a saved board comes back as it was');

  await act(async () => tree!.update(<Host boardKey="board.petalimp" runId="run-p" />));
  const petalimp = renders.filter((entry) => entry.key === 'board.petalimp');
  assert.ok(petalimp.length >= 2, 'the switch renders once before its own board has loaded');
  assert.deepEqual(petalimp[0], { key: 'board.petalimp', loaded: false, merges: 0, placed: 0 }, 'and that render has no board at all, never Wanderling’s');
  assert.ok(petalimp.every((entry) => entry.merges === 0 && entry.placed === 0), 'Petalimp’s board never reads Wanderling’s 3 merges');
  assert.deepEqual(petalimp.at(-1), { key: 'board.petalimp', loaded: true, merges: 0, placed: 0 }, 'then its own fresh board');
  assert.equal((storage.get('board.wanderling') as { merges: number }).merges, 3, 'Wanderling’s save is untouched');
  assert.equal((storage.get('board.petalimp') as { runId: string; merges: number }).runId, 'run-p');
  assert.equal((storage.get('board.petalimp') as { merges: number }).merges, 0);

  // Back to Wanderling: its own progress again, and Petalimp's never leaks the other way either.
  await act(async () => tree!.update(<Host boardKey="board.wanderling" runId="run-w" />));
  const back = renders.slice(renders.findLastIndex((entry) => entry.key === 'board.petalimp') + 1);
  assert.deepEqual(back[0], { key: 'board.wanderling', loaded: false, merges: 0, placed: 0 });
  assert.deepEqual(back.at(-1), { key: 'board.wanderling', loaded: true, merges: 3, placed: 1 });
  assert.ok(latest);
  await act(async () => tree!.unmount());
});
