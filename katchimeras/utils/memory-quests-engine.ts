import type { StoredHomeDayRecord } from '@/types/home';
import type { CalendarEventContext } from '@/utils/chronicle-engine';
import { acceptedFoodDetection, acceptedStudioDetection, dayRejectsDomain } from '@/utils/intelligence/classification-policy';

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
  | 'saveFoodMemory'
  | 'saveStudioMemory'
  | 'namePatch';

export type MemoryQuestTargetCell = 'memory' | 'reflection' | 'places' | 'chronicle' | 'foodVault' | 'studioVault';

export type MemoryQuest = {
  id: string;
  type: MemoryQuestType;
  emoji: string;
  title: string;
  rewardLabel: string;
  targetCell: MemoryQuestTargetCell;
  // Essence shown as the quest's incentive — equals the value of its target event
  // (the actual credit flows through the essence ledger, not the quest, so there's
  // no double-pay). See docs/progression-customisation-design.md §3.2.
  essenceReward: number;
  completed: boolean;
  contextLabel?: string;
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
  | 'studioMoments'
  | 'dayName'
  | 'vision'
  | 'classifiedMemories'
  | 'manualJournalEntries'
>;

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

const CATALOG: Record<MemoryQuestType, Omit<MemoryQuest, 'id' | 'completed'>> = {
  captureMoment: {
    type: 'captureMoment',
    emoji: '📷',
    title: 'Capture something that stood out',
    rewardLabel: 'a memory',
    targetCell: 'memory',
    essenceReward: 5,
  },
  recordVoiceMemory: {
    type: 'recordVoiceMemory',
    emoji: '🎤',
    title: 'Record a voice memory',
    rewardLabel: 'a voice crystal',
    targetCell: 'memory',
    essenceReward: 8,
  },
  answerReflection: {
    type: 'answerReflection',
    emoji: '🌿',
    title: 'Give today a meaning',
    rewardLabel: 'your reflection',
    targetCell: 'reflection',
    essenceReward: 4,
  },
  markPlace: {
    type: 'markPlace',
    emoji: '📍',
    title: 'Mark a place from today',
    rewardLabel: 'a place',
    targetCell: 'places',
    essenceReward: 6,
  },
  markBigMoment: {
    type: 'markBigMoment',
    emoji: '⭐',
    title: 'Mark today as a big moment',
    rewardLabel: 'a landmark',
    targetCell: 'chronicle',
    essenceReward: 15,
  },
  saveFoodMemory: {
    type: 'saveFoodMemory',
    emoji: '🍽',
    title: 'Save a food memory',
    rewardLabel: 'the food vault',
    targetCell: 'foodVault',
    essenceReward: 5,
  },
  saveStudioMemory: {
    type: 'saveStudioMemory',
    emoji: '📖',
    title: 'Keep an inspiration',
    rewardLabel: 'the studio',
    targetCell: 'studioVault',
    essenceReward: 5,
  },
  namePatch: {
    type: 'namePatch',
    emoji: '🏷',
    title: "Name today's patch",
    rewardLabel: 'a story banner',
    targetCell: 'chronicle',
    essenceReward: 3,
  },
};

type QuestOverride = Partial<Pick<MemoryQuest, 'title' | 'rewardLabel' | 'contextLabel'>>;

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
    case 'saveStudioMemory':
      return (day.studioMoments?.length ?? 0) > 0;
    case 'namePatch':
      return !!day.dayName && day.dayName.trim().length > 0;
    default:
      return false;
  }
}

function makeQuest(type: MemoryQuestType, day: QuestDayInput, override?: QuestOverride): MemoryQuest {
  return { ...CATALOG[type], ...override, id: `quest-${day.isoDate}-${type}`, completed: isQuestComplete(type, day) };
}

function calendarQuest(events: CalendarEventContext[]): { type: MemoryQuestType; override: QuestOverride } | null {
  const event = events.find((item) => item.category && item.category !== 'unknown');
  if (!event) return null;
  const contextLabel = 'Inspired by today';
  switch (event.category) {
    case 'celebration':
    case 'connection':
      return {
        type: 'captureMoment',
        override: { title: `Keep one moment from ${event.title}`, rewardLabel: 'a linked memory', contextLabel },
      };
    case 'journey':
      return {
        type: 'markPlace',
        override: { title: 'Mark where the journey took you', rewardLabel: 'a journey marker', contextLabel },
      };
    case 'care':
      return {
        type: 'answerReflection',
        override: { title: 'Notice how your body felt', rewardLabel: 'a care reflection', contextLabel },
      };
    case 'focus':
      return {
        type: 'answerReflection',
        override: { title: 'What moved forward today?', rewardLabel: 'a focus reflection', contextLabel },
      };
    case 'ritual':
      return {
        type: 'answerReflection',
        override: { title: 'What made this routine worth keeping?', rewardLabel: 'a ritual note', contextLabel },
      };
    case 'quiet':
      return {
        type: 'answerReflection',
        override: { title: 'Name the quiet part of today', rewardLabel: 'a calm reflection', contextLabel },
      };
    default:
      return null;
  }
}

// Up to `max` contextual quests for the day — "what could make today worth
// remembering?". Capture + reflection are always offered; Place when a place was
// visited; Voice in the evening (or as a fallback to fill the slate). Incomplete
// quests sort first so the next meaningful action is always on top.
export function selectMemoryQuests(day: QuestDayInput, now: Date, max = 3, calendarEvents: CalendarEventContext[] = []): MemoryQuest[] {
  const hour = now.getHours();
  const visited = day.visitedPlaceCount ?? 0;

  const offered: MemoryQuestType[] = ['captureMoment', 'answerReflection'];
  const overrides = new Map<MemoryQuestType, QuestOverride>();
  const calendarOffer = calendarQuest(calendarEvents);
  if (calendarOffer) {
    if (!offered.includes(calendarOffer.type)) offered.unshift(calendarOffer.type);
    overrides.set(calendarOffer.type, calendarOffer.override);
  }
  // Contextual quests, in priority order: where you went, then a meal-time food
  // memory, then an evening voice note. Around meal times nudges food (a proxy
  // for "food in the day" until on-device food detection lands).
  const mealtime = (hour >= 11 && hour <= 14) || (hour >= 17 && hour <= 21);
  const foodDetected = acceptedFoodDetection(day).detected;
  const studioDetected = acceptedStudioDetection(day).detected;
  if (visited > 0) offered.push('markPlace');
  // Detected food (Vision) is a strong trigger; otherwise nudge at meal times.
  if (foodDetected || (mealtime && !dayRejectsDomain(day, 'food'))) offered.push('saveFoodMemory');
  // A detected book/screen/poster invites keeping it in the Studio archive.
  if (studioDetected) offered.push('saveStudioMemory');
  if (hour >= 17) offered.push('recordVoiceMemory');
  // A big moment can be marked any time (optional, lower priority).
  offered.push('markBigMoment');
  // Once the day has something worth naming, offer to name the patch (low priority).
  const hasContent =
    (day.capturedMeanings?.length ?? 0) > 0 ||
    !!day.heroPhoto ||
    (day.notes?.length ?? 0) > 0 ||
    (day.confirmedPlaces?.length ?? 0) > 0 ||
    (day.bigMoments?.length ?? 0) > 0 ||
    (day.foodMoments?.length ?? 0) > 0 ||
    (day.studioMoments?.length ?? 0) > 0 ||
    (day.manualJournalEntries?.length ?? 0) > 0;
  if (hasContent) offered.push('namePatch');
  // Fill the slate with a voice memory if nothing else made the cut.
  if (!offered.includes('recordVoiceMemory') && offered.length < max) offered.push('recordVoiceMemory');

  const uniqueOffered = offered.filter((type, index) => offered.indexOf(type) === index);
  const quests = uniqueOffered.map((type) => makeQuest(type, day, overrides.get(type)));
  // Incomplete first (so the next thing to do leads), stable otherwise.
  quests.sort((a, b) => Number(a.completed) - Number(b.completed));
  return quests.slice(0, max);
}
