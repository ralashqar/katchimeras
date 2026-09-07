import { View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { DayActionCardSurface } from '@/components/katchadeck/ui/day-action-card';
import { mossproutMemoryPlantById } from '@/constants/mossprout-memory-plants';
import { mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { CelebrationParticles } from './companion-achievement-celebration';

/** The existing FTUE handoff owns the grant; this only reveals its reward. */
export function MossproutSeedNarrativeReward() {
  const reduced = useReducedMotion();
  const seed = mossproutFirstSeedForIntent(loadOnboardingProfile().mossproutAnswers.growthIntentId);
  const plant = mossproutMemoryPlantById.get(seed.id);
  if (!plant) return null;
  return <View accessibilityLabel="Memory Seed received" style={{ paddingVertical: 20 }}>
    <CelebrationParticles tier={1} tint="#A7CE81" layerStyle={{ zIndex: 0 }} />
    <Animated.View entering={reduced ? undefined : FadeInUp.springify().damping(16)} style={{ zIndex: 1 }}>
      <DayActionCardSurface
        artwork={<Image contentFit="contain" source={plant.art.seed} style={{ width: 84, height: 84 }} />}
        eyebrow="MEMORY SEED RECEIVED" title={plant.name}
        subtitle={`${seed.message}\nReady to plant in the Garden.`} trailing={<View />} />
    </Animated.View>
  </View>;
}
