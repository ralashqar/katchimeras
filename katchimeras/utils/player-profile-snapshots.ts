import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { flushFtuePersistence } from '@/features/onboarding/ftue-runtime';
import type { PlayerProfileSnapshot, PlayerProfileSnapshotValidation } from '@/types/player-profile-snapshot';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { createClientId } from '@/utils/client-id';
import { clearDevProfileSession, consumeDevProfileLaunchRoute, getDevProfileSession, isDevProfileSandboxActive, setDevProfileSession } from '@/utils/dev-profile-sandbox';
import { clearPlayerProfileRollback, loadPlayerProfileRollback, saveCapturedPlayerProfileSnapshot, savePlayerProfileRollback } from '@/utils/dev-profile-snapshot-storage';
import { flushStoredHomeStateWrites } from '@/utils/home-storage';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { installMergeWorldStateForDebug, loadMergeWorldState } from '@/utils/merge-world/repository';
import { captureKeyValueProfileDomain, replaceKeyValueProfileDomain, validateKeyValueProfileDomain } from '@/utils/player-profile-domain-registry';
import { setJourneyQuickModeEnabled } from '@/utils/dev-settings';

const RESTORE_JOURNAL_KEY = 'katchadeck.dev.profile-snapshot-restore-v1';

type RestoreJournal = {
  schemaVersion: 1;
  snapshotId: string;
  phase: 'installing' | 'complete';
  startedAt: string;
};

function assertDevTools() {
  if (!DEV_TOOLS_ENABLED) throw new Error('Player profile snapshots are only available in developer-enabled builds.');
}

export function summarizePlayerProfileSnapshot(state: PlayerProfileSnapshot['domains']['mergeWorld']['state'], ftueStep: string | null) {
  return {
    ftueStep,
    unlockedCharacters: [...state.unlockedCharacters],
    activeGateId: state.companionDiscovery.active?.gateId ?? null,
    selectedCharacterId: state.companionDiscovery.active?.selectedCharacterId ?? null,
    discoveryStage: state.companionDiscovery.active?.stage ?? null,
    pendingParcelCount: state.arrivals.filter((arrival) => arrival.kind === 'discovery_parcel' && arrival.claimedAt == null).length,
  };
}

export async function capturePlayerProfileSnapshot(input: {
  name: string;
  description?: string;
  source?: 'capture' | 'rollback';
  launchRoute?: PlayerProfileSnapshot['launchRoute'];
  persist?: boolean;
}): Promise<PlayerProfileSnapshot> {
  assertDevTools();
  await Promise.all([flushStoredHomeStateWrites(), flushFtuePersistence()]);
  const state = await loadMergeWorldState();
  const values = captureKeyValueProfileDomain();
  const ftueRaw = values['katchimeras.ftue-run.v4'];
  let ftueStep: string | null = null;
  try { ftueStep = ftueRaw ? (JSON.parse(ftueRaw) as { stepId?: string }).stepId ?? null : null; } catch {}
  const snapshot: PlayerProfileSnapshot = {
    schemaVersion: 1,
    id: createClientId('profile-snapshot'),
    name: input.name.trim() || 'Untitled profile snapshot',
    description: input.description?.trim() ?? '',
    source: input.source ?? 'capture',
    timePolicy: 'frozen',
    createdAt: new Date().toISOString(),
    tags: ['Local capture'],
    launchRoute: input.launchRoute ?? '/(tabs)/games',
    summary: summarizePlayerProfileSnapshot(state, ftueStep),
    domains: {
      keyValue: { schemaVersion: 1, values },
      mergeWorld: { schemaVersion: 1, state },
    },
  };
  if (input.persist !== false) await saveCapturedPlayerProfileSnapshot(snapshot);
  return snapshot;
}

export function validatePlayerProfileSnapshot(snapshot: unknown): PlayerProfileSnapshotValidation {
  const errors: string[] = [];
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, errors: ['Snapshot must be an object.'] };
  const candidate = snapshot as Partial<PlayerProfileSnapshot>;
  if (candidate.schemaVersion !== 1) errors.push('Unsupported profile snapshot version.');
  if (!candidate.id || !candidate.name) errors.push('Snapshot metadata is incomplete.');
  if (candidate.domains?.keyValue?.schemaVersion !== 1 || !candidate.domains.keyValue.values) errors.push('Key-value profile domain is missing.');
  else errors.push(...validateKeyValueProfileDomain(candidate.domains.keyValue.values));
  if (candidate.domains?.mergeWorld?.schemaVersion !== 1 || !candidate.domains.mergeWorld.state) {
    errors.push('Merge World profile domain is missing.');
  } else {
    try {
      const state = normalizeMergeWorldState(candidate.domains.mergeWorld.state);
      if (state.board.length !== 63) errors.push('Merge World board must contain 63 cells.');
      const instanceIds = state.board.flatMap((cell) => cell.occupant?.kind === 'item' ? [cell.occupant.instanceId] : []);
      if (new Set(instanceIds).size !== instanceIds.length) errors.push('Merge World board contains duplicate item instances.');
      const active = state.companionDiscovery.active;
      if (active?.selectedCharacterId && !active.candidateIds.includes(active.selectedCharacterId)) errors.push('Selected discovery path is not in its gate candidate pool.');
      if (active?.selectedCharacterId && state.unlockedCharacters.includes(active.selectedCharacterId)) errors.push('Active discovery character is already unlocked.');
      for (const record of state.companionDiscovery.records) {
        if (!state.unlockedCharacters.includes(record.characterId)) errors.push(`Discovery record ${record.characterId} is not unlocked.`);
        if (!state.companionDiscovery.completedGateIds.includes(record.gateId)) errors.push(`Discovery record ${record.characterId} has an incomplete gate.`);
      }
      if (state.arrivals.some((arrival) => arrival.kind === 'discovery_parcel' && arrival.discoveryId && active && arrival.discoveryId !== active.discoveryId && arrival.claimedAt == null)) {
        errors.push('An unclaimed discovery parcel does not match the active discovery.');
      }
      if (candidate.summary?.activeGateId !== (active?.gateId ?? null)) errors.push('Snapshot summary does not match the active discovery gate.');
      if (candidate.summary?.pendingParcelCount !== state.arrivals.filter((arrival) => arrival.kind === 'discovery_parcel' && arrival.claimedAt == null).length) errors.push('Snapshot summary does not match pending parcels.');
    } catch {
      errors.push('Merge World state cannot be normalized.');
    }
  }
  return { ok: errors.length === 0, errors };
}

async function installSnapshot(snapshot: PlayerProfileSnapshot) {
  setJourneyQuickModeEnabled(false);
  replaceKeyValueProfileDomain(snapshot.domains.keyValue.values);
  relationshipProgressionRepository.reloadFromStorageForDebug();
  await installMergeWorldStateForDebug(snapshot.domains.mergeWorld.state);
}

export async function replacePlayerProfileSnapshot(snapshot: PlayerProfileSnapshot, options: { createRollback?: boolean } = {}): Promise<void> {
  assertDevTools();
  const validation = validatePlayerProfileSnapshot(snapshot);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  await Promise.all([flushStoredHomeStateWrites(), flushFtuePersistence()]);
  let rollback: PlayerProfileSnapshot | null = null;
  if (options.createRollback !== false) {
    rollback = await capturePlayerProfileSnapshot({ name: 'Before snapshot load', source: 'rollback', persist: false });
    await savePlayerProfileRollback(rollback);
  }
  const now = new Date().toISOString();
  setStoredJson<RestoreJournal>(RESTORE_JOURNAL_KEY, { schemaVersion: 1, snapshotId: snapshot.id, phase: 'installing', startedAt: now });
  setDevProfileSession({
    schemaVersion: 1,
    snapshotId: snapshot.id,
    snapshotName: snapshot.name,
    loadedAt: now,
    sandboxed: true,
    pendingLaunchRoute: snapshot.launchRoute,
  });
  try {
    await installSnapshot(snapshot);
    setStoredJson<RestoreJournal>(RESTORE_JOURNAL_KEY, { schemaVersion: 1, snapshotId: snapshot.id, phase: 'complete', startedAt: now });
  } catch (error) {
    if (rollback) await installSnapshot(rollback);
    clearDevProfileSession();
    removeStoredValue(RESTORE_JOURNAL_KEY);
    throw error;
  }
}

export async function restorePlayerProfileRollback(): Promise<boolean> {
  assertDevTools();
  const rollback = await loadPlayerProfileRollback();
  if (!rollback) return false;
  await installSnapshot(rollback);
  clearDevProfileSession();
  removeStoredValue(RESTORE_JOURNAL_KEY);
  await clearPlayerProfileRollback();
  return true;
}

export async function recoverInterruptedPlayerProfileRestore(): Promise<boolean> {
  if (!DEV_TOOLS_ENABLED) return false;
  const journal = getStoredJson<RestoreJournal | null>(RESTORE_JOURNAL_KEY, null);
  if (!journal || journal.phase === 'complete') return false;
  return restorePlayerProfileRollback();
}

export { consumeDevProfileLaunchRoute, getDevProfileSession, isDevProfileSandboxActive };
