import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionAchievementDef } from '@/types/companion-achievements';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { companionAchievementIconSource } from '@/constants/achievement-icon-sources';

const TIER_TINT = ['#A87045', '#8295A6', '#B9872F', '#75609B', '#9B6A32'] as const;

export function CompanionAchievementCelebration({
  achievements,
  onDismiss,
}: {
  achievements: CompanionAchievementDef[];
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const featured = useMemo(() => [...achievements].sort((a, b) => b.tier - a.tier)[0], [achievements]);
  const family = featured ? katchimeraFamilyById.get(featured.familyId) : null;
  const tint = featured ? TIER_TINT[featured.tier - 1] : TIER_TINT[0];

  useEffect(() => {
    if (!featured || process.env.EXPO_OS !== 'ios') return;
    if (featured.tier >= 4) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(featured.tier >= 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }, [featured]);

  if (!featured || !family) return null;

  const share = async () => {
    try {
      await Share.share({
        message: `${family.displayName} achievement · ${featured.name}\n${featured.description}\n${featured.criterion}`,
      });
    } catch {
      // Share cancellation and unavailable share targets are harmless.
    }
  };

  return (
    <View accessibilityViewIsModal style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.backdrop} />
      <CelebrationParticles tier={featured.tier} tint={tint} />
      <Animated.View
        accessibilityLiveRegion="polite"
        entering={reduceMotion ? FadeIn.duration(100) : ZoomIn.springify().damping(14).mass(0.85)}
        exiting={FadeOut.duration(160)}
        style={styles.card}>
        <View style={[styles.halo, { backgroundColor: tint }]} />
        <ThemedText selectable style={styles.eyebrow} lightColor={tint} darkColor={tint}>
          {featured.tier >= 4 ? 'A centerpiece awakens' : 'Trophy room updated'}
        </ThemedText>
        <View style={[styles.trophy, { backgroundColor: `${tint}24`, borderColor: `${tint}62` }]}>
          <Image accessibilityLabel={featured.name} contentFit="contain" source={companionAchievementIconSource(featured)} style={styles.trophyArt} transition={0} />
          <View style={[styles.tierMedal, { backgroundColor: tint }]}>
            <ThemedText style={styles.tierMedalText} lightColor="#FFF8E9" darkColor="#FFF8E9">{roman(featured.tier)}</ThemedText>
          </View>
        </View>
        <ThemedText selectable style={styles.family} lightColor="#7A5A32" darkColor="#7A5A32">{family.displayName}</ThemedText>
        <ThemedText selectable style={styles.title} lightColor="#342315" darkColor="#342315">{featured.name}</ThemedText>
        <ThemedText selectable style={styles.body} lightColor="#624B34" darkColor="#624B34">{featured.description}</ThemedText>
        <View style={styles.reward}>
          <IconSymbol color={tint} name="sparkles" size={15} />
          <ThemedText selectable style={styles.rewardText} lightColor="#4A3825" darkColor="#4A3825">{featured.reward.label} added to the room</ThemedText>
        </View>
        {achievements.length > 1 ? (
          <View style={styles.stackNotice}>
            <ThemedText selectable style={styles.stackText} lightColor="#5A4630" darkColor="#5A4630">
              +{achievements.length - 1} more {achievements.length === 2 ? 'achievement' : 'achievements'} earned
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={share} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
            <ThemedText style={styles.shareLabel} lightColor="#5C452D" darkColor="#5C452D">Share</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.continueButton, { backgroundColor: tint }, pressed && styles.pressed]}>
            <ThemedText style={styles.continueLabel} lightColor="#FFF9EC" darkColor="#FFF9EC">Continue</ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export function CelebrationParticles({ tier, tint }: { tier: number; tint: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {Array.from({ length: 12 + tier * 8 }, (_, index) => (
        <ConfettiPiece index={index} key={index} tier={tier} tint={tint} />
      ))}
    </View>
  );
}

function ConfettiPiece({ index, tier, tint }: { index: number; tier: number; tint: string }) {
  const progress = useSharedValue(0);
  const angle = (index / (12 + tier * 8)) * Math.PI * 2;
  const distance = 105 + (index % 5) * 24 + tier * 8;
  const verticalBias = 45 + (index % 4) * 13;
  useEffect(() => {
    progress.value = withTiming(1, { duration: 720 + (index % 6) * 70, easing: Easing.out(Easing.cubic) });
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, progress.value - 0.78) / 0.22,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value + verticalBias * progress.value * progress.value },
      { rotate: `${index * 31 + progress.value * 240}deg` },
      { scale: 0.55 + progress.value * 0.45 },
    ],
  }));
  return <Animated.View style={[styles.confetti, { backgroundColor: index % 3 === 0 ? '#F3D68B' : index % 3 === 1 ? tint : '#E9EFE1' }, style]} />;
}

function roman(tier: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? String(tier);
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 80 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,15,11,0.74)' },
  confettiLayer: { alignItems: 'center', height: 1, justifyContent: 'center', left: '50%', position: 'absolute', top: '48%', width: 1, zIndex: 2 },
  confetti: { borderRadius: 3, height: 10, position: 'absolute', width: 6 },
  card: { alignItems: 'center', backgroundColor: '#EAD4AC', borderColor: 'rgba(255,248,224,0.82)', borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: '0 26px 68px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.72)', gap: 8, maxWidth: 480, overflow: 'hidden', paddingBottom: 18, paddingHorizontal: 22, paddingTop: 24, width: '100%', zIndex: 3 },
  halo: { borderRadius: 999, height: 220, opacity: 0.14, position: 'absolute', top: -120, width: 220 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 9 },
  trophy: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, height: 100, justifyContent: 'center', marginVertical: 3, position: 'relative', width: 100 },
  trophyArt: { height: 88, width: 88 },
  tierMedal: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, bottom: -6, height: 25, justifyContent: 'center', position: 'absolute', right: -6, width: 25 },
  tierMedalText: { ...KatchaUI.type.numeric, fontSize: 9, fontWeight: '900' },
  family: { ...KatchaUI.type.label, fontSize: 9.5 },
  title: { ...KatchaUI.type.display, fontSize: 31, lineHeight: 35, textAlign: 'center' },
  body: { ...KatchaUI.type.body, maxWidth: 330, textAlign: 'center' },
  reward: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingTop: 3 },
  rewardText: { ...KatchaUI.type.meta, fontSize: 10.5, fontWeight: '800' },
  stackNotice: { backgroundColor: 'rgba(84,60,35,0.08)', borderRadius: 11, marginTop: 2, paddingHorizontal: 11, paddingVertical: 6 },
  stackText: { ...KatchaUI.type.meta, fontSize: 10.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 9, paddingTop: 8, width: '100%' },
  shareButton: { alignItems: 'center', borderColor: 'rgba(85,59,34,0.22)', borderRadius: 15, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  shareLabel: { ...KatchaUI.type.action },
  continueButton: { alignItems: 'center', borderRadius: 15, boxShadow: '0 7px 17px rgba(64,45,25,0.24)', flex: 1, justifyContent: 'center', minHeight: 46 },
  continueLabel: { ...KatchaUI.type.action },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
});
