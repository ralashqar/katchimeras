import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { familyIdFromCompanionId, katchimeraFamilyById } from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { AppFontFamilies } from '@/constants/theme';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { getCreatureVisual } from '@/game/days';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { companionBondProgressForTotal } from '@/utils/companion-bond';

const SPLASH_GOLD = '#F6C653';
const SPLASH_GOLD_DEEP = '#75450A';
const SPLASH_INK = '#173D57';

export type CompanionBondCelebrationVariant = 'journey_complete' | 'level_up';

export function CompanionBondLevelUpCelebration({ onContinue, receipt, variant = 'level_up' }: {
  onContinue: () => void;
  receipt: CompanionBondAwardReceipt;
  variant?: CompanionBondCelebrationVariant;
}) {
  const reduceMotion = useReducedMotion();
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const familyId = familyIdFromCompanionId(receipt.creatureId);
  const family = familyId ? katchimeraFamilyById.get(familyId) : null;
  const companionSource = family?.anchorVisualKey ? getCreatureVisual(family.anchorVisualKey, 'grown').source : null;
  const next = companionBondProgressForTotal(receipt.afterTotal);
  const compactHeight = height < 740;
  const heroSize = Math.min(width * 0.72, height * (compactHeight ? 0.29 : 0.32), 310);
  const raySize = Math.min(width * 1.04, heroSize * 1.34, 410);
  const titleSize = width < 360 ? 30 : width < 420 ? 34 : 38;
  const numberSize = compactHeight ? 76 : 88;
  const bottomDockBottom = Math.max(12, insets.bottom + 8);
  const journeyComplete = variant === 'journey_complete';

  useEffect(() => {
    progress.value = withDelay(180, withTiming(1, { duration: reduceMotion ? 100 : 560, easing: Easing.out(Easing.cubic) }));
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (screenReaderEnabled) return;
    const timer = setTimeout(onContinue, reduceMotion ? 700 : 2800);
    return () => clearTimeout(timer);
  }, [onContinue, reduceMotion, screenReaderEnabled]);

  const oldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.62, 1], [1, 0, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -48]) }],
  }));
  const nextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.45, 1], [0, 0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [52, 0]) },
      { scale: interpolate(progress.value, [0.5, 1], [0.84, 1]) },
    ],
  }));

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'fade'}
      navigationBarTranslucent
      onRequestClose={onContinue}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible>
      <StatusBar style="dark" />
      <View accessibilityViewIsModal style={styles.screen}>
        <Image
          contentFit="cover"
          contentPosition="center"
          source={TODAY_ATMOSPHERE_BACKGROUND_SOURCES.clear_day.source}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
        <View pointerEvents="none" style={styles.skyVeil} />
        {!reduceMotion ? Array.from({ length: 10 }, (_, index) => <RisingArrow index={index} key={index} width={width} />) : null}

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              minHeight: height,
              paddingBottom: Math.max(98, insets.bottom + 86),
              paddingTop: Math.max(22, insets.top + 10),
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}>
          <Animated.View entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(300)} style={styles.heading}>
            <View style={styles.eyebrowChip}>
              <ThemedText selectable style={styles.eyebrow} lightColor={SPLASH_GOLD_DEEP} darkColor={SPLASH_GOLD_DEEP}>
                {journeyComplete ? 'Journey Day complete' : 'Bond level up'}
              </ThemedText>
            </View>
            <ThemedText
              selectable
              style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 7 }]}
              lightColor={SPLASH_INK}
              darkColor={SPLASH_INK}>
              {journeyComplete
                ? `A day with ${family?.displayName ?? 'your Katchimera'}`
                : `${family?.displayName ?? 'Katchimera'} grew closer`}
            </ThemedText>
          </Animated.View>

          <View style={[styles.heroStage, { height: raySize, width: raySize }]}>
            <RotatingRadialSunburst baseOpacity={0.9} size={raySize} style={styles.rays} />
            {companionSource ? (
              <Animated.View entering={reduceMotion ? FadeIn.duration(100) : FadeIn.duration(280).delay(70)} style={{ height: heroSize, width: heroSize }}>
                <Image
                  accessibilityLabel={journeyComplete
                    ? `${family?.displayName ?? 'Katchimera'} after completing today's Journey`
                    : `${family?.displayName ?? 'Katchimera'} at its new bond level`}
                  contentFit="contain"
                  source={companionSource}
                  style={StyleSheet.absoluteFill}
                  transition={0}
                />
              </Animated.View>
            ) : null}
          </View>

          <View accessibilityLiveRegion="polite" style={[styles.numberStage, { height: numberSize + 13 }]}>
            {journeyComplete ? (
              <Animated.View style={[styles.levelNumber, nextStyle]}>
                <GoldLevelNumber
                  accessibilityLabel={`${receipt.points} Bond gained`}
                  number={`+${receipt.points}`}
                  size={numberSize}
                />
              </Animated.View>
            ) : (
              <>
                <Animated.View style={[styles.levelNumber, oldStyle]}>
                  <GoldLevelNumber number={receipt.beforeLevel} size={numberSize} />
                </Animated.View>
                <Animated.View style={[styles.levelNumber, nextStyle]}>
                  <GoldLevelNumber number={receipt.afterLevel} size={numberSize} />
                </Animated.View>
              </>
            )}
          </View>

          <View style={styles.copy}>
            <View style={styles.bondName}>
              <IconSymbol color="#A95043" name="heart.fill" size={17} />
              <ThemedText selectable style={styles.bondLabel} lightColor="#3A2A1D" darkColor="#3A2A1D">
                {journeyComplete ? `+${receipt.points} Bond` : `${next.label} bond`}
              </ThemedText>
            </View>
            <ThemedText selectable style={styles.total} lightColor="#4F3A25" darkColor="#4F3A25">
              {receipt.afterTotal} total bond
            </ThemedText>
          </View>
        </ScrollView>

        <View style={[styles.bottomDock, { bottom: bottomDockBottom }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
            <ThemedText style={styles.continueLabel} lightColor="#FFF9EC" darkColor="#FFF9EC">{screenReaderEnabled ? 'Return to story' : 'Return now'}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function GoldLevelNumber({ accessibilityLabel, number, size }: {
  accessibilityLabel?: string;
  number: number | string;
  size: number;
}) {
  const dynamicStyle = { fontSize: size, lineHeight: size + 10 };
  return (
    <View accessibilityLabel={accessibilityLabel ?? `Bond level ${number}`} style={styles.numberStack}>
      <ThemedText
        accessibilityElementsHidden
        style={[styles.number, styles.numberShadow, dynamicStyle]}
        lightColor={SPLASH_GOLD_DEEP}
        darkColor={SPLASH_GOLD_DEEP}>
        {number}
      </ThemedText>
      <ThemedText selectable style={[styles.number, dynamicStyle]} lightColor={SPLASH_GOLD} darkColor={SPLASH_GOLD}>
        {number}
      </ThemedText>
    </View>
  );
}

function RisingArrow({ index, width }: { index: number; width: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(index * 90, withRepeat(withSequence(
      withTiming(1, { duration: 1050, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 0 }),
    ), -1));
    return () => cancelAnimation(progress);
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    left: (index + 0.6) * width / 11,
    opacity: interpolate(progress.value, [0, 0.2, 0.8, 1], [0, 0.68, 0.42, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [150 + (index % 3) * 34, -220]) },
      { scale: 0.7 + (index % 3) * 0.13 },
    ],
  }));
  return <Animated.View style={[styles.arrow, style]}><IconSymbol color="#FFF2A9" name="arrow.up" size={20} /></Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  skyVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,247,205,0.12)' },
  scroll: { flex: 1, width: '100%', zIndex: 2 },
  scrollContent: { alignItems: 'center', flexGrow: 1, gap: 8, justifyContent: 'center', paddingHorizontal: 22 },
  heading: { alignItems: 'center', gap: 6, maxWidth: 540, overflow: 'visible', paddingHorizontal: 4, width: '100%', zIndex: 2 },
  eyebrowChip: { backgroundColor: 'rgba(255,247,218,0.76)', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 5 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontWeight: '700', letterSpacing: -0.8, overflow: 'visible', paddingBottom: 5, paddingHorizontal: 8, textAlign: 'center', width: '100%' },
  heroStage: { alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 },
  rays: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  numberStage: { justifyContent: 'center', width: 180, zIndex: 3 },
  levelNumber: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: '100%' },
  numberStack: { alignItems: 'center', overflow: 'visible', width: '100%' },
  number: { fontFamily: AppFontFamilies.fredokaBold, fontVariant: ['tabular-nums'], fontWeight: '700', overflow: 'visible', paddingHorizontal: 8, textAlign: 'center', textShadowColor: 'rgba(255,250,207,0.9)', textShadowOffset: { height: -1, width: 0 }, textShadowRadius: 1.5, width: '100%' },
  numberShadow: { left: 0, position: 'absolute', textShadowColor: 'rgba(92,53,7,0.3)', textShadowOffset: { height: 0, width: 0 }, textShadowRadius: 8, top: 0, transform: [{ translateY: 4 }] },
  copy: { alignItems: 'center', backgroundColor: 'rgba(255,249,224,0.84)', borderColor: 'rgba(255,255,255,0.76)', borderRadius: 18, borderWidth: 1, gap: 3, paddingHorizontal: 18, paddingVertical: 9, zIndex: 2 },
  bondName: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  bondLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 17, fontWeight: '900' },
  total: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  bottomDock: { alignItems: 'center', left: 0, paddingHorizontal: 22, position: 'absolute', right: 0, zIndex: 5 },
  continueButton: { alignItems: 'center', backgroundColor: '#315F7D', borderCurve: 'continuous', borderRadius: 17, boxShadow: '0 8px 18px rgba(34,73,99,0.28)', justifyContent: 'center', maxWidth: 520, minHeight: 52, paddingHorizontal: 22, width: '100%' },
  continueLabel: { ...KatchaUI.type.action, textAlign: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  arrow: { bottom: '14%', position: 'absolute', zIndex: 1 },
});
