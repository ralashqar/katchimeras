import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';

const FEASTLE = require('@/assets/images/katchimeras/cutouts/feastle.png');
const FEAST_INK = '#4A291B';
const FEAST_CREAM = '#FFF0CE';

export function FeastleMergeFeastScreen({
  children,
  finishedAt = null,
  onClose,
  startedAt,
}: {
  children: ReactNode;
  finishedAt?: number | null;
  onClose: () => void;
  startedAt: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.warmScrim} />
      <LinearGradient
        colors={['rgba(47,29,12,0.46)', 'rgba(72,45,18,0.18)', 'rgba(39,22,12,0.58)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <ScreenCloseButton align="left" onPress={onClose} style={styles.closeButton} tint={FEAST_INK} variant="back" />

      <View
        pointerEvents="box-none"
        style={[
          styles.safeContent,
          compact && styles.safeContentCompact,
          {
            paddingBottom: Math.max(10, insets.bottom + 6),
            paddingLeft: Math.max(12, insets.left + 12),
            paddingRight: Math.max(12, insets.right + 12),
            paddingTop: insets.top + 60,
          },
        ]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <IconSymbol color="#F7D277" name="fork.knife" size={15} />
              <ThemedText style={styles.eyebrow} lightColor="#F7D277" darkColor="#F7D277">
                Merge Feast
              </ThemedText>
            </View>
            <ThemedText
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={2}
              style={[styles.title, compact && styles.titleCompact]}
              lightColor={FEAST_CREAM}
              darkColor={FEAST_CREAM}>
              Merge ingredients to cook for Feastle
            </ThemedText>
          </View>

          <View pointerEvents="none" style={[styles.feastleStage, compact && styles.feastleStageCompact]}>
            <Image accessibilityIgnoresInvertColors contentFit="contain" source={FEASTLE} style={styles.feastle} />
          </View>

          <ElapsedTimer finishedAt={finishedAt} startedAt={startedAt} />
        </View>

        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

function ElapsedTimer({ finishedAt, startedAt }: { finishedAt: number | null; startedAt: number }) {
  const [now, setNow] = useState(() => finishedAt ?? Date.now());

  useEffect(() => {
    if (finishedAt != null) {
      setNow(finishedAt);
      return;
    }
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [finishedAt, startedAt]);

  const elapsed = formatQuestDuration(Math.max(0, now - startedAt));
  return (
    <View accessibilityLabel={`Elapsed time ${elapsed}`} style={styles.timerPill}>
      <IconSymbol color="#B95519" name="timer" size={16} />
      <ThemedText style={styles.timerValue} lightColor="#B95519" darkColor="#B95519">{elapsed}</ThemedText>
      <ThemedText style={styles.timerLabel} lightColor={FEAST_INK} darkColor={FEAST_INK}>Elapsed</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'transparent', flex: 1 },
  warmScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(72, 45, 17, 0.25)' },
  safeContent: { alignSelf: 'center', flex: 1, gap: 8, maxWidth: 660, width: '100%' },
  safeContentCompact: { gap: 5 },
  closeButton: {
    backgroundColor: 'rgba(255, 240, 206, 0.97)',
    borderColor: 'rgba(149, 91, 33, 0.78)',
    boxShadow: '0 5px 14px rgba(63,33,12,0.38), inset 0 1px 0 rgba(255,255,255,0.82)',
  },
  header: { minHeight: 132, paddingRight: 116, position: 'relative' },
  headerCompact: { minHeight: 106 },
  headerCopy: { flex: 1, gap: 5, justifyContent: 'center', maxWidth: 390, paddingLeft: 4 },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 33 },
  titleCompact: { fontSize: 24, lineHeight: 28 },
  feastleStage: { height: 120, position: 'absolute', right: 4, top: 14, width: 126 },
  feastleStageCompact: { height: 96, top: 8, width: 104 },
  feastle: { height: '100%', width: '100%' },
  timerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,240,206,0.97)',
    borderColor: 'rgba(184,116,42,0.82)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 2,
    boxShadow: '0 4px 12px rgba(65,35,15,0.32), inset 0 1px 0 rgba(255,255,255,0.86)',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    right: 2,
  },
  timerValue: { fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '900', lineHeight: 22 },
  timerLabel: { fontSize: 10, fontWeight: '900' },
  content: { flex: 1, minHeight: 0 },
});
