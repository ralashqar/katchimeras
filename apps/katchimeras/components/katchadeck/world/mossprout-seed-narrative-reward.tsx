import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Keyframe, useReducedMotion } from 'react-native-reanimated';
import { DayActionCardSurface } from '@/components/katchadeck/ui/day-action-card';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { mossproutMemoryPlantById } from '@/constants/mossprout-memory-plants';
import { mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { CelebrationParticles } from './companion-achievement-celebration';

const SEED_REWARD_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.84 }] },
  68: { opacity: 1, transform: [{ translateY: -2 }, { scale: 1.06 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(440);

/** The existing FTUE handoff owns the grant; this only reveals its reward. */
export function MossproutSeedNarrativeReward() {
  const reduced = useReducedMotion();
  const seed = mossproutFirstSeedForIntent(loadOnboardingProfile().mossproutAnswers.growthIntentId);
  const plant = mossproutMemoryPlantById.get(seed.id);
  if (!plant) return null;
  return <View accessibilityLabel="Memory Seed received" style={{ paddingVertical: 20 }}>
    <CelebrationParticles tier={1} tint="#A7CE81" layerStyle={{ zIndex: 0 }} />
    <Animated.View entering={reduced ? undefined : SEED_REWARD_IN} style={{ zIndex: 1 }}>
      <DayActionCardSurface
        artwork={<View style={styles.seedStage}>
          <RotatingRadialSunburst baseOpacity={0.82} rotationDurationMs={24_000} size={126} style={styles.seedRays} />
          <Image contentFit="contain" source={plant.art.seed} style={styles.seedArt} />
        </View>}
        eyebrow="MEMORY SEED RECEIVED" title={plant.name}
        subtitle={`${seed.message}\nReady to plant in the Garden.`} trailing={<View />} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  seedStage: { alignItems: 'center', height: 88, justifyContent: 'center', overflow: 'visible', position: 'relative', width: 88 },
  seedRays: { left: -19, top: -19 },
  seedArt: { height: 84, width: 84, zIndex: 1 },
});
