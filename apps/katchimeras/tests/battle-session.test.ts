import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRST_BATTLE } from '@/constants/last-clearing-battle';
import { encounterRunId } from '@/features/encounter/run-id';
import type { BattleSession } from '@/features/encounter/battle-session';
import { loadNativeModule } from './helpers/native-motion-harness';

function fixture() {
  const disk = new Map<string, unknown>();
  const resets: (() => void)[] = [];
  const load = () => loadNativeModule('features/encounter/battle-session.ts', {
    './run-id': { encounterRunId },
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => disk.get(key) ?? fallback,
      setStoredJson: (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); },
      onStorageReset: (callback: () => void) => { resets.push(callback); },
    },
  }, { process: { env: {} } }) as unknown as typeof import('@/features/encounter/battle-session');
  return { disk, load, reset: () => { resets.forEach((callback) => callback()); disk.clear(); } };
}
const input = {
  sourceKey: 'first:fixture', source: { kind: 'first' as const, run: 'fixture' },
  encounter: FIRST_BATTLE, loadout: { companionId: 'mossprout', level: 1 },
  world: { heartwoodBuildings: [], chapterOpeningsSeen: [] }, backdrop: 'morning',
} as unknown as Omit<BattleSession, 'id' | 'status' | 'version' | 'result'>;

test('a playing or returning battle survives a new module instance and reset clears its cache', () => {
  const f = fixture();
  const api = f.load();
  const started = api.startBattleSession(input);
  assert.equal(JSON.stringify(f.load().getBattleSession()), JSON.stringify(started));
  api.saveBattleSession({ ...started, status: 'returning', result: { kind: 'left' } });
  assert.equal(f.load().getBattleSession()?.status, 'returning');
  f.reset();
  assert.equal(api.getBattleSession(), null);
});
test('resuming preserves attempt identity only for the matching authored encounter and loadout', () => {
  const api = fixture().load();
  const session = api.startBattleSession(input);
  const saved = { runId: encounterRunId(session.encounter, 3, session.loadout), run: { attempt: 3 } };
  assert.equal(api.battleResumeAttempt(session, saved), 3);
  assert.equal(api.battleResumeAttempt(session, { ...saved, runId: 'another-loadout' }), 1);
  assert.equal(api.battleResumeAttempt(session, { ...saved, run: { attempt: -1 } }), 1);
});
test('a corrupt session descriptor is ignored', () => {
  const f = fixture();
  f.disk.set('katchimeras.battle-session.v1', { version: 1, sourceKey: 'bad', encounter: { storageKey: 'bad' } });
  assert.equal(f.load().getBattleSession(), null);
});
