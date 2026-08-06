import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { StoredHomeDayRecord, TodayGrowthSource } from '@/types/home';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';
import { normalizeDayGrowthState, TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

export type TodayCareTimeBucket = 'morning' | 'midday' | 'afternoon' | 'evening';
export type TodayCareSource = 'system' | 'memory_quest' | 'quick_goal' | 'ai';
export type TodayCareCompletionMode = 'artifact' | 'inline_check_in' | 'quick_goal' | 'external_activity';
export type TodayCareContextCategory = 'photo' | 'place' | 'movement' | 'food' | 'studio' | 'people' | 'work';
export type TodayCareArtKey =
  | 'mood'
  | 'sleep'
  | 'journal'
  | 'photo'
  | 'voice'
  | 'reflection'
  | 'place'
  | 'movement'
  | 'food'
  | 'studio'
  | 'work'
  | 'people'
  | 'event'
  | 'quest';
export type TodayCareDestination =
  | { kind: 'inline_mood' }
  | { kind: 'inline_sleep' }
  | { kind: 'quick_category'; category: 'photo' | 'voice_note' | 'manual_journal' | 'place' | 'movement' | 'food' | 'studio' | 'people' | 'work' | 'life_event' }
  | { kind: 'reflection' }
  | { kind: 'memory_quest'; questType: MemoryQuestType }
  | { kind: 'quick_goal'; goalId: string; familyId: KatchimeraFamilyId }
  | {
      kind: 'photo_roll';
      assetIds: string[];
      placeName?: string;
      placeAddress?: string;
      startedAt?: string;
      endedAt?: string;
    }
  | { kind: 'mini_game'; questId: string };

export type TodayCareActionDefinition = {
  id: string;
  title: string;
  description: string;
  icon: IconSymbolName;
  artKey?: TodayCareArtKey;
  category: 'check_in' | 'memory' | 'goal' | 'play';
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

export type TodayCareMiniGameSuggestion = {
  companionName: string;
  familyId: KatchimeraFamilyId;
  questId: string;
  title: string;
};

export type TodayCarePhotoRollSuggestion = {
  assetIds: string[];
  title: string;
  placeName?: string;
  placeAddress?: string;
  startedAt?: string;
  endedAt?: string;
};

const ALL_DAY: TodayCareTimeBucket[] = ['morning', 'midday', 'afternoon', 'evening'];
const AFTER_MORNING: TodayCareTimeBucket[] = ['midday', 'afternoon', 'evening'];
const CATEGORY_SPECIFIC_COMPLETION_KEYS = new Set(['place', 'movement', 'food', 'studio', 'people', 'work']);

const CARE_CATALOG: TodayCareActionDefinition[] = [
  action({
    id: 'mood', title: 'How are you feeling?', description: 'Choose the mood that feels closest.',
    icon: 'face.smiling', artKey: 'mood', category: 'check_in', completionKey: 'mood', completionMode: 'inline_check_in',
    destination: { kind: 'inline_mood' }, growthSource: 'mood', priority: 100, eligibleTimeOfDay: ALL_DAY,
  }),
  action({
    id: 'sleep', title: 'How was your sleep?', description: 'Choose how well you slept last night.',
    icon: 'bed.double.fill', artKey: 'sleep', category: 'check_in', completionKey: 'sleep', completionMode: 'inline_check_in',
    destination: { kind: 'inline_sleep' }, growthSource: 'sleep', priority: 98, eligibleTimeOfDay: ALL_DAY,
  }),
  action({
    id: 'journal', title: "Write in today's journal", description: 'Write a full journal entry in your own words.',
    icon: 'square.and.pencil', artKey: 'journal', category: 'memory', completionKey: 'journal', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'manual_journal' }, growthSource: 'journal', priority: 94,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'photo', title: 'Take a photo from today', description: 'Capture a photo of something worth keeping.',
    icon: 'camera.fill', artKey: 'photo', category: 'memory', completionKey: 'photo', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'photo' }, growthSource: 'photo', priority: 92,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'voice', title: 'Record a voice note', description: 'Speak a short voice note about today.',
    icon: 'mic.fill', artKey: 'voice', category: 'memory', completionKey: 'voice', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'voice_note' }, growthSource: 'voice_note', priority: 87,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'reflection', title: 'Reflect on today', description: 'Answer one guided question about your day.',
    icon: 'book.closed.fill', artKey: 'reflection', category: 'memory', completionKey: 'reflection', completionMode: 'artifact',
    destination: { kind: 'reflection' }, growthSource: 'reflection', priority: 96,
    eligibleTimeOfDay: ['evening'], journalFocused: true,
  }),
  action({
    id: 'place', title: 'Add a place you visited', description: 'Journal where you went and what happened.',
    icon: 'mappin.and.ellipse', artKey: 'place', category: 'memory', completionKey: 'place', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'place' }, growthSource: 'place', priority: 76,
    eligibleTimeOfDay: AFTER_MORNING, journalFocused: true,
  }),
  action({
    id: 'movement', title: 'Journal how you moved', description: 'Record a walk, workout, or journey.',
    icon: 'figure.walk', artKey: 'movement', category: 'memory', completionKey: 'movement', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'movement' }, growthSource: 'movement', priority: 76,
    eligibleTimeOfDay: AFTER_MORNING, journalFocused: true,
  }),
  action({
    id: 'food', title: 'Journal a meal or drink', description: 'Record something you ate or drank today.',
    icon: 'fork.knife', artKey: 'food', category: 'memory', completionKey: 'food', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'food' }, growthSource: 'journal', priority: 76,
    eligibleTimeOfDay: ['midday', 'evening'], journalFocused: true,
  }),
  action({
    id: 'studio', title: 'Keep something that inspired you', description: 'Record something you watched, read, played, or made.',
    icon: 'books.vertical.fill', artKey: 'studio', category: 'memory', completionKey: 'studio', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'studio' }, growthSource: 'journal', priority: 76,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'people', title: 'Remember who was part of today', description: 'Record time with someone, a pet, or time by yourself.',
    icon: 'person.2.fill', artKey: 'people', category: 'memory', completionKey: 'people', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'people' }, growthSource: 'journal', priority: 76,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
  action({
    id: 'work', title: 'Record what you worked on', description: 'Keep a piece of progress, effort, study, or making.',
    icon: 'briefcase.fill', artKey: 'work', category: 'memory', completionKey: 'work', completionMode: 'artifact',
    destination: { kind: 'quick_category', category: 'work' }, growthSource: 'journal', priority: 76,
    eligibleTimeOfDay: ALL_DAY, journalFocused: true,
  }),
];

export function rankTodayCareActions(input: {
  day: StoredHomeDayRecord;
  now?: Date;
  memoryQuests?: readonly MemoryQuest[];
  quickGoals?: readonly TodayCareQuickGoal[];
  rotatingLimit?: number;
  reflectionAvailable?: boolean;
  miniGameSuggestion?: TodayCareMiniGameSuggestion | null;
  photoRollSuggestion?: TodayCarePhotoRollSuggestion | null;
  contextualCategories?: readonly TodayCareContextCategory[];
}): { active: RankedTodayCareAction[]; completed: RankedTodayCareAction[] } {
  const now = input.now ?? new Date();
  const bucket = careTimeBucket(now);
  const state = normalizeDayGrowthState(input.day.growth);
  const stateById = new Map(state.careActions.map((item) => [item.instanceId, item]));
  const contextualKeys = new Set<string>(input.contextualCategories ?? []);
  for (const quest of input.memoryQuests ?? []) {
    const key = memoryQuestRoute(quest.type).completionKey;
    if (['place', 'food', 'studio'].includes(key)) contextualKeys.add(key);
  }
  const candidates: RankedTodayCareAction[] = CARE_CATALOG
    .filter((definition) => definition.eligibleTimeOfDay.includes(bucket) || contextualKeys.has(definition.completionKey))
    .filter((definition) => definition.id !== 'reflection' || input.reflectionAvailable !== false)
    .map((definition) => ranked(definition, input.day.isoDate, 'system', isDefinitionAlreadySatisfied(definition.id, input.day)));

  if (input.miniGameSuggestion) {
    const game = input.miniGameSuggestion;
    const definition = action({
      id: `mini_game_round:${game.questId}`,
      title: `Play ${game.title}`,
      description: `Complete one round with ${game.companionName}.`,
      icon: 'gamecontroller.fill',
      category: 'play',
      completionKey: `mini_game:${game.questId}`,
      completionMode: 'external_activity',
      destination: { kind: 'mini_game', questId: game.questId },
      growthSource: 'mini_game',
      priority: 89,
      eligibleTimeOfDay: ALL_DAY,
    });
    candidates.push({
      ...ranked(definition, input.day.isoDate, 'system', false),
      familyId: game.familyId,
      sourceId: game.questId,
    });
  }

  if (input.photoRollSuggestion?.assetIds.length) {
    const photoRoll = input.photoRollSuggestion;
    const definition = action({
      id: 'photo_roll',
      title: photoRoll.title,
      description: 'Choose a detected Photo Library image to journal.',
      icon: 'photo.on.rectangle.angled',
      artKey: 'photo',
      category: 'memory',
      completionKey: 'photo',
      completionMode: 'artifact',
      destination: {
        kind: 'photo_roll',
        assetIds: photoRoll.assetIds,
        ...(photoRoll.placeName ? { placeName: photoRoll.placeName } : {}),
        ...(photoRoll.placeAddress ? { placeAddress: photoRoll.placeAddress } : {}),
        ...(photoRoll.startedAt ? { startedAt: photoRoll.startedAt } : {}),
        ...(photoRoll.endedAt ? { endedAt: photoRoll.endedAt } : {}),
      },
      growthSource: 'photo',
      priority: 99,
      eligibleTimeOfDay: ALL_DAY,
      journalFocused: true,
    });
    candidates.push({
      ...ranked(definition, input.day.isoDate, 'system', false),
      sourceId: photoRoll.assetIds.join('|'),
    });
  }

  for (const quest of input.memoryQuests ?? []) {
    if (quest.type === 'namePatch' || quest.type === 'markBigMoment') continue;
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
      description: 'Complete this Katchimera goal for today.',
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

  const completedKeys = new Set(
    candidates.flatMap((candidate) => {
      const stored = stateById.get(candidate.instanceId);
      return candidate.completed || stored?.status === 'completed' ? [candidate.completionKey] : [];
    }),
  );
  for (const key of artifactCompletionKeys(input.day)) completedKeys.add(key);
  const dismissedKeys = new Set(
    state.careActions.flatMap((stored) => stored.status === 'not_today'
      ? storedCompletionKey(stored.definitionId)
      : []),
  );

  const completed: RankedTodayCareAction[] = [];
  const eligible = candidates.filter((candidate) => {
    const stored = stateById.get(candidate.instanceId);
    if (candidate.completed || stored?.status === 'completed') {
      completed.push({ ...candidate, completed: true, completedAt: stored?.completedAt ?? candidate.completedAt });
      return false;
    }
    if (completedKeys.has(candidate.completionKey)) {
      // Artifact-backed actions can be satisfied by a journal record whose
      // storage shape differs from the legacy top-level field (notably photo
      // and voice journals). Keep the exact action instance available to the
      // completion animator instead of only removing it from the active queue.
      completed.push({ ...candidate, completed: true, completedAt: stored?.completedAt ?? candidate.completedAt });
      return false;
    }
    if (dismissedKeys.has(candidate.completionKey)) return false;
    if (stored?.status === 'not_today') return false;
    if (stored?.deferredUntil && new Date(stored.deferredUntil).getTime() > now.getTime()) return false;
    return true;
  });

  const checkIns = eligible
    .filter((candidate) => candidate.category === 'check_in')
    .sort(compareCandidates);
  if (checkIns.length > 0) {
    return {
      active: checkIns.slice(0, 1),
      completed: completed.sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? '')),
    };
  }
  const rotating = eligible
    .filter((candidate) => candidate.category !== 'check_in')
    .map((candidate) => contextualKeys.has(candidate.completionKey)
      ? { ...candidate, priority: candidate.priority + 40 }
      : candidate)
    .sort(compareCandidates);
  const withoutDuplicateCompletions = dedupeCompletionKeys(rotating);
  const memory = withoutDuplicateCompletions.filter((candidate) => candidate.journalFocused);
  const goals = withoutDuplicateCompletions.filter((candidate) => candidate.category === 'goal');
  const games = withoutDuplicateCompletions.filter((candidate) => candidate.category === 'play');
  const rotatingLimit = input.rotatingLimit ?? 3;
  const contextualMemory = memory.filter((candidate) => contextualKeys.has(candidate.completionKey));
  const selected: RankedTodayCareAction[] = contextualMemory.slice(0, rotatingLimit);
  const memoryTarget = Math.min(2, rotatingLimit);
  if (selected.length < memoryTarget) {
    const categorySpecific = memory.find((candidate) => (
      candidate.id !== 'journal'
      && CATEGORY_SPECIFIC_COMPLETION_KEYS.has(candidate.completionKey)
      && !selected.some((item) => item.instanceId === candidate.instanceId)
    ));
    if (categorySpecific) selected.push(categorySpecific);
  }
  for (const candidate of memory) {
    if (selected.length >= memoryTarget) break;
    // Generic journaling is a last resort, not a competitor to a concrete action.
    if (candidate.id === 'journal') continue;
    if (!selected.some((item) => item.instanceId === candidate.instanceId)) selected.push(candidate);
  }
  if (selected.length < rotatingLimit && games[0]) selected.push(games[0]);
  if (selected.length < rotatingLimit && goals[0]) selected.push(goals[0]);
  for (const candidate of withoutDuplicateCompletions) {
    if (selected.length >= rotatingLimit) break;
    if (candidate.category === 'goal' || candidate.id === 'journal') continue;
    if (!selected.some((item) => item.instanceId === candidate.instanceId)) selected.push(candidate);
  }
  if (selected.length < rotatingLimit) {
    const journalFallback = memory.find((candidate) => candidate.id === 'journal');
    if (journalFallback) selected.push(journalFallback);
  }

  return {
    active: [...checkIns, ...selected],
    completed: completed.sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? '')),
  };
}

function storedCompletionKey(definitionId: string): string[] {
  if (definitionId.startsWith('memory-quest:')) return [definitionId.slice('memory-quest:'.length)];
  if (definitionId === 'photo_roll') return ['photo'];
  if (definitionId.startsWith('mini_game_round:')) return [`mini_game:${definitionId.slice('mini_game_round:'.length)}`];
  return [definitionId];
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
    // The category, not the generated quest copy, owns the same-day slot.
    // This prevents a newly worded food/photo/etc quest from returning after
    // the player already completed or dismissed that category today.
    id: `memory-quest:${route.completionKey}`,
    title: quest.title,
    description: memoryQuestDescription(quest.type),
    icon: route.icon,
    artKey: route.artKey,
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

function memoryQuestDescription(type: MemoryQuestType): string {
  switch (type) {
    case 'captureMoment': return 'Take a photo of something that stood out today.';
    case 'recordVoiceMemory': return 'Record a voice note while it is still fresh.';
    case 'answerReflection': return 'Answer a guided reflection about today.';
    case 'markPlace': return 'Journal a place you visited today.';
    case 'markBigMoment': return 'Journal why today feels important.';
    case 'saveFoodMemory': return 'Journal a meal, snack, or drink from today.';
    case 'saveStudioMemory': return 'Journal something you watched, read, or enjoyed.';
    case 'namePatch': return "Give today's collection of memories a name.";
  }
}

function memoryQuestRoute(type: MemoryQuestType): {
  artKey: TodayCareArtKey;
  completionKey: string;
  growthSource: TodayGrowthSource;
  icon: IconSymbolName;
} {
  switch (type) {
    case 'captureMoment': return { artKey: 'photo', completionKey: 'photo', growthSource: 'photo', icon: 'camera.fill' };
    case 'recordVoiceMemory': return { artKey: 'voice', completionKey: 'voice', growthSource: 'voice_note', icon: 'mic.fill' };
    case 'answerReflection': return { artKey: 'reflection', completionKey: 'reflection', growthSource: 'reflection', icon: 'leaf.fill' };
    case 'markPlace': return { artKey: 'place', completionKey: 'place', growthSource: 'place', icon: 'mappin.and.ellipse' };
    case 'markBigMoment': return { artKey: 'event', completionKey: 'event', growthSource: 'journal', icon: 'sparkles' };
    case 'saveFoodMemory': return { artKey: 'food', completionKey: 'food', growthSource: 'journal', icon: 'fork.knife' };
    case 'saveStudioMemory': return { artKey: 'studio', completionKey: 'studio', growthSource: 'journal', icon: 'books.vertical.fill' };
    case 'namePatch': return { artKey: 'quest', completionKey: 'name', growthSource: 'quest', icon: 'square.and.pencil' };
  }
}

function isDefinitionAlreadySatisfied(id: string, day: StoredHomeDayRecord): boolean {
  if (id === 'mood') return day.promptAnswers.some((answer) => answer.kind === 'feeling' && !answer.dismissed);
  if (id === 'sleep') return Boolean(day.sleep);
  if (id === 'photo') return Boolean(day.heroPhoto || day.classifiedMemories?.some((memory) => memory.sourceType === 'photo'));
  if (id === 'voice') return Boolean(day.notes?.some((note) => note.kind === 'voice'));
  if (id === 'journal') {
    const records = day.journalRecords ?? [];
    return records.some((record) => record.flowId === 'general')
      || (!records.length && Boolean(day.notes?.some((note) => note.kind !== 'voice')));
  }
  if (id === 'place') return Boolean(day.confirmedPlaces?.length || hasJournalFlow(day, 'went_somewhere'));
  if (id === 'movement') return Boolean(day.stepsInterpretation || day.stepsCount >= 1000 || hasJournalFlow(day, 'movement'));
  if (id === 'food') return Boolean(day.foodMoments?.length || hasJournalFlow(day, 'food'));
  if (id === 'reflection') return day.promptAnswers.some((answer) => ['meaning', 'highlight', 'gratitude', 'day_word'].includes(answer.kind) && !answer.dismissed);
  return false;
}

function hasJournalFlow(day: StoredHomeDayRecord, flowId: string): boolean {
  return day.journalRecords?.some((record) => record.flowId === flowId) ?? false;
}

function artifactCompletionKeys(day: StoredHomeDayRecord): Set<string> {
  const keys = new Set<string>();
  if (day.promptAnswers.some((answer) => answer.kind === 'feeling' && !answer.dismissed)) keys.add('mood');
  if (day.sleep) keys.add('sleep');
  if (day.heroPhoto || day.classifiedMemories?.some((memory) => memory.sourceType === 'photo')) keys.add('photo');
  if (day.notes?.some((note) => note.kind === 'voice')) keys.add('voice');
  if (day.confirmedPlaces?.length) keys.add('place');
  if (day.stepsInterpretation || day.stepsCount >= 1000) keys.add('movement');
  if (day.foodMoments?.length) keys.add('food');
  if (day.promptAnswers.some((answer) => ['meaning', 'highlight', 'gratitude', 'day_word'].includes(answer.kind) && !answer.dismissed)) {
    keys.add('reflection');
  }
  for (const record of day.journalRecords ?? []) {
    if (record.source.kind === 'photo') keys.add('photo');
    if (record.source.kind === 'voice_note') keys.add('voice');
    if (record.flowId === 'went_somewhere') keys.add('place');
    else if (record.flowId === 'movement') keys.add('movement');
    else if (record.flowId === 'food') keys.add('food');
    else if (record.flowId === 'studio') keys.add('studio');
    else if (record.flowId === 'work') keys.add('work');
    else if (record.flowId === 'people') keys.add('people');
    else if (record.flowId === 'big_event') keys.add('event');
    else if (record.flowId === 'general') keys.add('journal');
  }
  return keys;
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
