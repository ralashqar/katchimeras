import assert from 'node:assert/strict';
import test from 'node:test';

import type { EncounterLedger, MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 22, 9);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('a v24 save crosses into the campaign pivot: version 25, the pivot marked, an empty encounter ledger, Glow kept', () => {
  const raw = createInitialMergeWorldState(NOW, ['mossprout']);
  (raw as { version: number }).version = 24;
  raw.coins = 137;
  const migrated = normalizeMergeWorldState(clone(raw), NOW);
  assert.equal(migrated.version, 25);
  assert.equal(migrated.pivot, 'campaign-v1');
  assert.equal(migrated.coins, 137);
  assert.deepEqual(migrated.encounters, { receipts: [], clears: {}, active: null, loadout: null, daily: {}, lastOutcome: null });
  assert.deepEqual(migrated.katchimeraProgress, {});
  // A fresh world is already there.
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(fresh.version, 25);
  assert.deepEqual(normalizeMergeWorldState(clone(migrated), NOW).version, 25);
});

test('the encounter ledger and Katchimera progress survive a round trip and shed what cannot be read', () => {
  const raw = createInitialMergeWorldState(NOW, ['mossprout']);
  const ledger: EncounterLedger = {
    receipts: ['encounter:sleeping-grove:2:run-1'],
    clears: { 'sleeping-grove:2': { firstClearedAt: NOW, clears: 2, bestGrade: 'bright', lastKatchimeraId: 'mossprout' } },
    active: { missionId: 'sleeping-grove:3', runId: 'run-2', campaignId: 'sleeping-grove', katchimeraId: 'mossprout', helperWispId: null, startedAt: NOW },
    loadout: { katchimeraId: 'mossprout', helperWispId: null },
    daily: { '2026-09-22': { slots: { '0': { clearedAt: NOW, grade: 'perfect' } } } },
    lastOutcome: { missionId: 'sleeping-grove:2', receiptId: 'encounter:sleeping-grove:2:run-1', grade: 'bright', glow: 20, xp: 12, firstClear: true, katchimeraId: 'mossprout', ackedAt: null },
  };
  raw.encounters = ledger;
  raw.katchimeraProgress = { mossprout: { level: 3, xp: 40, upgradedAt: NOW } };
  const migrated = normalizeMergeWorldState(clone(raw), NOW);
  assert.deepEqual(migrated.encounters, ledger);
  assert.deepEqual(migrated.katchimeraProgress, { mossprout: { level: 3, xp: 40, upgradedAt: NOW } });

  const broken = clone(raw) as unknown as { encounters: Record<string, unknown>; katchimeraProgress: Record<string, unknown> };
  broken.encounters.clears = { bad: { firstClearedAt: NOW, clears: 1, bestGrade: 'gold', lastKatchimeraId: 'mossprout' }, alsoBad: { bestGrade: 'cleared', lastKatchimeraId: 'nobody' } };
  broken.encounters.active = { missionId: 'x', katchimeraId: 'mossprout' };
  broken.encounters.daily = Object.fromEntries(Array.from({ length: 10 }, (_, day) => [`2026-09-${String(day + 10).padStart(2, '0')}`, { slots: {} }]));
  broken.katchimeraProgress = { mossprout: { level: 99, xp: -4 }, nobody: { level: 2, xp: 0 } };
  const repaired = normalizeMergeWorldState(broken as unknown as MergeWorldState, NOW);
  assert.deepEqual(repaired.encounters!.clears, {});
  assert.equal(repaired.encounters!.active, null, 'an active record without a run id is dropped');
  assert.equal(Object.keys(repaired.encounters!.daily).length, 7, 'only the last seven days are kept');
  assert.deepEqual(repaired.katchimeraProgress, { mossprout: { level: 10, xp: 0, upgradedAt: null } });
});

test("an encounter's own Mist survives a reload; unreadable encounter mist is plain locked mist", () => {
  const raw = createInitialMergeWorldState(NOW, ['mossprout']);
  raw.board[24] = { ...raw.board[24]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'dense', hp: 2, holds: { kind: 'item', definitionId: 'nature:garden:1' } } };
  raw.board[25] = { ...raw.board[25]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'wisp-bound', hp: 1, wispId: 'keeper' } };
  raw.board[26] = { ...raw.board[26]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'root', hp: 1, holds: { kind: 'spawner', spawnerId: 'pod' } } };
  const migrated = normalizeMergeWorldState(clone(raw), NOW);
  assert.deepEqual(migrated.board[24]!.mist, { kind: 'encounter', type: 'dense', hp: 2, holds: { kind: 'item', definitionId: 'nature:garden:1' } });
  assert.deepEqual(migrated.board[25]!.mist, { kind: 'encounter', type: 'wisp-bound', hp: 1, wispId: 'keeper' });
  assert.deepEqual(migrated.board[26]!.mist, { kind: 'encounter', type: 'root', hp: 1, holds: { kind: 'spawner', spawnerId: 'pod' } });
  const broken = clone(raw);
  (broken.board[24] as { mist: unknown }).mist = { kind: 'encounter', type: 'fog', hp: 1 };
  (broken.board[25] as { mist: unknown }).mist = { kind: 'encounter', type: 'light', hp: 1, holds: { kind: 'item', definitionId: 'not:a:thing' } };
  const repaired = normalizeMergeWorldState(broken, NOW);
  assert.notEqual(repaired.board[24]!.mist?.kind, 'encounter', 'an unknown type is not kept');
  assert.deepEqual(repaired.board[25]!.mist, { kind: 'encounter', type: 'light', hp: 1 }, 'an unknown held item is dropped, the mist stays');
});
