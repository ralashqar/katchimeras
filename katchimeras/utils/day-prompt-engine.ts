import { dayPromptRegistry, launchedDayPrompts, type Daypart, type DayPromptDefinition } from '@/constants/day-prompts';
import type { DayPromptKind, StoredHomeDayRecord } from '@/types/home';

const CAMERA_ROLL_PREFIX = 'camera-roll-photo-';
const PHOTO_PROMPT_EARLIEST_HOUR = 17;

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
  const order = promptOrderForDaypart(daypart, day, eligiblePhotoCount, now, options.forceMeaningfulPhoto === true);

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

function promptOrderForDaypart(
  daypart: Daypart,
  day: StoredHomeDayRecord,
  photoCandidateCount: number,
  now: Date,
  forceMeaningfulPhoto: boolean
): DayPromptKind[] {
  if (forceMeaningfulPhoto && !day.heroPhoto && photoCandidateCount > 0) {
    return ['meaningful_photo', 'meaning', 'day_word', 'feeling', 'people', 'activity'];
  }
  if (daypart === 'morning') {
    return ['feeling', 'people'];
  }
  if (daypart === 'midday') {
    return ['activity', 'people', 'feeling'];
  }

  const photoRich =
    !day.heroPhoto &&
    photoCandidateCount >= (dayPromptRegistry.meaningful_photo.minPhotoCandidates ?? 3) &&
    now.getHours() >= PHOTO_PROMPT_EARLIEST_HOUR;
  if (photoRich) {
    return ['meaningful_photo', 'meaning', 'day_word', 'feeling', 'people', 'activity'];
  }
  if (day.heroPhoto) {
    return ['meaning', 'day_word', 'feeling', 'people', 'activity'];
  }
  return ['day_word', 'feeling', 'people', 'activity'];
}

function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
