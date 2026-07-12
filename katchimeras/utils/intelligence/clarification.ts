import type { ClassifiedMemory, UserConfirmation } from '@/types/home';
import { withMemoryConfirmation } from '@/utils/intelligence/classification';
import {
  planNextQuestion,
  questionDefinition,
  questionIdForGraphNode,
} from '@/utils/intelligence/question-registry';

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
  'subject-focus': graph('subject-focus', {
    root: {
      id: 'root', question: 'What was this moment mainly about?', options: [
        option('focus_other', 'Something else', '✨', 'primary_subject', 'other', null, 'meaningful'),
      ],
    },
  }),
  'representation-context': graph('representation-context', {
    root: {
      id: 'root', question: 'What kind of image is this?', options: [
        option('real_scene', 'A real scene', '📷', 'representation_kind', 'physical_scene', null, 'meaningful'),
        option('artwork', 'Artwork', '🎨', 'representation_kind', 'artwork', null, 'meaningful'),
        option('screen', 'On a screen', '📱', 'representation_kind', 'screen_or_digital', null, 'meaningful'),
        option('book_document', 'Book / document', '📖', 'representation_kind', 'book_or_document', null, 'meaningful'),
        option('other_image', 'Something else', '✨', 'representation_kind', 'other', null, 'meaningful'),
      ],
    },
  }),
  'art-context': graph('art-context', {
    root: {
      id: 'root', question: 'Whose artwork is this?', options: [
        option('made_by_me', 'Made by me', '🎨', 'art_authorship', 'made_by_me', 'state', 'meaningful'),
        option('made_by_other', 'By someone else', '🖼️', 'art_authorship', 'made_by_someone_else', null, 'meaningful'),
        option('unknown_artist', 'Not sure', '🌙', 'art_authorship', 'unknown', null, 'meaningful'),
        option('not_art', 'This is not art', '↩️', 'art_authorship', 'not_art', null, 'meaningful'),
      ],
    },
    state: {
      id: 'state', question: 'What stage was it at?', options: [
        option('finished', 'Finished work', '✨', 'art_state', 'finished', null, 'meaningful'),
        option('in_progress', 'Work in progress', '🛠️', 'art_state', 'in_progress', null, 'energy'),
        option('experiment', 'An experiment', '🌱', 'art_state', 'experiment', null, 'meaningful'),
      ],
    },
  }),
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
      id: 'root', question: 'What kind of place was this?', options: [
        option('my_home', 'My home', '🏡', 'place_category', 'home', 'home-meaning', 'calm'),
        option('someone_home', "Someone else's home", '🫶', 'place_category', 'someone_elses_home', 'visit-meaning', 'together'),
        option('work_space', 'Work / study', '💼', 'place_category', 'work_space', 'general-purpose', 'meaningful'),
        option('shop_errand', 'Shop / errand', '🛍️', 'place_category', 'shop', 'general-purpose', 'energy'),
        option('appointment', 'Appointment', '🗓️', 'place_category', 'appointment', 'general-purpose', 'meaningful'),
        option('travel_place', 'Travel / transit', '🚉', 'place_category', 'transit_place', 'transit-purpose', 'energy'),
        option('other_place', 'Somewhere else', '📍', 'place_category', 'other_place', 'general-purpose', 'meaningful'),
        option('not_about_place', 'Not about the place', '↩️', 'place_category', 'incidental', null, 'meaningful'),
      ],
    },
    'home-meaning': {
      id: 'home-meaning', question: 'What was happening at home?', options: [
        option('relaxing', 'Relaxing', '🛋️', 'place_meaning', 'relaxing', null, 'calm'),
        option('everyday', 'Everyday home life', '🏡', 'place_meaning', 'everyday_life', null, 'calm'),
        option('family_time', 'Family time', '🫶', 'place_meaning', 'family_time', null, 'together'),
        option('hosting', 'Hosting', '✨', 'place_meaning', 'hosting', null, 'together'),
        option('home_work', 'Working / studying', '💻', 'place_meaning', 'work_study', null, 'meaningful'),
        option('changing_space', 'Changing the space', '🪴', 'place_meaning', 'changing_space', null, 'meaningful'),
      ],
    },
    'visit-meaning': {
      id: 'visit-meaning', question: 'What brought you there?', options: [
        option('catching_up', 'Catching up', '☕', 'place_purpose', 'catching_up', null, 'together'),
        option('family_visit', 'Family visit', '🏡', 'place_purpose', 'family', null, 'together'),
        option('helping', 'Helping / caring', '🫶', 'place_purpose', 'helping', null, 'meaningful'),
        option('celebration', 'A celebration', '🎉', 'place_purpose', 'celebration', null, 'energy'),
        option('staying_over', 'Staying over', '🌙', 'place_purpose', 'staying_over', null, 'calm'),
        option('brief_visit', 'A brief visit', '📍', 'place_purpose', 'visit', null, 'together'),
      ],
    },
    'stay-meaning': {
      id: 'stay-meaning', question: 'What kind of stay was this?', options: [
        option('holiday', 'A trip / holiday', '🧳', 'place_purpose', 'trip', null, 'energy'),
        option('visiting', 'Visiting someone', '🫶', 'place_purpose', 'visiting', null, 'together'),
        option('work_trip', 'Work trip', '💼', 'place_purpose', 'work_trip', null, 'meaningful'),
        option('temporary_home', 'Temporary home', '🏡', 'place_purpose', 'temporary_home', null, 'calm'),
        option('overnight', 'An overnight stop', '🌙', 'place_purpose', 'overnight', null, 'calm'),
      ],
    },
    'general-purpose': {
      id: 'general-purpose', question: 'What brought you here?', options: [
        option('visit', 'A visit', '📍', 'place_purpose', 'visit', null, 'together'),
        option('work', 'Work / study', '💼', 'place_purpose', 'work', null, 'meaningful'),
        option('appointment', 'Appointment', '🗓️', 'place_purpose', 'appointment', null, 'meaningful'),
        option('shopping', 'Shopping / errand', '🛍️', 'place_purpose', 'shopping', null, 'energy'),
        option('exercise', 'Exercise', '🏃', 'place_purpose', 'exercise', null, 'energy'),
        option('social', 'Meeting someone', '🫶', 'place_purpose', 'social', null, 'together'),
        option('passing', 'Passing through', '↪️', 'place_purpose', 'passing_through', null, 'meaningful'),
      ],
    },
    'transit-purpose': {
      id: 'transit-purpose', question: 'What kind of journey was this?', options: [
        option('commute', 'Commute', '🚉', 'place_purpose', 'commute', null, 'energy'),
        option('day_out', 'A day out', '🗺️', 'place_purpose', 'day_out', null, 'energy'),
        option('trip', 'A trip', '🧳', 'place_purpose', 'trip', null, 'meaningful'),
        option('errand_route', 'Running errands', '🛍️', 'place_purpose', 'errands', null, 'energy'),
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
  if (memory.promptState.graphId === 'subject-focus' && node.id === 'root') {
    return contextualSubjectFocusRoot(memory, node);
  }
  if (memory.promptState.graphId === 'place-context' && node.id === 'root') {
    return contextualPlaceRoot(memory, node);
  }
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

function contextualSubjectFocusRoot(memory: ClassifiedMemory, fallback: ClarificationNode): ClarificationNode {
  const candidates = memory.photoAnalysis?.hierarchy?.unresolvedFacets
    .find((facet) => facet.key === 'primary_subject')?.candidates ?? [];
  const options = candidates.flatMap((candidate): ClarificationOption[] => {
    const subject = memory.photoAnalysis?.subjects.find((item) => item.canonicalValue === candidate);
    const rawLabel = subject?.label && subject.label !== candidate ? subject.label : candidate.replace(/_/g, ' ');
    const domain = subject?.domain ?? 'other';
    const icon = domain === 'people' ? '🫶' : domain === 'animal' ? '🐾' : domain === 'food' ? '🍽️' : domain === 'media' ? '🎞️' : domain === 'place' ? '📍' : '✨';
    const archetype = domain === 'people' ? 'together' : domain === 'movement' ? 'energy' : domain === 'food' ? 'calm' : 'meaningful';
    return [option(
      `focus_${candidate.replace(/\W+/g, '_')}`,
      rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
      icon,
      'primary_subject',
      candidate,
      null,
      archetype
    )];
  });
  const deduped = options.filter((item, index) => options.findIndex((candidate) => candidate.facetValue === item.facetValue) === index);
  return deduped.length >= 2
    ? { id: 'root', question: 'What was this moment mainly about?', options: [...deduped, fallback.options[0]] }
    : fallback;
}

function contextualPlaceRoot(memory: ClassifiedMemory, fallback: ClarificationNode): ClarificationNode {
  const observed = memory.observations
    .map((item) => `${item.value} ${item.raw ?? ''}`)
    .join(' ');
  const homeLike = /\b(sofa|couch|living room|bedroom|kitchen|bed|domicile|fireplace|home interior|house interior)\b/i.test(observed);
  if (homeLike) {
    return {
      id: 'root',
      question: 'What kind of space was this?',
      options: [
        option('my_home', 'My home', '🏡', 'place_category', 'home', 'home-meaning', 'calm'),
        option('someone_home', "Someone else's home", '🫶', 'place_category', 'someone_elses_home', 'visit-meaning', 'together'),
        option('place_staying', 'A place I was staying', '🌙', 'place_category', 'temporary_stay', 'stay-meaning', 'calm'),
        option('work_space', 'Work / study space', '💼', 'place_category', 'work_space', 'general-purpose', 'meaningful'),
        option('shared_space', 'Shared / public space', '📍', 'place_category', 'shared_space', 'general-purpose', 'together'),
        option('not_about_space', 'Not about the space', '↩️', 'place_category', 'incidental', null, 'meaningful'),
      ],
    };
  }
  const transitLike = /\b(airport|station|platform|terminal|bus stop|train station|subway|underground|departure gate|arrival gate)\b/i.test(observed);
  if (transitLike) {
    return {
      id: 'root',
      question: 'How did this place fit the journey?',
      options: [
        option('starting_point', 'Starting point', '🚉', 'place_category', 'transit_place', 'transit-purpose', 'energy'),
        option('destination', 'The destination', '📍', 'place_category', 'destination', 'transit-purpose', 'meaningful'),
        option('stop_along_way', 'A stop along the way', '🗺️', 'place_category', 'transit_place', 'transit-purpose', 'meaningful'),
        option('commute_place', 'Part of my commute', '🚇', 'place_category', 'transit_place', 'transit-purpose', 'energy'),
        option('not_about_place', 'Not about the place', '↩️', 'place_category', 'incidental', null, 'meaningful'),
      ],
    };
  }
  return fallback;
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
    promptId: memory.promptState.currentQuestionId ?? `${memory.promptState.graphId}.${node.id}`,
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
  const activeQuestionId = memory.promptState.currentQuestionId ?? questionIdForGraphNode(memory.promptState.graphId, memory.promptState.currentNodeId);
  const activeDefinition = questionDefinition(activeQuestionId);
  const currentGoal = activeDefinition?.goal ?? memory.promptState.graphId;
  const questionCount = (memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length) + 1;
  const skippedGoalIds = currentGoal
    ? [...new Set([...(memory.promptState.skippedGoalIds ?? []), currentGoal])]
    : memory.promptState.skippedGoalIds ?? [];
  const next = {
    ...memory,
    promptState: {
      ...memory.promptState,
      questionCount,
      skippedGoalIds,
      askedQuestionIds: activeQuestionId
        ? [...new Set([...(memory.promptState.askedQuestionIds ?? []), activeQuestionId])]
        : memory.promptState.askedQuestionIds ?? [],
      status: 'answered' as const,
      currentNodeId: null,
      currentQuestionId: null,
    },
  };
  return moveToNextGoal(next, null);
}

export function dismissClarification(memory: ClassifiedMemory, now = new Date()): ClassifiedMemory {
  return {
    ...memory,
    promptState: { ...memory.promptState, status: 'dismissed', currentNodeId: null, currentQuestionId: null, dismissedAt: now.toISOString() },
  };
}

function moveToNextGoal(memory: ClassifiedMemory, completedGoalId: string | null): ClassifiedMemory {
  const activeDefinition = questionDefinition(memory.promptState.currentQuestionId) ??
    questionDefinition(completedGoalId ? `${completedGoalId}.root` : null);
  const completedGoalIds = completedGoalId
    ? [...new Set([...(memory.promptState.completedGoalIds ?? []), completedGoalId])]
    : memory.promptState.completedGoalIds ?? [];
  const blocked = new Set([...completedGoalIds, ...(memory.promptState.skippedGoalIds ?? [])]);
  const resolvedGoalIds = activeDefinition?.goal
    ? [...new Set([...(memory.promptState.resolvedGoalIds ?? []), activeDefinition.goal])]
    : memory.promptState.resolvedGoalIds ?? [];
  resolvedGoalIds.forEach((goal) => blocked.add(goal));
  const questionCount = memory.promptState.questionCount ?? memory.promptState.answeredNodeIds.length;
  if (questionCount >= (memory.promptState.maxQuestions ?? 3)) {
    return { ...memory, promptState: { ...memory.promptState, completedGoalIds, resolvedGoalIds, status: 'answered', currentNodeId: null, currentQuestionId: null } };
  }
  const plan = planNextQuestion(
    { ...memory, promptState: { ...memory.promptState, completedGoalIds, resolvedGoalIds } },
    blocked
  );
  if (!plan) {
    return { ...memory, promptState: { ...memory.promptState, completedGoalIds, resolvedGoalIds, candidateTrace: [], status: 'answered', currentNodeId: null, currentQuestionId: null } };
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
  const nextNodeId = plan.graphId === 'media-context' && confirmedMediaType
    ? unconfirmedTitle ? 'title' : 'meaning'
    : plan.nodeId;
  return {
    ...memory,
    promptState: {
      ...memory.promptState,
      completedGoalIds,
      resolvedGoalIds,
      graphId: plan.graphId,
      currentNodeId: nextNodeId,
      currentQuestionId: questionIdForGraphNode(plan.graphId, nextNodeId),
      candidateTrace: plan.trace,
      status: 'pending',
    },
  };
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
