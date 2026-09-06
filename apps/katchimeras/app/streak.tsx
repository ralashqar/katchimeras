import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakBackupSheet } from '@/components/katchadeck/streak/streak-backup-sheet';
import { StreakHeroStage } from '@/components/katchadeck/streak/streak-hero-stage';
import { StreakHeroTitle } from '@/components/katchadeck/streak/streak-hero-title';
import { StreakWeekRow } from '@/components/katchadeck/streak/streak-week-row';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import { AppFontFamilies } from '@/constants/theme';
import { useStreak } from '@/hooks/use-streak';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { StreakDayState } from '@/types/streak';
import { trackStreakEvent } from '@/utils/streak-sync';

const GOLD = '#E5BE6A';
const GOLD_DEEP = '#75450A';
const INK = '#173D57';

export default function StreakStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const { refresh, snapshot } = useStreak();
  const [backupOpen, setBackupOpen] = useState(false);
  const totals = useMemo(lifeTotals, []);
  const heroSize = Math.max(230, Math.min(310, width * 0.72, height * 0.34));
  const capturedToday = snapshot.todayState === 'captured' || snapshot.todayState === 'repaired';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Image contentFit="cover" source={TODAY_ATMOSPHERE_BACKGROUND_SOURCES.clear_day.source} style={StyleSheet.absoluteFill} transition={0} />
      <View pointerEvents="none" style={styles.wash} />
      <ScrollView
        contentContainerStyle={[styles.content, { minHeight: height, paddingBottom: insets.bottom + 24, paddingTop: insets.top + 12 }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.nav}>
          <Pressable accessibilityLabel="Close streak story" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
            <IconSymbol color={INK} name="xmark" size={18} />
          </Pressable>
          <ThemedText selectable style={styles.navLabel} lightColor={INK} darkColor={INK}>Streak Story</ThemedText>
          <Pressable accessibilityLabel="Refresh streak" accessibilityRole="button" onPress={refresh} style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}>
            <IconSymbol color={INK} name="arrow.counterclockwise" size={18} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInUp.duration(reduceMotion ? 80 : 320)} style={styles.hero}>
          <StreakHeroStage size={heroSize} />
          <View style={styles.streakCopy}><StreakHeroTitle days={snapshot.currentStreak} /></View>
          <ThemedText selectable style={styles.heroBody} lightColor={INK} darkColor={INK}>
            {capturedToday
              ? 'Today is part of your story. Every extra memory adds more Energy.'
              : 'Capture one meaningful thing from today to keep your story going.'}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(reduceMotion ? 80 : 300).delay(reduceMotion ? 0 : 90)} style={styles.weekBlock}>
          <View style={styles.weekHeading}>
            <View>
              <ThemedText selectable style={styles.kicker} lightColor={GOLD_DEEP} darkColor={GOLD_DEEP}>This week</ThemedText>
              <ThemedText selectable style={styles.weekTitle} lightColor={INK} darkColor={INK}>Monday to Sunday</ThemedText>
            </View>
            <View style={[styles.todayPill, capturedToday && styles.todayPillCaptured]}>
              <IconSymbol color={capturedToday ? GOLD_DEEP : INK} name={capturedToday ? 'checkmark' : 'flame.fill'} size={13} />
              <ThemedText selectable style={styles.todayPillLabel} lightColor={capturedToday ? GOLD_DEEP : INK} darkColor={capturedToday ? GOLD_DEEP : INK}>
                {capturedToday ? 'Captured' : 'Open'}
              </ThemedText>
            </View>
          </View>
          <StreakWeekRow days={snapshot.week} />
        </Animated.View>

        <KatchaButton fullWidth label={capturedToday ? 'Back to today' : 'Capture today'} onPress={() => router.replace('/(tabs)/today')} />

        <View style={styles.metrics}>
          <Metric label="Best streak" value={snapshot.longestStreak} />
          <View style={styles.metricDivider} />
          <Metric label="Days captured" value={snapshot.lifetimeCapturedDays} />
          <View style={styles.metricDivider} />
          <Metric label="Repairs" value={`${snapshot.repairsAvailable}/${snapshot.repairsCapacity}`} />
        </View>

        <View style={styles.details}>
          <View style={styles.detailsHeading}>
            <View>
              <ThemedText selectable style={styles.kicker} lightColor={GOLD_DEEP} darkColor={GOLD_DEEP}>Recent history</ThemedText>
              <ThemedText selectable style={styles.detailsTitle} lightColor={INK} darkColor={INK}>The last four weeks</ThemedText>
            </View>
            <IconSymbol color={GOLD_DEEP} name="calendar" size={22} />
          </View>
          <View style={styles.calendar}>{snapshot.recentDays.map((day) => <CalendarDay key={day.localDate} state={day.state} />)}</View>
          <View style={styles.lifeLine}>
            <LifeTotal label="Memories" value={totals.memories} />
            <LifeTotal label="Photos" value={totals.photos} />
            <LifeTotal label="Katchimeras" value={totals.katchimeras} />
          </View>
          {snapshot.syncState !== 'synced' ? (
            <View style={styles.syncNote}>
              <IconSymbol color={GOLD_DEEP} name={snapshot.syncState === 'error' ? 'info.circle.fill' : 'cloud.fill'} size={17} />
              <ThemedText selectable style={styles.syncText} lightColor={INK} darkColor={INK}>
                {snapshot.syncState === 'error' ? 'Your streak is safe here. We’ll retry syncing.' : 'Waiting to sync'}
              </ThemedText>
            </View>
          ) : null}
          <KatchaButton fullWidth icon="shield.fill" label="Back up your streak" onPress={() => { setBackupOpen(true); void trackStreakEvent('streak_backup_opened'); }} variant="secondary" />
        </View>
      </ScrollView>
      {backupOpen ? <StreakBackupSheet onClose={() => setBackupOpen(false)} /> : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <View style={styles.metric}><ThemedText selectable style={styles.metricValue} lightColor={INK} darkColor={INK}>{value}</ThemedText><ThemedText selectable style={styles.metricLabel} lightColor="#62788A" darkColor="#62788A">{label}</ThemedText></View>;
}

function CalendarDay({ state }: { state: StreakDayState }) {
  const counted = state === 'captured' || state === 'repaired';
  return <View style={[styles.calendarDay, counted && styles.calendarDayCaptured, state === 'repaired' && styles.calendarDayRepaired, state === 'missed' && styles.calendarDayMissed]}>{counted ? <IconSymbol color="#FFF9EC" name={state === 'repaired' ? 'shield.fill' : 'checkmark'} size={10} /> : null}</View>;
}

function LifeTotal({ label, value }: { label: string; value: number }) {
  return <View style={styles.lifeTotal}><ThemedText selectable style={styles.lifeValue} lightColor={INK} darkColor={INK}>{value.toLocaleString()}</ThemedText><ThemedText selectable style={styles.lifeLabel} lightColor="#62788A" darkColor="#62788A">{label}</ThemedText></View>;
}

function lifeTotals() {
  const state = homeRepository.load();
  const days = state ? [...state.archivedDays, state.today] : [];
  return {
    katchimeras: days.filter((day) => day.creature).length,
    memories: days.reduce((sum, day) => sum + (day.journalRecords?.length ?? day.moments.length), 0),
    photos: days.reduce((sum, day) => sum + day.moments.filter((moment) => moment.source === 'photo_library').length, 0),
  };
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9F4F8', flex: 1 },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(239,248,248,0.28)' },
  content: { gap: 18, paddingHorizontal: 20 },
  nav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  circleButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.66)', borderColor: 'rgba(255,255,255,0.82)', borderRadius: 999, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  navLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  hero: { alignItems: 'center' },
  streakCopy: { alignItems: 'center', marginTop: -24 },
  heroBody: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '700', lineHeight: 20, maxWidth: 350, paddingTop: 10, textAlign: 'center' },
  weekBlock: { gap: 10 },
  weekHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  kicker: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  weekTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 20, lineHeight: 23 },
  todayPill: { alignItems: 'center', backgroundColor: 'rgba(23,61,87,0.06)', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  todayPillCaptured: { backgroundColor: 'rgba(229,190,106,0.24)' },
  todayPillLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900' },
  metrics: { borderBottomColor: 'rgba(23,61,87,0.1)', borderTopColor: 'rgba(23,61,87,0.1)', borderBottomWidth: 1, borderTopWidth: 1, flexDirection: 'row', paddingVertical: 14 },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 22, fontVariant: ['tabular-nums'] },
  metricLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '800', marginTop: 1 },
  metricDivider: { backgroundColor: 'rgba(23,61,87,0.1)', width: 1 },
  details: { backgroundColor: 'rgba(255,250,233,0.88)', borderColor: 'rgba(255,255,255,0.8)', borderCurve: 'continuous', borderRadius: 27, borderWidth: 1.5, boxShadow: '0 16px 36px rgba(52,94,118,0.14), inset 0 1px 0 rgba(255,255,255,0.82)', gap: 16, padding: 17 },
  detailsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  detailsTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 19, lineHeight: 23 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  calendarDay: { alignItems: 'center', backgroundColor: 'rgba(23,61,87,0.04)', borderColor: 'rgba(23,61,87,0.12)', borderRadius: 999, borderWidth: 1, height: 26, justifyContent: 'center', width: 26 },
  calendarDayCaptured: { backgroundColor: GOLD, borderColor: '#C99433' },
  calendarDayRepaired: { backgroundColor: '#7B8E74', borderColor: '#5D7357' },
  calendarDayMissed: { borderColor: 'rgba(23,61,87,0.22)' },
  lifeLine: { flexDirection: 'row', justifyContent: 'space-between' },
  lifeTotal: { flex: 1 },
  lifeValue: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 18 },
  lifeLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '800' },
  syncNote: { alignItems: 'center', backgroundColor: 'rgba(229,190,106,0.16)', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 10 },
  syncText: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '800' },
});
