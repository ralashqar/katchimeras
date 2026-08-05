import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { StoredHomeDayRecord, TodayGrowthSource } from '@/types/home';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';
import { normalizeDayGrowthState, TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

export type TodayCareTimeBucket = 'morning' | 'midday' | 'afternoon' | 'evening';
export type TodayCareSource = 'system' | 'memory_quest' | 'quick_goal' | 'ai';
export type TodayCareCompletionMode = 'artifact' | 'inline_check_in' | 'quick_goal';
export type TodayCareDestination =
  | { kind: 'inline_mood' }
  | { kind: 'inline_sleep' }
  | { kind: 'quick_category'; category: 'photo' | 'voice_note' | 'manual_journal' | 'place' | 'movement' | 'food' }
  | { kind: 'reflection' }
  | { kind: 'memory_quest'; questType: MemoryQuestType }
  | { kind: 'quick_goal'; goalId: string; familyId: KatchimeraFamilyId };

export type TodayCareActionDefinition = {
  id: string;
  title: string;
  description: string;
  icon: IconSymbolName;
  category: 'check_in' | 'memory' | 'goal';
  completionKey: string;
  completionMode: TodayCareCompletionMode;
  destination: TodayCareDestination;
  growthSource: TodayGrowthSource;
  growthReward: number;
  priority: number;
  eligibleTimeOfDay: TodayCareTimeBucket[];
  journalFocused: boolean;
  canReplaceSkipped: boolean;
  aiGenerated: boolean;
};

export type RankedTodayCareAction = TodayCareActionDefinition & {
  instanceId: string;
  source: TodayCareSource;
  sourceId?: string;
  familyId?: KatchimeraFamilyId;
  completed: boolean;
  completedAt?: string | null;
};

export type TodayCareQuickGoal = {
  id: string;
  title: string;
  familyId: KatchimeraFamilyId;
  completed: boolean;
};

const ALL_DAY: TodayCareTimeBucket[] = ['morning', 'midday', 'afternoon', 'evening'];
const AFTER_MORNING: TodayCareTimeBucket[] = ['midday', 'afternoon', 'evening'];

const CARE_CATALOG: TodayCareActionDefinition[] = [
  action({
    id: 'mood', title: 'How are you feeling?', description: 'A quick check-in helps the egg understand today.',
    icon: 'face.smiling', category: 'check_in', completionKey: 'mood', completionMode: 'inline_check_in',
    destination: { kind: 'inline_mood' }, growthSource: 'mood', priority: 100, eligibleTimeOfDay: ALL_DAY,
  }),
  action({
    id: 'sleep', title: 'How was your sleep?', description: 'Tell the egg how your day began.',
    icon: 'bed.double.fill', category: 'check_in', completionKey: 'sleep', completionMode: 'inline_check_in',
    destination: { kind: 'inline_sleep' }, growthSource: 'sleep', priority: 98, eligibleTimeOfDay: ALL_DAY,
  }),
  action({
    id: 'journal', title: 'Write down one thing', description: 'A few honest words give the hatch more shape.',
    icon: 'square.and.pencil', category: 'memory', completionKey: 'journal', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'manual_journal' }, growthSource: 'journal', priority: 94,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'photo', title: 'Capture today’s moment', description: 'Keep one real detail from your day.',
    icon: 'camera.fill', category: 'memory', completionKey: 'photo', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'photo' }, growthSource: 'photo', priority: 92,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'voice', title: 'Leave a voice note', description: 'Say what happened while it is still fresh.',
    icon: 'mic.fill', category: 'memory', completionKey: 'voice', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'voice_note' }, growthSource: 'voice_note', priority: 87,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'reflection', title: 'What will you remember?', description: 'Give today a small meaning before it hatches.',
    icon: 'book.closed.fill', category: 'memory', completionKey: 'reflection', completionMode: 'artifact',
    destination: { kind: 'reflection' }, growthSource: 'reflection', priority: 96,
    eligibleTimeOfDay: ['evening'], journalFocused: true,
  }),
  action({
    id: 'place', title: 'Remember where you went', description: 'Add a place that mattered today.',
    icon: 'mappin.and.ellipse', category: 'memory', completionKey: 'place', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'place' }, growthSource: 'place', priority: 76,
    eligibleTimeOfDay: AFTER_MORNING, journalFocused: true,
  }),
  action({
    id: 'movement', title: 'How did you move?', description: 'Keep a walk or journey as part of today’s story.',
    icon: 'figure.walk', category: 'memory', completionKey: 'movement', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'movement' }, growthSource: 'movement', priority: 70,
    eligibleTimeOfDay: AFTER_MORNING, journalFocused: true,
  }),
  action({
    id: 'food', title: 'Keep a taste from today', description: 'Remember a meal, snack, or favourite drink.',
    icon: 'fork.knife', category: 'memory', completionKey: 'food', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'food' }, growthSource: 'journal', priority: 72,
    eligibleTimeOfDay: ['midday', 'evening'], journalFocused: true,
  }),
];

export function rankTodayCareActions(input: {
  day: StoredHomeDayRecord;
  now?: Date;
  memoryQuests?: readonly MemoryQuest[];
  quickGoals?: readonly TodayCareQuickGoal[];
  rotatingLimit?: number;
  reflectionAvailable?: boolean;
}): { active: RankedTodayCareAction[]; completed: RankedTodayCareAction[] } {
  const now = input.now ?? new Date();
  const bucket = careTimeBucket(now);
  const state = normalizeDayGrowthState(input.day.growth);
  const stateById = new Map(state.careActions.map((item) => [item.instanceId, item]));
  const candidates: RankedTodayCareAction[] = CARE_CATALOG
    .filter((definition) => definition.eligibleTimeOfDay.includes(bucket))
    .filter((definition) => definition.id !== 'reflection' || input.reflectionAvailable !== false)
    .map((definition) => ranked(definition, input.day.isoDate, 'system', isDefinitionAlreadySatisfied(definition.id, input.day)));

  for (const quest of input.memoryQuests ?? []) {
    if (quest.type === 'namePatch') continue;
    if (quest.type === 'answerReflection' && input.reflectionAvailable === false) continue;
    const definition = memoryQuestAction(quest);
    candidates.push({
      ...ranked(definition, input.day.isoDate, 'memory_quest', quest.completed),
      sourceId: quest.id,
    });
  }

  for (const goal of input.quickGoals ?? []) {
    const definition = action({
      id: `quick-goal:${goal.id}`,
      title: goal.title,
      description: 'A small promise you made with one of your Katchimeras.',
      icon: 'checkmark',
      category: 'goal',
      completionKey: `quick-goal:${goal.id}`,
      completionMode: 'quick_goal',
      destination: { kind: 'quick_goal', goalId: goal.id, familyId: goal.familyId },
      growthSource: 'quick_goal',
      priority: 82,
      eligibleTimeOfDay: ALL_DAY,
    });
    candidates.push({
      ...ranked(definition, input.day.isoDate, 'quick_goal', goal.completed),
      sourceId: goal.id,
      familyId: goal.familyId,
    });
  }

  const completed: RankedTodayCareAction[] = [];
  const eligible = candidates.filter((candidate) => {
    const stored = stateById.get(candidate.instanceId);
    if (candidate.completed || stored?.status === 'completed') {
      completed.push({ ...candidate, completed: true, completedAt: stored?.completedAt ?? candidate.completedAt });
      return false;
    }
    if (stored?.status === 'not_today') return false;
    if (stored?.deferredUntil && new Date(stored.deferredUntil).getTime() > now.getTime()) return false;
    return true;
  });

  const checkIns = eligible
    .filter((candidate) => candidate.category === 'check_in')
    .sort(compareCandidates);
  const rotating = eligible
    .filter((candidate) => candidate.category !== 'check_in')
    .sort(compareCandidates);
  const withoutDuplicateCompletions = dedupeCompletionKeys(rotating);
  const memory = withoutDuplicateCompletions.filter((candidate) => candidate.journalFocused);
  const goals = withoutDuplicateCompletions.filter((candidate) => candidate.category === 'goal');
  const rotatingLimit = input.rotatingLimit ?? 3;
  const selected: RankedTodayCareAction[] = memory.slice(0, Math.min(2, rotatingLimit));
  if (selected.length < rotatingLimit && goals[0]) selected.push(goals[0]);
  for (const candidate of memory) {
    if (selected.length >= rotatingLimit) break;
    if (!selected.some((item) => item.instanceId === candidate.instanceId)) selected.push(candidate);
  }

  return {
    active: [...checkIns, ...selected],
    completed: completed.sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? '')),
  };
}

export function careTimeBucket(date: Date): TodayCareTimeBucket {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function action(input: Omit<TodayCareActionDefinition, 'growthReward' | 'journalFocused' | 'canReplaceSkipped' | 'aiGenerated'> & {
  journalFocused?: boolean;
}): TodayCareActionDefinition {
  return {
    ...input,
    growthReward: TODAY_GROWTH_REWARDS[input.growthSource],
    journalFocused: input.journalFocused ?? false,
    canReplaceSkipped: true,
    aiGenerated: false,
  };
}

function ranked(definition: TodayCareActionDefinition, dayId: string, source: TodayCareSource, completed: boolean): RankedTodayCareAction {
  return {
    ...definition,
    instanceId: instanceId(dayId, definition.id),
    source,
    completed,
    completedAt: null,
  };
}

function memoryQuestAction(quest: MemoryQuest): TodayCareActionDefinition {
  const route = memoryQuestRoute(quest.type);
  return action({
    id: `memory-quest:${quest.id}`,
    title: quest.title,
    description: quest.contextLabel ?? `Keep ${quest.rewardLabel.toLowerCase()} as part of today.`,
    icon: route.icon,
    category: 'memory',
    completionKey: route.completionKey,
    completionMode: 'artifact',
    destination: { kind: 'memory_quest', questType: quest.type },
    growthSource: route.growthSource,
    priority: 97,
    eligibleTimeOfDay: ALL_DAY,
    journalFocused: true,
  });
}

function memoryQuestRoute(type: MemoryQuestType): {
  completionKey: string;
  growthSource: TodayGrowthSource;
  icon: IconSymbolName;
} {
  switch (type) {
    case 'captureMoment': return { completionKey: 'photo', growthSource: 'photo', icon: 'camera.fill' };
    case 'recordVoiceMemory': return { completionKey: 'voice', growthSource: 'voice_note', icon: 'mic.fill' };
    case 'answerReflection': return { completionKey: 'reflection', growthSource: 'reflection', icon: 'leaf.fill' };
    case 'markPlace': return { completionKey: 'place', growthSource: 'place', icon: 'mappin.and.ellipse' };
    case 'markBigMoment': return { completionKey: 'journal', growthSource: 'journal', icon: 'sparkles' };
    case 'saveFoodMemory': return { completionKey: 'food', growthSource: 'journal', icon: 'fork.knife' };
    case 'saveStudioMemory': return { completionKey: 'journal', growthSource: 'journal', icon: 'books.vertical.fill' };
    case 'namePatch': return { completionKey: 'name', growthSource: 'quest', icon: 'square.and.pencil' };
  }
}

function isDefinitionAlreadySatisfied(id: string, day: StoredHomeDayRecord): boolean {
  if (id === 'mood') return day.promptAnswers.some((answer) => answer.kind === 'feeling' && !answer.dismissed);
  if (id === 'sleep') return Boolean(day.sleep);
  if (id === 'photo') return Boolean(day.heroPhoto || day.classifiedMemories?.some((memory) => memory.sourceType === 'photo'));
  if (id === 'voice') return Boolean(day.notes?.some((note) => note.kind === 'voice'));
  if (id === 'journal') return Boolean(day.journalRecords?.length || day.notes?.some((note) => note.kind !== 'voice'));
  if (id === 'place') return Boolean(day.confirmedPlaces?.length);
  if (id === 'movement') return Boolean(day.stepsInterpretation || day.stepsCount >= 1000);
  if (id === 'food') return Boolean(day.foodMoments?.length);
  if (id === 'reflection') return day.promptAnswers.some((answer) => ['meaning', 'highlight', 'gratitude', 'day_word'].includes(answer.kind) && !answer.dismissed);
  return false;
}

function dedupeCompletionKeys(actions: RankedTodayCareAction[]): RankedTodayCareAction[] {
  const seen = new Set<string>();
  return actions.filter((candidate) => {
    if (seen.has(candidate.completionKey)) return false;
    seen.add(candidate.completionKey);
    return true;
  });
}

function compareCandidates(left: RankedTodayCareAction, right: RankedTodayCareAction): number {
  const priority = right.priority - left.priority;
  return priority || stableHash(left.instanceId) - stableHash(right.instanceId);
}

function instanceId(dayId: string, definitionId: string): string {
  return `care:${dayId}:${definitionId}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
