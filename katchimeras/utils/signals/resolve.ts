import type { HomeDayRecord } from '@/types/home';

import type { FactKey, Facts } from './facts';
import { dayDetailProvider } from './providers/day-detail';
import { evidenceProvider } from './providers/evidence';
import { photoLabelsProvider } from './providers/photo-labels';
import { sleepProvider } from './providers/sleep';
import { weatherProvider } from './providers/weather';

// Signal providers: modular producers that each turn a day's context into a
// slice of facts (docs/katchimera-engagement-v1.md refactor). Cheap providers
// read the day record synchronously; capability-gated ones (Vision labels,
// MapKit geo, sleep) land as their own files and register here. A provider
// that can't run simply omits its keys (or sets them 'unknown').

export type SignalContext = {
  today: HomeDayRecord | null;
  // Yesterday — some facts (e.g. last night's sleep quality) read the prior day.
  yesterday?: HomeDayRecord | null;
};

export type SignalProvider = {
  id: string;
  produces: FactKey[];
  resolve: (context: SignalContext) => Partial<Facts>;
};

// --- day-record provider: the cheap, always-available baseline ----------------
const dayRecordProvider: SignalProvider = {
  id: 'day-record',
  produces: [
    'steps.count',
    'notes.added',
    'places.confirmed',
    'places.confirmedNew',
    'places.categories',
    'food.moments',
    'moments.captured',
  ],
  resolve: ({ today }) => {
    if (!today) return {};
    const confirmed = today.confirmedPlaces?.length ?? 0;
    return {
      'steps.count': today.stepsCount ?? 0,
      'notes.added': today.notes?.length ?? 0,
      'places.confirmed': confirmed,
      // "New" place detection (history diff) isn't wired yet — treat any
      // confirmed place as new for now, but keep the key so quests referencing
      // it work the moment the real diff provider lands.
      'places.confirmedNew': confirmed > 0,
      // The place category the user confirmed (park/cafe/museum…) — powers the
      // location-creature quests without any MapKit call.
      'places.categories': Array.from(new Set((today.confirmedPlaces ?? []).map((place) => place.category))),
      'food.moments': today.foodMoments?.length ?? 0,
      'moments.captured': today.capturedMeanings?.length ?? 0,
    };
  },
};

// Registry — append providers here (or via registerProvider for native ones
// that must self-register after a capability check).
const PROVIDERS: SignalProvider[] = [
  dayRecordProvider,
  dayDetailProvider,
  evidenceProvider,
  sleepProvider,
  photoLabelsProvider,
  weatherProvider,
];

export function registerProvider(provider: SignalProvider): void {
  if (!PROVIDERS.some((existing) => existing.id === provider.id)) PROVIDERS.push(provider);
}

/** Resolve the full fact set for a context by merging every provider. */
export function resolveFacts(context: SignalContext): Partial<Facts> {
  return PROVIDERS.reduce<Partial<Facts>>((facts, provider) => Object.assign(facts, provider.resolve(context)), {});
}

export function resolveFactsForDay(today: HomeDayRecord | null, yesterday?: HomeDayRecord | null): Partial<Facts> {
  return resolveFacts({ today, yesterday });
}
