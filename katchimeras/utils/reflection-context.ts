import type { StoredHomeDayRecord } from '@/types/home';
import { visionSignalIsRejected } from '@/utils/intelligence/classification-policy';
import { forcesIndoors, isFairWeather } from '@/utils/day-weather';
import { computeDaySpanMeters } from '@/utils/living-rarity';
import { pickProminentTags } from '@/utils/vision-signals';

// The temporal + relational context the nightly line needs to feel like the app
// is watching your actual life, not rolling dice. The encounter engine answers
// "which creature is today"; this module answers the two questions that defeat
// staleness on even the thinnest day:
//   1. Mood — the emotional read of THIS day (cozy / restless / tender / defiant).
//   2. Bond depth — how this fits your HISTORY with this creature
//      (fresh / familiar / deep / knowing), where a run of consecutive days
//      forces "knowing" so day-5-home can never read like day-1-home.
// These two orthogonal axes are the same axes that will later index the 16-cell
// expression grid. Everything here is pure (day + the days before it) so it runs
// in the Node harness and carries no I/O.

export type DayMood = 'cozy' | 'restless' | 'tender' | 'defiant';
export type BondDepth = 'fresh' | 'familiar' | 'deep' | 'knowing';

// A compact note about one earlier meeting with the same creature — the raw
// material for "the fourth rainy Sunday we've spent here". Abstract content only.
export type PriorVisitNote = {
  weekday: string;
  rarity: string;
  daysAgo: number;
  subject: string | null;
};

export type ReflectionContext = {
  mood: DayMood;
  bondDepth: BondDepth;
  // Days in a row (ending today) that hatched THIS same creature.
  consecutiveDays: number;
  // Calendar gap since the previous meeting with this creature (null if first).
  daysSinceLastVisit: number | null;
  // Today is a restful day arriving after a run of busy ones — the "you finally
  // exhaled" read that a single-day snapshot can never see.
  recoveryAfterBusy: boolean;
  busyDaysBefore: number;
  // What yesterday hatched into (name only) — lets the line acknowledge the turn.
  previousDayCreature: string | null;
  // Up to 5 recent meetings with this creature, newest first.
  priorVisits: PriorVisitNote[];
  // Light shape-of-the-day tags (late wake, restless indoors, barely moved…).
  dayShape: string[];
};

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Warm, comfort/affection photo subjects — their presence tilts the day toward
// "cozy" rather than the depleted "tender" default.
const WARM_SUBJECTS = new Set([
  'coffee',
  'bakery',
  'food',
  'dessert',
  'bubble_tea',
  'dog',
  'cat',
  'baby',
  'flowers',
  'celebration',
]);

const STAY_PUT_METERS = 1200;
const RESTLESS_STEP_FLOOR = 5000;
const BOLD_STEP_FLOOR = 8000;
const COZY_STEP_CEILING = 7000;
const RESTFUL_STEP_CEILING = 6500;
const ROAMING_METERS = 8000;

// Bond-depth thresholds by lifetime visit count; a current consecutive streak
// can elevate beyond these (see classifyBondDepth).
const FAMILIAR_VISITS = 3;
const DEEP_VISITS = 10;
const KNOWING_VISITS = 30;
const KNOWING_STREAK = 4;
const FAMILIAR_STREAK = 2;

const BOND_RANK: Record<BondDepth, number> = { fresh: 0, familiar: 1, deep: 2, knowing: 3 };
const BOND_BY_RANK: BondDepth[] = ['fresh', 'familiar', 'deep', 'knowing'];

export function buildReflectionContext(
  day: StoredHomeDayRecord,
  pastDays: readonly StoredHomeDayRecord[] = []
): ReflectionContext {
  const profileId = day.creature?.encounterProfileId ?? null;
  const visitCount = day.creature?.bondVisitCount ?? (day.creature?.repeatDepth ?? 0) + 1;

  // Index the days before today by calendar date for contiguity checks. Anything
  // dated on/after today is irrelevant to "what led up to this day".
  const byDate = new Map<string, StoredHomeDayRecord>();
  for (const past of pastDays) {
    if (past.id === day.id) continue;
    if (dayDiff(day.isoDate, past.isoDate) <= 0) continue;
    const existing = byDate.get(past.isoDate);
    // Prefer the hatched record if duplicates of a date exist.
    if (!existing || (!existing.creature && past.creature)) {
      byDate.set(past.isoDate, past);
    }
  }

  const consecutiveDays = countConsecutive(day.isoDate, byDate, (record) =>
    profileId ? record.creature?.encounterProfileId === profileId : false
  );

  const busyDaysBefore = countConsecutive(day.isoDate, byDate, isBusyDay);
  const recoveryAfterBusy = busyDaysBefore >= 2 && isRestfulDay(day);

  const previousDay = byDate.get(shiftIso(day.isoDate, -1)) ?? null;
  const previousDayCreature = previousDay?.creature?.name ?? null;

  const priorVisits: PriorVisitNote[] = profileId
    ? [...byDate.values()]
        .filter((record) => record.creature?.encounterProfileId === profileId)
        .sort((left, right) => dayDiff(right.isoDate, left.isoDate))
        .slice(0, 5)
        .map((record) => ({
          weekday: weekdayName(record.isoDate),
          rarity: record.creature?.rarity ?? 'common',
          daysAgo: dayDiff(day.isoDate, record.isoDate),
          subject: record.vision ? pickProminentTags(record.vision, 1)[0] ?? null : null,
        }))
    : [];

  const daysSinceLastVisit = priorVisits[0]?.daysAgo ?? null;
  const mood = classifyMood(day);
  const bondDepth = classifyBondDepth(visitCount, consecutiveDays);

  return {
    mood,
    bondDepth,
    consecutiveDays,
    daysSinceLastVisit,
    recoveryAfterBusy,
    busyDaysBefore,
    previousDayCreature,
    priorVisits,
    dayShape: buildDayShape(day),
  };
}

// The emotional texture of the day, read from movement, place spread, time
// shape, and what the photos held. Ambiguous / depleted days fall through to
// "tender" on purpose — a quiet sick day misread as a lazy joke is the exact
// spell-breaker to avoid.
export function classifyMood(day: StoredHomeDayRecord): DayMood {
  if (hasPromptTag(day, 'feeling:low') || hasPromptTag(day, 'feeling:drained') || hasPromptTag(day, 'body:tired')) {
    return 'tender';
  }
  if (hasPromptTag(day, 'feeling:stressed') || hasPromptTag(day, 'restless_day')) {
    return 'restless';
  }
  if (hasPromptTag(day, 'feeling:calm') || hasPromptTag(day, 'feeling:loved') || hasPromptTag(day, 'meaning:peaceful')) {
    return 'cozy';
  }
  if (hasPromptTag(day, 'feeling:energized')) {
    return 'defiant';
  }

  const span = computeDaySpanMeters(day.locations);
  const stayedPut = day.locations.length < 2 || span <= STAY_PUT_METERS;
  const steps = day.stepsCount;
  const concepts = day.vision?.concepts
    .map((concept) => concept.name)
    .filter((concept) => !visionSignalIsRejected(day, concept)) ?? [];
  const warm = concepts.some((name) => WARM_SUBJECTS.has(name));
  // Weather that "did the deciding" — a rainy/snowy stay-in is cozy or forced,
  // never a defiant choice to skip a beautiful day. Prefer the resolved weather
  // (forecast or vision); fall back to the raw vision concepts.
  const forcedIn =
    forcesIndoors(day.weather) || concepts.includes('rain') || concepts.includes('snow');
  // A genuinely fair day you stayed in for is the strongest "chose it" signal.
  const fairOut = isFairWeather(day.weather);
  const weekend = isWeekend(day.isoDate);
  // A late start to a low-key day reads gentler — nudges an ambiguous stay-in
  // toward tender rather than a chosen, defiant one.
  const lateStart = earliestActivityHour(day) >= 10;

  // Stayed in one place but kept moving — pacing, chores, restless energy.
  if (stayedPut && steps >= RESTLESS_STEP_FLOOR) {
    return 'restless';
  }
  // Out in the world on your own terms — far roaming, somewhere new, real
  // distance. Bold rather than cozy.
  if (!stayedPut && (day.newPlaceCount >= 1 || span >= ROAMING_METERS || steps >= BOLD_STEP_FLOOR)) {
    return 'defiant';
  }
  // Chose stillness on a day you could have gone out — a settled weekend with
  // warm, comfort-shaped photos, fair weather, and no late, depleted start.
  if (stayedPut && weekend && warm && !forcedIn && !lateStart && (fairOut || day.weather === undefined)) {
    return 'defiant';
  }
  // Settled and warm: comfort photos (a rainy tea day lands here), or a pleasant
  // moderate day out.
  if (warm && steps < COZY_STEP_CEILING) {
    return 'cozy';
  }
  if (!stayedPut && steps >= 3000) {
    return 'cozy';
  }
  // Depleted or simply too thin to read — gentle by default.
  return 'tender';
}

function hasPromptTag(day: StoredHomeDayRecord, tag: string): boolean {
  return day.promptAnswers.some((answer) => !answer.dismissed && answer.semanticTags.includes(tag));
}

// How deep the relationship is, by lifetime visits, with a current streak able
// to elevate it: four quiet days in a row reads as "knowing" no matter the
// lifetime total, so a recurring rut is met with recognition, not a reset.
export function classifyBondDepth(visitCount: number, consecutiveDays: number): BondDepth {
  let depth: BondDepth = 'fresh';
  if (visitCount >= KNOWING_VISITS) depth = 'knowing';
  else if (visitCount >= DEEP_VISITS) depth = 'deep';
  else if (visitCount >= FAMILIAR_VISITS) depth = 'familiar';

  if (consecutiveDays >= KNOWING_STREAK) depth = maxDepth(depth, 'knowing');
  else if (consecutiveDays >= FAMILIAR_STREAK) depth = maxDepth(depth, 'familiar');

  return depth;
}

function buildDayShape(day: StoredHomeDayRecord): string[] {
  const tags: string[] = [];
  const hours = collectActivityHours(day);
  const earliest = hours.length ? Math.min(...hours) : null;

  if (earliest !== null && earliest >= 10) tags.push('late_wake');
  if (hours.some((hour) => hour >= 23 || hour < 3)) tags.push('late_night');

  const span = computeDaySpanMeters(day.locations);
  const stayedPut = day.locations.length < 2 || span <= STAY_PUT_METERS;
  if (stayedPut && day.stepsCount >= RESTLESS_STEP_FLOOR) tags.push('restless_indoors');
  if (day.stepsCount < 1500) tags.push('barely_moved');
  if ((day.vision?.analyzedPhotoCount ?? 0) === 0) tags.push('no_photos');
  if (isWeekend(day.isoDate)) tags.push('weekend');

  return tags;
}

function isBusyDay(day: StoredHomeDayRecord): boolean {
  return (
    day.stepsCount >= BOLD_STEP_FLOOR ||
    day.newPlaceCount >= 2 ||
    day.visitedPlaceCount >= 4 ||
    computeDaySpanMeters(day.locations) >= ROAMING_METERS
  );
}

function isRestfulDay(day: StoredHomeDayRecord): boolean {
  return (
    day.stepsCount < RESTFUL_STEP_CEILING &&
    day.newPlaceCount === 0 &&
    computeDaySpanMeters(day.locations) < ROAMING_METERS
  );
}

// Walk backwards from the day before `fromIso`, counting contiguous calendar
// days that satisfy `predicate`. Includes today in the count when today itself
// qualifies (callers pass predicates that hold for today by construction).
function countConsecutive(
  fromIso: string,
  byDate: Map<string, StoredHomeDayRecord>,
  predicate: (record: StoredHomeDayRecord) => boolean
): number {
  let count = 1;
  for (let back = 1; back < 400; back += 1) {
    const record = byDate.get(shiftIso(fromIso, -back));
    if (!record || !predicate(record)) break;
    count += 1;
  }
  return count;
}

function earliestActivityHour(day: StoredHomeDayRecord): number {
  const hours = collectActivityHours(day);
  return hours.length ? Math.min(...hours) : 0;
}

function collectActivityHours(day: StoredHomeDayRecord): number[] {
  const hours: number[] = [];
  const push = (iso: string | undefined | null) => {
    if (!iso) return;
    const time = new Date(iso);
    if (!Number.isNaN(time.getTime())) hours.push(time.getHours());
  };
  day.locations.forEach((point) => push(point.capturedAt));
  day.moments.forEach((moment) => push(moment.createdAt));
  return hours;
}

function maxDepth(left: BondDepth, right: BondDepth): BondDepth {
  return BOND_BY_RANK[Math.max(BOND_RANK[left], BOND_RANK[right])];
}

function weekdayIndex(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay();
}

function weekdayName(iso: string): string {
  return WEEKDAY_NAMES[weekdayIndex(iso)] ?? 'a day';
}

function isWeekend(iso: string): boolean {
  const index = weekdayIndex(iso);
  return index === 0 || index === 6;
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T12:00:00`).getTime();
  const b = new Date(`${bIso}T12:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}
