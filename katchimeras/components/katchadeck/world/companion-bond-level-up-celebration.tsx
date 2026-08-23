import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { familyIdFromCompanionId, katchimeraFamilyById } from '@/constants/katchimera-skins';
import { AppFontFamilies, KatchaDeckUI } from '@/constants/theme';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { getCreatureVisual } from '@/game/days';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { companionBondProgressForTotal } from '@/utils/companion-bond';

const SPLASH_GOLD = '#F6C653';
const SPLASH_GOLD_DEEP = '#75450A';
const SPLASH_INK = '#173D57';

export type CompanionBondCelebrationVariant = 'journey_complete' | 'level_up';

export type CompanionJourneyDayHandoffContent = {
  dayNumber: number;
  recap: readonly string[];
  tomorrowPreview: string;
};

export function CompanionBondLevelUpCelebration({ autoContinue = true, continueLabel, dismissible = true, journeyHandoff, message, onContinue, receipt, variant = 'level_up' }: {
  autoContinue?: boolean;
  continueLabel?: string;
  dismissible?: boolean;
  journeyHandoff?: CompanionJourneyDayHandoffContent;
  message?: string;
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
  const journeyComplete = variant === 'journey_complete';
  const heroSize = journeyComplete
    ? Math.min(width * 0.68, height * (compactHeight ? 0.27 : 0.3), 270)
    : Math.min(width * 0.72, height * (compactHeight ? 0.29 : 0.32), 310);
  const raySize = journeyComplete
    ? Math.min(width * 0.84, heroSize * 1.18, 318)
    : Math.min(width * 1.04, heroSize * 1.34, 410);
  const titleSize = journeyComplete
    ? (width < 360 ? 25 : 28)
    : (width < 360 ? 30 : width < 420 ? 34 : 38);
  const numberSize = journeyComplete ? (compactHeight ? 58 : 66) : (compactHeight ? 76 : 88);
  const bottomDockBottom = Math.max(12, insets.bottom + 8);
  const journeyBondTarget = next.nextRelationshipStage
    ? next.totalPoints + next.relationshipPointsRemaining
    : next.totalPoints;
  const journeyBondRatio = journeyBondTarget > 0
    ? Math.min(1, next.totalPoints / journeyBondTarget)
    : 1;

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
    if (screenReaderEnabled || !autoContinue) return;
    const timer = setTimeout(onContinue, reduceMotion ? 700 : 2800);
    return () => clearTimeout(timer);
  }, [autoContinue, onContinue, reduceMotion, screenReaderEnabled]);

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
      onRequestClose={dismissible ? onContinue : () => {}}
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
            journeyComplete && styles.journeyScrollContent,
            {
              minHeight: height,
              paddingBottom: journeyComplete ? Math.max(82, insets.bottom + 72) : Math.max(98, insets.bottom + 86),
              paddingTop: journeyComplete ? Math.max(8, insets.top + 2) : Math.max(22, insets.top + 10),
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.scroll}>
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(300)}
            style={[styles.heading, journeyComplete && styles.journeyHeading]}>
            {journeyComplete ? (
              <View style={styles.journeyPlaque}>
                <View pointerEvents="none" style={styles.journeyPlaqueHighlight} />
                <IconSymbol color="#F7CF60" name="sparkles" size={13} />
                <View style={styles.journeyPlaqueCopy}>
                  <ThemedText style={styles.journeyPlaqueEyebrow} lightColor="#FFF7D9" darkColor="#FFF7D9">
                    {journeyHandoff ? `JOURNEY DAY ${journeyHandoff.dayNumber}` : 'JOURNEY COMPLETE'}
                  </ThemedText>
                  <ThemedText selectable style={styles.journeyPlaqueTitle} lightColor="#FFD76B" darkColor="#FFD76B">
                    Journey Day Complete
                  </ThemedText>
                </View>
                <IconSymbol color="#F7CF60" name="sparkles" size={13} />
              </View>
            ) : (
              <>
                <View style={styles.eyebrowChip}>
                  <ThemedText selectable style={styles.eyebrow} lightColor={SPLASH_GOLD_DEEP} darkColor={SPLASH_GOLD_DEEP}>
                    Bond level up
                  </ThemedText>
                </View>
                <ThemedText
                  selectable
                  style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 5 }]}
                  lightColor={SPLASH_INK}
                  darkColor={SPLASH_INK}>
                  {family?.displayName ?? 'Katchimera'} grew closer
                </ThemedText>
              </>
            )}
          </Animated.View>

          <View style={[styles.heroStage, { height: raySize, width: raySize }]}>
            <RotatingRadialSunburst baseOpacity={0.9} size={raySize} style={styles.rays} />
            {journeyComplete ? (
              <CelebrationParticles
                layerStyle={styles.journeyConfetti}
                tier={2}
                tint="#82B94D"
              />
            ) : null}
            {companionSource ? (
              <Animated.View
                entering={reduceMotion ? FadeIn.duration(100) : FadeIn.duration(280).delay(70)}
                style={[styles.heroCreature, { height: heroSize, width: heroSize }]}>
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

          {journeyComplete ? (
            <Animated.View
              accessibilityLiveRegion="polite"
              style={[styles.journeyReward, nextStyle]}>
              <BondIconArt size={48} />
              <View style={[styles.journeyRewardNumber, { height: numberSize + 10, width: 132 }]}>
                <GoldLevelNumber
                  accessibilityLabel={`${receipt.points} Bond gained`}
                  number={`+${receipt.points}`}
                  size={numberSize}
                />
              </View>
            </Animated.View>
          ) : (
            <View accessibilityLiveRegion="polite" style={[styles.numberStage, { height: numberSize + 13 }]}>
              <>
                <Animated.View style={[styles.levelNumber, oldStyle]}>
                  <GoldLevelNumber number={receipt.beforeLevel} size={numberSize} />
                </Animated.View>
                <Animated.View style={[styles.levelNumber, nextStyle]}>
                  <GoldLevelNumber number={receipt.afterLevel} size={numberSize} />
                </Animated.View>
              </>
            </View>
          )}

          {journeyComplete ? (
            <View
              accessibilityLabel={next.nextRelationshipStage
                ? `${next.totalPoints} of ${journeyBondTarget} Bond toward ${next.nextRelationshipStage}.`
                : `${next.totalPoints} Bond. Maximum relationship stage reached.`}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: Math.max(1, journeyBondTarget), now: next.totalPoints }}
              style={styles.journeyProgressCard}>
              <View style={styles.journeyProgressTrack}>
                <View style={[styles.journeyProgressFill, { width: `${Math.max(next.totalPoints ? 6 : 0, journeyBondRatio * 100)}%` }]} />
                <View pointerEvents="none" style={styles.journeyProgressLabel}>
                  <ThemedText selectable style={styles.journeyProgressValue} lightColor="#FFFBE9" darkColor="#FFFBE9">
                    {next.totalPoints} / {journeyBondTarget}
                  </ThemedText>
                </View>
                <View pointerEvents="none" style={styles.journeyProgressShine} />
              </View>
            </View>
          ) : <View style={styles.copy}>
            <View style={styles.bondName}>
              <BondIconArt size={27} />
              <ThemedText selectable style={styles.bondLabel} lightColor="#3A2A1D" darkColor="#3A2A1D">
                {next.label} bond
              </ThemedText>
            </View>
            <ThemedText selectable style={styles.total} lightColor="#4F3A25" darkColor="#4F3A25">
              {receipt.afterTotal} total bond
            </ThemedText>
            {message ? <ThemedText selectable style={styles.message} lightColor="#4F3A25" darkColor="#4F3A25">{message}</ThemedText> : null}
          </View>}

          {journeyComplete && journeyHandoff ? (
            <GameSurface contentStyle={styles.journeyTimelineContent} density="feature" style={styles.handoffCard} tone="cream">
              <View accessibilityLabel={`Journey Day ${journeyHandoff.dayNumber} timeline`} style={styles.timeline}>
                {journeyHandoff.recap.map((item, index) => (
                  <Animated.View
                    entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(240).delay(90 + index * 70)}
                    key={item}
                    style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineCompleteMarker}>
                        <IconSymbol color="#FFF9E8" name="checkmark" size={12} />
                      </View>
                      <View style={styles.timelineConnector} />
                    </View>
                    <ThemedText style={styles.timelineText} lightColor="#3E3525" darkColor="#3E3525">{item}</ThemedText>
                  </Animated.View>
                ))}
                <Animated.View
                  entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.duration(240).delay(90 + journeyHandoff.recap.length * 70)}
                  style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineLockedMarker}>
                      <IconSymbol color="#75652F" name="lock.fill" size={11} />
                    </View>
                  </View>
                  <View style={styles.timelineTomorrowCopy}>
                    <ThemedText style={styles.timelineTomorrowTitle} lightColor="#3B452F" darkColor="#3B452F">Journey Day {journeyHandoff.dayNumber + 1}</ThemedText>
                    <ThemedText style={styles.timelineTomorrowText} lightColor="#5C624D" darkColor="#5C624D">{journeyHandoff.tomorrowPreview}</ThemedText>
                  </View>
                </Animated.View>
              </View>
            </GameSurface>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomDock, { bottom: bottomDockBottom }]}>
          <View style={styles.continueButtonFrame}>
            <KatchaButton
              fullWidth
              glow
              label={continueLabel ?? (screenReaderEnabled ? 'Return to story' : 'Return now')}
              labelStyle={KatchaDeckUI.typography.ftuePanelTitle}
              onPress={onContinue}
            />
          </View>
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
  journeyScrollContent: { gap: 3, justifyContent: 'flex-start', paddingHorizontal: 16 },
  heading: { alignItems: 'center', gap: 6, maxWidth: 540, overflow: 'visible', paddingHorizontal: 4, width: '100%', zIndex: 2 },
  journeyHeading: { gap: 0 },
  journeyPlaque: { alignItems: 'center', backgroundColor: 'rgba(34,76,43,0.96)', borderColor: '#D7A447', borderCurve: 'continuous', borderRadius: 21, borderWidth: 2, boxShadow: '0 7px 16px rgba(40,28,13,0.24), inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -3px 0 rgba(14,45,24,0.26)', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 62, paddingHorizontal: 18, width: '86%' },
  journeyPlaqueHighlight: { ...StyleSheet.absoluteFillObject, borderColor: 'rgba(255,239,177,0.3)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, margin: 3 },
  journeyPlaqueCopy: { alignItems: 'center', gap: 1 },
  journeyPlaqueEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.35, lineHeight: 12 },
  journeyPlaqueTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 19, fontWeight: '700', letterSpacing: -0.3, lineHeight: 23 },
  eyebrowChip: { backgroundColor: 'rgba(255,247,218,0.76)', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 5 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontWeight: '700', letterSpacing: -0.8, overflow: 'visible', paddingBottom: 5, paddingHorizontal: 8, textAlign: 'center', width: '100%' },
  heroStage: { alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 },
  rays: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  journeyConfetti: { top: '52%', zIndex: 1 },
  heroCreature: { zIndex: 2 },
  numberStage: { justifyContent: 'center', width: 180, zIndex: 3 },
  levelNumber: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: '100%' },
  numberStack: { alignItems: 'center', overflow: 'visible', width: '100%' },
  number: { fontFamily: AppFontFamilies.fredokaBold, fontVariant: ['tabular-nums'], fontWeight: '700', overflow: 'visible', paddingHorizontal: 8, textAlign: 'center', textShadowColor: 'rgba(255,250,207,0.9)', textShadowOffset: { height: -1, width: 0 }, textShadowRadius: 1.5, width: '100%' },
  numberShadow: { left: 0, position: 'absolute', textShadowColor: 'rgba(92,53,7,0.3)', textShadowOffset: { height: 0, width: 0 }, textShadowRadius: 8, top: 0, transform: [{ translateY: 4 }] },
  journeyReward: { alignItems: 'center', flexDirection: 'row', gap: 2, justifyContent: 'center', minHeight: 76, zIndex: 3 },
  journeyRewardNumber: { alignItems: 'center', justifyContent: 'center' },
  journeyProgressCard: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(246,243,224,0.8)', borderColor: 'rgba(255,255,246,0.72)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 5px 14px rgba(35,65,54,0.18), inset 0 1px 0 rgba(255,255,255,0.78)', height: 36, justifyContent: 'center', maxWidth: 330, paddingHorizontal: 8, width: '76%', zIndex: 2 },
  journeyProgressTrack: { backgroundColor: 'rgba(31,27,19,0.74)', borderColor: 'rgba(255,239,196,0.34)', borderRadius: 999, borderWidth: 2, boxShadow: '0 5px 14px rgba(20,16,9,0.3), inset 0 1px 3px rgba(0,0,0,0.28)', height: 18, overflow: 'hidden', position: 'relative', width: '100%' },
  journeyProgressFill: { backgroundColor: '#82B94D', borderRadius: 999, bottom: 0, left: 0, position: 'absolute', top: 0 },
  journeyProgressLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  journeyProgressValue: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 10.5, fontVariant: ['tabular-nums'], lineHeight: 13 },
  journeyProgressShine: { backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, height: 3, left: 8, position: 'absolute', right: 8, top: 2 },
  copy: { alignItems: 'center', backgroundColor: 'rgba(255,249,224,0.84)', borderColor: 'rgba(255,255,255,0.76)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 3, paddingHorizontal: 18, paddingVertical: 9, zIndex: 2 },
  bondName: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  bondLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 17, fontWeight: '900' },
  total: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  message: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '700', lineHeight: 17, maxWidth: 280, paddingTop: 4, textAlign: 'center' },
  handoffCard: { maxWidth: 520, width: '100%', zIndex: 2 },
  journeyTimelineContent: { paddingHorizontal: 14, paddingVertical: 11 },
  timeline: { paddingTop: 1 },
  timelineRow: { alignItems: 'stretch', flexDirection: 'row', gap: 9, minHeight: 29 },
  timelineRail: { alignItems: 'center', width: 24 },
  timelineCompleteMarker: { alignItems: 'center', backgroundColor: '#628447', borderColor: 'rgba(255,255,255,0.8)', borderRadius: 999, borderWidth: 1, height: 21, justifyContent: 'center', width: 21, zIndex: 2 },
  timelineLockedMarker: { alignItems: 'center', backgroundColor: '#EEE2AE', borderColor: 'rgba(122,106,49,0.28)', borderRadius: 999, borderWidth: 1, height: 21, justifyContent: 'center', width: 21, zIndex: 2 },
  timelineConnector: { backgroundColor: 'rgba(98,132,71,0.38)', flex: 1, minHeight: 8, width: 2 },
  timelineText: { flex: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 14, lineHeight: 17, paddingBottom: 6, paddingTop: 1 },
  timelineTomorrowCopy: { flex: 1, gap: 1, paddingBottom: 1, paddingTop: 1 },
  timelineTomorrowTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 14, lineHeight: 17 },
  timelineTomorrowText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', lineHeight: 14 },
  bottomDock: { alignItems: 'center', left: 0, paddingHorizontal: 22, position: 'absolute', right: 0, zIndex: 5 },
  continueButtonFrame: { maxWidth: 520, width: '100%' },
  arrow: { bottom: '14%', position: 'absolute', zIndex: 1 },
});
