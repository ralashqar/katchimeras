import type { ClassifiedMemory, UserConfirmation } from '@/types/home';
import { withMemoryConfirmation } from '@/utils/intelligence/classification';

export type ClarificationOption = {
  id: string;
  label: string;
  emoji: string;
  facetKey: string;
  facetValue: string;
  nextNodeId?: string | null;
  meaning?: 'calm' | 'energy' | 'together' | 'meaningful';
};

export type ClarificationNode = {
  id: string;
  question: string;
  options: ClarificationOption[];
};

export type ClarificationGraph = {
  id: string;
  version: number;
  rootNodeId: string;
  nodes: Record<string, ClarificationNode>;
};

const FOOD_MEANINGS: ClarificationNode = {
  id: 'meaning',
  question: 'What made it worth keeping?',
  options: [
    option('shared', 'Shared', '🍽️', 'food_meaning', 'shared', null, 'together'),
    option('treat', 'A treat', '🎁', 'food_meaning', 'treat', null, 'energy'),
    option('comfort', 'Comfort', '💛', 'food_meaning', 'comfort', null, 'calm'),
    option('discovery', 'A discovery', '✨', 'food_meaning', 'discovery', null, 'meaningful'),
    option('fuel', 'Fuel', '⚡', 'food_meaning', 'fuel', null, 'energy'),
  ],
};

const GRAPHS: Record<string, ClarificationGraph> = {
  'animal-relationship': graph('animal-relationship', {
    root: {
      id: 'root',
      question: 'Is this a pet?',
      options: [
        option('my_pet', 'My pet', '🐾', 'relationship', 'my_pet', 'meaning'),
        option('known_pet', "Someone else's pet", '🏡', 'relationship', 'known_pet', 'meaning'),
        option('animal_met', 'An animal I met', '🌿', 'relationship', 'animal_met', null, 'meaningful'),
        option('not_about_animal', 'Not about the animal', '↩️', 'relationship', 'incidental', null, 'meaningful'),
      ],
    },
    meaning: {
      id: 'meaning',
      question: 'What did this moment bring?',
      options: [
        option('companion', 'Companionship', '🐾', 'animal_meaning', 'companion', null, 'together'),
        option('comfort', 'Comfort', '🤍', 'animal_meaning', 'comfort', null, 'calm'),
        option('playful', 'Playfulness', '✨', 'animal_meaning', 'playful', null, 'energy'),
        option('walk_together', 'A walk together', '🚶', 'animal_meaning', 'walk_together', null, 'energy'),
      ],
    },
  }),
  'people-relationship': graph('people-relationship', {
    root: {
      id: 'root',
      question: 'Who is this moment about?',
      options: [
        option('my_child', 'My child', '🫶', 'relationship', 'my_child', 'child-role'),
        option('partner', 'Partner', '💛', 'relationship', 'partner', null, 'together'),
        option('family', 'Family', '🏡', 'relationship', 'family', 'family-role'),
        option('friends', 'Friend(s)', '✨', 'relationship', 'friends', 'friend-role'),
        option('colleagues', 'Colleague(s)', '🤝', 'relationship', 'colleagues', null, 'together'),
        option('me', 'Me', '🌿', 'relationship', 'self', null, 'meaningful'),
        option('someone_else', 'Someone else', '👋', 'relationship', 'someone_else', null, 'meaningful'),
        option('not_about_people', 'Not about the people', '↩️', 'relationship', 'incidental', null, 'meaningful'),
      ],
    },
    'child-role': {
      id: 'child-role',
      question: 'How would you like to remember them?',
      options: [
        option('daughter', 'Daughter', '💛', 'relationship_role', 'daughter', null, 'together'),
        option('son', 'Son', '💛', 'relationship_role', 'son', null, 'together'),
        option('child', 'My child', '🫶', 'relationship_role', 'child', null, 'together'),
        option('private', 'Keep it private', '🌙', 'relationship_role', 'unspecified', null, 'together'),
      ],
    },
    'family-role': {
      id: 'family-role',
      question: 'What kind of family moment?',
      options: [
        option('son', 'My son', '💛', 'relationship_role', 'son', null, 'together'),
        option('daughter', 'My daughter', '💛', 'relationship_role', 'daughter', null, 'together'),
        option('child', 'My child', '🫶', 'relationship_role', 'child', null, 'together'),
        option('parent', 'Parent', '🏡', 'relationship_role', 'parent', null, 'together'),
        option('sibling', 'Sibling', '✨', 'relationship_role', 'sibling', null, 'together'),
        option('grandparent', 'Grandparent', '🌿', 'relationship_role', 'grandparent', null, 'together'),
        option('niece_nephew', 'Niece / nephew', '🫶', 'relationship_role', 'niece_nephew', null, 'together'),
        option('grandchild', 'Grandchild', '🌱', 'relationship_role', 'grandchild', null, 'together'),
        option('cousin', 'Cousin', '✨', 'relationship_role', 'cousin', null, 'together'),
        option('extended', 'Other family', '💛', 'relationship_role', 'extended_family', null, 'together'),
      ],
    },
    'friend-role': {
      id: 'friend-role',
      question: 'What kind of friend moment?',
      options: [
        option('close_friend', 'Close friend', '💛', 'relationship', 'close_friend', null, 'together'),
        option('friend', 'A friend', '🌿', 'relationship_role', 'friend', null, 'together'),
        option('friend_group', 'Friend group', '✨', 'relationship_role', 'friend_group', null, 'energy'),
        option('new_friend', 'New friend', '🌱', 'relationship_role', 'new_friend', null, 'meaningful'),
        option('work_school_friend', 'Work / school friend', '🤝', 'relationship_role', 'work_school_friend', null, 'together'),
        option('other_friend', 'Other', '👋', 'relationship_role', 'other_friend', null, 'together'),
      ],
    },
    'young-family-role': {
      id: 'young-family-role',
      question: 'How are they related to you?',
      options: [
        option('son', 'My son', '💛', 'relationship_role', 'son', null, 'together'),
        option('daughter', 'My daughter', '💛', 'relationship_role', 'daughter', null, 'together'),
        option('child', 'My child', '🫶', 'relationship_role', 'child', null, 'together'),
        option('niece_nephew', 'Niece / nephew', '🫶', 'relationship_role', 'niece_nephew', null, 'together'),
        option('grandchild', 'Grandchild', '🌱', 'relationship_role', 'grandchild', null, 'together'),
        option('sibling', 'Sibling', '✨', 'relationship_role', 'sibling', null, 'together'),
        option('cousin', 'Cousin', '🏡', 'relationship_role', 'cousin', null, 'together'),
        option('other_family', 'Other family', '💛', 'relationship_role', 'extended_family', null, 'together'),
      ],
    },
    'child-friend-role': {
      id: 'child-friend-role',
      question: 'What is the connection?',
      options: [
        option('friends_child', "Friend's child", '🤝', 'relationship_role', 'friends_child', null, 'together'),
        option('family_friend', 'Family friend', '🏡', 'relationship_role', 'family_friend', null, 'together'),
        option('young_friend', 'A young friend', '✨', 'relationship_role', 'young_friend', null, 'together'),
        option('caregiving', 'Someone I care for', '🫶', 'relationship_role', 'caregiving', null, 'meaningful'),
        option('other_connection', 'Other', '👋', 'relationship_role', 'other_connection', null, 'meaningful'),
      ],
    },
  }),
  'food-context': graph('food-context', {
    root: {
      id: 'root',
      question: 'What was the food part?',
      options: [
        option('meal', 'A meal', '🍽️', 'food_kind', 'meal', 'meaning'),
        option('drink', 'Coffee / drink', '☕', 'food_kind', 'drink', 'meaning'),
        option('snack', 'A snack', '🥐', 'food_kind', 'snack', 'meaning'),
        option('dessert', 'Dessert', '🍰', 'food_kind', 'dessert', 'meaning'),
        option('cooking', 'Cooking', '🍲', 'food_kind', 'cooking', 'meaning'),
        option('incidental', 'Not about the food', '↩️', 'food_kind', 'incidental', null, 'meaningful'),
      ],
    },
    meaning: FOOD_MEANINGS,
  }),
  'place-context': graph('place-context', {
    root: {
      id: 'root', question: 'What kind of stop was this?', options: [
        option('visit', 'A visit', '📍', 'place_purpose', 'visit', null, 'together'),
        option('work', 'Work', '💼', 'place_purpose', 'work', null, 'meaningful'),
        option('family', 'Family visit', '🏡', 'place_purpose', 'family', null, 'together'),
        option('appointment', 'Appointment', '🗓️', 'place_purpose', 'appointment', null, 'meaningful'),
        option('shopping', 'Shopping', '🛍️', 'place_purpose', 'shopping', null, 'energy'),
        option('exercise', 'Exercise', '🏃', 'place_purpose', 'exercise', null, 'energy'),
        option('passing', 'Passing through', '↪️', 'place_purpose', 'passing_through', null, 'meaningful'),
      ],
    },
  }),
  'nature-context': graph('nature-context', {
    root: {
      id: 'root', question: 'What drew you to this scene?', options: [
        option('view', 'The view', '🌄', 'nature_context', 'view', null, 'meaningful'),
        option('walk', 'A walk', '🚶', 'nature_context', 'walk', null, 'calm'),
        option('hike', 'A hike', '🥾', 'nature_context', 'hike', null, 'energy'),
        option('weather', 'The weather', '🌦️', 'nature_context', 'weather', null, 'meaningful'),
        option('garden', 'The plants', '🌿', 'nature_context', 'plants', null, 'calm'),
        option('water', 'The water', '🌊', 'nature_context', 'water', null, 'calm'),
      ],
    },
  }),
  'activity-context': graph('activity-context', {
    root: {
      id: 'root', question: 'What was happening here?', options: [
        option('doing', 'I was doing it', '⚡', 'activity_role', 'participant', null, 'energy'),
        option('watching', 'I was watching', '👀', 'activity_role', 'spectator', null, 'meaningful'),
        option('workout', 'A workout', '🏋️', 'activity_kind', 'workout', null, 'energy'),
        option('sport', 'Sport', '🏀', 'activity_kind', 'sport', null, 'energy'),
        option('creative', 'Making something', '🎨', 'activity_kind', 'creative', null, 'meaningful'),
        option('not_activity', 'Not about the activity', '↩️', 'activity_kind', 'incidental', null, 'meaningful'),
      ],
    },
  }),
  'work-context': graph('work-context', {
    root: {
      id: 'root', question: 'What kind of focus was this?', options: [
        option('deep_work', 'Deep work', '💡', 'work_kind', 'deep_work', null, 'meaningful'),
        option('learning', 'Learning', '📚', 'work_kind', 'learning', null, 'meaningful'),
        option('making', 'Making', '🎨', 'work_kind', 'making', null, 'energy'),
        option('planning', 'Planning', '🗒️', 'work_kind', 'planning', null, 'calm'),
        option('admin', 'Life admin', '✅', 'work_kind', 'admin', null, 'meaningful'),
        option('not_work', 'Not about work', '↩️', 'work_kind', 'incidental', null, 'meaningful'),
      ],
    },
  }),
  'life-event-context': graph('life-event-context', {
    root: {
      id: 'root', question: 'What kind of life moment was this?', options: [
        option('birthday', 'Birthday', '🎂', 'life_event', 'birthday', null, 'together'),
        option('wedding', 'Wedding', '💍', 'life_event', 'wedding', null, 'together'),
        option('graduation', 'Graduation', '🎓', 'life_event', 'graduation', null, 'meaningful'),
        option('new_home', 'New home', '🏡', 'life_event', 'new_home', null, 'meaningful'),
        option('new_job', 'New job', '💼', 'life_event', 'new_job', null, 'meaningful'),
        option('reunion', 'Reunion', '🤗', 'life_event', 'reunion', null, 'together'),
        option('other_event', 'Another milestone', '✨', 'life_event', 'other', null, 'meaningful'),
      ],
    },
  }),
  'document-screen-context': graph('document-screen-context', {
    root: {
      id: 'root', question: 'What should this be remembered as?', options: [
        option('game', 'Game', '🎮', 'media_type', 'game', null, 'energy'),
        option('app', 'App / website', '📱', 'screen_kind', 'app', null, 'meaningful'),
        option('article', 'Article', '📰', 'screen_kind', 'article', null, 'meaningful'),
        option('receipt', 'Receipt', '🧾', 'document_kind', 'receipt', null, 'meaningful'),
        option('menu', 'Menu', '📋', 'document_kind', 'menu', null, 'meaningful'),
        option('book', 'Book', '📖', 'media_type', 'book', null, 'meaningful'),
        option('irrelevant', 'Do not file this', '↩️', 'screen_kind', 'incidental', null, 'meaningful'),
      ],
    },
  }),
  'media-context': graph('media-context', {
    root: {
      id: 'root',
      question: 'What was this?',
      options: [
        option('film', 'Movie', '🎬', 'media_type', 'film', 'meaning'),
        option('show', 'Show', '📺', 'media_type', 'show', 'meaning'),
        option('book', 'Book', '📖', 'media_type', 'book', 'meaning'),
        option('game', 'Game', '🎮', 'media_type', 'game', 'meaning'),
        option('music', 'Music', '🎵', 'media_type', 'music', 'meaning'),
        option('art', 'Art', '🎨', 'media_type', 'art', 'meaning'),
        option('not_media', 'Not media', '↩️', 'media_type', 'other', null, 'meaningful'),
      ],
    },
    title: {
      // Replaced at runtime with the OCR-supported title candidate.
      id: 'title',
      question: 'Did I read the title correctly?',
      options: [],
    },
    meaning: {
      id: 'meaning',
      question: 'How did it land?',
      options: [
        option('loved', 'Loved it', '💛', 'media_rating', 'loved', null, 'together'),
        option('inspired', 'Inspired me', '✨', 'media_rating', 'inspired', null, 'meaningful'),
        option('liked', 'Liked it', '👍', 'media_rating', 'liked', null, 'calm'),
        option('meh', 'Meh', '🌫️', 'media_rating', 'meh', null, 'calm'),
        option('thinking', 'Still thinking', '💭', 'media_rating', 'thinking', null, 'meaningful'),
      ],
    },
  }),
};

export function clarificationGraphForMemory(memory: ClassifiedMemory): ClarificationGraph | null {
  const id = memory.promptState.graphId;
  return id ? GRAPHS[id] ?? null : null;
}

export function currentClarificationNode(memory: ClassifiedMemory): ClarificationNode | null {
  const graph = clarificationGraphForMemory(memory);
  const nodeId = memory.promptState.currentNodeId ?? graph?.rootNodeId;
  const node = graph && nodeId ? graph.nodes[nodeId] ?? null : null;
  if (!node) return null;
  if (memory.promptState.graphId === 'media-context' && node.id === 'title') {
    const title = memory.facets.find(
      (facet) => facet.key === 'media_title' && facet.value !== 'unknown'
    )?.value;
    // A legacy record can point here without retaining OCR. Avoid a dead end.
    if (!title) return graph?.nodes.meaning ?? null;
    return {
      id: 'title',
      question: `Is this “${title}”?`,
      options: [
        option('confirm_title', 'Yes, keep this title', '✓', 'media_title', title, 'meaning', 'meaningful'),
        option('unnamed_title', 'Keep without a title', '📚', 'media_title', 'unknown', 'meaning', 'meaningful'),
      ],
    };
  }
  if (memory.promptState.graphId === 'media-context' && node.id === 'meaning') {
    const title = memory.facets.find(
      (facet) => facet.key === 'media_title' && facet.value !== 'unknown'
    )?.value;
    return title ? { ...node, question: `How did “${title}” land?` } : node;
  }
  if (memory.promptState.graphId === 'media-context' && node.id === 'root') {
    const isTelevision = memory.observations.some((observation) =>
      /television|\btv\b|tv screen|broadcast/i.test(`${observation.value} ${observation.raw ?? ''}`)
    );
    const title = memory.facets.find((facet) => facet.key === 'media_title')?.value;
    const mediaTypeFacet = memory.facets.find(
      (facet) => facet.key === 'media_type' && !facet.confirmed && facet.value !== 'other'
    );
    const structuredBook = memory.photoAnalysis?.subjects.some(
      (subject) => subject.canonicalValue === 'book' && subject.role !== 'incidental' && subject.score >= 0.55
    ) && memory.observations.some(
      (observation) => observation.value === 'document' && observation.confidence >= 0.55
    );
    const inferredMediaType = mediaTypeFacet?.value ?? (
      memory.photoAnalysis?.subjects.some(
        (subject) => subject.role === 'primary' && subject.canonicalValue === 'book'
      ) || structuredBook ? 'book' : undefined
    );
    if (inferredMediaType === 'book') {
      return {
        id: 'root',
        question: 'Is this a book?',
        options: [
          option('confirm_book', 'Yes, a book', '📖', 'media_type', 'book', title ? 'title' : 'meaning', 'meaningful'),
          option('other_media', 'Something else', '✨', 'media_type', 'other_screen', null, 'meaningful'),
          option('not_media', 'Not media', '↩️', 'media_type', 'other', null, 'meaningful'),
        ],
      };
    }
    if (
      !isTelevision &&
      title &&
      memory.facets.some((facet) => facet.key === 'media_type' && facet.confirmed && facet.value !== 'other') &&
      !memory.facets.some((facet) => facet.key === 'media_title' && facet.confirmed)
    ) {
      return {
        id: 'root',
        question: `Is this “${title}”?`,
        options: [
          option('confirm_title', 'Yes, keep this title', '✓', 'media_title', title, 'meaning', 'meaningful'),
          option('unnamed_title', 'Keep without a title', '📚', 'media_title', 'unknown', 'meaning', 'meaningful'),
        ],
      };
    }
    if (isTelevision) {
      return {
        id: 'root',
        question: 'What were you watching?',
        options: [
          option('live_sport', 'Live sport', '🏟️', 'media_type', 'live_sport', 'meaning', 'energy'),
          option('movie_show', 'Movie / show', '📺', 'media_type', 'show', 'meaning', 'calm'),
          option('video_game', 'A video game', '🎮', 'media_type', 'game', 'meaning', 'energy'),
          option('news_event', 'News / live event', '📰', 'media_type', 'news', 'meaning', 'meaningful'),
          option('other_tv', 'Something else', '✨', 'media_type', 'other_screen', 'meaning', 'meaningful'),
          option('not_about_screen', 'Not about the screen', '↩️', 'media_type', 'other', null, 'meaningful'),
        ],
      };
    }
    if (title) {
      return {
        ...node,
        options: node.options.map((item) =>
          item.facetKey === 'media_type' && item.facetValue === 'book'
            ? { ...item, nextNodeId: 'title' }
            : item
        ),
      };
    }
  }
  if (memory.promptState.graphId !== 'people-relationship' || node.id !== 'root') return node;
  const subject = memory.facets.find((facet) => facet.key === 'person_subject')?.value;
  if (subject === 'baby' || subject === 'child') return youngPersonRoot(subject);
  // Age classification must not decide which relationships the user is
  // allowed to declare: an adult may be their son/daughter, and a weak angle
  // may reduce `child` to generic `person`. People depicted on screens are
  // filtered before this graph, so keeping My child here does not revive the
  // old television-face false prompt.
  if (subject === 'person') return { ...node, question: 'Who is this person to you?' };
  if (subject === 'group') return { ...node, question: 'Who were you with?' };
  return node;
}

function youngPersonRoot(subject: 'baby' | 'child'): ClarificationNode {
  return {
    id: 'root',
    question: subject === 'baby' ? 'Who is this little one to you?' : 'Who is this child to you?',
    options: [
      option('my_child', 'My child', '🫶', 'relationship', 'my_child', 'child-role'),
      option('family', 'Family', '🏡', 'relationship', 'family', 'young-family-role'),
      option('friends', "Friend / friend's child", '✨', 'relationship', 'friends', 'child-friend-role'),
      option('someone_known', 'Someone I know', '🤝', 'relationship', 'someone_known', null, 'together'),
      option('someone_else', 'Someone else', '👋', 'relationship', 'someone_else', null, 'meaningful'),
      option('not_about_person', 'Not about them', '↩️', 'relationship', 'incidental', null, 'meaningful'),
    ],
  };
}

export function answerClarification(
  memory: ClassifiedMemory,
  node: ClarificationNode,
  selected: ClarificationOption,
  now = new Date()
): ClassifiedMemory {
  const confirmation: UserConfirmation = {
    promptId: `${memory.promptState.graphId}.${node.id}`,
    optionId: selected.id,
    label: selected.label,
    facetKey: selected.facetKey,
    facetValue: selected.facetValue,
    createdAt: now.toISOString(),
  };
  const next = withMemoryConfirmation(memory, confirmation, node.id, selected.nextNodeId ?? null);
  if (next.promptState.status === 'pending') return next;
  return moveToNextGoal(next, memory.promptState.graphId ?? null);
}

export function skipClarificationGoal(memory: ClassifiedMemory): ClassifiedMemory {
  const currentGoal = memory.promptState.graphId;
  const questionCount = (memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length) + 1;
  const skippedGoalIds = currentGoal
    ? [...new Set([...(memory.promptState.skippedGoalIds ?? []), currentGoal])]
    : memory.promptState.skippedGoalIds ?? [];
  const next = {
    ...memory,
    promptState: { ...memory.promptState, questionCount, skippedGoalIds, status: 'answered' as const, currentNodeId: null },
  };
  return moveToNextGoal(next, null);
}

export function dismissClarification(memory: ClassifiedMemory, now = new Date()): ClassifiedMemory {
  return {
    ...memory,
    promptState: { ...memory.promptState, status: 'dismissed', currentNodeId: null, dismissedAt: now.toISOString() },
  };
}

function moveToNextGoal(memory: ClassifiedMemory, completedGoalId: string | null): ClassifiedMemory {
  const completedGoalIds = completedGoalId
    ? [...new Set([...(memory.promptState.completedGoalIds ?? []), completedGoalId])]
    : memory.promptState.completedGoalIds ?? [];
  const blocked = new Set([...completedGoalIds, ...(memory.promptState.skippedGoalIds ?? [])]);
  const questionCount = memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length;
  if (questionCount >= (memory.promptState.maxQuestions ?? 3)) {
    return { ...memory, promptState: { ...memory.promptState, completedGoalIds, status: 'answered', currentNodeId: null } };
  }
  // Do not turn every supporting label into another questionnaire. Hierarchy
  // lives inside the selected graph. A different subject is considered only
  // after rejection replans that subject to primary.
  const candidates = [...(memory.photoAnalysis?.subjects ?? [])]
    .filter((subject) => subject.role === 'primary')
    .sort((left, right) => right.score - left.score);
  const nextGraphId = candidates.map(graphIdForSubject).find((id) => id && !blocked.has(id)) ?? null;
  if (!nextGraphId) {
    return { ...memory, promptState: { ...memory.promptState, completedGoalIds, status: 'answered', currentNodeId: null } };
  }
  const confirmedMediaType = memory.facets.some(
    (facet) => facet.key === 'media_type' && facet.confirmed && facet.value !== 'other'
  );
  const unconfirmedTitle = memory.facets.some(
    (facet) => facet.key === 'media_title' && !facet.confirmed && facet.value !== 'unknown'
  );
  // A document/screen question can already establish that the subject is a
  // book or game. Enter the media flow at the next unresolved question rather
  // than asking "What was this?" a second time.
  const nextNodeId = nextGraphId === 'media-context' && confirmedMediaType
    ? unconfirmedTitle ? 'title' : 'meaning'
    : 'root';
  return {
    ...memory,
    promptState: {
      ...memory.promptState,
      completedGoalIds,
      graphId: nextGraphId,
      currentNodeId: nextNodeId,
      status: 'pending',
    },
  };
}

function graphIdForSubject(subject: NonNullable<ClassifiedMemory['photoAnalysis']>['subjects'][number]): string | null {
  if (subject.domain === 'people') return 'people-relationship';
  if (subject.domain === 'animal') return 'animal-relationship';
  if (subject.domain === 'food') return 'food-context';
  if (subject.domain === 'media') return 'media-context';
  if (subject.domain === 'place') return 'place-context';
  if (subject.domain === 'nature') return 'nature-context';
  if (subject.domain === 'movement') return 'activity-context';
  if (subject.domain === 'work') return 'work-context';
  if (subject.domain === 'life_event') return 'life-event-context';
  if (subject.canonicalValue === 'screen' || subject.canonicalValue === 'document') return 'document-screen-context';
  return null;
}

function option(
  id: string,
  label: string,
  emoji: string,
  facetKey: string,
  facetValue: string,
  nextNodeId: string | null,
  meaning?: ClarificationOption['meaning']
): ClarificationOption {
  return { id, label, emoji, facetKey, facetValue, nextNodeId, meaning };
}

function graph(id: string, nodes: Record<string, ClarificationNode>): ClarificationGraph {
  return { id, version: 1, rootNodeId: 'root', nodes };
}
