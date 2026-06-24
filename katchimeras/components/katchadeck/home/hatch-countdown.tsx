import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { resolveHatchHour } from '@/utils/home-engine';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// A small pill that counts down to the day's hatch time (the user's chosen hatch
// hour). Self-ticking; once the hatch hour passes — or the day is already ready —
// it reads "Ready to hatch". Used below the egg on both Home and the World patch.
type Props = {
  // The day is already past its gate (state === 'ready_to_hatch'); skip the clock.
  isReady?: boolean;
  tint?: string;
  // Tighter pill + smaller text, for sitting close under the small World egg.
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

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

  // Compact (World): a timer icon + the time only. Full (Home): a dot + words.
  const text = compact
    ? ready
      ? 'Ready'
      : formatRemaining(remaining)
    : ready
      ? 'Ready to hatch'
      : `Hatches in ${formatRemaining(remaining)}`;

  return (
    <View style={[styles.pill, compact && styles.pillCompact, style]}>
      {compact ? (
        <IconSymbol name="timer" size={12} color={tint} />
      ) : (
        <View style={[styles.dot, { backgroundColor: tint, boxShadow: `0 0 8px ${tint}AA` }]} />
      )}
      <ThemedText
        style={[styles.label, compact && styles.labelCompact, { color: tint }]}
        lightColor={tint}
        darkColor={tint}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillCompact: { gap: 5, paddingVertical: 3, paddingHorizontal: 9 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  label: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  labelCompact: { fontSize: 10, letterSpacing: 0.2 },
});
