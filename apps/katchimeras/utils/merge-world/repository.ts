import * as SQLite from 'expo-sqlite';
import { WORLD_UPGRADE_STORIES } from '@/features/world-upgrades/world-upgrade-stories';
import { upgradeCompletedLevel } from '@/features/world-upgrades/world-upgrade-progress';
import { measureMergeWork } from './performance';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { sharedWorldPurchase } from '@/constants/shared-world';
import type { HavenStage } from '@/constants/haven-catalog';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld, resetMergeActivityForDay } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { completeMossproutChapterZeroSlice } from '@/utils/merge-world/chapter-zero-policy';
import { MOSSPROUT_FTUE_JOURNAL_ENERGY } from '@/utils/merge-world/economy-policy';
import { firstFtueMemoryForSource, reduceFirstFtueMemoryPlacement } from '@/utils/merge-world/first-ftue-memory';
import { MOSSPROUT_FIRST_MEMORY_SLOT_ID } from '@/utils/mossprout-garden-layout';

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
  const finishSerialization = measureMergeWork('save:serialize');
  const serialized = JSON.stringify(state);
  finishSerialization();
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

export function saveUpgradeStoryRead(storyId: string, count: number, now = Date.now()) {
  return reduceStoredMergeWorld((state) => {
    const story = WORLD_UPGRADE_STORIES.find((item) => item.id === storyId);
    if (!story || !Number.isFinite(count)) return { state, changed: false, message: '' };
    const level = upgradeCompletedLevel(state, story.offerId);
    if (story.level > level + 1) return { state, changed: false, message: '' };
    const available = story.before.length + (level >= story.level ? story.after.length : 0);
    const next = Math.max(state.upgradeStoryRead?.[storyId] ?? 0, Math.min(available, Math.floor(count)));
    if (next === (state.upgradeStoryRead?.[storyId] ?? 0)) return { state, changed: false, message: '' };
    return { state: { ...state, revision: state.revision + 1, updatedAt: now,
      upgradeStoryRead: { ...state.upgradeStoryRead, [storyId]: next } }, changed: true, message: '' };
  }, now);
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

/** Atomically spends Merge Glow and advances one linear Haven environment. */
export function upgradeStoredHavenTile(characterId: import('@/types/merge-world').MergeCharacterId, stage: HavenStage, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId, stage, now }), now);
}

/** Atomically spends Merge Glow and advances one Mossprout nature island. */
export function upgradeStoredMossproutNatureIsland(
  islandId: import('@/types/merge-world').MossproutNatureIslandId,
  level: import('@/types/merge-world').MossproutNatureIslandLevel,
  now = Date.now(),
) {
  return reduceStoredMergeWorld(
    (state) => reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level, now }),
    now,
  );
}

/** Exactly-once story upgrade. Retrying an effect key returns its original receipt. */
export function upgradeStoredStoryWorldTarget(effectKey: string, payload: StoryWorldUpgradeEffectPayload, now = Date.now()) {
  const target = payload.target;
  if (target.kind === 'haven_structure') {
    const purchase = sharedWorldPurchase(target.structureId);
    if (!purchase || payload.toLevel !== 1 || payload.economy.mode !== 'normal') throw new Error('Unknown shared-world purchase');
    return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
      type: 'unlockWorldTarget', targetId: purchase.unlockId, receiptId: effectKey, now,
    }), now);
  }
  const economyMode = payload.economy.mode;
  const grantedCoins = payload.economy.mode === 'grant' ? payload.economy.amount : 0;
  return reduceStoredMergeWorld((state) => target.kind === 'haven_tile'
    ? reduceMergeWorld(state, {
        type: 'upgradeHavenTile',
        characterId: target.familyId as import('@/types/merge-world').MergeCharacterId,
        stage: payload.toLevel as HavenStage,
        receiptId: effectKey,
        economyMode,
        grantedCoins,
        now,
      })
    : reduceMergeWorld(state, {
        type: 'upgradeMossproutNatureIsland',
        islandId: target.islandId as import('@/types/merge-world').MossproutNatureIslandId,
        level: payload.toLevel as import('@/types/merge-world').MossproutNatureIslandLevel,
        receiptId: effectKey,
        economyMode,
        grantedCoins,
        now,
      }), now);
}

export function revealStoredHaven(now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'revealHaven', now }), now);
}

export function grantStoredPlantableMemory(
  definitionId: import('@/types/merge-world').MossproutMemoryPlantId,
  source: import('@/types/merge-world').PlantableMemorySource,
  receiptId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantPlantableMemory', definitionId, source, receiptId, now,
  }), now);
}

export function placeStoredPlantableMemory(
  instanceId: string,
  slotId: import('@/types/merge-world').MossproutGardenPlantSlotId,
  receiptId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'placePlantableMemory', instanceId, slotId, receiptId, now,
  }), now);
}

/**
 * Idempotent repair boundary for the FTUE's first planted memory.
 *
 * The authored graph and the legacy resume snapshot are persisted separately.
 * If the app is interrupted between those writes, this operation safely
 * finishes the world mutation without requiring a screen to own Merge state.
 */
export async function ensureStoredFirstFtueMemoryPlacement(sourceId: string | null, receiptId: string) {
  const now = Date.now();
  const result = await reduceStoredMergeWorld((state) => (
    reduceFirstFtueMemoryPlacement(state, sourceId, receiptId, now)
  ), now);
  const plant = firstFtueMemoryForSource(result.state, sourceId);
  return {
    placed: plant?.status === 'planted' && plant.slotId === MOSSPROUT_FIRST_MEMORY_SLOT_ID,
    state: result.state,
  };
}

export function growStoredPlantableMemory(instanceId: string, amount: number, receiptId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'growPlantableMemory', instanceId, amount, receiptId, now,
  }), now);
}

export function upgradeStoredHavenStructure(level: number, receiptId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'upgradeHavenStructure', structureId: 'mossprout-garden', level, receiptId, now,
  }), now);
}

export function upgradeStoredHavenFeature(
  featureId: import('@/types/merge-world').MossproutGardenFeatureId,
  level: number,
  receiptId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'upgradeHavenFeature', structureId: 'mossprout-garden', featureId, level, receiptId, now,
  }), now);
}

export function revealStoredMovementEgg(receiptId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'revealMovementEgg', receiptId, now }), now);
}

export function recordStoredMovementEggProgress(input: {
  observedSteps?: number;
  manualMovement?: boolean;
  receiptId: string;
}, now = Date.now()) {
  return reduceStoredMergeWorld((state) => {
    const progress = reduceMergeWorld(state, { type: 'recordMovementEggProgress', ...input, now });
    return progress;
  }, now);
}

export async function applyStoredStepplingEgg(action: import('@/features/onboarding/steppling-egg-policy').StepplingEggAction) {
  const now = Date.now();
  const result = await reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'stepplingEgg', action, now }), now);
  // Reconcile advertised question rewards from saved answers, including retry
  // after interruption between the two stores. Stable IDs prevent double pay.
  const egg = result.state.stepplingEgg;
  if (egg?.intent) {
    const [{ loadCompanionBondState, saveCompanionBondState }, { recordCompanionBondEvent, syncCompanionBondEvent }, { STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND, stepplingStepsBond }] = await Promise.all([
      import('@/utils/companion-bond-storage'), import('@/utils/companion-bond'), import('@/features/onboarding/steppling-egg-policy'),
    ]);
    let bond = loadCompanionBondState();
    for (const [id, points] of [['intent', STEPPLING_INTENT_BOND], ...(egg.alternative ? [['movement', STEPPLING_MOVEMENT_BOND] as const] : [])] as const) {
      bond = recordCompanionBondEvent(bond, { id: `steppling:egg:${id}`, creatureId: 'companion:steppling', kind: 'reflection_saved', points, occurredAt: now, dayId: egg.sourceDayId }).state;
    }
    if ((egg.bondFedSteps ?? 0) > 0) {
      bond = syncCompanionBondEvent(bond, { id: 'steppling:egg:steps', creatureId: 'companion:steppling', kind: 'check_in_completed', points: stepplingStepsBond(egg.bondFedSteps!), occurredAt: now, dayId: egg.sourceDayId }).state;
    }
    saveCompanionBondState(bond);
  }
  return result;
}

export function grantStoredGeneratorParcel(generatorId: string, rewardId: string, dayId: string) {
  const now = Date.now();
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantGeneratorParcel', generatorId, rewardId, dayId, now }), now);
}

export function reconcileStoredJourneyMeditation(cycle: import('@/types/companion-journey-cycle').CompanionJourneyCycle, availableAt: number, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'reconcileJourneyMeditation', cycle, availableAt, now }), now);
}

export function grantStoredJourneyReturn(cycle: import('@/types/companion-journey-cycle').CompanionJourneyCycle, dayId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantJourneyReturn', cycle, dayId, now }), now);
}

export function reconcileStoredHavenStory(characterId: import('@/types/merge-world').MergeCharacterId, storyLevel: number, now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId, storyLevel, now }), now);
}

/** Completes the Chapter Zero handoff by publishing today's normal Garden batch immediately. */
export function seedStoredMossproutGardenAfterFtue(dayId: string, now = Date.now()) {
  return reduceStoredMergeWorld((state) => {
    const completedChapterZero = completeMossproutChapterZeroSlice(state, now);
    return reduceMergeWorld(completedChapterZero, {
      type: 'reconcileCharacterActivity',
      familyId: 'mossprout',
      dayId,
      status: 'complete',
      activity: null,
      now,
    });
  }, now);
}

/** Serialize purchases and Egg ownership against the latest persisted balance. */
export function applyStoredGlowDiscovery(command: Extract<MergeWorldCommand, { type: 'unlockWorldTarget' | 'transferDiscoveryEgg' | 'hatchWorldEgg' | 'prepareGlowDiscoveryLesson' }>) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, command), command.now);
}

export function grantStoredKatchimeraCard(
  familyId: import('@/types/merge-world').MergeCharacterId,
  cardId: string,
  sourceReceiptId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantKatchimeraCard', familyId, cardId, sourceReceiptId, now,
  }), now);
}

export function activateStoredResidentCardDiscovery(
  campaignId: string,
  journeyDayId: string,
  residentId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'activateResidentCardDiscovery', campaignId, journeyDayId, residentId, now,
  }), now);
}

export function purchaseStoredKatchimeraCard(
  familyId: import('@/types/merge-world').MergeCharacterId,
  cardId: string,
  purchaseId: string,
  now = Date.now(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'purchaseKatchimeraCard', familyId, cardId, cost: 150, purchaseId, now,
  }), now);
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

/**
 * Installs Chapter 0's board. Live FTUE entry preserves the player's Haven;
 * debug/reset callers retain the historical destructive behavior by default.
 */
export async function installMossproutOnboardingMergeWorld(
  now = Date.now(),
  rewardWispId: import('@/types/wisp').WispId = 'sprout',
  options: { preserveHaven?: boolean } = {},
): Promise<MergeWorldState> {
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  let installedState = createMossproutChapterZeroState(now, rewardWispId);
  try {
    await serializeWrite(async () => {
      const db = await database();
      const existing = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
      if (options.preserveHaven && existing?.state_json) {
        try {
          const current = normalizeMergeWorldState(JSON.parse(existing.state_json), now);
          installedState = {
            ...installedState,
            haven: current.haven,
            revision: Math.max(installedState.revision, current.revision) + 1,
            updatedAt: now,
          };
        } catch {
          // A corrupt prior snapshot must not prevent the recoverable FTUE board
          // from being installed. Its backup remains available below.
        }
      }
      await db.runAsync(
        `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id) DO UPDATE SET schema_version = excluded.schema_version, revision = excluded.revision,
         updated_at = excluded.updated_at, backup_json = COALESCE(merge_world_snapshot.backup_json, merge_world_snapshot.state_json), state_json = excluded.state_json`,
        [LOCAL_PROFILE_ID, installedState.version, installedState.revision, installedState.updatedAt, JSON.stringify(installedState), existing?.state_json ?? null],
      );
      await db.runAsync('DELETE FROM merge_world_outbox');
    });
  } finally {
    resetInProgress = false;
  }
  resetListeners.forEach((listener) => listener(installedState));
  publishSnapshot(installedState);
  return installedState;
}

export type MossproutMergeFtueStepId =
  | 'merge.seed_drag'
  | 'merge.second_seed_drag'
  | 'merge.first_bloom'
  | 'merge.serve_sprout'
  | 'merge.plant.spawn'
  | 'merge.plant.seed_pairs'
  | 'merge.plant.sprout_pair'
  | 'merge.serve_plant';

export async function prepareMossproutMergeFtueForDebug(step: MossproutMergeFtueStepId, now = Date.now()) {
  let prepared = await installMossproutOnboardingMergeWorld(now);
  if (step === 'merge.seed_drag') return prepared;
  prepared = mergeFirstPair(prepared, 'nature:garden:1', now + 1);
  if (step === 'merge.second_seed_drag') return persistPreparedFtueState(prepared);
  prepared = mergeFirstPair(prepared, 'nature:garden:1', now + 2);
  if (step === 'merge.first_bloom') return persistPreparedFtueState(prepared);
  prepared = mergeFirstPair(prepared, 'nature:garden:2', now + 3);
  if (step === 'merge.plant.spawn') return persistPreparedFtueState(prepared);
  prepared = reduceMergeWorld(prepared, { type: 'tapGenerator', generatorId: 'wild-garden', now: now + 4, seed: 'ftue-debug:echo-seed' }).state;
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

export function ensureStoredCompanionDailyGarden(familyId: 'mossprout' | 'steppling', now = Date.now()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'ensureCompanionDailyGarden', familyId, now }), now);
}
