import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { companionAchievementIconSource } from '@/constants/achievement-icon-sources';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { getCreatureVisual } from '@/game/days';
import type { CompanionAchievementDef } from '@/types/companion-achievements';
import { orderAchievementCelebrationQueue } from '@/utils/achievement-celebration';

const TIER_TINT = ['#A87045', '#8295A6', '#B9872F', '#75609B', '#9B6A32'] as const;
const TRANSITION_OUT_MS = 180;
const SPLASH_GOLD = '#F6C653';
const SPLASH_GOLD_DEEP = '#75450A';
const SPLASH_INK = '#173D57';
const CONFETTI_LOOP_MS = 3_400;

type Props = {
  achievements: readonly CompanionAchievementDef[];
  onAchievementSeen: (id: string) => void;
  onComplete?: () => void;
  preview?: boolean;
};

export function CompanionAchievementCelebration({
  achievements,
  onAchievementSeen,
  onComplete,
  preview = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [queue] = useState(() => orderAchievementCelebrationQueue(achievements));
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(queue.length > 0);
  const [advancing, setAdvancing] = useState(false);
  const [bottomDockHeight, setBottomDockHeight] = useState(238);
  const featured = queue[index] ?? null;
  const family = featured ? katchimeraFamilyById.get(featured.familyId) : null;
  const companionSource = family?.anchorVisualKey
    ? getCreatureVisual(family.anchorVisualKey).source
    : null;
  const tint = featured ? TIER_TINT[featured.tier - 1] : TIER_TINT[0];
  const medallionSize = Math.max(205, Math.min(320, width * 0.76, height * 0.36));
  const coinSize = medallionSize * 0.5;
  const iconSize = medallionSize * 0.92;
  const raySize = medallionSize + 104;
  const titleSize = width < 360 ? 36 : 42;
  const bottomDockBottom = Math.max(12, insets.bottom + 8);

  useEffect(() => {
    if (!featured || process.env.EXPO_OS !== 'ios') return;
    if (featured.tier >= 4) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(featured.tier >= 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }, [featured]);

  const share = useCallback(async () => {
    if (!featured || !family) return;
    try {
      await Share.share({
        message: `${family.displayName} achievement · ${featured.name}\n${featured.description}\n${featured.criterion}`,
      });
    } catch {
      // Share cancellation and unavailable share targets are harmless.
    }
  }, [family, featured]);

  const advance = useCallback(() => {
    if (!featured || advancing) return;
    setAdvancing(true);
    if (index < queue.length - 1) {
      if (!preview) onAchievementSeen(featured.id);
      setIndex((current) => current + 1);
      setTimeout(() => setAdvancing(false), reduceMotion ? 80 : 260);
      return;
    }
    setIndex(queue.length);
    setTimeout(() => {
      if (!preview) onAchievementSeen(featured.id);
      setVisible(false);
      onComplete?.();
    }, reduceMotion ? 80 : TRANSITION_OUT_MS);
  }, [advancing, featured, index, onAchievementSeen, onComplete, preview, queue.length, reduceMotion]);

  if (!queue.length) return null;

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'fade'}
      navigationBarTranslucent
      onRequestClose={advance}
      presentationStyle="fullScreen"
      statusBarTranslucent
      transparent={false}
      visible={visible}>
      <StatusBar style="dark" />
      <View accessibilityViewIsModal style={styles.screen}>
        <Image
          contentFit="cover"
          contentPosition="center"
          source={TODAY_ATMOSPHERE_BACKGROUND_SOURCES.clear_day.source}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
        {featured ? <CelebrationParticles key={`particles-${featured.id}`} tier={featured.tier} tint={tint} /> : null}
        {featured && family ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(260).easing(Easing.out(Easing.cubic))}
            exiting={reduceMotion ? FadeOut.duration(80) : FadeOutUp.duration(TRANSITION_OUT_MS).easing(Easing.in(Easing.cubic))}
            key={featured.id}
            style={styles.foreground}>
            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingBottom: bottomDockHeight + bottomDockBottom + 18,
                  paddingTop: Math.max(22, insets.top + 12),
                },
              ]}
              contentInsetAdjustmentBehavior="never"
              showsVerticalScrollIndicator={false}
              style={styles.heroScroll}>
              <View style={styles.headingBlock}>
                <View style={styles.headingMeta}>
                  <ThemedText selectable style={styles.eyebrow} lightColor={SPLASH_GOLD_DEEP} darkColor={SPLASH_GOLD_DEEP}>
                    Achievement unlocked
                  </ThemedText>
                  {queue.length > 1 ? (
                    <ThemedText selectable style={styles.queueCount} lightColor={SPLASH_GOLD_DEEP} darkColor={SPLASH_GOLD_DEEP}>
                      {index + 1} of {queue.length}
                    </ThemedText>
                  ) : null}
                </View>
                <AchievementHeroTitle fontSize={titleSize} title={featured.name} />
                <ThemedText selectable style={styles.description} lightColor={SPLASH_INK} darkColor={SPLASH_INK}>
                  {featured.description}
                </ThemedText>
              </View>

              <View style={[styles.hero, { height: raySize, width: raySize }]}>
                <RotatingRadialSunburst baseOpacity={0.9} size={raySize} style={styles.rays} />
                <Animated.View
                  entering={reduceMotion ? FadeIn.duration(100) : FadeIn.duration(220).delay(80)}
                  style={[
                    styles.achievementStage,
                    {
                      height: iconSize,
                      transform: [{ translateY: -medallionSize * 0.045 }],
                      width: iconSize,
                    },
                  ]}>
                  <View
                    style={[
                      styles.medallion,
                      {
                        height: coinSize,
                        left: (iconSize - coinSize) / 2,
                        top: (iconSize - coinSize) / 2,
                        width: coinSize,
                      },
                    ]}>
                    <LinearGradient
                      colors={['#FFF7C7', '#F4C65C', '#D28C28']}
                      end={{ x: 0.75, y: 1 }}
                      start={{ x: 0.2, y: 0 }}
                      style={[StyleSheet.absoluteFill, styles.medallionGradient]}
                    />
                    <View style={styles.medallionInset} />
                  </View>
                  <BreathingAchievementIcon achievement={featured} size={iconSize} />
                </Animated.View>
              </View>
            </ScrollView>

            <View
              onLayout={({ nativeEvent }) => setBottomDockHeight(Math.ceil(nativeEvent.layout.height))}
              style={[styles.bottomDock, { bottom: bottomDockBottom }]}>
              <View style={styles.bottomBlock}>
                <View style={styles.familyChip}>
                  <ThemedText selectable style={styles.family} lightColor={SPLASH_INK} darkColor={SPLASH_INK}>
                    {family.displayName} · {featured.criterion}
                  </ThemedText>
                </View>
                <View style={styles.rewardCard}>
                  {companionSource ? (
                    <Image
                      accessibilityLabel={`${family.displayName} Katchimera`}
                      contentFit="contain"
                      source={companionSource}
                      style={styles.rewardCompanion}
                      transition={0}
                    />
                  ) : (
                    <View style={styles.rewardFallbackIcon}>
                      <IconSymbol color={SPLASH_GOLD_DEEP} name="sparkles" size={30} />
                    </View>
                  )}
                  <View style={styles.rewardCopy}>
                    <ThemedText selectable style={styles.rewardTitle} lightColor="#3A2A1D" darkColor="#3A2A1D">
                      {featured.reward.label}
                    </ThemedText>
                    <ThemedText selectable style={styles.rewardBody} lightColor="#4F3A25" darkColor="#4F3A25">
                      Added to the trophy room
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={advancing}
                    onPress={share}
                    style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
                    <IconSymbol color="#31536B" name="square.and.arrow.up" size={17} />
                    <ThemedText style={styles.shareLabel} lightColor="#31536B" darkColor="#31536B">Share</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={advancing}
                    onPress={advance}
                    style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
                    <ThemedText style={styles.continueLabel} lightColor="#FFF9EC" darkColor="#FFF9EC">
                      {index < queue.length - 1 ? 'Next achievement' : 'Continue'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

function AchievementHeroTitle({ fontSize, title }: { fontSize: number; title: string }) {
  const dynamicStyle = { fontSize, lineHeight: fontSize + 5 };
  return (
    <View accessibilityLabel={title} style={styles.titleStack}>
      <ThemedText
        accessibilityElementsHidden
        lightColor={SPLASH_GOLD_DEEP}
        darkColor={SPLASH_GOLD_DEEP}
        style={[styles.title, styles.titleShadow, dynamicStyle]}>
        {title}
      </ThemedText>
      <ThemedText
        selectable
        lightColor={SPLASH_GOLD}
        darkColor={SPLASH_GOLD}
        style={[styles.title, dynamicStyle]}>
        {title}
      </ThemedText>
    </View>
  );
}

function BreathingAchievementIcon({
  achievement,
  size,
}: {
  achievement: CompanionAchievementDef;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.97);
  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withTiming(1.055, { duration: 1_450, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(scale);
  }, [reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.achievementIcon, { height: size, width: size }, style]}>
      <Image
        accessibilityLabel={achievement.name}
        contentFit="contain"
        source={companionAchievementIconSource(achievement)}
        style={StyleSheet.absoluteFill}
        transition={0}
      />
    </Animated.View>
  );
}

export function CelebrationParticles({
  layerStyle,
  tier,
  tint,
}: {
  layerStyle?: StyleProp<ViewStyle>;
  tier: number;
  tint: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const pieceCount = 20 + tier * 9;
  return (
    <View pointerEvents="none" style={[styles.confettiLayer, layerStyle]}>
      {Array.from({ length: pieceCount }, (_, index) => (
        <ConfettiPiece index={index} key={index} pieceCount={pieceCount} tier={tier} tint={tint} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  index,
  pieceCount,
  tier,
  tint,
}: {
  index: number;
  pieceCount: number;
  tier: number;
  tint: string;
}) {
  const progress = useSharedValue(0);
  const angle = (index / pieceCount) * Math.PI * 2;
  const distance = 126 + (index % 6) * 24 + tier * 9;
  const verticalBias = 58 + (index % 5) * 13;
  const flightDuration = 780 + (index % 6) * 55;
  const restDuration = Math.max(1, CONFETTI_LOOP_MS - flightDuration - 2);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: flightDuration, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 1 }),
        withDelay(restDuration, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [flightDuration, progress, restDuration]);
  const style = useAnimatedStyle(() => {
    const entranceOpacity = Math.min(1, progress.value / 0.035);
    const exitOpacity = 1 - Math.max(0, progress.value - 0.74) / 0.26;
    return {
      opacity: Math.min(entranceOpacity, exitOpacity),
      transform: [
        { translateX: Math.cos(angle) * distance * progress.value },
        { translateY: Math.sin(angle) * distance * progress.value + verticalBias * progress.value * progress.value },
        { rotate: `${index * 31 + progress.value * 285}deg` },
        { scale: 0.58 + progress.value * 0.52 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          backgroundColor: index % 4 === 0 ? '#FFF3A6' : index % 4 === 1 ? tint : index % 4 === 2 ? '#F6C653' : '#FFFDF0',
          height: 10 + (index % 3) * 2,
          width: 6 + (index % 2) * 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  foreground: { ...StyleSheet.absoluteFillObject },
  heroScroll: { flex: 1, width: '100%' },
  scrollContent: { alignItems: 'center', flexGrow: 1, gap: 12, justifyContent: 'space-between', paddingHorizontal: 22 },
  headingBlock: { alignItems: 'center', gap: 9, maxWidth: 560, paddingHorizontal: 6, width: '100%' },
  headingMeta: { alignItems: 'center', backgroundColor: 'rgba(255,247,218,0.76)', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'center', minHeight: 29, paddingHorizontal: 13, paddingVertical: 5 },
  eyebrow: { fontFamily: 'Manrope', fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  queueCount: { fontFamily: 'Manrope', fontSize: 11.5, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.2 },
  titleStack: { alignItems: 'center', maxWidth: 540, overflow: 'visible', width: '100%' },
  title: {
    fontFamily: 'FredokaBold',
    letterSpacing: -1.05,
    overflow: 'visible',
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(255,250,207,0.9)',
    textShadowOffset: { height: -1, width: 0 },
    textShadowRadius: 1.5,
    width: '100%',
  },
  titleShadow: {
    left: 0,
    position: 'absolute',
    textShadowColor: 'rgba(92,53,7,0.25)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 7,
    top: 0,
    transform: [{ translateY: 4 }],
  },
  description: { fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', letterSpacing: -0.15, lineHeight: 23, maxWidth: 410, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.62)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  hero: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  achievementStage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'relative' },
  achievementIcon: { zIndex: 2 },
  rays: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  medallion: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 999, boxShadow: '0 14px 34px rgba(159,109,29,0.24), inset 0 2px 0 rgba(255,255,255,0.76)', justifyContent: 'center', overflow: 'visible', position: 'absolute', zIndex: 0 },
  medallionGradient: { borderRadius: 999 },
  medallionInset: { alignItems: 'center', backgroundColor: 'rgba(255,251,220,0.2)', borderRadius: 999, height: '86%', justifyContent: 'center', overflow: 'visible', width: '86%' },
  bottomDock: { alignItems: 'center', left: 0, paddingHorizontal: 22, position: 'absolute', right: 0, zIndex: 5 },
  bottomBlock: { alignItems: 'center', gap: 12, maxWidth: 520, width: '100%' },
  familyChip: { backgroundColor: 'rgba(255,249,224,0.9)', borderColor: 'rgba(255,255,255,0.82)', borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, boxShadow: '0 5px 14px rgba(45,102,131,0.13), inset 0 1px 0 rgba(255,255,255,0.72)', paddingHorizontal: 14, paddingVertical: 7 },
  family: { fontFamily: 'Manrope', fontSize: 13, fontWeight: '800', letterSpacing: 0.05, lineHeight: 18, maxWidth: 430, textAlign: 'center' },
  rewardCard: { alignItems: 'center', backgroundColor: 'rgba(255,246,219,0.93)', borderColor: 'rgba(255,255,255,0.78)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1.5, boxShadow: '0 12px 28px rgba(52,94,118,0.2), inset 0 1px 0 rgba(255,255,255,0.8)', flexDirection: 'row', gap: 10, minHeight: 92, overflow: 'visible', paddingHorizontal: 14, paddingVertical: 10, width: '100%' },
  rewardCompanion: { height: 86, marginLeft: -3, marginVertical: -7, width: 86 },
  rewardFallbackIcon: { alignItems: 'center', height: 62, justifyContent: 'center', width: 62 },
  rewardCopy: { flex: 1, gap: 2 },
  rewardTitle: { fontFamily: 'FredokaBold', fontSize: 16, letterSpacing: -0.15, lineHeight: 20 },
  rewardBody: { fontFamily: 'Manrope', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.02, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  shareButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.44)', borderColor: 'rgba(36,88,125,0.2)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 50, paddingHorizontal: 16 },
  shareLabel: { ...KatchaUI.type.action },
  continueButton: { alignItems: 'center', backgroundColor: '#315F7D', borderCurve: 'continuous', borderRadius: 17, boxShadow: '0 8px 18px rgba(34,73,99,0.28)', flex: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  continueLabel: { ...KatchaUI.type.action, textAlign: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  confettiLayer: { alignItems: 'center', height: 1, justifyContent: 'center', left: '50%', position: 'absolute', top: '53%', width: 1, zIndex: 2 },
  confetti: { borderRadius: 3, height: 11, position: 'absolute', width: 7 },
});
