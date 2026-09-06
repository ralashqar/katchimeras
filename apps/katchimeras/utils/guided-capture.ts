import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { JournalSource, ManualJournalSubmission } from '@/types/home';
import { manualJournalFlow } from '@/utils/manual-journal-registry';

export type EggReactionTheme = 'nature' | 'social' | 'active' | 'cozy' | 'positive' | 'important' | 'neutral';
export type GuidedCaptureEntryPoint = 'today_suggestion' | 'plus' | 'vault' | 'quest' | 'egg' | 'companion' | 'photo_review' | 'note_review';

export type GuidedCaptureOption = {
  id: string;
  label: string;
  emoji: string;
  icon: IconSymbolName;
  flowId: string;
  categoryId: string;
  reaction: EggReactionTheme;
  refinement?: {
    title: string;
    categoryIds: readonly string[];
  };
  rootOptionId?: string;
};

export type GuidedCaptureFlow = {
  id: string;
  title: string;
  body: string;
  options: readonly GuidedCaptureOption[];
};

export type GuidedFollowUpOption = { id: string; label: string; kind: 'context' | 'feeling' };

const option = (
  id: string,
  label: string,
  emoji: string,
  icon: IconSymbolName,
  flowId: string,
  categoryId: string,
  reaction: EggReactionTheme,
  refinement?: GuidedCaptureOption['refinement'],
): GuidedCaptureOption => ({ id, label, emoji, icon, flowId, categoryId, reaction, refinement });

export const GUIDED_CAPTURE_FLOWS: readonly GuidedCaptureFlow[] = [
  {
    id: 'standout',
    title: 'What stood out today?',
    body: 'One little piece is enough.',
    options: [
      option('people', 'People', '👥', 'person.2.fill', 'people', 'group', 'social', {
        title: 'Who was part of it?',
        categoryIds: ['partner', 'my_child', 'family', 'friends', 'group', 'someone_new', 'pet', 'solo', 'someone_else'],
      }),
      option('outside', 'Getting outside', '🌿', 'leaf.fill', 'went_somewhere', 'park', 'nature', {
        title: 'What kind of place?',
        categoryIds: ['park', 'forest', 'garden', 'beach', 'street', 'travel'],
      }),
      option('progress', 'Getting something done', '🎯', 'trophy.fill', 'work', 'progress', 'positive', {
        title: 'What kind of progress?',
        categoryIds: ['focus', 'home_tasks', 'learning', 'creative', 'progress'],
      }),
      option('different', 'Something different', '✨', 'sparkles', 'general', 'new', 'important'),
      option('rest', 'Taking it easy', '😌', 'moon.stars.fill', 'general', 'rest', 'cozy'),
    ],
  },
  {
    id: 'people',
    title: 'Who was part of today?',
    body: 'You never need to name anyone.',
    options: [
      option('partner', 'Partner', '❤️', 'heart.fill', 'people', 'partner', 'important'),
      option('my_child', 'My child', '🫶', 'figure.and.child.holdinghands', 'people', 'my_child', 'important'),
      option('family', 'Family', '❤️', 'person.3.fill', 'people', 'family', 'social'),
      option('friends', 'Friends', '👥', 'bubble.left.and.bubble.right.fill', 'people', 'friends', 'social'),
      option('pet', 'A pet', '🐾', 'pawprint.fill', 'people', 'pet', 'social'),
      option('more', 'Someone else or me', '✨', 'person.fill', 'people', 'someone_else', 'neutral', {
        title: 'Which fits best?',
        categoryIds: ['group', 'someone_new', 'someone_else', 'solo'],
      }),
    ],
  },
  {
    id: 'movement',
    title: 'What kind of movement was it?',
    body: 'Choose the closest fit.',
    options: [
      option('walk', 'A walk', '🚶', 'figure.walk', 'movement', 'walk', 'nature'),
      option('exercise', 'Exercise', '🏃', 'figure.run', 'movement', 'workout', 'active', {
        title: 'What kind of exercise?',
        categoryIds: ['run', 'cycle', 'workout'],
      }),
      option('sport', 'Sport', '⚽', 'sportscourt.fill', 'movement', 'sport', 'active'),
      option('errands', 'Running around', '🛍️', 'cart.fill', 'movement', 'errands', 'active', {
        title: 'What kind of running around?',
        categoryIds: ['errands', 'commute'],
      }),
      option('exploring', 'Exploring', '🗺️', 'map.fill', 'movement', 'travel', 'nature', {
        title: 'How were you exploring?',
        categoryIds: ['walk', 'hike', 'travel'],
      }),
      option('mixed', 'Nothing in particular', '🤷', 'figure.mixed.cardio', 'movement', 'mixed', 'neutral'),
    ],
  },
  {
    id: 'place',
    title: 'Where did today take you?',
    body: 'Choose the closest kind of place.',
    options: [
      option('outdoors', 'Outdoors', '🌳', 'leaf.fill', 'went_somewhere', 'park', 'nature', {
        title: 'What kind of outdoor place?',
        categoryIds: ['park', 'forest', 'garden', 'beach'],
      }),
      option('around_town', 'Town or neighbourhood', '🏙️', 'building.2.fill', 'went_somewhere', 'city', 'active', {
        title: 'What kind of local place?',
        categoryIds: ['city', 'street'],
      }),
      option('culture', 'Culture or entertainment', '🎭', 'building.columns.fill', 'went_somewhere', 'museum', 'important', {
        title: 'Which kind of place?',
        categoryIds: ['museum', 'cinema'],
      }),
      option('cafe_or_restaurant', 'Cafe or restaurant', '☕', 'cup.and.saucer.fill', 'went_somewhere', 'cafe', 'cozy', {
        title: 'Which was it?',
        categoryIds: ['cafe', 'restaurant'],
      }),
      option('home', 'At home', '🏠', 'house.fill', 'went_somewhere', 'home', 'cozy'),
      option('trip_or_elsewhere', 'A trip or somewhere else', '✨', 'airplane', 'went_somewhere', 'travel', 'important', {
        title: 'Which fits best?',
        categoryIds: ['travel', 'other_place'],
      }),
    ],
  },
  {
    id: 'food',
    title: 'What was worth remembering?',
    body: 'Choose the closest fit.',
    options: [
      option('meal', 'A meal', '🍽️', 'fork.knife', 'food', 'meal', 'positive'),
      option('snack', 'A snack', '🍎', 'takeoutbag.and.cup.and.straw.fill', 'food', 'snack', 'positive'),
      option('dessert', 'Dessert or a treat', '🍰', 'birthday.cake.fill', 'food', 'dessert', 'important'),
      option('a_drink', 'A drink', '☕', 'cup.and.saucer.fill', 'food', 'drink', 'cozy', {
        title: 'What kind of drink?',
        categoryIds: ['coffee', 'tea', 'drink'],
      }),
      option('made', 'Made something', '🍳', 'frying.pan.fill', 'food', 'cooking', 'positive'),
      option('other', 'Something else', '✨', 'ellipsis.circle.fill', 'food', 'other_food', 'neutral'),
    ],
  },
  {
    id: 'work',
    title: 'What kind of win was it?',
    body: 'A small win still counts.',
    options: [
      option('work', 'Work', '💼', 'briefcase.fill', 'work', 'focus', 'positive', {
        title: 'What kind of work?',
        categoryIds: ['focus', 'office', 'learning', 'planning', 'admin', 'other_work'],
      }),
      option('life', 'Life stuff', '🏠', 'house.fill', 'work', 'home_tasks', 'positive'),
      option('health', 'Health or activity', '🏃', 'figure.run', 'movement', 'workout', 'active'),
      option('creative', 'Something creative', '🎨', 'paintbrush.fill', 'work', 'creative', 'important'),
      option('personal', 'Something personal', '🌱', 'leaf.fill', 'work', 'progress', 'positive'),
    ],
  },
  {
    id: 'inspiration',
    title: 'What stayed with you today?',
    body: 'A title is optional. Start with the kind of inspiration.',
    options: [
      option('book', 'A book or audiobook', '📖', 'book.fill', 'studio', 'book', 'cozy'),
      option('screen', 'A film or show', '🎬', 'film.fill', 'studio', 'film', 'important', {
        title: 'Which was it?',
        categoryIds: ['film', 'show'],
      }),
      option('music', 'Music or a podcast', '🎧', 'music.note', 'studio', 'music', 'positive', {
        title: 'Which was it?',
        categoryIds: ['music', 'podcast'],
      }),
      option('game', 'A game', '🎮', 'gamecontroller.fill', 'studio', 'game', 'active'),
      option('art', 'Art or something made', '🎨', 'paintbrush.fill', 'studio', 'art', 'important'),
      option('other', 'Something else', '✨', 'sparkles', 'studio', 'other_media', 'neutral'),
    ],
  },
  {
    id: 'big_event',
    title: 'Did today hold a bigger moment?',
    body: 'Choose the closest shape. You can name it afterward.',
    options: [
      option('celebration', 'A celebration', '🎉', 'sparkles', 'big_event', 'milestone', 'social', {
        title: 'What kind of celebration?',
        categoryIds: ['birthday', 'anniversary', 'holiday', 'wedding', 'graduation', 'reunion', 'milestone'],
      }),
      option('achievement', 'An achievement', '🏆', 'trophy.fill', 'big_event', 'achievement', 'positive'),
      option('first', 'A first', '⭐', 'star.fill', 'big_event', 'firstTime', 'important'),
      option('trip', 'A trip or adventure', '🗺️', 'airplane', 'big_event', 'trip', 'nature'),
      option('change', 'A life change', '🌱', 'leaf.fill', 'big_event', 'newJob', 'important', {
        title: 'What kind of change?',
        categoryIds: ['baby', 'newHome', 'newJob'],
      }),
      option('other', 'Another milestone', '✨', 'ellipsis.circle.fill', 'big_event', 'milestone', 'neutral'),
    ],
  },
  {
    id: 'general',
    title: 'What kind of moment was it?',
    body: 'Choose the closest fit.',
    options: [
      option('highlight', 'A highlight', '⭐', 'star.fill', 'general', 'highlight', 'positive'),
      option('difficult', 'A difficult moment', '🌧️', 'cloud.rain.fill', 'general', 'difficult', 'cozy'),
      option('gratitude', 'Something I’m grateful for', '❤️', 'heart.fill', 'general', 'gratitude', 'important'),
      option('rest', 'Rest or recovery', '😌', 'moon.stars.fill', 'general', 'rest', 'cozy'),
      option('nature', 'Nature or weather', '🌿', 'leaf.fill', 'general', 'nature', 'nature'),
      option('other', 'Something else', '✨', 'ellipsis.circle.fill', 'general', 'other', 'neutral', {
        title: 'What kind of moment?',
        categoryIds: ['new', 'morning', 'ordinary', 'other'],
      }),
    ],
  },
  {
    id: 'reflection',
    title: 'What are you taking from today?',
    body: 'Only if something comes to mind.',
    options: [
      option('grateful', 'Something I’m grateful for', '❤️', 'heart.fill', 'general', 'gratitude', 'important'),
      option('proud', 'Something I’m proud of', '🎯', 'trophy.fill', 'general', 'highlight', 'positive'),
      option('learned', 'Something I learned', '🌱', 'leaf.fill', 'work', 'learning', 'important'),
      option('thinking', 'Still thinking about it', '💭', 'ellipsis.bubble.fill', 'general', 'other', 'neutral'),
      option('difficult', 'Something difficult', '🌧️', 'cloud.rain.fill', 'general', 'difficult', 'cozy'),
      option('nothing', 'Nothing in particular', '✨', 'circle.fill', 'general', 'ordinary', 'neutral'),
    ],
  },
] as const;

export function guidedCaptureFlow(id: string): GuidedCaptureFlow | null {
  return GUIDED_CAPTURE_FLOWS.find((flow) => flow.id === id) ?? null;
}

export function guidedCaptureFlowForCareAction(actionId: string): GuidedCaptureFlow | null {
  // These already are complete, one-tap questions with their own answer data.
  // Sending them through guided capture replaces the bespoke question with the
  // generic journal reflection hierarchy and loses the original coverage.
  if (actionId === 'reflection' || actionId.startsWith('about_today:')) return null;
  const id = ({
    journal: 'standout',
    people: 'people',
    movement: 'movement',
    place: 'place',
    food: 'food',
    studio: 'inspiration',
    work: 'work',
    big_event: 'big_event',
  } as Record<string, string>)[actionId];
  return id ? guidedCaptureFlow(id) : null;
}

export function guidedCaptureFlowForManualFlowId(flowId?: string | null): GuidedCaptureFlow | null {
  const guidedId = ({
    people: 'people',
    food: 'food',
    went_somewhere: 'place',
    movement: 'movement',
    studio: 'inspiration',
    work: 'work',
    big_event: 'big_event',
    general: 'general',
  } as Record<string, string>)[flowId ?? ''];
  return guidedId ? guidedCaptureFlow(guidedId) : guidedCaptureFlow('standout');
}

export function guidedCaptureFlowForQuickCategory(categoryId: string): GuidedCaptureFlow | null {
  const guidedId = ({
    manual_journal: 'standout',
    people: 'people',
    place: 'place',
    movement: 'movement',
    food: 'food',
    studio: 'inspiration',
    work: 'work',
    life_event: 'big_event',
    reflection: 'reflection',
  } as Record<string, string>)[categoryId];
  return guidedId ? guidedCaptureFlow(guidedId) : null;
}

export function guidedFollowUpOptions(selected: GuidedCaptureOption): readonly GuidedFollowUpOption[] {
  const flow = manualJournalFlow(selected.flowId);
  const choice = flow?.choices.find((candidate) => candidate.id === selected.categoryId);
  const contextOptions = choice?.contextChoices ?? choice?.detailChoices ?? flow?.contextChoices;
  if (contextOptions?.length) return contextOptions.map((item) => ({ ...item, kind: 'context' as const }));
  return (choice?.feelings ?? flow?.feelings ?? []).map((item) => ({ id: item.id, label: item.label, kind: 'feeling' as const }));
}

export function guidedRefinementOptions(selected: GuidedCaptureOption): readonly GuidedCaptureOption[] {
  const refinement = selected.refinement;
  if (!refinement) return [];
  const flow = manualJournalFlow(selected.flowId);
  if (!flow) return [];
  return refinement.categoryIds.flatMap((categoryId) => {
    const choice = flow.choices.find((candidate) => candidate.id === categoryId);
    if (!choice) return [];
    return [{
      id: categoryId,
      label: choice.label,
      emoji: selected.emoji,
      icon: choice.icon,
      flowId: flow.id,
      categoryId: choice.id,
      reaction: selected.reaction,
      rootOptionId: selected.rootOptionId ?? selected.id,
    } satisfies GuidedCaptureOption];
  });
}

export function guidedRefinementTitle(selected: GuidedCaptureOption): string {
  return selected.refinement?.title ?? 'Which fits best?';
}

export function guidedFollowUpTitle(selected: GuidedCaptureOption): string {
  const flow = manualJournalFlow(selected.flowId);
  const choice = flow?.choices.find((candidate) => candidate.id === selected.categoryId);
  return choice?.contextTitle ?? choice?.detailTitle ?? flow?.detailTitle ?? 'Want to add a little more?';
}

export function buildGuidedCaptureSubmission(input: {
  sessionId: string;
  promptId: string;
  option: GuidedCaptureOption;
  contextId?: string | null;
  note?: string | null;
  specific?: string | null;
  entryPoint?: GuidedCaptureEntryPoint;
  journalSource?: JournalSource;
}): ManualJournalSubmission {
  const flow = manualJournalFlow(input.option.flowId);
  const choice = flow?.choices.find((candidate) => candidate.id === input.option.categoryId);
  if (!flow || !choice) throw new Error(`Invalid guided capture route ${input.option.flowId}.${input.option.categoryId}`);
  const answerIds = [
    ...(input.option.rootOptionId ? [input.option.rootOptionId] : []),
    input.option.id,
    ...(input.contextId ? [input.contextId] : []),
  ];
  const followUp = input.contextId
    ? guidedFollowUpOptions(input.option).find((item) => item.id === input.contextId) ?? null
    : null;
  const source: JournalSource = input.journalSource ?? {
    kind: 'manual',
    sourceId: input.sessionId,
    origin: {
      kind: 'guided_capture',
      sessionId: input.sessionId,
      promptId: input.promptId,
      answerIds,
      entryPoint: input.entryPoint,
      captureMode: 'choice',
    },
  };
  return {
    sessionId: input.sessionId,
    flowId: flow.id,
    path: [flow.id, choice.id, ...(input.contextId ? [input.contextId] : [])],
    categoryId: choice.id,
    canonicalQualityIds: choice.qualityIds ?? [],
    fields: { specific: input.specific?.trim() || null, context: followUp?.kind === 'context' ? input.contextId ?? null : null, guided_answers: answerIds },
    feeling: followUp?.kind === 'feeling' ? input.contextId ?? null : null,
    note: input.note?.trim() || null,
    sourceType: 'manual',
    sourceId: input.sessionId,
    journalSource: source,
    confirmedFacets: choice.confirmedFacets ?? [],
  };
}

export function eggReactionTint(theme: EggReactionTheme): string {
  return ({
    nature: '#78B993', social: '#E59AA0', active: '#E8AA62', cozy: '#A99AC7', positive: '#E3BD67', important: '#DDA6C5', neutral: '#A8B5A2',
  } as const)[theme];
}
