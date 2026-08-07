import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakHeroStage } from '@/components/katchadeck/streak/streak-hero-stage';
import { StreakHeroTitle } from '@/components/katchadeck/streak/streak-hero-title';
import { StreakWeekRow } from '@/components/katchadeck/streak/streak-week-row';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { AppFontFamilies } from '@/constants/theme';
import { streakRepository } from '@/storage/repositories/streak-repository';
import type { StreakDaySummary, StreakMilestone } from '@/types/streak';
import { localDateId, shiftDateId } from '@/utils/streak-engine';

export function StreakMilestoneCelebration({
  milestone,
  onDismiss,
  preview = false,
}: {
  milestone: StreakMilestone;
  onDismiss: () => void;
  preview?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const heroSize = Math.max(220, Math.min(300, width * 0.7, height * 0.32));
  const week = preview ? previewWeek() : streakRepository.snapshot().week;

  return (
    <Modal animationType={reduceMotion ? 'none' : 'fade'} navigationBarTranslucent onRequestClose={onDismiss} presentationStyle="fullScreen" statusBarTranslucent visible>
      <StatusBar style="dark" />
      <View accessibilityViewIsModal style={styles.screen}>
        <Image contentFit="cover" source={TODAY_ATMOSPHERE_BACKGROUND_SOURCES.clear_day.source} style={StyleSheet.absoluteFill} transition={0} />
        <View pointerEvents="none" style={styles.wash} />
        <ScrollView
          contentContainerStyle={[styles.content, { minHeight: height, paddingBottom: insets.bottom + 18, paddingTop: insets.top + 24 }]}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(reduceMotion ? 80 : 320)} style={styles.heroBlock}>
            <ThemedText selectable style={styles.eyebrow} lightColor="#75450A" darkColor="#75450A">Life milestone</ThemedText>
            <StreakHeroStage size={heroSize} />
            <View style={styles.streakCopy}><StreakHeroTitle days={milestone.days} /></View>
          </Animated.View>

          <View style={styles.weekBlock}>
            <ThemedText selectable style={styles.weekTitle} lightColor="#173D57" darkColor="#173D57">Your week, captured</ThemedText>
            <StreakWeekRow days={week} />
          </View>

          <ThemedText selectable style={styles.subtitle} lightColor="#173D57" darkColor="#173D57">{milestoneCopy(milestone.days)}</ThemedText>

          <View style={styles.bottom}>
            <View style={styles.reward}>
              <View style={styles.rewardIcon}><IconSymbol color="#75450A" name="sparkles" size={24} /></View>
              <View style={styles.rewardCopy}>
                <ThemedText selectable style={styles.rewardTitle} lightColor="#3A2A1D" darkColor="#3A2A1D">{milestone.essenceReward} Essence earned</ThemedText>
                <ThemedText selectable style={styles.rewardBody} lightColor="#5D4730" darkColor="#5D4730">Added to your life milestones</ThemedText>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <ThemedText style={styles.buttonLabel} lightColor="#FFF9EC" darkColor="#FFF9EC">Let’s keep going</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function previewWeek(): StreakDaySummary[] {
  const today = localDateId(new Date());
  const current = new Date(`${today}T12:00:00`);
  const offset = (current.getDay() - 1 + 7) % 7;
  const monday = shiftDateId(today, -offset);
  return Array.from({ length: 7 }, (_, index) => {
    const localDate = shiftDateId(monday, index);
    return {
      label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
      localDate,
      state: localDate <= today ? 'captured' as const : 'future' as const,
    };
  });
}

function milestoneCopy(days: number): string {
  if (days === 3) return 'Three days of your life, held together.';
  if (days === 7) return 'An entire week of your life, remembered.';
  if (days === 14) return 'Two weeks of moments you can return to.';
  if (days === 30) return 'A month of your life, remembered.';
  if (days === 365) return 'A whole year of small moments, kept together.';
  return 'Your life is becoming a story you can return to.';
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9F4F8', flex: 1 },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(239,248,248,0.28)' },
  content: { gap: 18, justifyContent: 'space-between', paddingHorizontal: 22 },
  heroBlock: { alignItems: 'center' },
  eyebrow: { backgroundColor: 'rgba(255,247,218,0.82)', borderRadius: 999, fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.3, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, textTransform: 'uppercase' },
  streakCopy: { alignItems: 'center', marginTop: -24 },
  weekBlock: { gap: 9 },
  weekTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, textAlign: 'center' },
  subtitle: { alignSelf: 'center', fontFamily: AppFontFamilies.manrope, fontSize: 14.5, fontWeight: '800', lineHeight: 21, maxWidth: 355, textAlign: 'center' },
  bottom: { gap: 10 },
  reward: { alignItems: 'center', backgroundColor: 'rgba(255,246,219,0.9)', borderColor: 'rgba(255,255,255,0.8)', borderCurve: 'continuous', borderRadius: 21, borderWidth: 1.5, flexDirection: 'row', gap: 12, minHeight: 72, paddingHorizontal: 14 },
  rewardIcon: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.25)', borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  rewardCopy: { flex: 1 },
  rewardTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 16 },
  rewardBody: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  button: { alignItems: 'center', backgroundColor: '#75450A', borderRadius: 999, boxShadow: '0 10px 24px rgba(83,52,14,0.2)', minHeight: 55, justifyContent: 'center' },
  buttonLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
});
