import { Platform } from 'react-native';

import { streakRepository } from '@/storage/repositories/streak-repository';
import type { StoredHomeState } from '@/types/home';
import type { StoredStreakState, StreakCaptureIntent } from '@/types/streak';
import { supabase } from '@/utils/supabase';
import { historicalQualifyingCaptureIntents } from '@/utils/streak-qualification';
import { registerStreakCapture } from '@/utils/streak-engine';

let syncing: Promise<void> | null = null;
let bootstrapping: Promise<void> | null = null;

export async function ensureStreakIdentity(): Promise<string | null> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user.id) return existing.data.session.user.id;
  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error) return null;
  return signedIn.data.user?.id ?? null;
}

export function bootstrapStreakSystem(homeState: StoredHomeState | null): Promise<void> {
  if (bootstrapping) return bootstrapping;
  bootstrapping = (async () => {
    if (homeState) migrateExistingHistory(homeState);
    await ensureStreakIdentity();
    await flushStreakOutbox();
    await pullStreakSnapshot();
  })().finally(() => {
    bootstrapping = null;
  });
  return bootstrapping;
}

export function migrateExistingHistory(homeState: StoredHomeState): void {
  let state = streakRepository.load();
  if (state.historyImportedAt) return;
  const intents = historicalQualifyingCaptureIntents(homeState);
  if (intents.length > 0) {
    const earliest = intents.map((intent) => intent.localDate).sort()[0];
    state = { ...state, activationDate: earliest };
    streakRepository.replace(state);
    for (const intent of intents.sort((left, right) => left.localDate.localeCompare(right.localDate))) {
      const registered = registerStreakCapture(
        streakRepository.load(),
        intent,
        new Date(`${intent.localDate}T12:00:00`),
        { countTowardRepair: false, queue: true },
      );
      streakRepository.replace(registered.state);
    }
  }
  const imported = streakRepository.load();
  const milestoneDays = Object.values(imported.milestones).map((milestone) => milestone.days).sort((a, b) => b - a);
  streakRepository.replace({
    ...imported,
    historyImportedAt: new Date().toISOString(),
    seenMilestoneDays: milestoneDays.slice(1),
  });
}

export function enqueueStreakCaptures(intents: StreakCaptureIntent[]): void {
  for (const intent of intents) {
    const result = streakRepository.capture(intent);
    if (!result.firstCaptureOfDay) continue;
    void trackStreakEvent(result.snapshot.currentStreak === 1 ? 'streak_started' : 'day_captured', {
      capture_type: intent.type,
      current_streak: result.snapshot.currentStreak,
      local_date: intent.localDate,
    });
    void trackStreakEvent('streak_incremented', { current_streak: result.snapshot.currentStreak });
    if (result.repairEarned) void trackStreakEvent('streak_repair_earned', { repairs_available: result.snapshot.repairsAvailable });
  }
  if (intents.length > 0) void flushStreakOutbox();
}

export function flushStreakOutbox(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    const userId = await ensureStreakIdentity();
    if (!userId) {
      markSyncError('Your streak is safe on this device and will sync when sign-in is available.');
      return;
    }
    let state = streakRepository.load();
    for (const event of [...state.outbox]) {
      const { error } = await supabase.rpc('register_daily_capture_v1', {
        payload: {
          capture_type: event.type,
          client_event_id: event.clientEventId,
          local_date: event.localDate,
          occurred_at: event.occurredAt,
          is_history: event.clientEventId.startsWith('streak-history:'),
          source_id_hash: event.sourceIdHash,
          timezone: event.timezone,
        },
      });
      if (error) {
        state = streakRepository.load();
        streakRepository.replace({
          ...state,
          outbox: state.outbox.map((item) => item.clientEventId === event.clientEventId
            ? { ...item, attempts: item.attempts + 1 }
            : item),
          syncError: error.message,
        });
        return;
      }
      state = streakRepository.load();
      streakRepository.replace({
        ...state,
        outbox: state.outbox.filter((item) => item.clientEventId !== event.clientEventId),
        syncError: null,
        syncedAt: new Date().toISOString(),
      });
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

export async function pullStreakSnapshot(): Promise<void> {
  const { data, error } = await supabase.rpc('get_streak_snapshot_v1', { history_days: 366 });
  if (error || !data || typeof data !== 'object') return;
  const remote = data as {
    days?: Array<Record<string, unknown>>;
    milestones?: Array<Record<string, unknown>>;
    profile?: Record<string, unknown>;
  };
  if (!remote.profile) return;
  const current = streakRepository.load();
  const days = { ...current.days };
  for (const row of remote.days ?? []) {
    const localDate = typeof row.local_date === 'string' ? row.local_date : null;
    const state = row.state;
    if (!localDate || (state !== 'captured' && state !== 'missed' && state !== 'repaired')) continue;
    days[localDate] = {
      firstCaptureTimestamp: typeof row.first_capture_at === 'string' ? row.first_capture_at : null,
      localDate,
      qualifyingCaptureType: typeof row.qualifying_capture_type === 'string'
        ? row.qualifying_capture_type as StoredStreakState['days'][string]['qualifyingCaptureType']
        : null,
      repairedAt: typeof row.repaired_at === 'string' ? row.repaired_at : null,
      repairSource: row.repair_source === 'earned' || row.repair_source === 'support' || row.repair_source === 'migration' ? row.repair_source : null,
      state,
      timezone: typeof row.timezone === 'string' ? row.timezone : 'UTC',
    };
  }
  const milestones = { ...current.milestones };
  for (const row of remote.milestones ?? []) {
    const milestoneDays = Number(row.milestone_days);
    const essenceReward = Number(row.essence_reward);
    if (!Number.isFinite(milestoneDays) || !Number.isFinite(essenceReward)) continue;
    milestones[String(milestoneDays)] = {
      days: milestoneDays,
      essenceReward,
      reachedAt: typeof row.reached_at === 'string' ? row.reached_at : new Date().toISOString(),
    };
  }
  const profile = remote.profile;
  streakRepository.replace({
    ...current,
    activationDate: typeof profile.activation_date === 'string' && profile.activation_date < current.activationDate
      ? profile.activation_date
      : current.activationDate,
    days,
    historyImportedAt: typeof profile.history_imported_at === 'string' ? profile.history_imported_at : current.historyImportedAt,
    milestones,
    repairEarningProgress: finiteInteger(profile.repair_earning_progress, current.repairEarningProgress),
    repairsAvailable: finiteInteger(profile.repairs_available, current.repairsAvailable),
    repairsCapacity: finiteInteger(profile.repairs_capacity, current.repairsCapacity),
    syncError: null,
    syncedAt: new Date().toISOString(),
  });
}

export async function syncRepair(localDate: string): Promise<void> {
  await ensureStreakIdentity();
  const { error } = await supabase.rpc('use_streak_repair_v1', { target_local_date: localDate });
  if (error) markSyncError(error.message);
}

export async function syncRepairDecline(localDate: string): Promise<void> {
  await ensureStreakIdentity();
  const { error } = await supabase.rpc('decline_streak_repair_v1', { target_local_date: localDate });
  if (error) markSyncError(error.message);
}

export async function trackStreakEvent(
  eventName: string,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  const userId = await ensureStreakIdentity();
  if (!userId) return;
  await supabase.from('streak_analytics_events').insert({
    event_name: eventName,
    platform: Platform.OS,
    properties,
    user_id: userId,
  });
}

function markSyncError(message: string): void {
  const state: StoredStreakState = streakRepository.load();
  streakRepository.replace({ ...state, syncError: message });
}

function finiteInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}
