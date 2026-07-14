import { seededShuffle } from './trivia-packs';

export type MemoryMatchPackId = 'relicoon-gallery' | 'mossprout-garden' | 'feastle-food';

export type MemoryMatchVisual =
  | { kind: 'world_asset'; assetKey: string }
  | { kind: 'icon'; symbol: string }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'local_image'; uri: string; sourceId: string };

export type MatchingMotif = {
  id: string;
  label: string;
  accessibilityLabel: string;
  visual: MemoryMatchVisual;
  /** Compatibility field for existing icon-pack consumers. */
  symbol?: string;
};

export type MemoryMatchPack = {
  id: MemoryMatchPackId;
  eyebrow: string;
  title: string;
  introduction: string;
  cardBackLabel: string;
  completionRule: 'find_all' | 'within_move_budget';
  motifs: MatchingMotif[];
};

const RELICOON_LABELS = [
  'Amphora','Compass','Fossil','Crown','Mask','Coin','Vase','Scroll','Statue','Mosaic','Helmet','Brooch',
  'Telescope','Map','Tablet','Medal','Lantern','Bell','Goblet','Key','Seal','Astrolabe','Hourglass','Cameo',
  'Sundial','Quill','Pendant','Shield','Flute','Drum','Fan','Mirror','Ring','Chalice','Bust','Torq',
  'Urn','Relief','Globe','Spyglass','Locket','Tiara','Tapestry','Manuscript','Scepter','Abacus','Totem','Monolith',
];
const RELICOON_SYMBOLS = [
  'building.columns.fill','map.fill','sparkles','crown.fill','theatermasks.fill','circle.fill','shippingbox.fill','doc.text.fill',
];

export const RELICOON_MATCHING_MOTIFS: MatchingMotif[] = RELICOON_LABELS.map((label, index) => {
  const symbol = RELICOON_SYMBOLS[index % RELICOON_SYMBOLS.length];
  return {
    id: `relicoon:artifact:${label.toLowerCase()}`,
    label,
    accessibilityLabel: label,
    symbol,
    visual: { kind: 'icon', symbol },
  };
});

const MOSSPROUT_PLANTS = [
  ['pine', 'Pine tree', 'bloom_pine_1'],
  ['oak', 'Oak tree', 'bloom_oak_1'],
  ['birch', 'Birch tree', 'bloom_birch_1'],
  ['blossom', 'Blossom tree', 'bloom_blossom_1'],
  ['shrub', 'Garden shrub', 'bloom_shrub_1'],
  ['fern', 'Fern', 'bloom_fern_1'],
  ['wildflowers', 'Wildflowers', 'bloom_wildflowers_1'],
  ['mushrooms', 'Mushrooms', 'bloom_mushrooms_1'],
  ['lavender', 'Lavender', 'bloom_lavender_1'],
  ['butterfly-bush', 'Butterfly bush', 'bloom_butterfly_bush_1'],
  ['cattails', 'Cattails', 'bloom_cattails_1'],
  ['snowdrops', 'Snowdrops', 'bloom_snowdrops_1'],
] as const;

export const MOSSPROUT_MATCHING_MOTIFS: MatchingMotif[] = MOSSPROUT_PLANTS.map(
  ([id, label, assetKey]) => ({
    id: `mossprout:plant:${id}`,
    label,
    accessibilityLabel: label,
    visual: { kind: 'world_asset', assetKey },
  }),
);

const FEASTLE_FOODS = [
  ['apple', 'Apple', '🍎'],
  ['bread', 'Bread', '🍞'],
  ['cheese', 'Cheese', '🧀'],
  ['carrot', 'Carrot', '🥕'],
  ['rice', 'Rice', '🍚'],
  ['pasta', 'Pasta', '🍝'],
  ['cake', 'Cake', '🍰'],
  ['soup', 'Soup', '🍲'],
  ['pizza', 'Pizza', '🍕'],
  ['strawberry', 'Strawberry', '🍓'],
  ['egg', 'Egg', '🥚'],
  ['taco', 'Taco', '🌮'],
  ['sushi', 'Sushi', '🍣'],
  ['pear', 'Pear', '🍐'],
  ['croissant', 'Croissant', '🥐'],
  ['cookie', 'Cookie', '🍪'],
  ['noodles', 'Noodles', '🍜'],
  ['sandwich', 'Sandwich', '🥪'],
  ['avocado', 'Avocado', '🥑'],
  ['dumpling', 'Dumpling', '🥟'],
] as const;

export const FEASTLE_MATCHING_MOTIFS: MatchingMotif[] = FEASTLE_FOODS.map(
  ([id, label, emoji]) => ({
    id: `feastle:food:${id}`,
    label,
    accessibilityLabel: label,
    visual: { kind: 'emoji', emoji },
  }),
);

export const MEMORY_MATCH_PACKS: Record<MemoryMatchPackId, MemoryMatchPack> = {
  'relicoon-gallery': {
    id: 'relicoon-gallery',
    eyebrow: 'RELICOON',
    title: 'Relicoon’s gallery pairs',
    introduction: 'Turn over the gallery cards and reunite every artefact pair.',
    cardBackLabel: 'Hidden gallery card',
    completionRule: 'within_move_budget',
    motifs: RELICOON_MATCHING_MOTIFS,
  },
  'mossprout-garden': {
    id: 'mossprout-garden',
    eyebrow: 'MOSSPROUT',
    title: 'Mossprout’s garden pairs',
    introduction: 'Turn over the garden cards and find every matching plant.',
    cardBackLabel: 'Hidden garden card',
    completionRule: 'find_all',
    motifs: MOSSPROUT_MATCHING_MOTIFS,
  },
  'feastle-food': {
    id: 'feastle-food',
    eyebrow: 'FEASTLE',
    title: 'Feastle’s matching feast',
    introduction: 'Turn over the table cards and find every matching food.',
    cardBackLabel: 'Hidden feast card',
    completionRule: 'find_all',
    motifs: FEASTLE_MATCHING_MOTIFS,
  },
};

export function memoryMatchPack(packId: MemoryMatchPackId): MemoryMatchPack {
  return MEMORY_MATCH_PACKS[packId] ?? MEMORY_MATCH_PACKS['relicoon-gallery'];
}

export type MemoryMatchCard = {
  cardId: string;
  motif: MatchingMotif;
};

export function createMatchingDeck(
  seed: string,
  pairCount: number,
  recentIds: string[] = [],
  packId: MemoryMatchPackId = 'relicoon-gallery',
): MemoryMatchCard[] {
  const pack = memoryMatchPack(packId);
  const recent = new Set(recentIds);
  const fresh = pack.motifs.filter((motif) => !recent.has(motif.id));
  const source = fresh.length >= pairCount ? fresh : pack.motifs;
  const motifs = seededShuffle(source, `${seed}:${packId}:motifs`).slice(0, pairCount);
  return seededShuffle(
    motifs.flatMap((motif) => [
      { cardId: `${motif.id}:a`, motif },
      { cardId: `${motif.id}:b`, motif },
    ]),
    `${seed}:${packId}:deck`,
  );
}

export function shuffleMatchingDeck(deck: MemoryMatchCard[], seed: string): MemoryMatchCard[] {
  const shuffled = seededShuffle(deck, seed);
  if (shuffled.length <= 1) return shuffled;
  const unchanged = shuffled.every((card, index) => card.cardId === deck[index]?.cardId);
  return unchanged ? [...shuffled.slice(1), shuffled[0]] : shuffled;
}

export function validateMatchingMotifs(
  motifs: MatchingMotif[] = RELICOON_MATCHING_MOTIFS,
): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const motif of motifs) {
    if (ids.has(motif.id)) errors.push(`Duplicate matching motif: ${motif.id}`);
    if (!motif.label || !motif.accessibilityLabel || !motif.visual) {
      errors.push(`Incomplete matching motif: ${motif.id}`);
    }
    ids.add(motif.id);
  }
  return errors;
}

export type MemoryMatchOpenCard = { cardId: string; motifId: string };
export type MemoryMatchState = {
  openCards: MemoryMatchOpenCard[];
  matchedMotifIds: string[];
  moves: number;
  locked: boolean;
  comparison: null | { motifId: string; matched: boolean };
};

export type MemoryMatchAction =
  | { type: 'reveal'; cardId: string; motifId: string }
  | { type: 'resolve_comparison' }
  | { type: 'hide_open' }
  | { type: 'reset' };

export function createMemoryMatchState(): MemoryMatchState {
  return {
    openCards: [],
    matchedMotifIds: [],
    moves: 0,
    locked: false,
    comparison: null,
  };
}

export function memoryMatchReducer(
  state: MemoryMatchState,
  action: MemoryMatchAction,
): MemoryMatchState {
  if (action.type === 'reset') return createMemoryMatchState();
  if (action.type === 'hide_open') {
    return { ...state, openCards: [], locked: false, comparison: null };
  }
  if (action.type === 'resolve_comparison') {
    const comparison = state.comparison;
    return {
      ...state,
      openCards: [],
      locked: false,
      comparison: null,
      matchedMotifIds:
        comparison?.matched && !state.matchedMotifIds.includes(comparison.motifId)
          ? [...state.matchedMotifIds, comparison.motifId]
          : state.matchedMotifIds,
    };
  }
  if (
    state.locked ||
    state.openCards.some((card) => card.cardId === action.cardId) ||
    state.matchedMotifIds.includes(action.motifId)
  ) {
    return state;
  }
  if (state.openCards.length === 0) {
    return {
      ...state,
      openCards: [{ cardId: action.cardId, motifId: action.motifId }],
    };
  }
  const first = state.openCards[0];
  const matched = first.motifId === action.motifId;
  return {
    ...state,
    openCards: [...state.openCards, { cardId: action.cardId, motifId: action.motifId }],
    moves: state.moves + 1,
    locked: true,
    comparison: { motifId: action.motifId, matched },
  };
}
