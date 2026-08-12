import type {
  CompanionAchievementRecord,
  CompanionAchievementState,
} from '@/types/companion-achievements';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const STORAGE_KEY = 'katchimera.companion-achievements.v1';
const EMPTY: CompanionAchievementState = { version: 3, baselined: false, catalogVersion: 2, unlocked: {} };

export function loadCompanionAchievementState(): CompanionAchievementState {
  const stored = getStoredJson<unknown>(STORAGE_KEY, EMPTY);
  if (!stored || typeof stored !== 'object') return EMPTY;
  const candidate = stored as { version?: number; baselined?: boolean; migratedFromV1?: boolean; unlocked?: CompanionAchievementState['unlocked'] };
  if (![2, 3].includes(candidate.version ?? 0) || !candidate.unlocked || typeof candidate.unlocked !== 'object') {
    return { ...EMPTY, migratedFromV1: candidate.version === 1 };
  }
  return {
    version: 3,
    baselined: Boolean(candidate.baselined),
    migratedFromV1: Boolean(candidate.migratedFromV1),
    catalogVersion: typeof (candidate as { catalogVersion?: unknown }).catalogVersion === 'number'
      ? (candidate as { catalogVersion: number }).catalogVersion
      : 1,
    unlocked: candidate.unlocked,
  };
}

export function saveCompanionAchievementState(state: CompanionAchievementState): void {
  setStoredJson(STORAGE_KEY, state);
}

export function resetCompanionAchievementsForDebug(): void {
  saveCompanionAchievementState(EMPTY);
}

export function recordCompanionAchievementUnlocks(
  state: CompanionAchievementState,
  records: CompanionAchievementRecord[]
): CompanionAchievementState {
  if (!records.length) return state;
  const unlocked = { ...state.unlocked };
  let changed = false;
  for (const record of records) {
    const existing = unlocked[record.id];
    if (existing) {
      if (record.earnedAt < existing.earnedAt) {
        unlocked[record.id] = { ...existing, earnedAt: record.earnedAt, sourceDayId: record.sourceDayId ?? existing.sourceDayId };
        changed = true;
      }
      continue;
    }
    unlocked[record.id] = record;
    changed = true;
  }
  return changed ? { ...state, unlocked } : state;
}

export function markCompanionAchievementSeen(
  state: CompanionAchievementState,
  ids: readonly string[]
): CompanionAchievementState {
  const unlocked = { ...state.unlocked };
  let changed = false;
  for (const id of ids) {
    const record = unlocked[id];
    if (!record || record.seenCelebration) continue;
    unlocked[id] = { ...record, seenCelebration: true };
    changed = true;
  }
  return changed ? { ...state, unlocked } : state;
}
