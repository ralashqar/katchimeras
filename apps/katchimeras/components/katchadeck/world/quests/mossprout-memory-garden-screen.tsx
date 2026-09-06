import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { ScreenCloseButton } from '@/components/katchadeck/ui/screen-close-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';

const MOSSPROUT = require('@incubator/art-cutouts/mossprout.png');
const GARDEN_INK = '#3D2D1D';
const GARDEN_CREAM = '#FFF1CE';

export function MossproutMemoryGardenScreen({
  children,
  elapsed,
  moves,
  onBoardLayout,
  onClose,
  onPrimary,
  pairsFound,
  pairCount,
  primaryLabel,
  result = false,
  status,
}: {
  children: ReactNode;
  elapsed: string;
  moves: number;
  onBoardLayout?: (event: LayoutChangeEvent) => void;
  onClose: () => void;
  onPrimary?: () => void;
  pairsFound: number;
  pairCount: number;
  primaryLabel?: string;
  result?: boolean;
  status: string;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? FadeIn.duration(100) : FadeInDown.duration(280);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.mossScrim} />
      <LinearGradient
        colors={['rgba(6,18,12,0.58)', 'rgba(8,22,13,0.24)', 'rgba(7,18,10,0.58)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <ScreenCloseButton
        align="left"
        onPress={onClose}
        variant="back"
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.safeContent,
          {
            paddingBottom: Math.max(12, insets.bottom + 8),
            paddingLeft: Math.max(14, insets.left + 14),
            paddingRight: Math.max(14, insets.right + 14),
            paddingTop: insets.top + 62,
          },
        ]}>
        <Animated.View entering={enter} style={styles.header}>
          <View style={styles.titleRow}>
            <IconSymbol color="#B7D86E" name="leaf.fill" size={16} />
            <ThemedText style={styles.title} lightColor={GARDEN_CREAM} darkColor={GARDEN_CREAM}>
              Memory Garden
            </ThemedText>
            <IconSymbol color="#B7D86E" name="leaf.fill" size={16} />
          </View>
          <View style={styles.statsRow}>
            <GardenStat icon="leaf.fill" label={`${pairsFound}/${pairCount} pairs`} tone="gold" />
            <GardenStat icon="pawprint.fill" label={`${moves} ${moves === 1 ? 'move' : 'moves'}`} tone="cream" />
            <GardenStat icon="timer" label={elapsed} tone="green" />
          </View>
        </Animated.View>

        <View
          accessibilityLabel="Mossprout memory garden cards"
          onLayout={onBoardLayout}
          style={[styles.board, result && styles.resultBoard]}>
          {children}
        </View>

        <Animated.View entering={enter} style={styles.bottomArea}>
          <View accessibilityLiveRegion="polite" style={styles.statusRibbon}>
            <Image accessibilityIgnoresInvertColors contentFit="contain" source={MOSSPROUT} style={styles.mossprout} />
            <ThemedText style={styles.statusText} lightColor={GARDEN_INK} darkColor={GARDEN_INK}>
              {status}
            </ThemedText>
            <IconSymbol color="#78934A" name="leaf.fill" size={15} />
          </View>
          {primaryLabel && onPrimary ? (
            <KatchaSurfaceProvider surface="parchment">
              <KatchaButton
                fullWidth
                icon={result ? 'arrow.right' : 'leaf.fill'}
                label={primaryLabel}
                onPress={onPrimary}
                variant="secondary"
              />
            </KatchaSurfaceProvider>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

function GardenStat({ icon, label, tone }: { icon: IconSymbolName; label: string; tone: 'gold' | 'cream' | 'green' }) {
  return (
    <View style={[styles.stat, tone === 'gold' ? styles.statGold : tone === 'green' ? styles.statGreen : styles.statCream]}>
      <IconSymbol color={tone === 'green' ? '#3F7042' : tone === 'gold' ? '#728D3C' : '#456C69'} name={icon} size={14} />
      <ThemedText numberOfLines={1} style={styles.statLabel} lightColor={GARDEN_INK} darkColor={GARDEN_INK}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'transparent', flex: 1 },
  mossScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 21, 13, 0.48)' },
  safeContent: { alignSelf: 'center', flex: 1, gap: 10, maxWidth: 620, width: '100%' },
  header: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: 0.7, lineHeight: 25, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', maxWidth: 480, width: '100%' },
  stat: {
    alignItems: 'center',
    borderColor: 'rgba(89, 70, 39, 0.5)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1,
    boxShadow: '0 3px 8px rgba(10, 24, 13, 0.3), inset 0 1px 0 rgba(255,255,255,0.72)',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  statGold: { backgroundColor: 'rgba(250, 215, 127, 0.96)' },
  statCream: { backgroundColor: 'rgba(242, 239, 211, 0.96)' },
  statGreen: { backgroundColor: 'rgba(216, 239, 201, 0.96)' },
  statLabel: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900', textTransform: 'uppercase' },
  board: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0, width: '100%' },
  resultBoard: { paddingHorizontal: 12 },
  bottomArea: { alignSelf: 'center', gap: 10, maxWidth: 500, width: '100%' },
  statusRibbon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(224, 195, 143, 0.98)',
    borderColor: 'rgba(104, 72, 31, 0.72)',
    borderCurve: 'continuous',
    borderRadius: 17,
    borderWidth: 1,
    boxShadow: '0 5px 14px rgba(10, 24, 13, 0.4), inset 0 1px 0 rgba(255,244,211,0.68)',
    flexDirection: 'row',
    gap: 8,
    maxWidth: 360,
    minHeight: 52,
    paddingLeft: 92,
    paddingRight: 13,
    position: 'relative',
    width: '86%',
  },
  mossprout: { bottom: -16, height: 132, left: -50, position: 'absolute', width: 136 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '900', lineHeight: 17, textAlign: 'center' },
});
