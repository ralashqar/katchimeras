import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EggShell } from '@/components/katchadeck/home/egg-shell';
import type { EggVisualState } from '@/types/home';

type LanternEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  crackStage?: 0 | 1 | 2;
};

// The Lantern egg stage: just the egg artwork - no membrane ring, no orbiting
// particles, no internal caption. Breathing/shimmer/reaction animation lives
// in EggShell; the motion channels that used to come from the drag membrane
// are pinned to rest. Sized to the same 258px stage as the creature hero so
// flipping between days keeps the subject centered in one spot.
export function LanternEgg({ egg, onPress, reactionKey = 0, crackStage = 0 }: LanternEggProps) {
  const rest = {
    dragX: useSharedValue(0),
    dragY: useSharedValue(0),
    pressProgress: useSharedValue(0),
    releaseVelocity: useSharedValue(0),
    interactionEnergy: useSharedValue(0),
    glowLagX: useSharedValue(0),
    glowLagY: useSharedValue(0),
  };

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.stage}>
      <View style={[styles.halo, { backgroundColor: 'rgba(167,139,250,0.10)' }]} />
      <View style={styles.scale}>
        <EggShell crackStage={crackStage} egg={egg} motion={rest} reactionKey={reactionKey} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  halo: {
    borderRadius: 999,
    height: 252,
    position: 'absolute',
    width: 252,
  },
  scale: {
    transform: [{ scale: 1.08 }],
  },
});
