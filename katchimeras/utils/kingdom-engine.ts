import type { HomeDayRecord } from '@/types/home';
import type {
  KingdomBuilding,
  KingdomBuildingId,
  KingdomBuildingLevel,
  KingdomCreature,
  KingdomLandmark,
  KingdomPlot,
  KingdomState,
  KingdomTotals,
} from '@/types/kingdom';

// deriveKingdom — the pure fold from every day ever lived to the persistent
// Kingdom. No incremental updates, no stored world state: recomputing from the
// day archive is milliseconds at years of days, is immune to drift bugs, and
// backfills existing users' Kingdoms for free (the Hatch Your Past pattern).
//
// All days (including the still-forming one) feed building counts, so today's
// captures visibly tick the Kingdom the moment they land; only hatched days
// contribute creatures.

// Lifetime thresholds for levels 1..4, per building. Tuned for "level 1 on the
// first real signal, level 4 after months of living" — adjust freely, the fold
// re-derives everything.
const LEVEL_THRESHOLDS: Record<KingdomBuildingId, [number, number, number, number]> = {
  home: [1, 7, 30, 120], // days hatched
  memoryLibrary: [1, 25, 100, 300], // memories kept
  crossroads: [1, 10, 40, 120], // places given meaning
  journeyHall: [10_000, 100_000, 500_000, 2_000_000], // lifetime steps
  sanctuary: [1, 20, 80, 240], // reflections answered
  study: [1, 5, 20, 60], // inspirations kept
  foodPavilion: [1, 5, 20, 60], // food memories
};

const REFLECTIVE_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'gratitude', 'highlight', 'intention']);

function levelFor(count: number, thresholds: [number, number, number, number]): KingdomBuildingLevel {
  let level: KingdomBuildingLevel = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (count >= thresholds[i]) level = (i + 1) as KingdomBuildingLevel;
  }
  return level;
}

function nextLevelAt(count: number, thresholds: [number, number, number, number]): number | null {
  const next = thresholds.find((threshold) => count < threshold);
  return next ?? null;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return `${value}`;
}

function building(
  id: KingdomBuildingId,
  label: string,
  question: string,
  emoji: string,
  count: number,
  unit: string
): KingdomBuilding {
  const thresholds = LEVEL_THRESHOLDS[id];
  return {
    id,
    label,
    question,
    emoji,
    level: levelFor(count, thresholds),
    count,
    countLabel: `${formatCount(count)} ${unit}`,
    nextLevelAt: nextLevelAt(count, thresholds),
  };
}

export function deriveKingdom(days: HomeDayRecord[]): KingdomState {
  const totals: KingdomTotals = {
    daysLived: days.length,
    daysHatched: 0,
    memories: 0,
    photos: 0,
    notes: 0,
    places: 0,
    steps: 0,
    reflections: 0,
    foodMoments: 0,
    studioMoments: 0,
    bigMoments: 0,
  };
  const creatures: KingdomCreature[] = [];
  const landmarks: KingdomLandmark[] = [];

  for (const day of days) {
    if (day.state === 'hatched') totals.daysHatched += 1;

    const photos = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
    const notes = day.notes?.length ?? 0;
    totals.photos += photos;
    totals.notes += notes;
    totals.memories += photos + notes;

    // Places that were given meaning count first; a day with visits but no
    // confirmations still contributes what it can.
    totals.places += Math.max(day.confirmedPlaces?.length ?? 0, day.visitedPlaceCount ?? 0);
    totals.steps += day.stepsCount ?? 0;
    totals.reflections += (day.promptAnswers ?? []).filter(
      (answer) => !answer.dismissed && REFLECTIVE_KINDS.has(answer.kind) && answer.choiceIds.length > 0
    ).length;
    totals.foodMoments += day.foodMoments?.length ?? 0;
    totals.studioMoments += day.studioMoments?.length ?? 0;
    totals.bigMoments += day.bigMoments?.length ?? 0;

    for (const moment of day.bigMoments ?? []) {
      landmarks.push({
        id: moment.id,
        type: moment.type,
        label: moment.label,
        subject: moment.subject,
        dayId: day.id,
        isoDate: day.isoDate,
      });
    }

    if (day.state === 'hatched' && day.creature) {
      creatures.push({
        dayId: day.id,
        isoDate: day.isoDate,
        creatureId: day.creature.id,
        name: day.creature.name,
        visualKey: day.creature.visualKey,
        rarity: day.creature.rarity,
        accentColor: day.creature.accentColor,
      });
    }
  }

  landmarks.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  creatures.sort((a, b) => b.isoDate.localeCompare(a.isoDate));

  const buildings: KingdomBuilding[] = [
    building('home', 'Home', "What is today's story?", '🏠', totals.daysHatched, totals.daysHatched === 1 ? 'day' : 'days'),
    building('memoryLibrary', 'Memory Library', 'What do I want to remember?', '📦', totals.memories, totals.memories === 1 ? 'memory' : 'memories'),
    building('crossroads', 'Crossroads', 'Where did I go?', '🗺', totals.places, totals.places === 1 ? 'place' : 'places'),
    building('journeyHall', 'Journey Hall', 'How did I move through life?', '🛤', totals.steps, 'steps'),
    building('sanctuary', 'Sanctuary', 'How did life feel?', '🌿', totals.reflections, totals.reflections === 1 ? 'reflection' : 'reflections'),
    building('study', 'Study', 'What inspired me?', '📚', totals.studioMoments, totals.studioMoments === 1 ? 'inspiration' : 'inspirations'),
    building('foodPavilion', 'Food Pavilion', 'What did I savour?', '🍽', totals.foodMoments, totals.foodMoments === 1 ? 'meal' : 'meals'),
  ];

  return {
    version: 1,
    builtFromDayCount: days.length,
    buildings,
    creatures,
    landmarks,
    totals,
  };
}

// --- Expansion plots (K4) ---------------------------------------------------
// Cadence (docs §2/§8 default): the first islet at 30 days lived, another every
// 60 after, plus one per legendary discovery. Pure derivation — plots can never
// be lost, only gained; capped by the dock ring around the island.

export const MAX_KINGDOM_PLOTS = 8;
const FIRST_PLOT_AT_DAYS = 30;
const PLOT_EVERY_DAYS = 60;

export function deriveKingdomPlots(totals: KingdomTotals, legendaryDiscoveries = 0): KingdomPlot[] {
  const fromDays =
    totals.daysLived < FIRST_PLOT_AT_DAYS ? 0 : 1 + Math.floor((totals.daysLived - FIRST_PLOT_AT_DAYS) / PLOT_EVERY_DAYS);
  const earned = Math.min(MAX_KINGDOM_PLOTS, fromDays + Math.max(0, legendaryDiscoveries));
  return Array.from({ length: earned }, (_, index) => {
    const fromDay = index < fromDays;
    return {
      id: `plot-${index + 1}`,
      index,
      label: `Garden ${index + 1}`,
      earnedFrom: fromDay
        ? `${index === 0 ? FIRST_PLOT_AT_DAYS : FIRST_PLOT_AT_DAYS + index * PLOT_EVERY_DAYS} days lived`
        : 'A legendary discovery',
    };
  });
}
