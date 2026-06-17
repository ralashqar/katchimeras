import creaturePersonas from '@/data/katchimeras/creature-personas.json';
import { encounterCastByProfileId } from '@/constants/encounter-cast';
import type { StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { buildReflectionContext } from '@/utils/reflection-context';
import { weatherLabel } from '@/utils/day-weather';
import { supabase } from '@/utils/supabase';
import { pickProminentTags } from '@/utils/vision-signals';

// Per-creature character bible: a persona paragraph plus one short voice note
// for each mood (the day's emotional read) and each bond depth (how it fits your
// history). The narrator composes within these instead of inventing freely, so
// the character never drifts. Creatures without an entry fall back to the cast's
// one-line voice.
type CreaturePersona = {
  persona: string;
  moods: Record<string, string>;
  bond: Record<string, string>;
};
const personasByProfileId = creaturePersonas as Record<string, CreaturePersona>;

export type GeneratedDayReflection = {
  highlight: string;
  reflection: string;
};

const REQUEST_TIMEOUT_MS = 9000;
const MAX_HIGHLIGHT_LENGTH = 200;
const MAX_REFLECTION_LENGTH = 320;
const FALLBACK_VOICE = 'a gentle companion who notices small true things';

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Privacy contract: the request carries place categories, moment labels, step
// bands, and abstract photo subject words only — never coordinates, photo URIs,
// place names, free text, or identifiers. `pastDays` (earlier day records) stays
// on-device: only the derived temporal context (streak counts, weekday/rarity of
// prior visits) is sent, never the raw days.
export function buildReflectionRequest(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  pastDays: readonly StoredHomeDayRecord[] = []
) {
  const creature = day.creature;
  if (!creature) {
    return null;
  }

  const castEntry = creature.encounterProfileId
    ? encounterCastByProfileId.get(creature.encounterProfileId)
    : undefined;

  const context = buildReflectionContext(day, pastDays);
  const persona = creature.encounterProfileId
    ? personasByProfileId[creature.encounterProfileId]
    : undefined;

  return {
    dayLabel: weekdayNames[new Date(`${day.isoDate}T12:00:00`).getDay()] ?? 'Today',
    momentLabels: day.moments.map((moment) => moment.label).slice(0, 24),
    stepsBand: resolveStepsBand(day.stepsCount),
    visitedPlaceCount: day.visitedPlaceCount,
    newPlaceCount: day.newPlaceCount,
    // The recurring photo subjects of the day (e.g. "dog", "coffee", "water"),
    // so the line can name something specific. Abstract content words only.
    prominentTags: day.vision ? pickProminentTags(day.vision) : [],
    // The specific raw things the camera saw ("marble sculpture", "ramen
    // bowl") — more evocative than the grouped concepts above.
    photoDetails: day.vision?.details ?? [],
    // Actual words read off signs/placards/menus/tickets (OCR). The single most
    // specific signal — it lets the line name the real exhibit or dish. NOTE:
    // this is free text and loosens the "labels not text" privacy contract.
    signText: day.vision ? day.vision.textTokens.slice(0, 12) : [],
    character: {
      name: creature.name,
      encounterCue: castEntry?.categoryLabel ?? null,
      repeatDepth: creature.repeatDepth,
      voice: castEntry?.voice ?? FALLBACK_VOICE,
      rarity: creature.rarity,
      // Two independent axes the narrator can lean on: why this day was rare
      // (living conditions) and how deep the bond has grown (return visits).
      rarityReason: creature.rarityReason ?? null,
      bondStage: creature.bondStage ?? 0,
      bondVisitCount: creature.bondVisitCount ?? creature.repeatDepth + 1,
      // The character bible: persona + the voice notes for THIS day's mood and
      // THIS relationship's depth, so the line stays in character.
      persona: persona?.persona ?? null,
      moodGuidance: persona?.moods[context.mood] ?? null,
      bondGuidance: persona?.bond[context.bondDepth] ?? null,
    },
    // Temporal + relational read of the day (see utils/reflection-context.ts).
    // This is what lets the line notice a streak, a recovery after a busy
    // stretch, or a specific shared history instead of treating each day alone.
    context: {
      mood: context.mood,
      bondDepth: context.bondDepth,
      consecutiveDays: context.consecutiveDays,
      daysSinceLastVisit: context.daysSinceLastVisit,
      recoveryAfterBusy: context.recoveryAfterBusy,
      busyDaysBefore: context.busyDaysBefore,
      previousDayCreature: context.previousDayCreature,
      priorVisits: context.priorVisits,
      dayShape: context.dayShape,
    },
    // The day's actual weather (abstract label only). When present the line MAY
    // name it truthfully; when absent it must not invent any.
    weather: day.weather
      ? { condition: day.weather.condition, label: weatherLabel(day.weather.condition), tempMaxC: day.weather.tempMaxC ?? null }
      : null,
    tonePreference: profile.preferenceIds[0] ?? null,
  };
}

export async function requestDayReflection(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  pastDays: readonly StoredHomeDayRecord[] = []
): Promise<GeneratedDayReflection | null> {
  const payload = buildReflectionRequest(day, profile, pastDays);
  if (!payload) {
    return null;
  }

  try {
    const invocation = supabase.functions.invoke('generate-day-reflection', { body: payload });
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS);
    });
    const result = await Promise.race([invocation, timeout]);

    if (!result || result.error) {
      return null;
    }

    const data = result.data as Partial<GeneratedDayReflection> | null;
    const highlight = typeof data?.highlight === 'string' ? data.highlight.trim() : '';
    const reflection = typeof data?.reflection === 'string' ? data.reflection.trim() : '';
    if (!highlight || !reflection) {
      return null;
    }

    return {
      highlight: highlight.slice(0, MAX_HIGHLIGHT_LENGTH),
      reflection: reflection.slice(0, MAX_REFLECTION_LENGTH),
    };
  } catch {
    return null;
  }
}

// On-demand LLM panel captions for the 4-panel comic (open, scene, turn,
// close). Same privacy-clean payload as the reflection, plus wantComic. Returns
// null on any failure → the comic falls back to local templated beats.
export async function requestComicBeats(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  pastDays: readonly StoredHomeDayRecord[] = []
): Promise<string[] | null> {
  const payload = buildReflectionRequest(day, profile, pastDays);
  if (!payload) {
    return null;
  }

  try {
    const invocation = supabase.functions.invoke('generate-day-reflection', {
      body: { ...payload, wantComic: true },
    });
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS);
    });
    const result = await Promise.race([invocation, timeout]);

    if (!result || result.error) {
      return null;
    }

    const beats = (result.data as { beats?: unknown } | null)?.beats;
    if (!Array.isArray(beats) || beats.length < 4) {
      return null;
    }

    return beats.slice(0, 4).map((beat) => (typeof beat === 'string' ? beat.trim() : ''));
  } catch {
    return null;
  }
}

function resolveStepsBand(stepsCount: number): 'none' | 'light' | 'moderate' | 'high' {
  if (stepsCount <= 0) return 'none';
  if (stepsCount < 2500) return 'light';
  if (stepsCount < 7000) return 'moderate';
  return 'high';
}
