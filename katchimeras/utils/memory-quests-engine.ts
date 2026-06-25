import type { StoredHomeDayRecord } from '@/types/home';
import { detectFoodInVision } from '@/utils/food-detect';

// Memory Quests (Patch Systems V3) — they replace the generic "Daily Seeds".
// Quests are never chores: each one is a meaningful capture/reflection that grows
// a real patch object. They're optional, capped at 3, contextual, and have no
// streaks or failure state. Completion is DERIVED from the day's signals, so the
// existing capture flows' animations (egg-feed mote + cell growth) fire for free.

export type MemoryQuestType =
  | 'captureMoment'
  | 'recordVoiceMemory'
  | 'answerReflection'
  | 'markPlace'
  | 'markBigMoment'
  | 'saveFoodMemory';

export type MemoryQuestTargetCell = 'memory' | 'reflection' | 'places' | 'chronicle' | 'foodVault';

export type MemoryQuest = {
  id: string;
  type: MemoryQuestType;
  emoji: string;
  title: string;
  rewardLabel: string;
  targetCell: MemoryQuestTargetCell;
  completed: boolean;
};

// Only the fields a quest reads — keeps the engine testable with plain objects.
type QuestDayInput = Pick<
  StoredHomeDayRecord,
  | 'isoDate'
  | 'notes'
  | 'capturedMeanings'
  | 'heroPhoto'
  | 'moments'
  | 'promptAnswers'
  | 'confirmedPlaces'
  | 'visitedPlaceCount'
  | 'bigMoments'
  | 'foodMoments'
  | 'vision'
>;

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

const CATALOG: Record<MemoryQuestType, Omit<MemoryQuest, 'id' | 'completed'>> = {
  captureMoment: {
    type: 'captureMoment',
    emoji: '📷',
    title: 'Capture something that stood out',
    rewardLabel: 'a memory',
    targetCell: 'memory',
  },
  recordVoiceMemory: {
    type: 'recordVoiceMemory',
    emoji: '🎤',
    title: 'Record a voice memory',
    rewardLabel: 'a voice crystal',
    targetCell: 'memory',
  },
  answerReflection: {
    type: 'answerReflection',
    emoji: '🌿',
    title: 'Give today a meaning',
    rewardLabel: 'your reflection',
    targetCell: 'reflection',
  },
  markPlace: {
    type: 'markPlace',
    emoji: '📍',
    title: 'Mark a place from today',
    rewardLabel: 'a place',
    targetCell: 'places',
  },
  markBigMoment: {
    type: 'markBigMoment',
    emoji: '⭐',
    title: 'Mark today as a big moment',
    rewardLabel: 'a landmark',
    targetCell: 'chronicle',
  },
  saveFoodMemory: {
    type: 'saveFoodMemory',
    emoji: '🍽',
    title: 'Save a food memory',
    rewardLabel: 'the food vault',
    targetCell: 'foodVault',
  },
};

// A quest is "complete" once its real-life signal exists for the day.
export function isQuestComplete(type: MemoryQuestType, day: QuestDayInput): boolean {
  switch (type) {
    case 'captureMoment':
      return (
        (day.capturedMeanings?.length ?? 0) > 0 ||
        !!day.heroPhoto ||
        (day.moments ?? []).some((moment) => moment.type === 'photo')
      );
    case 'recordVoiceMemory':
      return (day.notes ?? []).some((note) => note.kind === 'voice');
    case 'answerReflection':
      return (day.promptAnswers ?? []).some((answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind));
    case 'markPlace':
      return (day.confirmedPlaces?.length ?? 0) > 0;
    case 'markBigMoment':
      return (day.bigMoments?.length ?? 0) > 0;
    case 'saveFoodMemory':
      return (day.foodMoments?.length ?? 0) > 0;
    default:
      return false;
  }
}

function makeQuest(type: MemoryQuestType, day: QuestDayInput): MemoryQuest {
  return { ...CATALOG[type], id: `quest-${day.isoDate}-${type}`, completed: isQuestComplete(type, day) };
}

// Up to `max` contextual quests for the day — "what could make today worth
// remembering?". Capture + reflection are always offered; Place when a place was
// visited; Voice in the evening (or as a fallback to fill the slate). Incomplete
// quests sort first so the next meaningful action is always on top.
export function selectMemoryQuests(day: QuestDayInput, now: Date, max = 3): MemoryQuest[] {
  const hour = now.getHours();
  const visited = day.visitedPlaceCount ?? 0;

  const offered: MemoryQuestType[] = ['captureMoment', 'answerReflection'];
  // Contextual quests, in priority order: where you went, then a meal-time food
  // memory, then an evening voice note. Around meal times nudges food (a proxy
  // for "food in the day" until on-device food detection lands).
  const mealtime = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
  const foodDetected = detectFoodInVision(day.vision).detected;
  if (visited > 0) offered.push('markPlace');
  // Detected food (Vision) is a strong trigger; otherwise nudge at meal times.
  if (foodDetected || mealtime) offered.push('saveFoodMemory');
  if (hour >= 17) offered.push('recordVoiceMemory');
  // A big moment can be marked any time (optional, lower priority).
  offered.push('markBigMoment');
  // Fill the slate with a voice memory if nothing else made the cut.
  if (!offered.includes('recordVoiceMemory') && offered.length < max) offered.push('recordVoiceMemory');

  const quests = offered.map((type) => makeQuest(type, day));
  // Incomplete first (so the next thing to do leads), stable otherwise.
  quests.sort((a, b) => Number(a.completed) - Number(b.completed));
  return quests.slice(0, max);
}
