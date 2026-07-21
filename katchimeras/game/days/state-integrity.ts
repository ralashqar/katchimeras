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
 * remove its creature. The only supported reverse transition is the explicit
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
    if (!finalized?.creature || day.creature) return day;
    repaired = true;
    return {
      ...day,
      state: 'hatched',
      creature: finalized.creature,
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
  const historyChanged = encounterHistory !== incoming.encounterHistory;

  if (!repaired && !historyChanged) return incoming;
  return { ...incoming, today, tomorrow, archivedDays, encounterHistory };
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
