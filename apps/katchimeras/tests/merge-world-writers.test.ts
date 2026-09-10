import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { flushMergeWorldWriters, mergeWorldWriterCountForTests, registerMergeWorldWriterFlush } from '@/utils/merge-world/writer-flush';
import { MergeWorldStaleWriteError, mergeWriteIsStale } from '@/utils/merge-world/write-guard';
import type { MergeWorldState } from '@/types/merge-world';

test('direct readers drain every registered provider once, sharing one drain, and survive a failing writer', async () => {
  const calls: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const unregisterA = registerMergeWorldWriterFlush(async () => { calls.push('a'); await gate; });
  const unregisterB = registerMergeWorldWriterFlush(async () => { calls.push('b'); throw new Error('write failed'); });
  assert.equal(mergeWorldWriterCountForTests(), 2);
  const first = flushMergeWorldWriters();
  const second = flushMergeWorldWriters();
  assert.equal(first, second, 'concurrent callers share the in-flight drain');
  release();
  await first;
  assert.deepEqual(calls, ['a', 'b']);
  await flushMergeWorldWriters();
  assert.deepEqual(calls, ['a', 'b', 'a', 'b'], 'a finished drain does not satisfy a later caller');
  unregisterA(); unregisterB();
  assert.equal(mergeWorldWriterCountForTests(), 0);
  await flushMergeWorldWriters();
});

test('a save is stale only when disk moved past the snapshot it was derived from', () => {
  assert.equal(mergeWriteIsStale(10, 10), false, 'unchanged disk');
  assert.equal(mergeWriteIsStale(9, 10), false, 'our own newer state is still valid');
  assert.equal(mergeWriteIsStale(11, 10), true, 'another writer landed since');
  assert.equal(mergeWriteIsStale(11, undefined), false, 'callers without a base keep the old unconditional write');
  assert.equal(mergeWriteIsStale(null, 10), false, 'no row yet');
  const error = new MergeWorldStaleWriteError({ revision: 11 } as MergeWorldState);
  assert.equal(error.current.revision, 11);
  assert.equal(error.name, 'MergeWorldStaleWriteError');
});

test('the repository flushes writers before reading or reducing, tags snapshot origins, and validates provider saves', () => {
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  assert.match(repository, /export async function loadMergeWorldState[\s\S]*?await flushMergeWorldWriters\(\);[\s\S]*?const db = await database\(\);/);
  assert.match(repository, /async function reduceStoredMergeWorld[\s\S]*?await flushMergeWorldWriters\(\);[\s\S]*?serializeWrite/);
  assert.match(repository, /publishSnapshot\(state, 'provider'\)/);
  assert.match(repository, /publishSnapshot\(result\.state, 'store'\)/);
  assert.doesNotMatch(repository, /publishSnapshot\([A-Za-z.]+\);/, 'every publish names its origin');
  assert.match(repository, /if \(row && mergeWriteIsStale\(row\.revision, options\.baseRevision\)\)[\s\S]*?throw new MergeWorldStaleWriteError\(current\)/);
  assert.match(repository, /'SELECT revision, state_json FROM merge_world_snapshot WHERE profile_id = \?'/);
});

test('the provider registers its flush, adopts store writes, and never retries a stale save', () => {
  const provider = readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  assert.match(provider, /useEffect\(\(\) => registerMergeWorldWriterFlush\(flush\), \[flush\]\)/);
  assert.match(provider, /subscribeMergeWorldSnapshots\(\(freshState, origin\) => \{[\s\S]*?if \(origin === 'provider' && freshState\.revision <= \(stateRef\.current\?\.revision \?\? -1\)\) return;[\s\S]*?if \(origin === 'store' && freshState\.revision <= \(baseRevisionRef\.current \?\? -1\)\) return;[\s\S]*?baseRevisionRef\.current = freshState\.revision;/);
  assert.match(provider, /await saveMergeWorldState\(pending\.state, \[\.\.\.pending\.receiptIds\], \{ baseRevision: baseRevisionRef\.current \?\? undefined \}\);[\s\S]*?baseRevisionRef\.current = pending\.state\.revision;/);
  assert.match(provider, /if \(caught instanceof MergeWorldStaleWriteError\) \{[\s\S]*?baseRevisionRef\.current = caught\.current\.revision;[\s\S]*?stateRef\.current = caught\.current;[\s\S]*?return;/);
  assert.match(provider, /options\?\.persist !== 'immediate' && \(command\.type === 'move' \|\| command\.type === 'tapGenerator'\)/);
  const screen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(screen, /send\(effectiveCommand, currentStep\?\.surface === 'merge' \? \{ persist: 'immediate' \} : undefined\)/);
  assert.match(screen, /const chapterZeroTarget = mossproutChapterZeroRepairTarget\(ftueRun, state\);[\s\S]*?repairFtueStep\(ftueRun\.stepId, chapterZeroTarget, \{ clearStepIds: chapterZeroStepsFrom\(chapterZeroTarget\) \}\);/);
  const glow = readFileSync('features/onboarding/glow-discovery-runtime.ts', 'utf8');
  assert.match(glow, /eventId: `\$\{run\.runId\}:\$\{run\.nodeId\}:domain-complete:\$\{run\.revision\}`/);
});
