import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import type { ActivitySession, ActivitySource } from '@/features/activities/activity-session';

test('activity descriptors retain framing and return receipts across reloads; reset removes them', () => {
  const disk = new Map<string, unknown>();
  const resets: (() => void)[] = [];
  const load = () => loadNativeModule('features/activities/activity-session.ts', {
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => disk.get(key) ?? fallback,
      setStoredJson: (key: string, value: unknown) => disk.set(key, structuredClone(value)), onStorageReset: (fn: () => void) => resets.push(fn) },
  }) as unknown as typeof import('@/features/activities/activity-session');
  const api = load();
  const sources: ActivitySource[] = [{ kind: 'cafe', kitchen: true, goalId: 'serve-three' },
    { kind: 'event', eventId: 'spring', nodeId: 'one' }, { kind: 'rush', dayId: '2026-09-27', index: 0, attempt: 1 }];
  for (const source of sources) {
    const input = { source, tileLayerId: 'structure:baristabbit-home', tileScene: {}, backdrop: 'morning',
      tileFraming: { frame: { left: -200, top: 30, width: 700, height: 600 }, viewport: { width: 390, height: 844 } } } as unknown as Omit<ActivitySession, 'id' | 'version' | 'status'>;
    const started = api.startActivitySession(input);
    assert.equal(JSON.stringify(load().getActivitySession()), JSON.stringify(started));
    api.saveActivitySession({ ...started, status: 'returning', result: { goalCompleted: true } });
    assert.equal(load().getActivitySession()?.result?.goalCompleted, true);
  }
  resets.forEach(reset => reset()); disk.clear();
  assert.equal(api.getActivitySession(), null);
  disk.set('katchimeras.activity-session.v1', { version: 1, id: 'bad', source: { kind: 'cafe' }, status: 'playing' });
  assert.equal(load().getActivitySession(), null);
});
