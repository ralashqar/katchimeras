export const MOSSPROUT_MEMORY_NURSERY_CHAPTER_ID = 'mossprout:chapter:memory-nursery';
export const MOSSPROUT_HEARTWOOD_CHAPTER_ID = 'mossprout:chapter:heartwood';

export type MossproutExtendedJourneyBeat = {
  beatId: string;
  chapterId: string;
  minimumActiveDays: number;
  title: string;
  objectiveId: string;
  mergeOrderId: string;
  requirements: readonly { definitionId: string; quantity: number }[];
  description: string;
  optionalAction: 'goal' | 'reflection' | 'playful' | null;
};

export const MOSSPROUT_EXTENDED_JOURNEY_BEATS: readonly MossproutExtendedJourneyBeat[] = [
  {
    beatId: 'memory-nursery:nursery-key', chapterId: MOSSPROUT_MEMORY_NURSERY_CHAPTER_ID,
    minimumActiveDays: 15, title: 'The Nursery Key', objectiveId: 'mossprout:objective:nursery-key',
    mergeOrderId: 'merge-story:mossprout:memory-nursery:nursery-key',
    requirements: [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }],
    description: 'Bring a Rare Flower and Water Lily to wake the old nursery lock.', optionalAction: 'reflection',
  },
  {
    beatId: 'memory-nursery:keepsake-root', chapterId: MOSSPROUT_MEMORY_NURSERY_CHAPTER_ID,
    minimumActiveDays: 17, title: 'A Keepsake Takes Root', objectiveId: 'mossprout:objective:keepsake-root',
    mergeOrderId: 'merge-story:mossprout:memory-nursery:keepsake-root',
    requirements: [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 }],
    description: 'Pair a Pressed Leaf with a living Plant.', optionalAction: 'goal',
  },
  {
    beatId: 'memory-nursery:garden-remembers', chapterId: MOSSPROUT_MEMORY_NURSERY_CHAPTER_ID,
    minimumActiveDays: 19, title: 'What the Garden Remembers', objectiveId: 'mossprout:objective:garden-remembers',
    mergeOrderId: 'merge-story:mossprout:memory-nursery:garden-remembers',
    requirements: [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }],
    description: 'Bring a Memory Sprig and Water Lily to the nursery bed.', optionalAction: 'playful',
  },
  {
    beatId: 'memory-nursery:lantern-bank', chapterId: MOSSPROUT_MEMORY_NURSERY_CHAPTER_ID,
    minimumActiveDays: 21, title: 'The Lantern Bank', objectiveId: 'mossprout:objective:lantern-bank',
    mergeOrderId: 'merge-story:mossprout:memory-nursery:lantern-bank',
    requirements: [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }],
    description: 'Grow a Memory Bloom for the lantern bank.', optionalAction: null,
  },
  {
    beatId: 'heartwood:mirror-for-rain', chapterId: MOSSPROUT_HEARTWOOD_CHAPTER_ID,
    minimumActiveDays: 22, title: 'A Mirror for Rain', objectiveId: 'mossprout:objective:mirror-for-rain',
    mergeOrderId: 'merge-story:mossprout:heartwood:mirror-for-rain',
    requirements: [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }],
    description: 'Make a Rain Mirror for the path into the grove.', optionalAction: 'reflection',
  },
  {
    beatId: 'heartwood:rings-of-attention', chapterId: MOSSPROUT_HEARTWOOD_CHAPTER_ID,
    minimumActiveDays: 24, title: 'Rings of Attention', objectiveId: 'mossprout:objective:rings-of-attention',
    mergeOrderId: 'merge-story:mossprout:heartwood:rings-of-attention',
    requirements: [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:4', quantity: 1 }],
    description: 'Bring a Rare Flower and Field Journal to the ancient rings.', optionalAction: 'goal',
  },
  {
    beatId: 'heartwood:place-that-holds', chapterId: MOSSPROUT_HEARTWOOD_CHAPTER_ID,
    minimumActiveDays: 26, title: 'A Place That Holds', objectiveId: 'mossprout:objective:place-that-holds',
    mergeOrderId: 'merge-story:mossprout:heartwood:place-that-holds',
    requirements: [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'nature:keepsake:5', quantity: 1 }],
    description: 'Bring a Magical Plant and Memory Terrarium to shelter the grove.', optionalAction: 'playful',
  },
  {
    beatId: 'heartwood:heartwood', chapterId: MOSSPROUT_HEARTWOOD_CHAPTER_ID,
    minimumActiveDays: 28, title: 'Heartwood', objectiveId: 'mossprout:objective:heartwood',
    mergeOrderId: 'merge-story:mossprout:heartwood:heartwood',
    requirements: [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }],
    description: 'Complete the Heartwood Sanctuary.', optionalAction: null,
  },
] as const;

export const mossproutExtendedBeatById = new Map(MOSSPROUT_EXTENDED_JOURNEY_BEATS.map((beat) => [beat.beatId, beat]));
export const mossproutExtendedBeatByObjectiveId = new Map(MOSSPROUT_EXTENDED_JOURNEY_BEATS.map((beat) => [beat.objectiveId, beat]));
