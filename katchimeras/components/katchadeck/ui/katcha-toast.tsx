import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { TOAST_MESSAGES_ENABLED } from '@/constants/game-ui';
import { KatchaUI } from '@/constants/katcha-ui';

type KatchaToastProps = {
  busy?: boolean;
  icon?: IconSymbolName;
  message: string | null;
  placementStyle?: StyleProp<ViewStyle>;
  tone?: 'neutral' | 'success' | 'danger';
};

export function KatchaToast({ busy = false, icon, message, placementStyle, tone = 'neutral' }: KatchaToastProps) {
  const { tokens } = useKatchaSurface();
  const reduceMotion = useReducedMotion();
  if (!TOAST_MESSAGES_ENABLED || !message) return null;
  const accent = tone === 'danger' ? tokens.destructive : tone === 'success' ? tokens.success : tokens.accent;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={FadeInDown.duration(reduceMotion ? 80 : 220)}
      exiting={FadeOut.duration(160)}
      pointerEvents="none"
      style={[
        styles.toast,
        placementStyle ?? styles.defaultPlacement,
        { backgroundColor: tokens.elevated, borderColor: tokens.borderStrong, boxShadow: tokens.cardShadow },
      ]}>
      {busy ? <ActivityIndicator color={accent} size="small" /> : icon || tone !== 'neutral' ? <IconSymbol name={icon ?? (tone === 'success' ? 'checkmark' : 'exclamationmark.triangle.fill')} size={15} color={accent} /> : null}
      <ThemedText style={styles.text} lightColor={tokens.text} darkColor={tokens.text}>{message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  defaultPlacement: { bottom: 120 },
  toast: { alignItems: 'center', alignSelf: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.pill, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: KatchaUI.touchTarget, paddingHorizontal: 16, paddingVertical: 9, position: 'absolute', zIndex: 45 },
  text: { ...KatchaUI.type.body, fontSize: 13, fontWeight: '800' },
});
