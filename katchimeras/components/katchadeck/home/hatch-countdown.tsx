import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { popEnter } from '@/components/katchadeck/motion';
import { Lantern } from '@/constants/theme';
import { resolveHatchHour } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// The hatch countdown (v5 mockup): a frosted-glass rounded card with a small
// "Hatches in" kicker over a big bold gold time ("05h 27m"). Self-ticking;
// once the hatch hour passes — or the day is already ready — it reads "Ready
// to hatch". The compact variant (timer icon + time) is kept for small hosts.
type Props = {
  // The day is already past its gate (state === 'ready_to_hatch'); skip the clock.
  isReady?: boolean;
  tint?: string;
  // Tighter pill + smaller text, for sitting close under a small egg.
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

const GOLD = '#F2D48A';
const CREAM = 'rgba(251, 243, 228, 0.88)';

export function HatchCountdown({ isReady = false, tint = Lantern.ember300, compact = false, style }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const hatchHour = resolveHatchHour(loadOnboardingProfile());
  const target = new Date(nowMs);
  target.setHours(hatchHour, 0, 0, 0);
  const remaining = target.getTime() - nowMs;
  const ready = isReady || remaining <= 0;

  if (compact) {
    return (
      <View style={[styles.compactPill, style]}>
        <IconSymbol name="timer" size={12} color={tint} />
        <ThemedText style={[styles.compactLabel, { color: tint }]} lightColor={tint} darkColor={tint}>
          {ready ? 'Ready' : formatRemaining(remaining)}
        </ThemedText>
      </View>
    );
  }

  return (
    <Animated.View entering={popEnter(240)} style={[styles.card, style]}>
      {ready ? (
        <ThemedText style={styles.value} lightColor={GOLD} darkColor={GOLD}>
          Ready to hatch
        </ThemedText>
      ) : (
        <>
          <View style={styles.kickerRow}>
            <IconSymbol name="hourglass" size={11} color={CREAM} />
            <ThemedText style={styles.kicker} lightColor={CREAM} darkColor={CREAM}>
              Hatches in
            </ThemedText>
          </View>
          <ThemedText style={styles.value} lightColor={GOLD} darkColor={GOLD}>
            {formatRemaining(remaining)}
          </ThemedText>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(31, 27, 22, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.36)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1.2,
    boxShadow: '0 4px 14px rgba(13, 12, 15, 0.24), inset 0 1px 0 rgba(255, 248, 230, 0.2)',
    gap: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  kickerRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  compactPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(48, 34, 18, 0.88)',
    borderColor: 'rgba(244, 222, 180, 0.3)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  compactLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
});
