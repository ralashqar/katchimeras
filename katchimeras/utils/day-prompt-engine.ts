import { dayPromptRegistry, launchedDayPrompts, type Daypart, type DayPromptDefinition } from '@/constants/day-prompts';
import type { DayPromptKind, StoredHomeDayRecord } from '@/types/home';

const CAMERA_ROLL_PREFIX = 'camera-roll-photo-';

export type DayPromptPhotoCandidate = {
  assetId: string;
  thumbnailUri: string;
  localUri?: string;
  capturedAt: string;
  dayIsoDate?: string;
  source?: 'day_record' | 'camera_roll' | 'dev_override';
};

export type ActiveDayPrompt = DayPromptDefinition & {
  photoCandidates: DayPromptPhotoCandidate[];
};

export function selectActiveDayPrompt(
  day: StoredHomeDayRecord,
  now: Date = new Date(),
  options: {
    photoCandidates?: DayPromptPhotoCandidate[];
    forceMeaningfulPhoto?: boolean;
  } = {}
): ActiveDayPrompt | null {
  if (day.state === 'hatched') {
    return null;
  }

  const daypart = resolveDaypart(now);
  const answeredOrDismissed = new Set(day.promptAnswers.map((answer) => answer.kind));
  const photoCandidates = options.photoCandidates ?? collectDayPromptPhotoCandidates(day);
  const eligiblePhotoCount = countEligiblePhotoCandidatesForDay(photoCandidates, day.isoDate, options.forceMeaningfulPhoto === true);
  const order = rankPromptKinds(day, now, eligiblePhotoCount, options.forceMeaningfulPhoto === true);

  for (const kind of order) {
    if (answeredOrDismissed.has(kind)) {
      continue;
    }
    const prompt = dayPromptRegistry[kind];
    const isForcedMeaningfulPhoto = options.forceMeaningfulPhoto === true && kind === 'meaningful_photo';
    if (!prompt?.launchEnabled || (!isForcedMeaningfulPhoto && !prompt.dayparts.includes(daypart))) {
      continue;
    }
    if (prompt.photoGated && eligiblePhotoCount < (prompt.minPhotoCandidates ?? 1)) {
      continue;
    }
    if (kind === 'meaning' && !day.heroPhoto && !day.moments.some((moment) => moment.type === 'photo')) {
      continue;
    }

    return {
      ...prompt,
      photoCandidates: prompt.photoGated ? photoCandidates : [],
    };
  }

  const fallback = launchedDayPrompts.find(
    (prompt) =>
      prompt.id !== 'meaningful_photo' &&
      prompt.id !== 'meaning' &&
      prompt.dayparts.includes(daypart) &&
      !answeredOrDismissed.has(prompt.id)
  );

  return fallback ? { ...fallback, photoCandidates: [] } : null;
}

// Build a specific prompt by kind, applying the same gating used for the
// auto-selected prompt (launch-enabled, photo availability, photo-meaning needs
// a photo). Returns null when that prompt isn't currently answerable.
export function buildDayPromptByKind(
  day: StoredHomeDayRecord,
  kind: DayPromptKind,
  options: {
    photoCandidates?: DayPromptPhotoCandidate[];
    forceMeaningfulPhoto?: boolean;
    // When false (default) an already-answered prompt is excluded. The "Add to
    // today" menu passes true so every category stays visible/re-answerable —
    // the once-per-day restriction can be reinstated later by flipping this.
    includeAnswered?: boolean;
  } = {}
): ActiveDayPrompt | null {
  if (day.state === 'hatched') {
    return null;
  }
  const prompt = dayPromptRegistry[kind];
  if (!prompt?.launchEnabled) {
    return null;
  }
  if (!options.includeAnswered && day.promptAnswers.some((answer) => answer.kind === kind)) {
    return null;
  }
  const photoCandidates = options.photoCandidates ?? collectDayPromptPhotoCandidates(day);
  const eligiblePhotoCount = countEligiblePhotoCandidatesForDay(
    photoCandidates,
    day.isoDate,
    options.forceMeaningfulPhoto === true
  );
  if (prompt.photoGated && eligiblePhotoCount < (prompt.minPhotoCandidates ?? 1)) {
    return null;
  }
  if (kind === 'meaning' && !day.heroPhoto && !day.moments.some((moment) => moment.type === 'photo')) {
    return null;
  }
  return { ...prompt, photoCandidates: prompt.photoGated ? photoCandidates : [] };
}

// Every prompt the user could answer right now, for the "Add to today" menu.
// Daypart is intentionally ignored here — the menu lets the user pick any
// available category, not just the time-of-day suggestion. Photo-gated prompts
// only appear when recent photos exist (so "no photos → no Photo button").
export function listAvailableDayPrompts(
  day: StoredHomeDayRecord,
  now: Date = new Date(),
  options: { photoCandidates?: DayPromptPhotoCandidate[]; forceMeaningfulPhoto?: boolean } = {}
): ActiveDayPrompt[] {
  if (day.state === 'hatched') {
    return [];
  }
  const photoCandidates = options.photoCandidates ?? collectDayPromptPhotoCandidates(day);
  const available: ActiveDayPrompt[] = [];
  for (const prompt of launchedDayPrompts) {
    // "Photo meaning" is never a standalone button — it always follows a photo
    // pick as the second half of the Photo → meaning pair (see the sheet).
    if (prompt.id === 'meaning') {
      continue;
    }
    const built = buildDayPromptByKind(day, prompt.id, {
      photoCandidates,
      forceMeaningfulPhoto: options.forceMeaningfulPhoto,
      // Testing: keep answered categories in the menu so they can be re-fed.
      includeAnswered: true,
    });
    if (built) {
      available.push(built);
    }
  }

  // Stack the menu by how relevant each prompt is right now — most relevant
  // first — so it matches the surfaced question's ordering.
  const eligiblePhotoCount = countEligiblePhotoCandidatesForDay(
    photoCandidates,
    day.isoDate,
    options.forceMeaningfulPhoto === true
  );
  const order = rankPromptKinds(day, now, eligiblePhotoCount, options.forceMeaningfulPhoto === true);
  return available.sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
}

export function resolveDaypart(now: Date): Daypart {
  const hour = now.getHours();
  if (hour < 11) {
    return 'morning';
  }
  if (hour < 17) {
    return 'midday';
  }
  return 'evening';
}

// Fixed tiebreak when two prompts score equally.
const RANK_TIEBREAK: DayPromptKind[] = ['sleep', 'meaningful_photo', 'meaning', 'feeling', 'activity', 'people', 'hobby', 'day_word'];

// Rank the launched prompts by how relevant each is to the day RIGHT NOW — what
// the app has actually noticed: sleep first thing in the morning, the activity
// question after you've travelled, a photo worth keeping when the roll filled
// up, a reflection before bed. Opening the app surfaces the top one; the rest
// stack behind it in relevance order. Pure + deterministic.
export function rankPromptKinds(
  day: StoredHomeDayRecord,
  now: Date,
  photoCandidateCount: number,
  forceMeaningfulPhoto = false
): DayPromptKind[] {
  const hour = now.getHours();
  const isMorning = hour < 11;
  const isMidday = hour >= 11 && hour < 17;
  const isEvening = hour >= 17 && hour < 21;
  const isNight = hour >= 21;

  const vision = day.vision;
  const faces = vision?.maxFaceCount ?? 0;
  const concepts = new Set((vision?.concepts ?? []).map((concept) => concept.name));
  const traveled = day.newPlaceCount >= 1 || concepts.has('travel') || concepts.has('city');
  const moved = day.stepsCount >= 7000;
  const social = faces >= 2 || day.moments.some((moment) => moment.type === 'social');
  const minPhotos = dayPromptRegistry.meaningful_photo.minPhotoCandidates ?? 3;
  const hasPhotos = photoCandidateCount >= minPhotos;
  const hasHero = Boolean(day.heroPhoto);

  const score: Partial<Record<DayPromptKind, number>> = {
    // Morning open → "how did you sleep?" is the first thing.
    sleep: isMorning ? 10 : isMidday ? 3 : 0,
    // The day's photos are worth keeping — strongest in the evening wind-down.
    meaningful_photo:
      forceMeaningfulPhoto && !hasHero && photoCandidateCount > 0
        ? 100
        : hasPhotos && !hasHero
          ? 8 + (isEvening || isNight ? 2 : 0)
          : 0,
    // Always follows a chosen photo.
    meaning: hasHero ? 9 : 0,
    // Travel / a big moving day push the activity question up.
    activity: 4 + (traveled ? 5 : 0) + (moved ? 2 : 0) + (isMidday || isEvening ? 1 : 0),
    feeling: isMorning ? 5 : isEvening ? 4 : isMidday ? 3 : 2,
    people: (social ? 6 : 2) + (isEvening ? 1 : 0),
    hobby: 3 + (isEvening || isNight ? 1 : 0),
    // Before bed → "sum up your day".
    day_word: isNight ? 8 : isEvening ? 6 : 1,
  };

  return launchedDayPrompts
    .map((prompt) => prompt.id)
    .sort((left, right) => {
      const diff = (score[right] ?? 0) - (score[left] ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return RANK_TIEBREAK.indexOf(left) - RANK_TIEBREAK.indexOf(right);
    });
}

export function collectDayPromptPhotoCandidates(day: StoredHomeDayRecord): DayPromptPhotoCandidate[] {
  const seen = new Set<string>();
  const candidates: DayPromptPhotoCandidate[] = [];
  const sorted = [...day.locations].sort(
    (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
  );

  for (const point of sorted) {
    if (!point.hasPhoto || !point.thumbnailUri) {
      continue;
    }
    const assetId = point.id.startsWith(CAMERA_ROLL_PREFIX)
      ? point.id.slice(CAMERA_ROLL_PREFIX.length)
      : point.id.startsWith('photo-location-') && point.momentId
        ? point.momentId
        : point.id;
    if (!assetId || seen.has(assetId)) {
      continue;
    }
    seen.add(assetId);
    candidates.push({
      assetId,
      capturedAt: point.capturedAt,
      dayIsoDate: toLocalDateId(new Date(point.capturedAt)),
      thumbnailUri: point.thumbnailUri,
      source: 'day_record',
    });
  }

  return candidates.slice(0, 8);
}

function countEligiblePhotoCandidatesForDay(
  candidates: DayPromptPhotoCandidate[],
  isoDate: string,
  forceMeaningfulPhoto: boolean
) {
  if (forceMeaningfulPhoto) {
    return candidates.length;
  }
  return candidates.filter((candidate) => candidate.dayIsoDate === isoDate).length;
}

function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
