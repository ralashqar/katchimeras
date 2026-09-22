import { reduceAdventure } from '@/features/shared-adventure/runtime';
import { placeLanternWorld, projectLanternWorld, startLanternWorld, upgradeLanternWorld } from '@/features/wisps/lantern-world';
import { lanternResidentCapacity, type LanternLevel } from '@/constants/wisp-lantern-levels';
import { reduceWispLantern } from '@/utils/wisp-lantern-state';
import { claimDayChest, dayChestFor, recordTimeTrialHeat } from '@/features/time-trial/trial-world';
import { localDayId } from '@/utils/world-identity-rules';
import { heartwoodBuildingCost } from '@/constants/heartwood-buildings';
import { buildFirstSpring, firstSpringAwake, firstSpringBuilt, growFirstSeedIntoSpring, upgradeHeartwoodBuilding, wakeFirstSpring } from '@/features/heartwood-buildings/buildings-world';
import { gameNow } from '@/utils/game-clock';
import { reconcileJourneyGardenOrders } from '@/features/companion/journey-garden-orders';
import { availableLocalEvents, harmonyDefinition } from '@/features/live-ops/local-catalog';
import { projectLocalEvents, reduceLocalEvent } from '@/features/live-ops/local-runtime';
import type { LocalEventCommand } from '@/types/local-live-ops';
import { recordHatchProfileAnswers } from '@/features/onboarding/hatch-profile-storage';
import { GLOW } from '@/constants/glow';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { HarmonyState, LiveEventProgress } from '@/types/live-ops';
import { contentRegistrySnapshot } from '@/features/content-packs/active-pack';
import { appendGameplayEvents, GAMEPLAY_JOURNAL_SCHEMA } from '@/features/live-ops/journal';
import { newWorldMilestones, worldMilestoneEvents } from '@/features/live-ops/merge-events';
import { applyHarmonyEvent, emptyHarmony } from '@/features/live-ops/rules';
import * as SQLite from 'expo-sqlite';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { WORLD_UPGRADE_STORIES } from '@/features/world-upgrades/world-upgrade-stories';
import { upgradeCompletedLevel } from '@/features/world-upgrades/world-upgrade-progress';
import { measureMergeWork } from './performance';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { sharedWorldPurchase } from '@/constants/shared-world';
import { islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import type { HavenStage } from '@/constants/haven-catalog';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld, resetMergeActivityForDay } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState, createMossproutOpeningState, createMossproutBasketParcelState } from '@/utils/merge-world/onboarding';
import { completeMossproutChapterZeroSlice } from '@/utils/merge-world/chapter-zero-policy';
import { MOSSPROUT_FTUE_JOURNAL_ENERGY } from '@/utils/merge-world/economy-policy';
import { flushMergeWorldWriters } from './writer-flush';
import { MergeWorldStaleWriteError, mergeWriteIsStale } from './write-guard';
export { MergeWorldStaleWriteError } from './write-guard';

/**
 * Who produced a published snapshot. A provider adopts another writer's store
 * write unconditionally (its own optimistic state was derived from an older
 * snapshot), but only adopts another provider's save when it is newer.
 */
export type MergeWorldSnapshotOrigin = 'provider' | 'store';

const DATABASE_NAME = 'katchimeras-merge-world.db';
const LOCAL_PROFILE_ID = 'local';

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
let resetGeneration = 0;
let resetInProgress = false;
let writeQueue: Promise<void> = Promise.resolve();
const resetListeners = new Set<(state: MergeWorldState) => void>();
const snapshotListeners = new Set<(state: MergeWorldState, origin: MergeWorldSnapshotOrigin) => void>();

function publishSnapshot(state: MergeWorldState, origin: MergeWorldSnapshotOrigin) {
  snapshotListeners.forEach((listener) => listener(state, origin));
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
        ${GAMEPLAY_JOURNAL_SCHEMA}
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

export async function loadMergeWorldState(now = gameNow()): Promise<MergeWorldState> {
  // A mounted provider may still hold commands it has not written. Read what
  // the player sees, not what the database saw a moment ago.
  await flushMergeWorldWriters();
  const db = await database();
  const row = await db.getFirstAsync<{ state_json: string; backup_json: string | null }>(
    'SELECT state_json, backup_json FROM merge_world_snapshot WHERE profile_id = ?',
    [LOCAL_PROFILE_ID],
  );
  if (!row) return createInitialMergeWorldState(now);
  try {
    return normalizeMergeWorldState(JSON.parse(row.state_json), now);
  } catch (error) {
    // Never silent: a fallback here is the player losing progress.
    console.warn('Merge world: the stored world could not be read; falling back', error);
    if (row.backup_json) {
      try {
        return normalizeMergeWorldState(JSON.parse(row.backup_json), now);
      } catch (backupError) {
        console.warn('Merge world: the backup could not be read either; starting a new world', backupError);
      }
    }
    return createInitialMergeWorldState(now);
  }
}

export async function saveMergeWorldState(
  state: MergeWorldState,
  receiptIds?: readonly string[],
  options: {
    /**
     * Revision of the snapshot this state was derived from. When the database
     * has moved past it, the save is rejected with `MergeWorldStaleWriteError`
     * carrying the newer snapshot, instead of reverting another writer.
     */
    baseRevision?: number;
    gameplayEvents?: readonly GameplayEvent[];
  } = {},
): Promise<void> {
  // Companion/story resets notify their subscribers asynchronously. Do not
  // allow a subscriber holding the pre-reset board to queue it behind the
  // destructive reset and restore generators after the database is cleared.
  if (resetInProgress) return;
  const generation = resetGeneration;
  const finishSerialization = measureMergeWork('save:serialize');
  let serialized = JSON.stringify(state);
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
    if (options.baseRevision != null) {
      const row = await db.getFirstAsync<{ revision: number; state_json: string }>(
        'SELECT revision, state_json FROM merge_world_snapshot WHERE profile_id = ?',
        [LOCAL_PROFILE_ID],
      );
      if (row && mergeWriteIsStale(row.revision, options.baseRevision)) {
        let current: MergeWorldState;
        try { current = normalizeMergeWorldState(JSON.parse(row.state_json), gameNow()); }
        catch { current = state; }
        throw new MergeWorldStaleWriteError(current);
      }
    }
    await db.withTransactionAsync(async () => {
      if (generation !== resetGeneration) return;
      if (resetInProgress) return;
      const previous = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
      const projection = await db.getFirstAsync<{ projection_id: string }>('SELECT projection_id FROM gameplay_projections WHERE projection_id = ?', ['harmony:v1']);
      let priorState: MergeWorldState | null = null;
      try { priorState = previous ? JSON.parse(previous.state_json) as MergeWorldState : null; }
      catch { /* Loading already reported the damaged snapshot; recovered facts are historical. */ }
      const revision = contentRegistrySnapshot().revision;
      const backfill = !projection && priorState ? worldMilestoneEvents(priorState, revision, true) : [];
      state = { ...state, wispLanternPlacement: priorState?.wispLanternPlacement ?? state.wispLanternPlacement, wispLanternProgress: priorState?.wispLanternProgress ?? state.wispLanternProgress, heartwoodBuildings: priorState?.heartwoodBuildings ?? state.heartwoodBuildings, timeTrials: priorState?.timeTrials ?? state.timeTrials, localLiveOps: priorState?.localLiveOps ?? state.localLiveOps, sharedAdventure: priorState?.sharedAdventure ?? state.sharedAdventure };
      state = projectLanternWorld(state, options.gameplayEvents ?? []);
      state = projectLocalEvents(state, [...newWorldMilestones(priorState, state, revision), ...(options.gameplayEvents ?? [])], state.updatedAt);
      serialized = JSON.stringify(state);
      await appendGameplayEvents(db, [...backfill, ...newWorldMilestones(priorState, state, revision), ...(options.gameplayEvents ?? [])], contentRegistrySnapshot().packs.filter((record) => !record.retiredAt).flatMap((record) => record.pack.liveEvents ?? []));
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
  if (generation === resetGeneration && !resetInProgress) publishSnapshot(state, 'provider');
}

async function reduceStoredMergeWorld(
  reduce: (state: MergeWorldState) => (MergeWorldCommandResult & { localGameplayEvents?: GameplayEvent[] }) | Promise<MergeWorldCommandResult & { localGameplayEvents?: GameplayEvent[] }>,
  now = gameNow(),
): Promise<MergeWorldCommandResult> {
  // Story effects and world screens reduce the database directly while a
  // provider may still be buffering the player's last taps. Drain those first
  // so this reduce starts from the board the player actually has.
  await flushMergeWorldWriters();
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
    const reduced = await reduce(current);
    if (!reduced.changed || generation !== resetGeneration || resetInProgress) return reduced;
    await db.withTransactionAsync(async () => {
    const projection = await db.getFirstAsync<{ projection_id: string }>('SELECT projection_id FROM gameplay_projections WHERE projection_id = ?', ['harmony:v1']);
    const revision = contentRegistrySnapshot().revision;
    reduced.state = projectLanternWorld(reduced.state, reduced.localGameplayEvents ?? []);
    reduced.state = projectLocalEvents(reduced.state, newWorldMilestones(current, reduced.state, revision), now);
    await appendGameplayEvents(db, [...(!projection ? worldMilestoneEvents(current, revision, true) : []), ...newWorldMilestones(current, reduced.state, revision), ...(reduced.localGameplayEvents ?? [])], contentRegistrySnapshot().packs.filter((record) => !record.retiredAt).flatMap((record) => record.pack.liveEvents ?? []));
    await db.runAsync(
      `INSERT INTO merge_world_snapshot (profile_id, schema_version, revision, updated_at, state_json, backup_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET schema_version = excluded.schema_version, revision = excluded.revision,
       updated_at = excluded.updated_at, backup_json = merge_world_snapshot.state_json, state_json = excluded.state_json`,
      [LOCAL_PROFILE_ID, reduced.state.version, reduced.state.revision, reduced.state.updatedAt, JSON.stringify(reduced.state), row?.state_json ?? null],
    );
    });
    return reduced;
  });
  if (result.changed && generation === resetGeneration && !resetInProgress) publishSnapshot(result.state, 'store');
  return result;
}

export async function applyStoredAdventure(command: import('@/features/shared-adventure/types').AdventureCommand, now = gameNow()) {
  return reduceStoredMergeWorld(state => reduceAdventure(state, command, now), now);
}

export async function plantStoredWispLantern(now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = placeLanternWorld(state, now);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
}

const storedWorldStep = (step: (state: MergeWorldState, now: number) => MergeWorldState, now: number) => reduceStoredMergeWorld(state => {
  const next = step(state, now);
  return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
}, now);

/** A finished Wisp Rush heat: saved once, paid once, records only ever better. Throws if the run cannot be accepted. */
/** A Mist encounter begins: the board that is up and the loadout brought in are remembered with the world. */
export async function startStoredEncounter(input: { missionId: string; runId: string; campaignId?: string; katchimeraId: import('@/types/merge-world').MergeCharacterId; helperWispId: import('@/types/wisp').WispId | null }, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'startEncounter', ...input, now }), now);
}
export async function abandonStoredEncounter(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'abandonEncounter', now }), now);
}
/** A cleared encounter paid once per receipt: Glow, experience, the clear, and the island a level up when the rung was its chapter's last. */
export async function completeStoredEncounter(input: { receiptId: string; missionId: string; campaignId?: string; katchimeraId: import('@/types/merge-world').MergeCharacterId; helperWispId: import('@/types/wisp').WispId | null; outcome: import('@/features/encounter/outcome').EncounterOutcome; difficulty: import('@/types/encounter').EncounterDifficulty; base?: { glow: number; xp: number } | null }, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'completeEncounter', ...input, now }), now);
}
export async function ackStoredEncounterOutcome(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'ackEncounterOutcome', now }), now);
}
export async function upgradeStoredKatchimera(characterId: import('@/types/merge-world').MergeCharacterId, expectedLevel: number, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'upgradeKatchimera', characterId, expectedLevel, now }), now);
}
export async function recordStoredTimeTrialHeat(run: { trialId?: string; dayId: string; index: number; score: number }, now = gameNow()) {
  let outcome: import('@/features/time-trial/trial-world').HeatOutcome | null = null;
  const result = await reduceStoredMergeWorld(state => {
    const recorded = recordTimeTrialHeat(state, run, localDayId(new Date(now)), now);
    outcome = recorded.outcome;
    if (recorded.state === state) return { state, changed: false };
    return { state: { ...recorded.state, revision: state.revision + 1, updatedAt: now }, changed: true };
  }, now);
  return { state: result.state, outcome: outcome! };
}
/** The day's chest: marks it taken and says which friend pack it holds (the caller grants that pack by its receipt). */
export async function claimStoredTimeTrialChest(dayId: string, now = gameNow()) {
  let chest: import('@/features/time-trial/trial-world').DayChest | null = null;
  await reduceStoredMergeWorld(state => {
    chest = dayChestFor(state, dayId);
    const next = claimDayChest(state, dayId, now);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
  return chest as import('@/features/time-trial/trial-world').DayChest | null;
}

/** The first session's planting beat, and its recovery: the Dew Spring, dug out and dormant. */
export const FIRST_SPRING_HEARTWOOD_RECEIPT_ID = 'ftue:first-spring:heartwood';
export async function ensureStoredFirstSpringBuilt(now = gameNow()) {
  const result = await reduceStoredMergeWorld((state) => {
    const built = buildFirstSpring(state, now);
    // Heartwood wakes with its Spring: the tile's first stage comes free with the build, never as an upgrade of its own.
    const woken = firstSpringBuilt(built) && (built.haven.tileStages.mossprout ?? 0) < 1
      ? reduceMergeWorld(built, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now, receiptId: FIRST_SPRING_HEARTWOOD_RECEIPT_ID, economyMode: 'free' })
      : null;
    const next = woken?.changed ? woken.state : built;
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
  return { placed: firstSpringBuilt(result.state), state: result.state };
}

/** The garden has woken: the first Spring runs. */
export async function wakeStoredFirstSpring(now = gameNow()) {
  const result = await storedWorldStep(wakeFirstSpring, now);
  return { awake: firstSpringAwake(result.state), state: result.state };
}

/** Older saves: the first session's sprouted seed becomes the Dew Spring. Safe to call at any time: it only ever happens once. */
export async function ensureStoredFirstSpring(now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = growFirstSeedIntoSpring(state, now);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
}

export async function upgradeStoredHeartwoodBuilding(id: import('@/constants/heartwood-buildings').HeartwoodBuildingId, expectedLevel: number, now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = upgradeHeartwoodBuilding(state, id, expectedLevel, now);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
}

export async function upgradeStoredWispLantern(targetLevel: LanternLevel, now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = upgradeLanternWorld(state, targetLevel);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
}

/** Read capacity from the flushed authoritative world, never a caller-supplied level. */
export async function assignStoredLanternResidents(ids: import('@/types/wisp').WispId[], now = gameNow()) {
  const { updateStoredWispState } = await import('@/utils/wisp-storage');
  return reduceStoredMergeWorld(state => {
    updateStoredWispState(current => reduceWispLantern(current, { type: 'residents', ids }, now, 1, [], lanternResidentCapacity(state.wispLanternProgress?.level)));
    return { state, changed: false };
  }, now);
}

export async function activateStoredWispLantern(now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = startLanternWorld(state, now);
    return { state: next === state ? state : { ...next, revision: state.revision + 1, updatedAt: now }, changed: next !== state };
  }, now);
}

export async function loadGameplayJournal(limit = 100): Promise<GameplayEvent[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM gameplay_events ORDER BY occurred_at DESC, event_id LIMIT ?', [Math.max(1, Math.min(500, Math.floor(limit)))]);
  return rows.map((row) => JSON.parse(row.payload_json) as GameplayEvent);
}

export async function loadHarmonyProgress(): Promise<HarmonyState> {
  const db = await database();
  const row = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM gameplay_projections WHERE projection_id = ?', ['harmony:v1']);
  if (row) return JSON.parse(row.payload_json) as HarmonyState;
  const snapshot = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
  if (!snapshot) return emptyHarmony();
  return worldMilestoneEvents(JSON.parse(snapshot.state_json), contentRegistrySnapshot().revision, true).reduce((progress, event) => applyHarmonyEvent(progress, event, harmonyDefinition()), emptyHarmony());
}

export async function loadLiveEventProgress(): Promise<LiveEventProgress[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload_json: string }>("SELECT payload_json FROM gameplay_projections WHERE projection_id LIKE 'event:%'");
  return rows.map((row) => JSON.parse(row.payload_json) as LiveEventProgress);
}

export function saveUpgradeStoryRead(storyId: string, count: number, now = gameNow()) {
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
export function grantMossproutFtueJournalEnergy(dayId: string, now = gameNow()) {
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
}, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'claimStepEnergy',
    ...input,
    now,
  }), now);
}

/** Backwards-compatible name for the authored onboarding call site. */
export const claimMossproutFtueStepEnergy = claimDailyStepEnergy;

/** Opens the fixed first board discovery after Mossprout's Chapter 0 return. */
export function installStepplingFtueDiscovery(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'startStepplingDiscovery', now }), now);
}

/** Immediately persists a Today journal payout using the same receipts as provider reconciliation. */
export function grantJournalCaptureEnergy(input: {
  companionEnergy: number;
  dayId: string;
  journalEnergy: number;
  recordId: string;
}, now = gameNow()) {
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
export function upgradeStoredHavenTile(characterId: import('@/types/merge-world').MergeCharacterId, stage: HavenStage, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId, stage, now }), now);
}

/** Atomically spends Merge Glow and advances one Mossprout nature island. */
export function upgradeStoredMossproutNatureIsland(
  islandId: import('@/types/merge-world').MossproutNatureIslandId,
  level: import('@/types/merge-world').MossproutNatureIslandLevel,
  now = gameNow(),
) {
  return reduceStoredMergeWorld(
    (state) => reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level, now }),
    now,
  );
}

/** Starts one island chapter and publishes its authored Merge request exactly once. */
export function activateStoredIslandCampaignChapter(input: {
  campaignId: string;
  islandId: import('@/types/merge-world').MossproutNatureIslandId;
  residentSkinId: import('@/types/katchimera').KatchimeraSkinId;
  level: import('@/types/merge-world').MossproutNatureIslandLevel;
  selectedOptionId?: string | null;
  orders: import('@/types/merge-world').MergeOrder[];
}, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'activateIslandCampaignChapter',
    ...input,
    now,
  }), now);
}

export function acknowledgeStoredIslandCampaignChapterReturn(campaignId: string, level: import('@/types/merge-world').MossproutNatureIslandLevel, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'ackIslandCampaignChapterReturn', campaignId, level, now,
  }), now);
}

export function requestStoredIslandCampaignDelivery(campaignId: string, level: import('@/types/merge-world').MossproutNatureIslandLevel, orders: import('@/types/merge-world').MergeOrder[], now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'requestIslandCampaignDelivery', campaignId, level, orders, now,
  }), now);
}

export function recordStoredIslandRestorationProgress(campaignId: string, level: import('@/types/merge-world').MossproutNatureIslandLevel, progress: { current: number; total: number }, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'recordIslandRestorationProgress', campaignId, level, current: progress.current, total: progress.total, now,
  }), now);
}

export function completeStoredIslandRestoration(campaignId: string, level: import('@/types/merge-world').MossproutNatureIslandLevel, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'completeIslandRestoration', campaignId, level, now,
  }), now);
}

export function completeStoredIslandCampaignChapter(campaignId: string, level: import('@/types/merge-world').MossproutNatureIslandLevel, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'completeIslandCampaignChapter', campaignId, level, now,
  }), now);
}

/** Developer-only wallet grant for testing long island and Merge progression. */
export function grantStoredDevMergeCurrency(input: { glow?: number; energy?: number }, now = gameNow()) {
  return reduceStoredMergeWorld((state) => {
    if (!DEV_TOOLS_ENABLED) return { state, changed: false, message: 'Developer tools are disabled.' };
    const glow = Math.max(0, Math.floor(Number(input.glow) || 0));
    const energy = Math.max(0, Math.floor(Number(input.energy) || 0));
    if (glow === 0 && energy === 0) return { state, changed: false, message: 'No currency added.' };
    const next: MergeWorldState = {
      ...state,
      coins: Math.min(999_999, state.coins + glow),
      energy: { ...state.energy, value: Math.min(999_999, state.energy.value + energy) },
      revision: state.revision + 1,
      updatedAt: now,
    };
    return { state: next, changed: true, message: `Added ${glow.toLocaleString()} Glow and ${energy.toLocaleString()} Energy.` };
  }, now);
}

/** Persists the moment an island resident first appears, before any request or card grant. */
export function discoverStoredIslandCampaignResident(input: {
  campaignId: string;
  islandId: import('@/types/merge-world').MossproutNatureIslandId;
  residentSkinId: import('@/types/katchimera').KatchimeraSkinId;
}, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'discoverIslandCampaignResident',
    ...input,
    now,
  }), now);
}

export function acknowledgeStoredIslandCampaignResidentDiscovery(campaignId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'ackIslandCampaignResidentDiscovery',
    campaignId,
    now,
  }), now);
}

export function acknowledgeStoredIslandCampaignResidentCardReveal(campaignId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'ackIslandCampaignResidentCardReveal',
    campaignId,
    now,
  }), now);
}

/** Mossprout's wish has been told; the Kingdom tracker and its first map hint may appear. */
export function introduceStoredKingdomGoal(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'introduceKingdomGoal', now }), now);
}

export function acknowledgeStoredKingdomGoalCoachmark(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'ackKingdomGoalCoachmark', now }), now);
}

/** A mist mission's ticket: the tile's price, paid once at its bubble; the reveal after the board then charges nothing. */
export function payStoredHatchableMission(companion: import('@/types/merge-world').MergeCharacterId, receiptId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'payHatchableMission', companion, receiptId, now }), now);
}

/** Exactly-once story upgrade. Retrying an effect key returns its original receipt. */
export function upgradeStoredStoryWorldTarget(effectKey: string, payload: StoryWorldUpgradeEffectPayload, now = gameNow()) {
  const target = payload.target;
  if (payload.transition === 'island_reveal') {
    const campaign = target.kind === 'haven_nature_island' ? islandCampaignForIsland(target.islandId) : null;
    if (!campaign || payload.toLevel !== 1 || payload.economy.mode !== 'normal') {
      throw new Error('Unknown nature-island reveal');
    }
    return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
      type: 'revealMossproutNatureIsland',
      islandId: campaign.islandId,
      campaignId: campaign.campaignId,
      residentSkinId: campaign.residentSkinId,
      cost: mossproutNatureIslandLevelDefinition(campaign.islandId, 1)?.coinCost ?? 40,
      receiptId: effectKey,
      now,
    }), now);
  }
  if (target.kind === 'haven_structure') {
    const purchase = sharedWorldPurchase(target.structureId);
    // The reducer decides the cost from the world (a paid ticket makes the reveal free); a save that never bought a ticket still pays here.
    if (!purchase || payload.toLevel !== 1 || (payload.economy.mode !== 'normal' && payload.economy.mode !== 'free')) throw new Error('Unknown shared-world purchase');
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

export function revealStoredHaven(now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'revealHaven', now }), now);
}

export function grantStoredPlantableMemory(
  definitionId: import('@/types/merge-world').MossproutMemoryPlantId,
  source: import('@/types/merge-world').PlantableMemorySource,
  receiptId: string,
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantPlantableMemory', definitionId, source, receiptId, now,
  }), now);
}

export function placeStoredPlantableMemory(
  instanceId: string,
  slotId: import('@/types/merge-world').MossproutGardenPlantSlotId,
  receiptId: string,
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'placePlantableMemory', instanceId, slotId, receiptId, now,
  }), now);
}

export function growStoredPlantableMemory(instanceId: string, amount: number, receiptId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'growPlantableMemory', instanceId, amount, receiptId, now,
  }), now);
}

export function upgradeStoredHavenStructure(level: number, receiptId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'upgradeHavenStructure', structureId: 'mossprout-garden', level, receiptId, now,
  }), now);
}

export function upgradeStoredHavenFeature(
  featureId: import('@/types/merge-world').MossproutGardenFeatureId,
  level: number,
  receiptId: string,
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'upgradeHavenFeature', structureId: 'mossprout-garden', featureId, level, receiptId, now,
  }), now);
}

export function revealStoredMovementEgg(receiptId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'revealMovementEgg', receiptId, now }), now);
}

export function recordStoredMovementEggProgress(input: {
  observedSteps?: number;
  manualMovement?: boolean;
  receiptId: string;
}, now = gameNow()) {
  return reduceStoredMergeWorld((state) => {
    const progress = reduceMergeWorld(state, { type: 'recordMovementEggProgress', ...input, now });
    return progress;
  }, now);
}

export async function applyStoredHatchableEgg(definition: import('@/types/hatchable-companion').HatchableCompanionDefinition, action: import('@/features/onboarding/hatchable-egg-policy').HatchableEggAction) {
  const now = gameNow();
  const { companion } = definition;
  const result = await reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'hatchableEgg', companion, action, now }), now);
  // Reconcile advertised question rewards from saved answers, including retry
  // after interruption between the two stores. Stable IDs prevent double pay.
  const [{ loadCompanionBondState, saveCompanionBondState }, { recordCompanionBondEvent, syncCompanionBondEvent }, { eggFeedBond, hatchableEggProgress }] = await Promise.all([
    import('@/utils/companion-bond-storage'), import('@/utils/companion-bond'), import('@/features/onboarding/hatchable-egg-policy'),
  ]);
  const egg = hatchableEggProgress(result.state, definition);
  if (egg?.wispAnswers?.length) {
    recordHatchProfileAnswers(companion, egg.wispAnswers);
    let bond = loadCompanionBondState();
    for (const answer of egg.wispAnswers) {
      bond = recordCompanionBondEvent(bond, { id: `${companion}:egg:wisp:${answer.questionId}`, creatureId: `companion:${companion}`, kind: 'reflection_saved', points: 15, occurredAt: answer.timestamp, dayId: egg.sourceDayId }).state;
    }
    saveCompanionBondState(bond);
  }
  if (egg?.intent) {
    let bond = loadCompanionBondState();
    for (const [id, points] of [['intent', definition.egg.intent.bond], ...(egg.alternative ? [['movement', definition.egg.alternative.bond] as const] : [])] as const) {
      bond = recordCompanionBondEvent(bond, { id: `${companion}:egg:${id}`, creatureId: `companion:${companion}`, kind: 'reflection_saved', points, occurredAt: now, dayId: egg.sourceDayId }).state;
    }
    if ((egg.bondFedSteps ?? 0) > 0) {
      bond = syncCompanionBondEvent(bond, { id: `${companion}:egg:steps`, creatureId: `companion:${companion}`, kind: 'check_in_completed', points: eggFeedBond(definition.egg, egg.bondFedSteps!), occurredAt: now, dayId: egg.sourceDayId }).state;
    }
    saveCompanionBondState(bond);
  }
  return result;
}
export async function applyStoredStepplingEgg(action: import('@/features/onboarding/hatchable-egg-policy').HatchableEggAction) {
  const { STEPPLING_HATCHABLE } = await import('@/constants/hatchable-companions/registry');
  return applyStoredHatchableEgg(STEPPLING_HATCHABLE, action);
}

/**
 * The first light: the Glow that drove the opening's wisps off stays with you. Granted once per
 * run (the receipt is the run's) by the flow after the lift, and repaired by the world screen at the
 * first restore. Reports whether this call was the one that granted it.
 */
/**
 * The planting beat needs the Spring's price on the counter: the opening's light if it has not been kept yet, and
 * otherwise (a profile that spent it) the shortfall, once per run.
 */
export async function ensureStoredFirstSpringLight(runId: string, now = gameNow()) {
  const cost = heartwoodBuildingCost(0) ?? 0;
  const lit = await ensureStoredOpeningGlow(`${runId}:opening-glow`, GLOW.firstRestorationCost, now);
  if (lit.state.coins >= cost) return lit.state;
  const short = cost - lit.state.coins;
  return (await reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantOpeningGlow', receiptId: `${runId}:first-spring-light`, amount: short, now }), now)).state;
}

/** Glow the story hands over once per receipt (Steppling's mist price after the first session). */
export async function grantStoredStoryGlow(receiptId: string, amount: number, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantStoryGlow', receiptId, amount, now }), now);
}

export async function ensureStoredOpeningGlow(receiptId: string, amount = GLOW.firstRestorationCost, now = gameNow()) {
  const result = await reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantOpeningGlow', receiptId, amount, now }), now);
  return { state: result.state, granted: result.changed, amount };
}

export function grantStoredGeneratorParcel(generatorId: string, rewardId: string, dayId: string) {
  const now = gameNow();
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantGeneratorParcel', generatorId, rewardId, dayId, now }), now);
}

export function reconcileStoredJourneyMeditation(cycle: import('@/types/companion-journey-cycle').CompanionJourneyCycle, availableAt: number, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'reconcileJourneyMeditation', cycle, availableAt, now }), now);
}

export function grantStoredJourneyReturn(cycle: import('@/types/companion-journey-cycle').CompanionJourneyCycle, dayId: string, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'grantJourneyReturn', cycle, dayId, now }), now);
}

export function reconcileStoredHavenStory(characterId: import('@/types/merge-world').MergeCharacterId, storyLevel: number, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId, storyLevel, now }), now);
}

/** Completes the Chapter Zero handoff by publishing today's normal Garden batch immediately. */
export function seedStoredMossproutGardenAfterFtue(dayId: string, now = gameNow()) {
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
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'grantKatchimeraCard', familyId, cardId, sourceReceiptId, now,
  }), now);
}

export function activateStoredResidentCardDiscovery(
  campaignId: string,
  journeyDayId: string,
  residentId: string,
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'activateResidentCardDiscovery', campaignId, journeyDayId, residentId, now,
  }), now);
}

export function purchaseStoredKatchimeraCard(
  familyId: import('@/types/merge-world').MergeCharacterId,
  cardId: string,
  purchaseId: string,
  now = gameNow(),
) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, {
    type: 'purchaseKatchimeraCard', familyId, cardId, cost: 150, purchaseId, now,
  }), now);
}

export async function resetMergeWorldStateForDebug(now = gameNow()): Promise<void> {
  resetGeneration += 1;
  resetInProgress = true;
  try {
    await serializeWrite(async () => {
      const db = await database();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM merge_world_snapshot WHERE profile_id = ?', [LOCAL_PROFILE_ID]);
        await db.runAsync('DELETE FROM merge_world_outbox');
        await db.runAsync('DELETE FROM gameplay_events');
        await db.runAsync('DELETE FROM gameplay_projections');
      });
    });
    const freshState = createInitialMergeWorldState(now);
    resetListeners.forEach((listener) => listener(freshState));
    publishSnapshot(freshState, 'store');
  } finally {
    resetInProgress = false;
  }
}

/** Atomically installs an authored/captured developer profile board. */
export async function installMergeWorldStateForDebug(input: unknown, now = gameNow()): Promise<MergeWorldState> {
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
        await db.runAsync('DELETE FROM gameplay_events');
        await db.runAsync('DELETE FROM gameplay_projections');
        await appendGameplayEvents(db, worldMilestoneEvents(installed, contentRegistrySnapshot().revision, true));
      });
    });
  } finally {
    resetInProgress = false;
  }
  resetListeners.forEach((listener) => listener(installed));
  publishSnapshot(installed, 'store');
  return installed;
}

/** `opening`: the mist-veiled opening's board (eight Seeds, two Sprouts) instead of the classic lesson board. */
export type MossproutInstallOptions = { opening?: boolean; /** The live first session: the Basket arrives by parcel and the board starts bare. */ basketParcel?: boolean };

/**
 * Installs Chapter 0's board. Live FTUE entry preserves the player's Haven;
 * debug/reset callers retain the historical destructive behavior by default.
 */
export async function installMossproutOnboardingMergeWorld(
  now = gameNow(),
  rewardWispId: import('@/types/wisp').WispId = 'sprout',
  options: { preserveHaven?: boolean } & MossproutInstallOptions = {},
): Promise<MergeWorldState> {
  await serializeWrite(async () => undefined);
  resetGeneration += 1;
  resetInProgress = true;
  let installedState = options.opening ? createMossproutOpeningState(now, rewardWispId)
    : options.basketParcel ? createMossproutBasketParcelState(now, rewardWispId)
    : createMossproutChapterZeroState(now, rewardWispId);
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
  publishSnapshot(installedState, 'store');
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

export async function prepareMossproutMergeFtueForDebug(step: MossproutMergeFtueStepId, now = gameNow()) {
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
  publishSnapshot(state, 'store');
  return state;
}

/** Makes one day eligible for real-life Merge Energy without resetting board progress. */
export async function resetMergeWorldActivityForDayForDebug(
  dayId: string,
  now = gameNow(),
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
  if (resetState) publishSnapshot(resetState, 'store');
}

export function subscribeMergeWorldResets(listener: (state: MergeWorldState) => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function subscribeMergeWorldSnapshots(listener: (state: MergeWorldState, origin: MergeWorldSnapshotOrigin) => void): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

export function ensureStoredJourneyGardenOrders(relationships: import('@/types/relationship-progression').RelationshipProgressState, now = gameNow()) {
  return reduceStoredMergeWorld(state => {
    const next = reconcileJourneyGardenOrders(state, relationships, now);
    return { state: next, changed: next !== state };
  }, now);
}

export function ensureStoredCompanionDailyGarden(familyId: import('@/types/merge-world').MergeCharacterId, now = gameNow()) {
  return reduceStoredMergeWorld((state) => reduceMergeWorld(state, { type: 'ensureCompanionDailyGarden', familyId, now }), now);
}

/** Serialized with ordinary world writers; claims and inventory share the snapshot commit. */
export async function applyStoredLocalEvent(command: LocalEventCommand, now = gameNow()) {
  return reduceStoredMergeWorld(async state => {
    const harmony = await loadHarmonyProgress();
    const result = reduceLocalEvent(state, command, harmony, availableLocalEvents(), now);
    return { state: result.world, changed: true, localGameplayEvents: result.events };
  }, now);
}

export async function appendSourceGameplayEvents(events: GameplayEvent[]) {
  return reduceStoredMergeWorld(state => ({
    changed: true,
    state: { ...projectLocalEvents(state, events, gameNow()), revision: state.revision + 1, updatedAt: gameNow() },
    localGameplayEvents: events,
  }));
}
