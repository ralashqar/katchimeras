import type {
  EncounterHistoryMap,
  StoredHomeDayRecord,
  StoredHomeState,
} from '@/types/home';

/**
 * Reconciles a full-state writer with the latest repository state.
 *
 * Home state is intentionally updated by several asynchronous enrichers. Those
 * jobs may finish with a snapshot captured before a hatch. A hatch is a terminal
 * user-visible event, so a normal writer may enrich that day but can never
 * remove its Wisp result (or a legacy Katchimera). The only supported reverse transition is the explicit
 * developer rehatch command, which bypasses this reconciliation at save time.
 */
export function preserveFinalizedHatches(
  current: StoredHomeState | null | undefined,
  incoming: StoredHomeState
): StoredHomeState {
  if (!current) return incoming;

  const currentDays = indexDays(current);
  let repaired = false;
  const protect = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    const finalized = currentDays.get(day.id);
    if (!finalized || (!finalized.dailyHatch && !finalized.creature)) return day;
    const keepsDailyHatch = !finalized.dailyHatch || Boolean(day.dailyHatch);
    const keepsLegacyCreature = !finalized.creature || Boolean(day.creature);
    if (keepsDailyHatch && keepsLegacyCreature && (!finalized.card || day.card)) return day;
    repaired = true;
    return {
      ...day,
      state: finalized.state,
      dailyHatch: day.dailyHatch ?? finalized.dailyHatch,
      creature: day.creature ?? finalized.creature,
      legacyEncounter: day.legacyEncounter ?? finalized.legacyEncounter,
      card: day.card ?? finalized.card,
      shareReadyAt: day.shareReadyAt ?? finalized.shareReadyAt,
      hatchCheckIn: day.hatchCheckIn ?? finalized.hatchCheckIn,
      devForceReadyToHatch: undefined,
      devHatchReflectionMode: undefined,
    };
  };

  const today = protect(incoming.today);
  const tomorrow = incoming.tomorrow ? protect(incoming.tomorrow) : undefined;
  const archivedDays = incoming.archivedDays.map(protect);
  const encounterHistory = mergeEncounterHistory(current.encounterHistory, incoming.encounterHistory);
  const aspectHistory = mergeEncounterHistory(current.aspectHistory ?? {}, incoming.aspectHistory ?? {});
  const skinHistory = mergeEncounterHistory(current.skinHistory ?? {}, incoming.skinHistory ?? {});
  const historyChanged =
    encounterHistory !== incoming.encounterHistory ||
    aspectHistory !== incoming.aspectHistory ||
    skinHistory !== incoming.skinHistory;

  if (!repaired && !historyChanged) return incoming;
  return { ...incoming, today, tomorrow, archivedDays, encounterHistory, aspectHistory, skinHistory };
}

/**
 * Rejects the characteristic stale-writer failure where the current calendar
 * day is replaced by a newly-created empty record. Normal Today operations are
 * append-only for prompts, growth and journals; clearing all of them together
 * is only valid through the explicit reset command.
 */
export function preserveActiveTodayFromEmptyDowngrade(
  current: StoredHomeState | null | undefined,
  incoming: StoredHomeState,
): StoredHomeState {
  if (!current) return incoming;
  if (current.today.id !== incoming.today.id || current.today.isoDate !== incoming.today.isoDate) return incoming;
  const cycleProtected = preserveNewestEggCycle(current, incoming);
  if (!hasNurtureProgress(current.today) || hasNurtureProgress(cycleProtected.today)) return cycleProtected;
  return { ...cycleProtected, today: current.today };
}

function preserveNewestEggCycle(current: StoredHomeState, incoming: StoredHomeState): StoredHomeState {
  const currentCycle = validTimestamp(current.today.growth?.cycleStartedAt);
  const incomingCycle = validTimestamp(incoming.today.growth?.cycleStartedAt);
  if (currentCycle == null || (incomingCycle != null && incomingCycle >= currentCycle)) return incoming;

  const eventMap = new Map((current.today.growth?.events ?? []).map((event) => [event.id, event]));
  for (const event of incoming.today.growth?.events ?? []) eventMap.set(event.id, event);
  const careMap = new Map((current.today.growth?.careActions ?? [])
    .filter((action) => validTimestamp(action.updatedAt) != null && validTimestamp(action.updatedAt)! >= currentCycle)
    .map((action) => [action.instanceId, action]));
  for (const action of incoming.today.growth?.careActions ?? []) {
    if (validTimestamp(action.updatedAt) != null && validTimestamp(action.updatedAt)! >= currentCycle) {
      careMap.set(action.instanceId, action);
    }
  }
  return {
    ...incoming,
    today: {
      ...incoming.today,
      growth: {
        schemaVersion: 1,
        cycleStartedAt: current.today.growth?.cycleStartedAt,
        events: [...eventMap.values()],
        careActions: [...careMap.values()],
      },
    },
  };
}

function validTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function hasNurtureProgress(day: StoredHomeDayRecord): boolean {
  return (day.growth?.events.length ?? 0) > 0
    || (day.growth?.careActions.length ?? 0) > 0
    || day.promptAnswers.length > 0
    || (day.journalRecords?.length ?? 0) > 0
    || (day.manualJournalEntries?.length ?? 0) > 0
    || day.moments.length > 0
    || day.sleep != null
    || day.heroPhoto != null
    || (day.capturedMeanings?.length ?? 0) > 0;
}

function indexDays(state: StoredHomeState): Map<string, StoredHomeDayRecord> {
  const indexed = new Map<string, StoredHomeDayRecord>();
  for (const day of [...state.archivedDays, state.today, ...(state.tomorrow ? [state.tomorrow] : [])]) {
    indexed.set(day.id, day);
  }
  return indexed;
}

function mergeEncounterHistory(
  current: EncounterHistoryMap,
  incoming: EncounterHistoryMap
): EncounterHistoryMap {
  let merged: EncounterHistoryMap | null = null;
  for (const [profileId, previous] of Object.entries(current)) {
    const next = incoming[profileId];
    if (
      next &&
      next.count >= previous.count &&
      next.lastSeenIsoDate >= previous.lastSeenIsoDate
    ) {
      continue;
    }
    merged ??= { ...incoming };
    merged[profileId] = next
      ? {
          count: Math.max(previous.count, next.count),
          lastSeenIsoDate: previous.lastSeenIsoDate > next.lastSeenIsoDate
            ? previous.lastSeenIsoDate
            : next.lastSeenIsoDate,
        }
      : previous;
  }
  return merged ?? incoming;
}
