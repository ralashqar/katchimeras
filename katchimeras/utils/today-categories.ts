import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayMapNode, HomeDayRecord } from '@/types/home';
import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { MemoryQuest } from '@/utils/memory-quests-engine';
import { acceptedFoodDetection, acceptedStudioDetection } from '@/utils/intelligence/classification-policy';
import { buildMomentTimeline } from '@/utils/moment-timeline';

// The Today screen's single source of category state: one entry per life
// category orbiting the egg — what it has, whether it's asking for attention,
// and why. A facade over the same signals the World structures read
// (day-prompt-engine photos prompt, unconfirmed places, steps spikes, mood /
// sleep gaps, food & studio vision detections, Memory Quests) so Today and any
// other surface agree on "what needs review".

export type TodayCategoryId =
  | 'photos'
  | 'notes'
  | 'places'
  | 'journey'
  | 'reflection'
  | 'food'
  | 'studio'
  | 'sleep'
  | 'mood'
  | 'quests';

export type TodayCategoryState = {
  id: TodayCategoryId;
  label: string;
  icon: IconSymbolName;
  accent: string;
  // How much of the day lives in this category (steps use countLabel instead).
  count: number;
  countLabel?: string;
  hasContent: boolean;
  // The category is asking a contextual question (golden glow on its icon).
  needsAttention: boolean;
  glowReason?: string;
  // Mood only: the logged mood's state key (radiant/light/meh/heavy/stormy) —
  // drives the chip's face art.
  variant?: string;
};

type DeriveOptions = {
  // The forming day's available prompts (photos attention reads these).
  prompts: ActiveDayPrompt[];
  // The day's Memory Quests (selectMemoryQuests output).
  quests: MemoryQuest[];
  // Recent hatched-day average, for the steps-spike read. Null = unknown.
  recentAvgSteps?: number | null;
  // The photo-candidate signature the user already engaged with (see
  // photoPromptSignature) — matching signature suppresses the photos glow.
  handledPhotoSig?: string | null;
};

// Signature of the current photo candidates — changes when new photos appear,
// which re-arms the photos attention after a dismissal.
export function photoPromptSignature(prompts: ActiveDayPrompt[]): string | null {
  const prompt = prompts.find((p) => p.id === 'meaningful_photo' && p.photoCandidates.length > 0);
  return prompt ? prompt.photoCandidates.map((candidate) => candidate.assetId).join('|') : null;
}

// The first detected stop the user hasn't given meaning to yet (home excluded).
export function findUnconfirmedPlace(day: HomeDayRecord): DayMapNode | null {
  const nodes = day.dayMap?.nodes ?? [];
  if (nodes.length === 0) return null;
  const confirmed = new Set((day.confirmedPlaces ?? []).map((place) => place.id));
  return nodes.find((node) => !confirmed.has(node.id) && node.type !== 'home') ?? null;
}

// Steps spike: an unmistakably active day (7k+) or well above the recent norm,
// not yet interpreted (same read as the World Journey "!").
export function stepsNeedInterpreting(day: HomeDayRecord, recentAvgSteps?: number | null): boolean {
  if (day.stepsInterpretation) return false;
  const steps = day.stepsCount ?? 0;
  const spike = recentAvgSteps ? steps >= Math.max(4500, recentAvgSteps * 1.6) : false;
  return steps >= 7000 || spike;
}

function hasFeelingAnswer(day: HomeDayRecord): boolean {
  return (day.promptAnswers ?? []).some(
    (answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0
  );
}

// The day's LAST logged mood → icon + accent for the mood orbit icon (same
// faces/tints as the Mood Monument sheet's choices).
const MOOD_META: Record<string, { icon: IconSymbolName; accent: string }> = {
  energized: { icon: 'face.very_happy', accent: '#FFC36B' },
  good: { icon: 'face.happy', accent: '#FFE08A' },
  calm: { icon: 'face.happy', accent: '#91D8C7' },
  loved: { icon: 'face.happy', accent: '#F49AC1' },
  meh: { icon: 'face.neutral', accent: '#A7D5FF' },
  drained: { icon: 'face.sad', accent: '#91D8C7' },
  low: { icon: 'face.sad', accent: '#91D8C7' },
  stressed: { icon: 'face.very_sad', accent: '#C77DFF' },
};

// Choice id → mood STATE (must mirror mood-monument-sheet's MOOD_CHOICES).
const MOOD_STATE: Record<string, string> = {
  energized: 'radiant',
  good: 'light',
  calm: 'light',
  loved: 'light',
  meh: 'meh',
  drained: 'heavy',
  low: 'heavy',
  stressed: 'stormy',
};

function latestMoodChoice(day: HomeDayRecord): string | null {
  const latest = [...(day.promptAnswers ?? [])]
    .reverse()
    .find((answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0);
  return latest?.choiceIds[0] ?? null;
}

function latestMoodMeta(day: HomeDayRecord): { icon: IconSymbolName; accent: string } | null {
  const latest = [...(day.promptAnswers ?? [])]
    .reverse()
    .find((answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0);
  const choice = latest?.choiceIds[0];
  return (choice && MOOD_META[choice]) || null;
}

function formatSteps(steps: number): string {
  if (steps >= 1000) return `${(steps / 1000).toFixed(steps >= 10000 ? 0 : 1)}k`;
  return `${steps}`;
}

export function deriveTodayCategories(day: HomeDayRecord, options: DeriveOptions): TodayCategoryState[] {
  const { prompts, quests, recentAvgSteps = null, handledPhotoSig = null } = options;

  const photoSig = photoPromptSignature(prompts);
  const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
  const noteCount = day.notes?.length ?? 0;
  const placeCount = day.confirmedPlaces?.length ?? day.visitedPlaceCount ?? 0;
  const steps = day.stepsCount ?? 0;
  // The badge and the reader share one projection, so every successful manual
  // "+" action changes both together and the count can never promise hidden rows.
  const momentCount = buildMomentTimeline(day).length;
  const foodCount = day.foodMoments?.length ?? 0;
  const studioCount = day.studioMoments?.length ?? 0;
  const questsLeft = quests.filter((quest) => !quest.completed).length;

  const foodSuggestion = foodCount === 0 ? acceptedFoodDetection(day) : null;
  const studioSuggestion = studioCount === 0 ? acceptedStudioDetection(day) : null;

  const categories: TodayCategoryState[] = [
    {
      id: 'photos',
      label: 'Photos',
      icon: 'camera.fill',
      accent: '#92D7FF',
      count: photoCount,
      hasContent: photoCount > 0,
      needsAttention: !!photoSig && photoSig !== handledPhotoSig,
      glowReason: 'New photos from today could mean something',
    },
    {
      id: 'notes',
      label: 'Voice & notes',
      icon: 'mic.fill',
      accent: '#7DE8CD',
      count: noteCount,
      hasContent: noteCount > 0,
      needsAttention: false,
    },
    {
      id: 'places',
      label: 'Places',
      icon: 'mappin.and.ellipse',
      accent: '#F49AC1',
      count: placeCount,
      hasContent: placeCount > 0,
      needsAttention: !!findUnconfirmedPlace(day),
      glowReason: 'Somewhere you stopped today — what was it?',
    },
    {
      id: 'journey',
      label: 'Journey',
      icon: 'figure.walk',
      accent: '#A8C99A',
      count: steps,
      countLabel: steps > 0 ? formatSteps(steps) : undefined,
      hasContent: steps > 0 || !!day.stepsInterpretation,
      needsAttention: stepsNeedInterpreting(day, recentAvgSteps),
      glowReason: 'Today’s movement looks meaningful — what kind of journey was it?',
    },
    {
      id: 'reflection',
      label: 'Moments',
      icon: 'sparkles',
      accent: '#A78BFA',
      count: momentCount,
      hasContent: momentCount > 0,
      // The mood icon carries the "how does it feel?" ask — this stays a reader.
      needsAttention: false,
    },
    {
      id: 'food',
      label: 'Food',
      icon: 'fork.knife',
      accent: '#FFC36B',
      count: foodCount,
      hasContent: foodCount > 0,
      needsAttention: !!(foodSuggestion?.label && foodSuggestion.emoji),
      glowReason: 'A meal spotted in today’s photos — keep it?',
    },
    {
      id: 'studio',
      label: 'Inspo',
      icon: 'book.fill',
      accent: '#E8C272',
      count: studioCount,
      hasContent: studioCount > 0,
      needsAttention: !!(studioSuggestion?.detected && studioSuggestion.mediaType),
      glowReason: 'Something inspiring spotted today — keep it in the Study?',
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: 'bed.double.fill',
      accent: '#C9C2E8',
      // Sleep is one record per day, not a log — a "1" badge is noise. The lit
      // chip already says "recorded"; pressing it shows the night.
      count: 0,
      hasContent: !!day.sleep,
      variant: day.sleep?.quality,
      needsAttention: !day.sleep,
      glowReason: 'How did the night treat you?',
    },
    {
      id: 'mood',
      label: 'Mood',
      // No mood yet → a neutral smiling face asking; logged → the mood's own
      // face + tint, so the icon IS the day's current mood.
      icon: latestMoodMeta(day)?.icon ?? 'face.smiling',
      accent: latestMoodMeta(day)?.accent ?? '#C9C2E8',
      count: 0,
      hasContent: hasFeelingAnswer(day),
      needsAttention: !hasFeelingAnswer(day),
      glowReason: 'How does it feel right now?',
      variant: (() => {
        const choice = latestMoodChoice(day);
        return choice ? MOOD_STATE[choice] : undefined;
      })(),
    },
    {
      id: 'quests',
      label: 'Quests',
      icon: 'sparkles',
      accent: '#F2A65A',
      count: questsLeft,
      hasContent: quests.length > 0,
      needsAttention: false,
    },
  ];

  return categories;
}
