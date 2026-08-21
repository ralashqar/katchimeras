import * as SQLite from 'expo-sqlite';

import type { MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { HavenStage } from '@/constants/haven-catalog';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld, resetMergeActivityForDay } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { MOSSPROUT_FTUE_JOURNAL_ENERGY } from '@/utils/merge-world/economy-policy';

const DATABASE_NAME = 'katchimeras-merge-world.db';
const LOCAL_PROFILE_ID = 'local';

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let resetGeneration = 0;
let resetInProgress = false;
let writeQueue: Promise<void> = Promise.resolve();
const resetListeners = new Set<(state: MergeWorldState) => void>();
const snapshotListeners = new Set<(state: MergeWorldState) => void>();

function publishSnapshot(state: MergeWorldState) {
  snapshotListeners.forEach((listener) => listener(state));
}

function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function database() {
  if (!databasePromise) {
    const opening = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS merge_world_snapshot (
          profile_id TEXT PRIMARY KEY NOT NULL,
          schema_version INTEGER NOT NULL,
          revision INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          state_json TEXT NOT NULL,
          backup_json TEXT
        );
        CREATE TABLE IF NOT EXISTS merge_world_outbox (
          receipt_id TEXT PRIMARY KEY NOT NULL,
          receipt_kind TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          synced_at INTEGER
        );
      `);
      return db;
    })();
    databasePromise = opening.catch((caught) => {
      databasePromise = null;
      throw caught;
    });
  }
  return databasePromise;
}

export async function loadMergeWorldState(now = Date.now()): Promise<MergeWorldState> {
  const db = await database();
  const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
    'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
    [LOCAL_PROFILE_ID],
  );
  if (!row) return createInitialMergeWorldState(now);
  try {
    return normalizeMergeWorldState(JSON.parse(row.state_json), now);
  } catch {
    if (row.backup_json) {
      try {
        return normalizeMergeWorldState(JSON.parse(row.backup_json), now);
      } catch {
        // Fall through to a recoverable new world.
      }
    }
    return createInitialMergeWorldState(now);
  }
}

export async function saveMergeWorldState(state: MergeWorldState, receiptIds?: readonly string[]): Promise<void> {
  // Companion/story resets notify their subscribers asynchronously. Do not
  // allow a subscriber holding the pre-reset board to queue it behind the
  // destructive reset and restore generators after the database is cleared.
  if (resetInProgress) return;
  const generation = resetGeneration;
  const serialized = JSON.stringify(state);
  const selectedReceipts = receiptIds == null
    ? state.externalRewardReceipts
    : state.externalRewardReceipts.filter((receipt) => receiptIds.includes(receipt.id));

  await serializeWrite(async () => {
    if (generation !== resetGeneration) return;
    if (resetInProgress) return;
    const db = await database();
    if (generation !== resetGeneration) return;
    if (resetInProgress) return;
    await db.withTransactionAsync(async () => {
      if (generation !== resetGeneration) return;
      if (resetInProgress) return;
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           schema_version = excluded.schema_version,
           revision = excluded.revision,
           updated_at = excluded.updated_at,
           backup_json = merge_world_snapshot.state_json,
           state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, state.version, state.revision, state.updatedAt, serialized, null],
      );
      for (const receipt of selectedReceipts) {
        await db.runAsync(
          `INSERT OR IGNORE INTO merge_world_outbox (receipt_id, receipt_kind, created_at, payload_json, synced_at)
           VALUES (?, ?, ?, ?, ?)`,
          [receipt.id, receipt.kind, receipt.createdAt, JSON.stringify(receipt), receipt.appliedAt],
        );
        if (receipt.appliedAt != null) {
          await db.runAsync('UPDATE merge_world_outbox SET synced_at = ? WHERE receipt_id = ?', [receipt.appliedAt, receipt.id]);
        }
      }
    });
  });
  if (generation === resetGeneration && !resetInProgress) publishSnapshot(state);
}

async function reduceStoredMergeWorld(
  reduce: (state: MergeWorldState) => MergeWorldCommandResult,
  now = Date.now(),
): Promise<MergeWorldCommandResult> {
  const generation = resetGeneration;
  const result = await serializeWrite(async () => {
    const db = await database();
    const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
      'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
      [LOCAL_PROFILE_ID],
    );
    let current = createInitialMergeWorldState(now);
    if (row) {
      try {
        current = normalizeMergeWorldState(JSON.parse(row.state_json), now);
      } catch {
        if (row.backup_json) {
          try { current = normalizeMergeWorldState(JSON.parse(row.backup_json), now); } catch {}
        }
      }
    }
    const reduced = reduce(current);
    if (!reduced.changed || generation !== resetGeneration || resetInProgress) return reduced;
    await db.runAsync(
      `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET schema_version = excluded.schema_version, revision = excluded.revision,
       updated_at = excluded.updated_at, backup_json = merge_world_snapshot.state_json, state_json = excluded.state_json`,
      [LOCAL_PROFILE_ID, reduced.state.version, reduced.state.revision, reduced.state.updatedAt, JSON.stringify(reduced.state), row?.state_json ?? null],
    );
    return reduced;
  });
  if (result.changed && generation === resetGeneration && !resetInProgress) publishSnapshot(result.state);
  return result;
}

/** Pays the authored journal reward through the normal daily journal receipt. */
export function grantMossproutFtueJournalEnergy(dayId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantActivityRewardsBatch',
    rewards: [{
      receiptId: `activity:egg-journal:${dayId}`,
      kind: 'daily_journal_energy',
      amount: MOSSPROUT_FTUE_JOURNAL_ENERGY,
      label: 'Mossprout memory',
      grantDayId: dayId,
    }],
    now,
  }), now);
}

/** Atomically checkpoints yesterday's pedometer total for its one daily conversion. */
export function claimDailyStepEnergy(input: {
  dayId: string;
  observedSteps: number;
  observedAt: string;
  allowBootstrap: boolean;
  receiptId: string;
}, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'claimStepEnergy',
    ...input,
    now,
  }), now);
}

/** Backwards-compatible name for the authored onboarding call site. */
export const claimMossproutFtueStepEnergy = claimDailyStepEnergy;

/** Opens the fixed first board discovery after Mossprout's Chapter 0 return. */
export function installStepplingFtueDiscovery(now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'startStepplingDiscovery', now }), now);
}

/** Immediately persists a Today journal payout using the same receipts as provider reconciliation. */
export function grantJournalCaptureEnergy(input: {
  companionEnergy: number;
  dayId: string;
  journalEnergy: number;
  recordId: string;
}, now = Date.now()) {
  const rewards = [
    ...(input.journalEnergy > 0 ? [{
      receiptId: `activity:egg-journal:${input.dayId}:${input.recordId}`,
      kind: 'daily_journal_energy' as const,
      amount: input.journalEnergy,
      label: 'Journal memory',
      grantDayId: input.dayId,
    }] : []),
    ...(input.companionEnergy > 0 ? [{
      receiptId: `activity:egg-companion:${input.dayId}`,
      kind: 'daily_companion_energy' as const,
      amount: input.companionEnergy,
      label: 'Companion reflection',
      grantDayId: input.dayId,
    }] : []),
  ];
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantActivityRewardsBatch',
    rewards,
    now,
  }), now);
}

/** Atomically spends Merge Coins and advances one linear Haven environment. */
export function upgradeStoredHavenTile(characterId: import('@/types/merge-world').MergeCharacterId, stage: HavenStage, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId, stage, now }), now);
}

export function revealStoredHaven(now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'revealHaven', now }), now);
}

export function reconcileStoredHavenStory(characterId: import('@/types/merge-world').MergeCharacterId, storyLevel: number, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId, storyLevel, now }), now);
}

export async function resetMergeWorldStateForDebug(now = Date.now()): Promise<void> {
  resetGeneration += 1;
  resetInProgress = true;
  try {
    await serializeWrite(async () => {
      const db = await database();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
        await db.runAsync('DELETE FROM merge_world_outbox');
      });
    });
    const freshState = createInitialMergeWorldState(now);
    resetListeners.forEach((listener) => listener(freshState));
    publishSnapshot(freshState);
  } finally {
    resetInProgress = false;
  }
}

/** Atomically installs an authored/captured developer profile board. */
export async function installMergeWorldStateForDebug(input: unknown, now = Date.now()): Promise<MergeWorldState> {
  const installed = normalizeMergeWorldState(input, now);
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  try {
    await serializeWrite(async () => {
      const db = await database();
      const existing = await db.getFirstAsync<{ state_json: string }>(
        'SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?',
        [LOCAL_PROFILE_ID],
      );
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(profile_id) DO UPDATE SET
             schema_version = excluded.schema_version,
             revision = excluded.revision,
             updated_at = excluded.updated_at,
             backup_json = merge_world_snapshot.state_json,
             state_json = excluded.state_json`,
          [LOCAL_PROFILE_ID, installed.version, installed.revision, installed.updatedAt, JSON.stringify(installed), existing?.state_json ?? null],
        );
        await db.runAsync('DELETE FROM merge_world_outbox');
      });
    });
  } finally {
    resetInProgress = false;
  }
  resetListeners.forEach((listener) => listener(installed));
  publishSnapshot(installed);
  return installed;
}

/** One-time product migration: archives the old snapshot as backup and installs Chapter 0. */
export async function installMossproutOnboardingMergeWorld(now = Date.now(), rewardWispId: import('@/types/wisp').WispId = 'sprout'): Promise<MergeWorldState> {
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  const freshState = createMossproutChapterZeroState(now, rewardWispId);
  try {
    await serializeWrite(async () => {
      const db = await database();
      const existing = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET schema_version = excluded.schema_version, revision = excluded.revision,
         updated_at = excluded.updated_at, backup_json = COALESCE(merge_world_snapshot.backup_json, merge_world_snapshot.state_json), state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, freshState.version, freshState.revision, freshState.updatedAt, JSON.stringify(freshState), existing?.state_json ?? null],
      );
      await db.runAsync('DELETE FROM merge_world_outbox');
    });
  } finally {
    resetInProgress = false;
  }
  resetListeners.forEach((listener) => listener(freshState));
  publishSnapshot(freshState);
  return freshState;
}

export type MossproutMergeFtueStepId =
  | 'merge.seed_drag'
  | 'merge.serve_sprout'
  | 'merge.plant.spawn'
  | 'merge.plant.seed_pairs'
  | 'merge.plant.sprout_pair'
  | 'merge.serve_plant';

export async function prepareMossproutMergeFtueForDebug(step: MossproutMergeFtueStepId, now = Date.now()) {
  let prepared = await installMossproutOnboardingMergeWorld(now);
  if (step === 'merge.seed_drag') return prepared;
  prepared = mergeFirstPair(prepared, 'nature:garden:1', now + 1);
  if (step === 'merge.plant.spawn') return persistPreparedFtueState(prepared);
  prepared = reduceMergeWorld(prepared, { type: 'tapGenerator', generatorId: 'wild-garden', now: now + 2, seed: 'ftue-debug:echo-seed' }).state;
  if (step === 'merge.plant.seed_pairs') return persistPreparedFtueState(prepared);
  prepared = mergeDefinitionIntoEcho(prepared, 'nature:garden:1', 'mossprout-seed-echo', now + 3);
  if (step === 'merge.serve_sprout') return persistPreparedFtueState(prepared);
  prepared = reduceMergeWorld(prepared, { type: 'serveOrder', orderId: 'mossprout:chapter-0:first-sprout', now: now + 4 }).state;
  if (step === 'merge.plant.sprout_pair') return persistPreparedFtueState(prepared);
  prepared = mergeDefinitionIntoEcho(prepared, 'nature:garden:2', 'mossprout-sprout-echo', now + 5);
  return persistPreparedFtueState(prepared);
}

function mergeDefinitionIntoEcho(state: MergeWorldState, definitionId: string, echoId: string, now: number) {
  const from = state.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId);
  const to = state.board.findIndex((cell) => cell.mist?.kind === 'echo' && cell.mist.id === echoId);
  return from < 0 || to < 0 ? state : reduceMergeWorld(state, { type: 'move', from, to, now }).state;
}

function mergeFirstPair(state: MergeWorldState, definitionId: string, now: number) {
  const cells = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === definitionId ? [index] : []);
  return cells.length < 2 ? state : reduceMergeWorld(state, { type: 'move', from: cells[0], to: cells[1], now }).state;
}

async function persistPreparedFtueState(state: MergeWorldState) {
  await saveMergeWorldState(state);
  resetListeners.forEach((listener) => listener(state));
  publishSnapshot(state);
  return state;
}

/** Makes one day eligible for real-life Merge Energy without resetting board progress. */
export async function resetMergeWorldActivityForDayForDebug(
  dayId: string,
  now = Date.now(),
  stepEnergyDayId?: string,
): Promise<void> {
  // Preserve a board command that was queued immediately before Reset Today.
  // Once drained, resetInProgress rejects any stale writes until the scoped
  // snapshot and its mounted-provider notification are complete.
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  let resetState: MergeWorldState | null = null;
  try {
    await serializeWrite(async () => {
      const db = await database();
      const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
        'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
        [LOCAL_PROFILE_ID],
      );
      let current = createInitialMergeWorldState(now);
      if (row) {
        try {
          current = normalizeMergeWorldState(JSON.parse(row.state_json), now);
        } catch {
          if (row.backup_json) {
            try {
              current = normalizeMergeWorldState(JSON.parse(row.backup_json), now);
            } catch {
              // Keep the recoverable new world.
            }
          }
        }
      }
      resetState = resetMergeActivityForDay(current, dayId, now, stepEnergyDayId);
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET
           schema_version = excluded.schema_version,
           revision = excluded.revision,
           updated_at = excluded.updated_at,
           backup_json = merge_world_snapshot.state_json,
           state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, resetState.version, resetState.revision, resetState.updatedAt, JSON.stringify(resetState), null],
      );
    });
  } finally {
    resetInProgress = false;
  }
  if (resetState) resetListeners.forEach((listener) => listener(resetState!));
  if (resetState) publishSnapshot(resetState);
}

export function subscribeMergeWorldResets(listener: (state: MergeWorldState) => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function subscribeMergeWorldSnapshots(listener: (state: MergeWorldState) => void): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}
