import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';

const revealedJourneyStatuses = new Set<string>();

export type KatchimeraJourneyStatus = 'in_progress' | 'complete';

export function KatchimeraJourneyStatusPlaque({
  dayNumber,
  revealKey,
  status,
}: {
  dayNumber: number;
  revealKey: string;
  status: KatchimeraJourneyStatus;
}) {
  const reduceMotion = useReducedMotion();
  const complete = status === 'complete';
  const [animateReveal] = useState(() => !reduceMotion && !revealedJourneyStatuses.has(revealKey));

  useEffect(() => {
    revealedJourneyStatuses.add(revealKey);
  }, [revealKey]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={`Journey Day ${dayNumber}, ${complete ? 'complete' : 'in progress'}`}
      entering={animateReveal ? FadeInDown.duration(300) : undefined}
      pointerEvents="none"
      style={styles.root}>
      <Animated.View entering={animateReveal ? ZoomIn.duration(260).delay(80) : undefined} style={styles.plaque}>
        <View pointerEvents="none" style={styles.plaqueHighlight} />
        <ThemedText
          numberOfLines={1}
          style={styles.title}
          lightColor="#FFE08A"
          darkColor="#FFE08A">
          Journey Day {dayNumber}
        </ThemedText>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(180)}
          key={status}
          style={[styles.status, complete ? styles.statusComplete : styles.statusInProgress]}>
          <IconSymbol
            color={complete ? '#DDF2A8' : '#FFD76B'}
            name={complete ? 'checkmark' : 'circle.fill'}
            size={complete ? 14 : 8}
            weight="bold"
          />
          <ThemedText
            numberOfLines={1}
            style={styles.statusText}
            lightColor={complete ? '#E8F7BE' : '#FFE6A3'}
            darkColor={complete ? '#E8F7BE' : '#FFE6A3'}>
            {complete ? 'Complete' : 'In progress'}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: -56, zIndex: 7 },
  plaque: {
    alignItems: 'center',
    backgroundColor: 'rgba(34,76,43,0.96)',
    borderColor: '#D7A447',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 2,
    boxShadow: '0 6px 13px rgba(40,28,13,0.28), inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -3px 0 rgba(14,45,24,0.26)',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 16,
    width: 270,
  },
  plaqueHighlight: { ...StyleSheet.absoluteFillObject, borderColor: 'rgba(255,239,177,0.32)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, margin: 3 },
  title: { flexShrink: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, fontWeight: '700', letterSpacing: -0.25, lineHeight: 21 },
  status: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 27, paddingHorizontal: 9 },
  statusComplete: { backgroundColor: 'rgba(164,204,99,0.18)', borderColor: 'rgba(222,244,174,0.36)' },
  statusInProgress: { backgroundColor: 'rgba(246,194,74,0.14)', borderColor: 'rgba(255,220,125,0.34)' },
  statusText: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 10.5, fontWeight: '700', lineHeight: 13 },
});
