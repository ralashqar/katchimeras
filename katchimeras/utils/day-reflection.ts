import { encounterCastByProfileId } from '@/constants/encounter-cast';
import type { StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { supabase } from '@/utils/supabase';

export type GeneratedDayReflection = {
  highlight: string;
  reflection: string;
};

const REQUEST_TIMEOUT_MS = 9000;
const MAX_HIGHLIGHT_LENGTH = 200;
const MAX_REFLECTION_LENGTH = 320;
const FALLBACK_VOICE = 'a gentle companion who notices small true things';

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Privacy contract: the request carries place categories, moment labels, and
// step bands only — never coordinates, photo URIs, free text, or identifiers.
export function buildReflectionRequest(day: StoredHomeDayRecord, profile: OnboardingProfile) {
  const creature = day.creature;
  if (!creature) {
    return null;
  }

  const castEntry = creature.encounterProfileId
    ? encounterCastByProfileId.get(creature.encounterProfileId)
    : undefined;

  return {
    dayLabel: weekdayNames[new Date(`${day.isoDate}T12:00:00`).getDay()] ?? 'Today',
    momentLabels: day.moments.map((moment) => moment.label).slice(0, 24),
    stepsBand: resolveStepsBand(day.stepsCount),
    visitedPlaceCount: day.visitedPlaceCount,
    newPlaceCount: day.newPlaceCount,
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
    },
    tonePreference: profile.preferenceIds[0] ?? null,
  };
}

export async function requestDayReflection(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile
): Promise<GeneratedDayReflection | null> {
  const payload = buildReflectionRequest(day, profile);
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

function resolveStepsBand(stepsCount: number): 'none' | 'light' | 'moderate' | 'high' {
  if (stepsCount <= 0) return 'none';
  if (stepsCount < 2500) return 'light';
  if (stepsCount < 7000) return 'moderate';
  return 'high';
}
