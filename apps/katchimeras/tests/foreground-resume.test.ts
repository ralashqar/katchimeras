import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { createForegroundTask } from '@/utils/foreground-task';
import { createPendingVisualCompletion } from '@/utils/pending-visual-completion';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function scheduler() {
  const callbacks = new Map<ReturnType<typeof setTimeout>, () => void>();
  let id = 0;
  return {
    callbacks,
    schedule(callback: () => void) {
      const handle = ++id as unknown as ReturnType<typeof setTimeout>;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle: ReturnType<typeof setTimeout>) { callbacks.delete(handle); },
    tick() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

test('thirty rapid inactive/active bounces debounce to one foreground pass', async () => {
  const clock = scheduler();
  let calls = 0;
  const task = createForegroundTask(async () => { calls++; }, { ...clock, onError: (error) => assert.fail(String(error)) });
  for (let cycle = 0; cycle < 30; cycle++) {
    task.setActive(true);
    task.setActive(false);
    assert.equal(clock.callbacks.size, 0);
  }
  clock.tick();
  await flush();
  assert.equal(calls, 0);
  task.setActive(true);
  task.setActive(true);
  assert.equal(clock.callbacks.size, 1);
  clock.tick();
  await flush();
  assert.equal(calls, 1);
  task.dispose();
});

test('a slow resume has one worker and at most one trailing request', async () => {
  const clock = scheduler();
  let finish!: () => void;
  let calls = 0;
  let activeCheck!: () => boolean;
  const task = createForegroundTask(async (isActive) => {
    calls++;
    activeCheck = isActive;
    await new Promise<void>((resolve) => { finish = resolve; });
  }, { ...clock, onError: (error) => assert.fail(String(error)) });
  task.setActive(true);
  clock.tick();
  await flush();
  for (let cycle = 0; cycle < 30; cycle++) {
    task.setActive(false);
    assert.equal(activeCheck(), false);
    task.setActive(true);
    clock.tick();
  }
  assert.equal(calls, 1);
  finish();
  await flush();
  assert.equal(clock.callbacks.size, 1);
  clock.tick();
  await flush();
  assert.equal(calls, 2);
  task.dispose();
  assert.equal(activeCheck(), false);
  finish();
  await flush();
  assert.equal(clock.callbacks.size, 0);
});

test('background/dispose cancels queued resumes and a rejected worker can retry', async () => {
  const clock = scheduler();
  let failures = 0;
  const task = createForegroundTask(async () => { throw new Error('test'); }, {
    ...clock, onError: () => { failures++; },
  });
  task.setActive(true);
  clock.tick();
  await flush();
  task.setActive(false);
  task.setActive(true);
  clock.tick();
  await flush();
  assert.equal(failures, 2);
  task.setActive(false);
  task.setActive(true);
  task.dispose();
  clock.tick();
  await flush();
  assert.equal(failures, 2);
});

test('camera completion is once-only across interrupted, superseded and cancelled moves', () => {
  const pending = createPendingVisualCompletion<{ tx: number; ty: number; scale: number }>();
  let completed = 0;
  for (let cycle = 0; cycle < 30; cycle++) {
    const staleId = pending.begin({ tx: 1, ty: 2, scale: 1 }, () => assert.fail('superseded move'));
    const target = { tx: cycle, ty: 30, scale: 2 };
    const id = pending.begin(target, () => { completed++; });
    pending.finish(staleId);
    assert.equal(pending.peek()?.target, target);
    pending.finish(id); // resume settles the intended destination
    pending.finish(id); // delayed native completion is ignored
    assert.equal(pending.peek(), null);
    const cancelled = pending.begin(target, () => assert.fail('cancelled move'));
    pending.cancel();
    pending.finish(cancelled);
  }
  assert.equal(completed, 30);
});
