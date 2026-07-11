import { encounterCastBySeedId } from '@/constants/encounter-cast';
import { homeMomentOptions } from '@/constants/home-mvp';
import type { DayTag, StoredHomeDayRecord } from '@/types/home';
import { extractEncounterCandidates } from '@/utils/encounter-engine';
import { conceptSeedId, pickProminentTags } from '@/utils/vision-signals';
import { visionSignalIsRejected } from '@/utils/intelligence/classification-policy';

// The day-tag field: one weighted, source-tagged chip per signal the day
// surfaced, unified across moments, prompts, vision, places, steps, capture, and
// weather. These are what orbit the egg — sized by weight, glowing toward the
// candidate creature(s) they feed. Pure: deterministic from the stored day, so
// it is verifiable in the Node harness and identical across re-derivations.

const STEPS_TAG_THRESHOLD = 2500;
const STEPS_FULL = 12_000;
const SCORE_NORMALIZER = 0.34; // the largest single moment/prompt scoreBias
const MAX_VISION_TAGS = 4;

const SOURCE_ACCENT: Record<DayTag['source'], string> = {
  moment: '#A8C4FF',
  prompt: '#D8B4FE',
  vision: '#7DE8CD',
  place: '#FFC36B',
  steps: '#9AE6B4',
  studio: '#C7B8FF',
  capture: '#F5A6C8',
  weather: '#BFD3FF',
};

export function buildDayTags(day: StoredHomeDayRecord): DayTag[] {
  // Seed → the candidate creature it would feed (history-independent: we only
  // need the seed → profileId mapping, so an empty history is fine).
  const seedToProfile = new Map<string, string>();
  for (const candidate of extractEncounterCandidates(day, {})) {
    seedToProfile.set(candidate.castEntry.seedId, candidate.profile.id);
  }
  const feedsFor = (seedId: string | null): string[] => {
    if (!seedId) return [];
    const profileId = seedToProfile.get(seedId);
    return profileId ? [profileId] : [];
  };

  const tags: DayTag[] = [];

  day.moments.forEach((moment) => {
    const option = homeMomentOptions[moment.type];
    tags.push({
      id: `tag-moment-${moment.id}`,
      label: moment.label,
      icon: moment.icon,
      accentColor: moment.accentColor,
      weight: normalizeBias(option?.scoreBias),
      feedsSpecies: feedsFor(momentSeedId(moment.type)),
      source: 'moment',
    });
  });

  day.promptAnswers
    .filter((answer) => !answer.dismissed && answer.labels.length > 0)
    .forEach((answer) => {
      const seedIds = (answer.encounterSeedBias ?? []).map((bias) => bias.seedId);
      tags.push({
        id: `tag-prompt-${answer.id}`,
        label: answer.labels.join(' · '),
        icon: 'sparkles',
        accentColor: SOURCE_ACCENT.prompt,
        weight: normalizeBias(answer.scoreBias),
        feedsSpecies: dedupe(seedIds.flatMap(feedsFor)),
        source: 'prompt',
      });
    });

  if (day.vision) {
    pickProminentTags(day.vision, MAX_VISION_TAGS)
      .filter((concept) => !visionSignalIsRejected(day, concept))
      .forEach((concept, index) => {
      const seedId = conceptSeedId(concept);
      const conceptEntry = day.vision?.concepts.find((entry) => entry.name === concept);
      tags.push({
        id: `tag-vision-${concept}`,
        label: humanize(concept),
        icon: 'sparkles',
        accentColor: SOURCE_ACCENT.vision,
        weight: clamp01(0.45 + 0.4 * (conceptEntry?.coverage ?? 0) - index * 0.04),
        feedsSpecies: feedsFor(seedId),
        source: 'vision',
      });
      });
  }

  (day.placeCategorySeeds ?? []).forEach((seedId, index) => {
    const castEntry = encounterCastBySeedId.get(seedId);
    tags.push({
      id: `tag-place-${seedId}-${index}`,
      label: castEntry?.categoryLabel ?? humanize(seedId),
      icon: 'mappin.and.ellipse',
      accentColor: SOURCE_ACCENT.place,
      weight: index === 0 ? 0.62 : 0.54,
      feedsSpecies: feedsFor(seedId),
      source: 'place',
    });
  });

  if (day.stepsCount >= STEPS_TAG_THRESHOLD || day.stepsInterpretation) {
    const stepsSeed = day.stepsCount >= 6500 ? 'high_steps_day' : null;
    // An interpreted day leads with WHAT it was (a hike), steps as colour.
    const interp = day.stepsInterpretation;
    const stepsLabel = day.stepsCount >= STEPS_TAG_THRESHOLD ? `${day.stepsCount.toLocaleString()} steps` : null;
    tags.push({
      id: 'tag-steps',
      label: interp ? (stepsLabel ? `${interp.label} · ${stepsLabel}` : interp.label) : (stepsLabel ?? 'A walk'),
      icon: homeMomentOptions.walk.icon,
      accentColor: SOURCE_ACCENT.steps,
      // An interpreted active day is a stronger signal than raw steps alone.
      weight: clamp01(Math.max((day.stepsCount / STEPS_FULL) * 0.8, interp ? 0.6 : 0)),
      feedsSpecies: feedsFor(stepsSeed),
      source: 'steps',
    });
  }

  // The Studio — one chip per inspiration the day took in (most recent first, capped).
  (day.studioMoments ?? [])
    .slice(-3)
    .reverse()
    .forEach((item) => {
      tags.push({
        id: `tag-studio-${item.id}`,
        label: item.label,
        icon: item.mediaType === 'film' || item.mediaType === 'show' ? 'film.fill' : 'book.fill',
        accentColor: SOURCE_ACCENT.studio,
        weight: item.rating === 'loved' || item.rating === 'inspired' ? 0.6 : 0.46,
        feedsSpecies: [],
        source: 'studio',
      });
    });

  if (day.capturedEnergy && Object.keys(day.capturedEnergy).length > 0) {
    const peak = Math.max(0, ...Object.values(day.capturedEnergy));
    tags.push({
      id: 'tag-capture',
      label: 'Captured',
      icon: 'sparkles',
      accentColor: SOURCE_ACCENT.capture,
      weight: clamp01(0.4 + peak),
      feedsSpecies: [],
      source: 'capture',
    });
  }

  if (day.weather) {
    tags.push({
      id: 'tag-weather',
      label: weatherTagLabel(day.weather.condition),
      icon: 'cloud.fill',
      accentColor: SOURCE_ACCENT.weather,
      weight: 0.3,
      feedsSpecies: [],
      source: 'weather',
    });
  }

  return tags.sort((left, right) => right.weight - left.weight);
}

function momentSeedId(type: StoredHomeDayRecord['moments'][number]['type']): string | null {
  if (type === 'coffee') return 'coffee_shop';
  if (type === 'walk') return 'park';
  if (type === 'social') return 'social_gathering';
  if (type === 'calm') return 'home_evening';
  return null;
}

function normalizeBias(bias: Partial<Record<string, number>> | undefined): number {
  if (!bias) return 0.3;
  const peak = Math.max(0, ...Object.values(bias).map((value) => value ?? 0));
  return clamp01(peak / SCORE_NORMALIZER);
}

function weatherTagLabel(condition: string): string {
  return humanize(condition);
}

function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// Re-export for callers that want the source palette (the orbiter component).
export const dayTagSourceAccent = SOURCE_ACCENT;
