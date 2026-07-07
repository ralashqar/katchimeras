import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

type MicrocopyToastProps = {
  message: string | null;
  busy?: boolean;
};

export function MicrocopyToast({ message, busy = false }: MicrocopyToastProps) {
  if (!message) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={styles.microcopy}>
      {busy ? <ActivityIndicator color={Lantern.ember300} size="small" /> : null}
      <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {message}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  microcopy: {
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 10, 20, 0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 120,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 45,
  },
  microcopyText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
