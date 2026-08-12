import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { companionAchievementIconSource } from '@/constants/achievement-icon-sources';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days';
import type { CompanionAchievementDef } from '@/types/companion-achievements';
import { orderAchievementCelebrationQueue } from '@/utils/achievement-celebration';

const TIER_TINT = ['#A87045', '#8295A6', '#B9872F', '#75609B', '#9B6A32'] as const;
const CONFETTI_LOOP_MS = 3_400;

type Props = {
  achievements: readonly CompanionAchievementDef[];
  onAchievementSeen: (id: string) => void;
  onComplete?: () => void;
  preview?: boolean;
};

/** Achievement-specific data adapter for the shared, reusable reward splash. */
export function CompanionAchievementCelebration({ achievements, onAchievementSeen, onComplete, preview = false }: Props) {
  const items = orderAchievementCelebrationQueue(achievements).flatMap((achievement): RewardSplashItem[] => {
    const family = katchimeraFamilyById.get(achievement.familyId);
    if (!family) return [];
    const companionSource = family.anchorVisualKey ? getCreatureVisual(family.anchorVisualKey).source : null;
    return [{
      id: achievement.id,
      eyebrow: 'Achievement unlocked',
      title: achievement.name,
      description: achievement.description,
      image: companionAchievementIconSource(achievement),
      imageAccessibilityLabel: achievement.name,
      detail: `${family.displayName} · ${achievement.criterion}`,
      rewardTitle: achievement.reward.label,
      rewardBody: 'Added to the trophy room',
      supportingImage: companionSource,
      supportingImageAccessibilityLabel: `${family.displayName} Katchimera`,
      tint: TIER_TINT[achievement.tier - 1] ?? TIER_TINT[0],
      tier: achievement.tier,
      shareMessage: `${family.displayName} achievement · ${achievement.name}\n${achievement.description}\n${achievement.criterion}`,
      nextLabel: 'Next achievement',
    }];
  });
  return <RewardSplash items={items} onComplete={onComplete} onItemSeen={onAchievementSeen} preview={preview} />;
}

// Kept as a public primitive for cinematic, discovery, and streak celebrations.
export function CelebrationParticles({ layerStyle, tier, tint }: { layerStyle?: StyleProp<ViewStyle>; tier: number; tint: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const pieceCount = 20 + tier * 9;
  return <View pointerEvents="none" style={[styles.confettiLayer, layerStyle]}>{Array.from({ length: pieceCount }, (_, index) => <ConfettiPiece index={index} key={index} pieceCount={pieceCount} tier={tier} tint={tint} />)}</View>;
}

function ConfettiPiece({ index, pieceCount, tier, tint }: { index: number; pieceCount: number; tier: number; tint: string }) {
  const progress = useSharedValue(0);
  const angle = (index / pieceCount) * Math.PI * 2;
  const distance = 126 + (index % 6) * 24 + tier * 9;
  const verticalBias = 58 + (index % 5) * 13;
  const flightDuration = 780 + (index % 6) * 55;
  const restDuration = Math.max(1, CONFETTI_LOOP_MS - flightDuration - 2);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = withRepeat(withSequence(withTiming(1, { duration: flightDuration, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 1 }), withDelay(restDuration, withTiming(0, { duration: 1 }))), -1, false);
    return () => cancelAnimation(progress);
  }, [flightDuration, progress, restDuration]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(Math.min(1, progress.value / 0.035), 1 - Math.max(0, progress.value - 0.74) / 0.26),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value + verticalBias * progress.value * progress.value },
      { rotate: `${index * 31 + progress.value * 285}deg` },
      { scale: 0.58 + progress.value * 0.52 },
    ],
  }));
  return <Animated.View style={[styles.confetti, { backgroundColor: index % 4 === 0 ? '#FFF3A6' : index % 4 === 1 ? tint : index % 4 === 2 ? '#F6C653' : '#FFFDF0', height: 10 + (index % 3) * 2, width: 6 + (index % 2) * 2 }, style]} />;
}

const styles = StyleSheet.create({
  confettiLayer: { alignItems: 'center', height: 1, justifyContent: 'center', left: '50%', position: 'absolute', top: '53%', width: 1, zIndex: 2 },
  confetti: { borderRadius: 3, height: 11, position: 'absolute', width: 7 },
});
