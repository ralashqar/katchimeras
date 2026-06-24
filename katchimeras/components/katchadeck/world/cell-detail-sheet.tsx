import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { PatchCell } from '@/types/world';

// The "tap a cell" detail view — a small time-capsule reader for one cell of the
// day's patch. Memory Vault shows the day's photos + meanings, Journey shows
// movement (never punishing), Reflection shows mood + what stood out. Places is
// handled by the caller (it routes to the full day map).
type CellDetailSheetProps = {
  day: HomeDayRecord;
  cell: PatchCell;
  recentAvgSteps: number | null;
  onClose: () => void;
};

const MEANING_TINT: Record<string, string> = {
  calm: '#7DE8CD',
  energy: '#FFC36B',
  together: '#F49AC1',
  meaningful: '#A78BFA',
};

export function CellDetailSheet({ day, cell, recentAvgSteps, onClose }: CellDetailSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />

        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          {cell.sourceLabel}
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {cell.summaryLabel}
        </ThemedText>

        {cell.type === 'memory' ? <MemoryBody day={day} /> : null}
        {cell.type === 'journey' ? <JourneyBody day={day} recentAvgSteps={recentAvgSteps} /> : null}
        {cell.type === 'reflection' ? <ReflectionBody day={day} /> : null}

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Close
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function MemoryBody({ day }: { day: HomeDayRecord }) {
  const photos = [
    day.heroPhoto?.thumbnailUri,
    ...(day.capturedMeanings ?? []).map((meaning) => meaning.thumbnailUri),
  ].filter((uri): uri is string => !!uri);
  const meanings = day.capturedMeanings ?? [];

  if (photos.length === 0 && meanings.length === 0) {
    return <EmptyBody label="No memories captured yet. Snap a moment to fill the vault." />;
  }

  return (
    <View style={styles.body}>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.photo} contentFit="cover" transition={120} />
          ))}
        </ScrollView>
      ) : null}
      {meanings.length > 0 ? (
        <View style={styles.chipWrap}>
          {meanings.map((meaning, index) => (
            <Chip key={index} label={meaning.label} tint={MEANING_TINT[meaning.archetype] ?? Lantern.moon300} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function JourneyBody({ day, recentAvgSteps }: { day: HomeDayRecord; recentAvgSteps: number | null }) {
  const steps = day.stepsCount ?? 0;
  // Always non-judgmental: a quiet day is cozy, never a failure.
  let comparison = 'Every step left a mark on the path.';
  if (steps === 0) comparison = 'A restful day — the path is cozy and still.';
  else if (recentAvgSteps && recentAvgSteps > 0) {
    if (steps > recentAvgSteps * 1.15) comparison = 'You moved more than usual today.';
    else if (steps < recentAvgSteps * 0.6) comparison = 'A gentler day than usual — a good rest.';
    else comparison = 'About your usual pace today.';
  }
  return (
    <View style={styles.body}>
      <ThemedText style={styles.bigStat} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {steps.toLocaleString()}
      </ThemedText>
      <ThemedText style={styles.statUnit} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        steps{recentAvgSteps ? ` · usually ~${recentAvgSteps.toLocaleString()}` : ''}
      </ThemedText>
      <ThemedText style={styles.bodyLine} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {comparison}
      </ThemedText>
    </View>
  );
}

function ReflectionBody({ day }: { day: HomeDayRecord }) {
  const meanings = day.capturedMeanings ?? [];
  const answers = (day.promptAnswers ?? [])
    .filter((answer) => !answer.dismissed)
    .flatMap((answer) => answer.labels ?? []);

  if (meanings.length === 0 && answers.length === 0) {
    return <EmptyBody label="Nothing reflected yet. Tap the egg to add what stood out." />;
  }

  return (
    <View style={styles.body}>
      <View style={styles.chipWrap}>
        {meanings.map((meaning, index) => (
          <Chip key={`m-${index}`} label={meaning.label} tint={MEANING_TINT[meaning.archetype] ?? Lantern.moon300} />
        ))}
        {answers.map((label, index) => (
          <Chip key={`a-${index}`} label={label} tint={Lantern.moon300} />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.chip, { borderColor: `${tint}66` }]}>
      <View style={[styles.chipDot, { backgroundColor: tint }]} />
      <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {label}
      </ThemedText>
    </View>
  );
}

function EmptyBody({ label }: { label: string }) {
  return (
    <View style={styles.body}>
      <ThemedText style={styles.bodyLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 8,
    left: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 4, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  body: { gap: 12, paddingTop: 6 },
  photoRow: { gap: 8, paddingVertical: 2 },
  photo: { width: 88, height: 88, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  chipDot: { width: 7, height: 7, borderRadius: 999 },
  chipLabel: { fontSize: 12.5, fontWeight: '700' },
  bigStat: { fontSize: 40, fontWeight: '900', lineHeight: 44 },
  statUnit: { fontSize: 13, fontWeight: '700', marginTop: -4 },
  bodyLine: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  close: { alignSelf: 'center', paddingTop: 8 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
