import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MotionView as MotiView } from '@/components/katchadeck/ui/motion-view';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

type Props = {
  phase: 'recording' | 'analyzing';
  elapsed: number;
};

export function InlineVoiceNote({ phase, elapsed }: Props) {
  if (phase === 'analyzing') {
    return (
      <View
        accessibilityLabel="Reading voice note"
        accessibilityRole="progressbar"
        style={styles.status}>
        <ActivityIndicator color={Lantern.ember300} size="small" />
        <ThemedText style={styles.statusText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          Reading…
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`Recording voice note, ${elapsed} seconds`}
      accessibilityRole="progressbar"
      style={[styles.status, styles.recording]}>
      <View style={styles.recDot} />
      <View style={styles.bars}>
        {[0, 1, 2, 3, 4].map((index) => (
          <MotiView
            animate={{ scaleY: 1 }}
            from={{ scaleY: 0.4 }}
            key={index}
            style={styles.bar}
            transition={{
              delay: index * 60,
              duration: 360 + index * 90,
              loop: true,
              type: 'timing',
            }}
          />
        ))}
      </View>
      <ThemedText style={styles.statusText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {`0:${String(elapsed).padStart(2, '0')} · release to finish`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.92)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 10px 26px rgba(0,0,0,0.38)',
    flexDirection: 'row',
    gap: 9,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  recording: {
    borderColor: 'rgba(244,154,193,0.52)',
  },
  recDot: {
    backgroundColor: '#F49AC1',
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 16,
  },
  bar: {
    backgroundColor: '#F49AC1',
    borderRadius: 2,
    height: 16,
    width: 3,
  },
  statusText: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: 0.15,
  },
});
