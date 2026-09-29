import { authoredCombatEncounter } from '@/features/encounter/combat-loadout';
import { DEFAULT_ENCOUNTER_PROFILE } from '@/features/encounter/encounter-run';
import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { FIRST_BATTLE } from '@/constants/last-clearing-battle';
import { encounterRunId } from '@/features/encounter/run-id';
import { encounterProfile } from '@/features/encounter/spawner-profile';
import { combatLessonMission } from '@/constants/combat-campaign';
import type { BattleSession } from '@/features/encounter/battle-session';
import { loadNativeModule } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fixture(env: Record<string, string> = {}) {
  const disk = new Map<string, unknown>();
  const resets: (() => void)[] = [];
  const load = () => loadNativeModule('features/encounter/battle-session.ts', {
    './combat-loadout': { authoredCombatEncounter },
    './encounter-run': { DEFAULT_ENCOUNTER_PROFILE },
    './run-id': { encounterRunId },
    './spawner-profile': { encounterProfile },
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => disk.get(key) ?? fallback,
      setStoredJson: (key: string, value: unknown) => { disk.set(key, JSON.parse(JSON.stringify(value))); },
      onStorageReset: (callback: () => void) => { resets.push(callback); },
    },
  }, { process: { env } }) as unknown as typeof import('@/features/encounter/battle-session');
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

test('the scene flag defaults to dedicated battles and zero restores embedded battles', () => {
  assert.equal(fixture().load().BATTLE_SCENE_ENABLED, true);
  assert.equal(fixture({ EXPO_PUBLIC_BATTLE_SCENE: '1' }).load().BATTLE_SCENE_ENABLED, true);
  assert.equal(fixture({ EXPO_PUBLIC_BATTLE_SCENE: '0' }).load().BATTLE_SCENE_ENABLED, false);
});

test('embedded mode ignores a previous dedicated victory without deleting its saved session', async () => {
  const f = fixture({ EXPO_PUBLIC_BATTLE_SCENE: '0' });
  const api = f.load();
  const started = api.startBattleSession(input);
  const won = { ...started, status: 'returned', result: { kind: 'won', outcome: { grade: 'perfect' }, runId: 'dedicated-run' } } as BattleSession;
  api.saveBattleSession(won);
  let observed: BattleSession | null = null;
  function Consumer({ enabled }: { enabled: boolean }) {
    observed = api.useBattleSession(enabled);
    return null;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(React.createElement(Consumer, { enabled: api.BATTLE_SCENE_ENABLED })); });
  assert.equal(observed, null, 'embedded reward handlers must fall back to their live mission outcome');
  assert.equal(JSON.stringify(f.load().getBattleSession()), JSON.stringify(won), 'the saved result remains recoverable');
  await act(async () => { tree.update(React.createElement(Consumer, { enabled: true })); });
  assert.equal(observed, won, 'dedicated mode still reads its persisted result');
  await act(async () => { api.saveBattleSession({ ...won, result: { kind: 'left' } }); });
  assert.equal((observed as BattleSession | null)?.result?.kind, 'left', 'enabled consumers still receive updates');
  await act(async () => { tree.unmount(); });
});


test('combat freezes upgrades and resumes the chosen support', () => {
  const f = fixture(); const api = f.load();
  const next = { ...input, sourceKey: 'combat:test', encounter: combatLessonMission(3).encounter,
    loadout: { companionId: 'mossprout', level: 5 } as BattleSession['loadout'], world: { heartwoodBuildings: {}, chapterOpeningsSeen: [], heroBuildings: { 'bloom-house': { level: 6, builtAt: 1 } } } };
  const started = api.startBattleSession(next);
  assert.equal(started.loadout.combatProfile?.damageMultiplier, 1.32);
  assert.ok((started.loadout.combatProfile?.seedPace ?? 0) > 0);
  api.saveBattleSession({ ...started, prepared: true, loadout: { ...started.loadout, secondaryGenerator: 'dew-well' } });
  const resumed = api.startBattleSession({ ...next, loadout: { ...next.loadout, level: 9 } });
  assert.equal(resumed.loadout.level, 5);
  assert.equal(resumed.loadout.secondaryGenerator, 'dew-well');
  assert.equal(f.load().getBattleSession()?.prepared, true);
});
