import { getStoredJson, getStoredRaw, removeStoredValue, setStoredRaw, setStoredRawAsync } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';
import {
  preserveActiveTodayFromEmptyDowngrade,
  preserveFinalizedHatches,
} from '@/game/days/state-integrity';
import {
  mergeStoredHomeState,
  splitStoredHomeState,
  type ActiveHomeEnvelope,
  type ArchiveHomeEnvelope,
} from '@/utils/home-storage-partition';

const listeners = new Set<() => void>();
export const HOME_ACTIVE_STORAGE_KEY = `${HOME_STORAGE_KEY}:active-v1`;
export const HOME_ARCHIVE_STORAGE_KEY = `${HOME_STORAGE_KEY}:archive-v1`;

let cachedHomeState: StoredHomeState | null | undefined;
let pendingDeferredState: StoredHomeState | null = null;
let pendingArchiveWrite = false;
let deferredWrite: Promise<void> | null = null;
let activeRevision = 0;
let archiveRevision = 0;
let lastArchivedDays: StoredHomeState['archivedDays'] | null = null;

export function loadStoredHomeState() {
  if (cachedHomeState === undefined) {
    const active = getStoredJson<ActiveHomeEnvelope | null>(HOME_ACTIVE_STORAGE_KEY, null);
    const archive = getStoredJson<ArchiveHomeEnvelope | null>(HOME_ARCHIVE_STORAGE_KEY, null);
    const partitioned = mergeStoredHomeState(active, archive);
    if (partitioned && active && archive) {
      activeRevision = active.revision;
      archiveRevision = archive.revision;
      lastArchivedDays = archive.days;
      cachedHomeState = partitioned;
    } else {
      cachedHomeState = getStoredJson<StoredHomeState | null>(HOME_STORAGE_KEY, null);
      lastArchivedDays = cachedHomeState?.archivedDays ?? null;
    }
  }
  return cachedHomeState;
}

// The raw persisted JSON string — a cheap identity check for caches (same
// string ⇒ same state) without paying the parse.
export function loadStoredHomeStateRaw(): string | null {
  return getStoredRaw(HOME_ACTIVE_STORAGE_KEY) ?? getStoredRaw(HOME_STORAGE_KEY);
}

export type HomeSaveOptions = {
  notify?: boolean;
  allowHatchDowngrade?: boolean;
  allowTodayReset?: boolean;
  /** The caller changed only Today/Tomorrow or top-level active metadata. */
  preserveArchive?: boolean;
};

export function saveStoredHomeState(state: StoredHomeState, options?: HomeSaveOptions) {
  const currentState = loadStoredHomeState();
  const hatchProtectedState = options?.allowHatchDowngrade
    ? state
    : preserveFinalizedHatches(currentState, state);
  const protectedState = options?.allowTodayReset
    ? hatchProtectedState
    : preserveActiveTodayFromEmptyDowngrade(currentState, hatchProtectedState);
  warnIfHatchDowngradeWasPrevented(state, protectedState);
  cachedHomeState = protectedState;
  const archiveChanged = !options?.preserveArchive
    && !sameArchive(lastArchivedDays, protectedState.archivedDays);
  writePartitionedSync(protectedState, archiveChanged);
  // A pre-hatch async write may already be inside native storage. Queue the
  // protected state behind it so the older write cannot become the final value.
  if (deferredWrite) pendingDeferredState = protectedState;
  if (deferredWrite) pendingArchiveWrite ||= archiveChanged;
  if (options?.notify !== false) {
    notifyHomeStateListeners();
  }
}

// The native localStorage shim writes to SQLite synchronously. Large home
// archives can therefore block the JS thread for seconds. Hot UI mutations use
// this coalescing async writer while reads are served immediately from memory.
export function saveStoredHomeStateDeferred(state: StoredHomeState, options?: HomeSaveOptions) {
  const currentState = loadStoredHomeState();
  const hatchProtectedState = options?.allowHatchDowngrade
    ? state
    : preserveFinalizedHatches(currentState, state);
  const protectedState = options?.allowTodayReset
    ? hatchProtectedState
    : preserveActiveTodayFromEmptyDowngrade(currentState, hatchProtectedState);
  warnIfHatchDowngradeWasPrevented(state, protectedState);
  cachedHomeState = protectedState;
  pendingDeferredState = protectedState;
  pendingArchiveWrite ||= !options?.preserveArchive
    && !sameArchive(lastArchivedDays, protectedState.archivedDays);
  if (options?.notify !== false) {
    notifyHomeStateListeners();
  }
  if (!deferredWrite) {
    deferredWrite = drainDeferredWrites();
  }
  return deferredWrite;
}

async function drainDeferredWrites() {
  // Yield to navigation/rendering before serialization and native I/O.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  try {
    while (pendingDeferredState) {
      const state = pendingDeferredState;
      const writeArchive = pendingArchiveWrite;
      pendingDeferredState = null;
      pendingArchiveWrite = false;
      await writePartitionedDeferred(state, writeArchive);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[Home storage] Deferred save failed', error);
    }
  } finally {
    deferredWrite = null;
    if (pendingDeferredState) {
      deferredWrite = drainDeferredWrites();
    }
  }
}

export function clearStoredHomeState() {
  cachedHomeState = null;
  pendingDeferredState = null;
  pendingArchiveWrite = false;
  lastArchivedDays = null;
  removeStoredValue(HOME_STORAGE_KEY);
  removeStoredValue(HOME_ACTIVE_STORAGE_KEY);
  removeStoredValue(HOME_ARCHIVE_STORAGE_KEY);
  notifyHomeStateListeners();
}

export function subscribeHomeStateChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyHomeStateListeners() {
  listeners.forEach((listener) => listener());
}

export async function flushStoredHomeStateWrites(): Promise<void> {
  while (deferredWrite) await deferredWrite;
}

export function loadStoredHomeArchivePage(offset: number, limit: number): StoredHomeState['archivedDays'] {
  const days = loadStoredHomeState()?.archivedDays ?? [];
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(0, Math.floor(limit));
  return days.slice(safeOffset, safeOffset + safeLimit);
}

function writePartitionedSync(state: StoredHomeState, writeArchive: boolean): void {
  if (writeArchive || !getStoredRaw(HOME_ARCHIVE_STORAGE_KEY)) {
    archiveRevision += 1;
    setStoredRaw(HOME_ARCHIVE_STORAGE_KEY, serializeArchive(state, archiveRevision));
    lastArchivedDays = state.archivedDays;
  }
  activeRevision += 1;
  setStoredRaw(HOME_ACTIVE_STORAGE_KEY, serializeActive(state, activeRevision));
}

async function writePartitionedDeferred(state: StoredHomeState, writeArchive: boolean): Promise<void> {
  const startedAt = performance.now();
  let archiveBytes = 0;
  // Archive first: an active envelope is never published before the archive it
  // references is durable. The legacy monolith remains as migration fallback.
  if (writeArchive || !getStoredRaw(HOME_ARCHIVE_STORAGE_KEY)) {
    archiveRevision += 1;
    const archiveRaw = serializeArchive(state, archiveRevision);
    archiveBytes = archiveRaw.length;
    await setStoredRawAsync(HOME_ARCHIVE_STORAGE_KEY, archiveRaw);
    lastArchivedDays = state.archivedDays;
  }
  activeRevision += 1;
  const activeRaw = serializeActive(state, activeRevision);
  const serializedAt = performance.now();
  await setStoredRawAsync(HOME_ACTIVE_STORAGE_KEY, activeRaw);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_TODAY_LOOP_PERF === '1') {
    console.info('[today-energy-loop] persistence', {
      activeBytes: activeRaw.length,
      archiveBytes,
      serializeMs: round(serializedAt - startedAt),
      totalMs: round(performance.now() - startedAt),
    });
  }
}

function serializeActive(state: StoredHomeState, revision: number): string {
  return JSON.stringify(splitStoredHomeState(state, revision, archiveRevision).active);
}

function serializeArchive(state: StoredHomeState, revision: number): string {
  return JSON.stringify(splitStoredHomeState(state, activeRevision, revision).archive);
}

function sameArchive(
  left: StoredHomeState['archivedDays'] | null,
  right: StoredHomeState['archivedDays'],
): boolean {
  if (!left || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) continue;
    if (archiveDayFingerprint(left[index]) !== archiveDayFingerprint(right[index])) return false;
  }
  return true;
}

function archiveDayFingerprint(day: StoredHomeState['archivedDays'][number]): string {
  const growth = day.growth;
  const latestGrowth = growth?.events[growth.events.length - 1];
  const latestCare = growth?.careActions[growth.careActions.length - 1];
  const latestJournal = day.journalRecords?.[day.journalRecords.length - 1];
  const latestMemory = day.classifiedMemories?.[day.classifiedMemories.length - 1];
  return [
    day.id,
    day.state,
    day.derivedSignature ?? '',
    day.creature?.id ?? '',
    day.card?.id ?? '',
    day.heroPhoto?.assetId ?? '',
    day.shareReadyAt ?? '',
    day.moments.length,
    day.locations.length,
    day.promptAnswers.length,
    day.notes?.length ?? 0,
    day.journalRecords?.length ?? 0,
    latestJournal?.id ?? '',
    latestMemory ? `${latestMemory.id}:${latestMemory.createdAt}:${latestMemory.schemaVersion}` : '',
    latestGrowth?.id ?? '',
    latestCare?.updatedAt ?? '',
  ].join('|');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function warnIfHatchDowngradeWasPrevented(
  requested: StoredHomeState,
  protectedState: StoredHomeState
) {
  if (!__DEV__ || requested === protectedState) return;
  const requestedDays = new Map(
    [...requested.archivedDays, requested.today, ...(requested.tomorrow ? [requested.tomorrow] : [])]
      .map((day) => [day.id, day] as const)
  );
  const repairedIds = [
    ...protectedState.archivedDays,
    protectedState.today,
    ...(protectedState.tomorrow ? [protectedState.tomorrow] : []),
  ]
    .filter((day) => day.creature && !requestedDays.get(day.id)?.creature)
    .map((day) => day.id);
  if (repairedIds.length > 0) {
    console.warn(`[Home storage] Prevented stale writer from unhatching: ${repairedIds.join(', ')}`);
  }
}
