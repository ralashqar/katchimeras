import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * The rival's charge: one pip per piece in its beat, filled as each lands.
 *
 * What makes an incoming volley anticipated rather than merely noticed. The last pip pulses while the rival is
 * one piece from firing, so a glance at the top of the screen says "brace". Views only — two or three pips do
 * not earn a canvas — and the pulse is one repeating shared value on the UI thread.
 */
export const RivalCharge = memo(function RivalCharge({ placed, total, reduced }: { placed: number; total: number; reduced: boolean }) {
  const armed = placed === total - 1 && total > 1;
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!armed || reduced) { glow.value = armed ? 1 : 0; return; }
    glow.value = withRepeat(withTiming(1, { duration: 420 }), -1, true);
    return () => cancelAnimation(glow);
  }, [armed, reduced, glow]);
  const pulse = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * glow.value }));
  return <View accessible accessibilityLabel={`Rival charge ${placed} of ${total}`} pointerEvents="none" style={styles.row}>
    {Array.from({ length: total }, (_, i) => {
      const filled = i < placed;
      const next = i === placed && armed;
      return <Animated.View key={i} style={[styles.pip, filled && styles.filled, next && styles.next, next && pulse]} />;
    })}
  </View>;
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 5 },
  pip: { width: 22, height: 7, borderRadius: 4, backgroundColor: '#061F1FCC', borderWidth: 1, borderColor: '#AFD7A344' },
  filled: { backgroundColor: '#F2BB3E', borderColor: '#FFE49A' },
  next: { borderColor: '#FFE49A', backgroundColor: '#F2BB3E' },
});
