import registryJson from '@/data/intelligence/memory-qualities.json';
import type { MemoryDomain } from '@/types/home';

export type SemanticSource = 'photo' | 'voice_note' | 'text_note';

export type SemanticCategoryDefinition = {
  id: string;
  domain: MemoryDomain;
  displayName: string;
  sources: SemanticSource[];
  aliases: string[];
  wordAnchors: string[];
  positiveSentences: string[];
  negativeSentences: string[];
  physicalOnly: boolean;
  sensitive?: boolean;
  thresholds: { accept: number; review: number; minimumMargin: number };
  assignments: { seedId: string; weight: number }[];
};

type QualityRow = {
  id: string;
  domain: MemoryDomain;
  aliases: string[];
  physicalOnly: boolean;
  assignmentSeedId?: string;
};

const DEFAULT_THRESHOLDS = { accept: 0.8, review: 0.58, minimumMargin: 0.12 };
const DISPLAY: Record<string, string> = {
  'subject.food': 'a meal', 'subject.drink': 'a drink', 'work.focus': 'focused work',
  'life.celebration': 'a celebration', 'screen.app': 'an app or screen',
  'document.receipt': 'a receipt', 'document.menu': 'a menu',
};
const MEDIA_SENTENCES: Record<string, { positive: string[]; negative: string[] }> = {
  'media.book': {
    positive: ['I read a book', 'I finished a novel', 'I started reading a book', 'I listened to an audiobook', 'A book stayed with me'],
    negative: ['I booked a table', 'I bought a bookshelf', 'I read the news', 'I want to read a book later'],
  },
  'media.film': {
    positive: ['I watched a movie', 'I saw a film', 'I watched a documentary', 'I went to the cinema', 'A movie stayed with me'],
    negative: ['I filmed a video', 'I worked on a film', 'I want to watch a movie later', 'I watched a television episode'],
  },
  'media.game': {
    positive: ['I played a video game', 'I started a new game', 'I finished a video game', 'I played on my console'],
    negative: ['I played football outside', 'It was a game plan', 'I watched a sports match'],
  },
  'media.music': {
    positive: ['I listened to an album', 'I discovered a song', 'I went to a concert', 'I listened to music'],
    negative: ['I practiced an instrument', 'Music was playing in the background', 'I plan to hear the album'],
  },
  'media.art': {
    positive: ['I saw an exhibition', 'I looked at a painting', 'I visited an art gallery', 'An artwork inspired me'],
    negative: ['I painted my wall', 'I plan to visit an exhibition', 'The app uses artwork'],
  },
};

const EXTRA: Record<string, string[]> = {
  'place.park': ['public park', 'parkland', 'recreation ground', 'open lawn', 'footpath', 'playground'],
  'place.city': ['city skyline', 'urban centre', 'downtown district', 'high-rise buildings'],
  'activity.sport': ['playing sport', 'sports training', 'athletic match', 'team sport'],
  'work.focus': ['focused work', 'office work', 'studying', 'planning a project'],
  'subject.food': ['meal', 'cuisine', 'dish', 'dining', 'cooking'],
};

function title(id: string): string {
  return DISPLAY[id] ?? id.split('.')[1].replaceAll('_', ' ');
}

function genericPositive(name: string, domain: MemoryDomain): string[] {
  if (domain === 'place' || domain === 'nature') return [`I spent time at ${name}`, `I visited ${name}`, `This photo shows ${name}`, `${name} was part of my day`];
  if (domain === 'movement') return [`I did ${name}`, `I spent time ${name}`, `${name} was part of my day`, `This photo shows ${name}`];
  if (domain === 'people' || domain === 'animal') return [`I spent time with ${name}`, `${name} was part of my day`, `This photo shows ${name}`, `I mentioned ${name}`];
  return [`I experienced ${name}`, `${name} was part of my day`, `This photo shows ${name}`, `I mentioned ${name}`];
}

const qualities = (registryJson as { qualities: QualityRow[] }).qualities;

export const SEMANTIC_CATEGORIES: SemanticCategoryDefinition[] = [
  ...qualities.map((quality): SemanticCategoryDefinition => {
    const name = title(quality.id);
    const media = MEDIA_SENTENCES[quality.id];
    return {
      id: quality.id,
      domain: quality.domain,
      displayName: name,
      sources: ['photo', 'voice_note', 'text_note'],
      aliases: quality.aliases,
      wordAnchors: [...new Set([...quality.aliases, ...(EXTRA[quality.id] ?? [])])],
      positiveSentences: media?.positive ?? genericPositive(name, quality.domain),
      negativeSentences: media?.negative ?? [],
      physicalOnly: quality.physicalOnly,
      sensitive: quality.domain === 'people',
      thresholds: { ...DEFAULT_THRESHOLDS },
      assignments: quality.assignmentSeedId ? [{ seedId: quality.assignmentSeedId, weight: 1 }] : [],
    };
  }),
  {
    id: 'media.show', domain: 'media', displayName: 'a show', sources: ['voice_note', 'text_note'],
    aliases: ['show', 'tv show', 'series', 'episode', 'miniseries', 'television series'],
    wordAnchors: ['show', 'tv show', 'series', 'episode', 'miniseries', 'television'],
    positiveSentences: ['I watched a television show', 'I watched an episode', 'I started a series', 'I finished a miniseries'],
    negativeSentences: ['I performed in a live show', 'I want to watch a series later', 'I watched a movie'],
    physicalOnly: false, thresholds: { ...DEFAULT_THRESHOLDS }, assignments: [{ seedId: 'cinema', weight: 0.86 }],
  },
  {
    id: 'media.other', domain: 'media', displayName: 'other media', sources: ['voice_note', 'text_note'],
    aliases: ['podcast', 'news', 'live sport', 'online video', 'livestream'],
    wordAnchors: ['podcast', 'news broadcast', 'live sport', 'online video', 'livestream'],
    positiveSentences: ['I listened to a podcast', 'I watched the news', 'I watched a live sports match', 'I watched an online video'],
    negativeSentences: ['I made a podcast', 'I played in a sports match', 'I plan to watch the news'],
    physicalOnly: false, thresholds: { ...DEFAULT_THRESHOLDS }, assignments: [],
  },
];

export function semanticCategoriesFor(source: SemanticSource): SemanticCategoryDefinition[] {
  return SEMANTIC_CATEGORIES.filter((category) => category.sources.includes(source));
}

export function validateSemanticCategories(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const category of SEMANTIC_CATEGORIES) {
    if (ids.has(category.id)) errors.push(`Duplicate category ${category.id}`);
    ids.add(category.id);
    if (!category.wordAnchors.length) errors.push(`${category.id} has no word anchors`);
    if (category.sources.some((source) => source !== 'photo') && !category.positiveSentences.length) errors.push(`${category.id} has no sentence anchors`);
    const { accept, review, minimumMargin } = category.thresholds;
    if (review < 0 || accept > 1 || review >= accept || minimumMargin <= 0) errors.push(`${category.id} has invalid thresholds`);
  }
  return errors;
}
