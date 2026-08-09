import { ensureStreakIdentity } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';
import type { HomeDayRecord } from '@/types/home';
import { normalizeDayGrowthState } from '@/utils/today-growth';

export type EconomyEventType = 'photo' | 'voice' | 'reflection' | 'place' | 'new_place' | 'food' | 'studio' | 'big_moment' | 'quest' | 'hatched_week' | 'discovery_common' | 'discovery_rare' | 'discovery_epic' | 'discovery_legendary';

/** Sends only a stable hash and coarse event metadata; never memory text, photos, place names, or coordinates. */
export async function registerEconomyEvent(input: {
  clientEventId: string;
  eventType: EconomyEventType;
  localDate: string;
  occurredAt: string;
  sourceIdHash: string;
}): Promise<{ credited: boolean; delta?: number }> {
  const userId = await ensureStreakIdentity();
  if (!userId) return { credited: false };
  const { data, error } = await supabase.rpc('register_economy_event_v1', {
    payload: {
      client_event_id: input.clientEventId,
      event_type: input.eventType,
      local_date: input.localDate,
      occurred_at: input.occurredAt,
      source_id_hash: input.sourceIdHash,
    },
  });
  if (error || !data || typeof data !== 'object') return { credited: false };
  const result = data as { credited?: unknown; delta?: unknown };
  return { credited: result.credited === true, delta: Number.isFinite(result.delta) ? Number(result.delta) : undefined };
}

type PendingEconomyEvent = Parameters<typeof registerEconomyEvent>[0];

export function economyEventsForDays(days: readonly HomeDayRecord[], userSeed: string): PendingEconomyEvent[] {
  const events: PendingEconomyEvent[] = [];
  const add = (day: HomeDayRecord, eventType: EconomyEventType, sourceId: string, occurredAt: string) => {
    const sourceIdHash = opaqueHash(`${userSeed}:${eventType}:${sourceId}`);
    events.push({ clientEventId: `${eventType}:${day.isoDate}:${sourceIdHash}`, eventType, localDate: day.isoDate, occurredAt, sourceIdHash });
  };
  const sourceMap: Partial<Record<string, EconomyEventType>> = {
    photo: 'photo', voice_note: 'voice', reflection: 'reflection', place: 'place', quest: 'quest',
  };
  for (const day of days) {
    for (const growth of normalizeDayGrowthState(day.growth).events) {
      const type = sourceMap[growth.source];
      if (type) add(day, type, growth.sourceId, growth.awardedAt);
    }
    (day.confirmedPlaces ?? []).slice(0, Math.max(0, day.newPlaceCount ?? 0)).forEach((place) => add(day, 'new_place', place.id, day.isoDate));
    (day.foodMoments ?? []).slice(0, 1).forEach((item) => add(day, 'food', item.id, item.createdAt));
    (day.studioMoments ?? []).slice(0, 1).forEach((item) => add(day, 'studio', item.id, item.createdAt));
    (day.bigMoments ?? []).slice(0, 1).forEach((item) => add(day, 'big_moment', item.id, item.createdAt));
  }
  const hatched = days.filter((day) => day.state === 'hatched').sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  for (let index = 6; index < hatched.length; index += 7) {
    const day = hatched[index];
    add(day, 'hatched_week', `week-${Math.floor(index / 7) + 1}`, day.card?.sealedAt ?? `${day.isoDate}T12:00:00.000Z`);
  }
  return [...new Map(events.map((event) => [event.clientEventId, event])).values()];
}

export async function syncEconomyEvents(days: readonly HomeDayRecord[], userSeed: string) {
  const events = economyEventsForDays(days, userSeed);
  // Keep migration responsive without opening an unbounded number of requests.
  for (let index = 0; index < events.length; index += 8) {
    await Promise.all(events.slice(index, index + 8).map(registerEconomyEvent));
  }
}

function opaqueHash(value: string) {
  let a = 2166136261;
  let b = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b ^ code, 3266489917);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
