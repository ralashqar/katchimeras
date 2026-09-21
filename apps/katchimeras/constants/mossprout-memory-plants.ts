import type { ImageSourcePropType } from 'react-native';
import { mossproutMemoryPlantNames } from '@/constants/mossprout-memory-plant-names';

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
  'back-left', 'back-centre', 'back-right', 'front-left', 'front-right',
];

export const MOSSPROUT_MEMORY_PLANTS: readonly MossproutMemoryPlantDefinition[] = [
  {
    id: 'momentum', name: mossproutMemoryPlantNames.momentum, color: '#E79A39',
    description: 'For making a start, even when the first step is small.',
    reflection: 'Start small enough that starting is not scary.',
    art: {
      seed: require('@incubator/art-world/memory-plants/momentum_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/momentum_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/momentum_bloom.webp'),
    },
  },
  {
    id: 'stillness', name: mossproutMemoryPlantNames.stillness, color: '#94BFC0',
    description: 'For finding a little quiet when everything feels full.',
    reflection: 'Quiet can be something you grow, not something you wait for.',
    art: {
      seed: require('@incubator/art-world/memory-plants/stillness_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/stillness_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/stillness_bloom.webp'),
    },
  },
  {
    id: 'renewal', name: mossproutMemoryPlantNames.renewal, color: '#58BDAA',
    description: 'For getting a little energy back without demanding it all at once.',
    reflection: 'Fresh starts can arrive one small unfurling at a time.',
    art: {
      seed: require('@incubator/art-world/memory-plants/renewal_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/renewal_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/renewal_bloom.webp'),
    },
  },
  {
    id: 'warmth', name: mossproutMemoryPlantNames.warmth, color: '#F3A66F',
    description: 'For protecting the good in an ordinary day.',
    reflection: 'A good day is worth noticing while it is here.',
    art: {
      seed: require('@incubator/art-world/memory-plants/warmth_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/warmth_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/warmth_bloom.webp'),
    },
  },
  {
    id: 'curiosity', name: mossproutMemoryPlantNames.curiosity, color: '#8267C7',
    description: 'For days when the next direction is not clear yet.',
    reflection: 'Not knowing can still be a place to begin.',
    art: {
      seed: require('@incubator/art-world/memory-plants/curiosity_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/curiosity_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/curiosity_bloom.webp'),
    },
  },
  {
    id: 'connection', name: mossproutMemoryPlantNames.connection, color: '#AC83D7',
    description: 'For the small things that bring us closer.',
    reflection: 'A little kindness can put down roots in two places at once.',
    art: {
      seed: require('@incubator/art-world/memory-plants/connection_seed.webp'),
      sprout: require('@incubator/art-world/memory-plants/connection_sprout.webp'),
      bloom: require('@incubator/art-world/memory-plants/connection_bloom.webp'),
    },
  },
] as const;

export const mossproutMemoryPlantById = new Map(MOSSPROUT_MEMORY_PLANTS.map((definition) => [definition.id, definition]));

export function mossproutMemoryPlantStage(growthPoints: number): MossproutMemoryPlantStage {
  if (growthPoints >= 3) return 'bloom';
  if (growthPoints >= 1) return 'sprout';
  return 'seed';
}

