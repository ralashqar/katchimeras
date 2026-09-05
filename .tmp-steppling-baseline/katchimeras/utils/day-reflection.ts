import creaturePersonas from '@/data/katchimeras/creature-personas.json';
import { encounterCastByProfileId } from '@/constants/encounter-cast';
import type { StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { buildReflectionContext } from '@/utils/reflection-context';
import { weatherLabel } from '@/utils/day-weather';
import { supabase } from '@/utils/supabase';
import { pickProminentTags } from '@/utils/vision-signals';
import { visionSignalIsRejected } from '@/utils/intelligence/classification-policy';
import { projectDayPhotoSubjects } from '@/utils/intelligence/photo-subject-projection';

// Per-creature character bible: a persona paragraph plus one short voice note
// for each mood and each bond depth. The narrator composes within these instead
// of inventing freely, so the character never drifts.
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

// Privacy contract: the default reflection request carries labels, categories,
// counts, weather labels, creature metadata, and abstract photo subject words -
// never coordinates, photo URIs, place names, raw OCR, freeform user text, or
// identifiers. `pastDays` stays on-device: only derived temporal context is sent.
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
  const promptSummary = buildPromptReflectionSummary(day);
  const classifiedSubjects = projectDayPhotoSubjects(day, 4).map((subject) => subject.value);
  const fallbackTags = day.vision ? pickProminentTags(day.vision) : [];
  const prominentTags = [...new Set([...classifiedSubjects, ...fallbackTags])]
    .filter((tag) => !visionSignalIsRejected(day, tag))
    .slice(0, 4);

  return {
    dayLabel: weekdayNames[new Date(`${day.isoDate}T12:00:00`).getDay()] ?? 'Today',
    momentLabels: day.moments.map((moment) => moment.label).slice(0, 24),
    stepsBand: resolveStepsBand(day.stepsCount),
    visitedPlaceCount: day.visitedPlaceCount,
    newPlaceCount: day.newPlaceCount,
    prominentTags,
    // Specific camera-derived object descriptions are allowed; OCR text is not
    // sent in the default nightly reflection.
    photoDetails: (day.vision?.details ?? []).filter((detail) => !visionSignalIsRejected(day, detail)),
    character: {
      name: creature.name,
      encounterCue: castEntry?.categoryLabel ?? null,
      repeatDepth: creature.repeatDepth,
      voice: castEntry?.voice ?? FALLBACK_VOICE,
      rarity: creature.rarity,
      rarityReason: creature.rarityReason ?? null,
      bondStage: creature.bondStage ?? 0,
      bondVisitCount: creature.bondVisitCount ?? creature.repeatDepth + 1,
      persona: persona?.persona ?? null,
      moodGuidance: persona?.moods[context.mood] ?? null,
      bondGuidance: persona?.bond[context.bondDepth] ?? null,
    },
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
    promptFacts: promptSummary,
    weather: day.weather
      ? { condition: day.weather.condition, label: weatherLabel(day.weather.condition), tempMaxC: day.weather.tempMaxC ?? null }
      : null,
    tonePreference: profile.preferenceIds[0] ?? null,
  };
}

function buildPromptReflectionSummary(day: StoredHomeDayRecord) {
  const activeAnswers = day.promptAnswers.filter((answer) => !answer.dismissed);
  const labelsFor = (kind: string) =>
    activeAnswers
      .filter((answer) => answer.kind === kind)
      .flatMap((answer) => answer.labels)
      .slice(0, 8);
  const dayWord = labelsFor('day_word')[0] ?? null;

  return {
    feelings: labelsFor('feeling'),
    peopleLabels: labelsFor('people'),
    activityLabels: labelsFor('activity'),
    meaningLabels: labelsFor('meaning'),
    dayWord,
    dayFocus: labelsFor('day_focus')[0] ?? null,
    dayCharacter: labelsFor('day_character')[0] ?? null,
    dayOutcome: labelsFor('day_outcome')[0] ?? null,
    forWho: labelsFor('for_who')[0] ?? null,
    pace: labelsFor('energy')[0] ?? null,
    intention: labelsFor('intention')[0] ?? null,
    heroPhotoMeaning: day.heroPhoto?.meaningLabels ?? [],
    hasUserWrittenNote: activeAnswers.some((answer) => Boolean(answer.noteText?.trim())),
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

// On-demand LLM panel captions for the 4-panel comic. Uses the same default
// privacy-clean payload as reflection, plus opt-in OCR detail for this explicit
// story/comic request. Failure falls back to local templated beats.
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
      body: { ...payload, signText: day.vision ? day.vision.textTokens.slice(0, 12) : [], wantComic: true },
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
