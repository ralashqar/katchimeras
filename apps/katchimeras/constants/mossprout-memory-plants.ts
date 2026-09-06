import type { ImageSourcePropType } from 'react-native';

import type { MossproutGardenPlantSlotId, MossproutMemoryPlantId } from '@/types/merge-world';

export type MossproutMemoryPlantStage = 'seed' | 'sprout' | 'bloom';

export type MossproutMemoryPlantDefinition = {
  id: MossproutMemoryPlantId;
  name: string;
  description: string;
  reflection: string;
  color: string;
  art: Record<MossproutMemoryPlantStage, ImageSourcePropType>;
};

export const MOSSPROUT_GARDEN_PLANT_SLOTS: readonly MossproutGardenPlantSlotId[] = [
  'back-left', 'back-centre', 'back-right', 'front-left', 'front-centre', 'front-right',
];

export const MOSSPROUT_MEMORY_PLANTS: readonly MossproutMemoryPlantDefinition[] = [
  {
    id: 'momentum', name: 'Seed of Momentum', color: '#E79A39',
    description: 'For making a start, even when the first step is small.',
    reflection: 'Start small enough that starting is not scary.',
    art: {
      seed: require('@incubator/art-world/memory-plants/momentum_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/momentum_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/momentum_bloom.webp'),
    },
  },
  {
    id: 'stillness', name: 'Seed of Stillness', color: '#94BFC0',
    description: 'For finding a little quiet when everything feels full.',
    reflection: 'Quiet can be something you grow, not something you wait for.',
    art: {
      seed: require('@incubator/art-world/memory-plants/stillness_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/stillness_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/stillness_bloom.webp'),
    },
  },
  {
    id: 'renewal', name: 'Seed of Renewal', color: '#58BDAA',
    description: 'For getting a little energy back without demanding it all at once.',
    reflection: 'Fresh starts can arrive one small unfurling at a time.',
    art: {
      seed: require('@incubator/art-world/memory-plants/renewal_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/renewal_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/renewal_bloom.webp'),
    },
  },
  {
    id: 'warmth', name: 'Seed of Warmth', color: '#F3A66F',
    description: 'For protecting the good in an ordinary day.',
    reflection: 'A good day is worth noticing while it is here.',
    art: {
      seed: require('@incubator/art-world/memory-plants/warmth_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/warmth_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/warmth_bloom.webp'),
    },
  },
  {
    id: 'curiosity', name: 'Seed of Curiosity', color: '#8267C7',
    description: 'For days when the next direction is not clear yet.',
    reflection: 'Not knowing can still be a place to begin.',
    art: {
      seed: require('@incubator/art-world/memory-plants/curiosity_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/curiosity_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/curiosity_bloom.webp'),
    },
  },
] as const;

export const mossproutMemoryPlantById = new Map(MOSSPROUT_MEMORY_PLANTS.map((definition) => [definition.id, definition]));

export function mossproutMemoryPlantStage(growthPoints: number): MossproutMemoryPlantStage {
  if (growthPoints >= 3) return 'bloom';
  if (growthPoints >= 1) return 'sprout';
  return 'seed';
}

