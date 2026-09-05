import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/components/katchadeck/motion';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaUI } from '@/constants/katcha-ui';

export type KatchaButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'premium';
export type KatchaButtonSize = 'compact' | 'regular';

export type KatchaButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  cost?: { currency: keyof typeof GAME_CURRENCY_ART; amount: number };
  disabled?: boolean;
  fullWidth?: boolean;
  glow?: boolean;
  icon?: IconSymbolName;
  label: string;
  labelStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  onPress?: () => void;
  size?: KatchaButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: KatchaButtonVariant;
};

export function KatchaButton({
  accessibilityHint,
  accessibilityLabel,
  cost,
  disabled = false,
  fullWidth = false,
  glow = false,
  icon,
  label,
  labelStyle,
  loading = false,
  onPress,
  size = 'regular',
  style,
  variant = 'primary',
}: KatchaButtonProps) {
  const press = usePressMotion();
  const { tokens } = useKatchaSurface();
  const resolvedVariant = variant === 'premium' ? 'primary' : variant;
  const primary = resolvedVariant === 'primary';
  const destructive = resolvedVariant === 'destructive';
  const tertiary = resolvedVariant === 'tertiary';
  const foreground = primary ? tokens.accentText : destructive ? tokens.destructiveText : tokens.text;
  const fill = destructive ? tokens.destructive : tertiary ? 'transparent' : tokens.elevated;
  const rim = primary ? tokens.accentPressed : destructive ? tokens.destructivePressed : tokens.borderStrong;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? (cost ? `${label}, ${cost.amount.toLocaleString()} ${cost.currency === 'coins' ? 'Glow' : cost.currency === 'energy' ? 'Energy' : 'Bond'}` : label)}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.pressable, fullWidth && styles.fullWidth, style, (disabled || loading) && styles.disabled]}>
      <Animated.View style={[styles.shadow, fullWidth && styles.fullWidth, press.animatedStyle, primary && { boxShadow: glow ? tokens.buttonGlow : tokens.cardShadow }]}>
        <View style={[
          styles.rim,
          size === 'compact' && styles.compactRim,
          fullWidth && styles.fullWidth,
          { borderColor: rim },
        ]}>
          <View style={[styles.fill, size === 'compact' && styles.compactFill, { backgroundColor: fill }]}>
            {primary ? <LinearGradient colors={[tokens.accent, tokens.accentPressed]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
            {primary ? <View pointerEvents="none" style={styles.rimLight} /> : null}
            <View style={[styles.labelRow, cost && styles.costRow]}>
              <View style={[styles.labelRow, cost && styles.actionGroup]}>
                {loading ? <ActivityIndicator color={foreground} size="small" /> : null}
                {icon && !loading ? <IconSymbol color={foreground} name={icon} size={size === 'compact' ? 15 : 17} /> : null}
                <ThemedText style={[styles.label, cost && styles.flexibleLabel, size === 'compact' && styles.compactLabel, cost && styles.costLabel, cost && size === 'compact' && styles.compactCostLabel, labelStyle]} lightColor={foreground} darkColor={foreground}>{label}</ThemedText>
              </View>
              {cost ? <View style={styles.currencyGroup}>
                <Image source={GAME_CURRENCY_ART[cost.currency]} contentFit="contain" transition={0} style={[styles.currencyIcon, size === 'compact' && styles.compactCurrencyIcon]} />
                <ThemedText style={[styles.label, styles.costLabel, size === 'compact' && styles.compactCostLabel, labelStyle]} lightColor={foreground} darkColor={foreground}>{cost.amount.toLocaleString()}</ThemedText>
              </View> : null}
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { backgroundColor: 'transparent' },
  fullWidth: { width: '100%' },
  shadow: { backgroundColor: 'transparent', borderRadius: KatchaUI.radius.pill },
  rim: { borderCurve: 'continuous', borderRadius: KatchaUI.radius.pill, borderWidth: 1, minHeight: 56, padding: 1 },
  compactRim: { minHeight: 48 },
  fill: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.pill, flex: 1, justifyContent: 'center', minHeight: 52, overflow: 'hidden', paddingHorizontal: 20, position: 'relative' },
  compactFill: { minHeight: 44, paddingHorizontal: 14 },
  rimLight: { backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 999, height: 1, left: 14, position: 'absolute', right: 14, top: 2 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  costRow: { alignSelf: 'stretch', justifyContent: 'center', gap: 12 },
  actionGroup: { flexShrink: 1, justifyContent: 'center' },
  flexibleLabel: { flexShrink: 1 },
  currencyGroup: { alignItems: 'center', flexDirection: 'row', gap: 6, flexShrink: 0 },
  currencyIcon: { width: 40, height: 44 },
  compactCurrencyIcon: { width: 32, height: 36 },
  costLabel: { ...KatchaUI.type.companionPageTitle, fontSize: 24, lineHeight: 30, fontWeight: 'normal', textTransform: 'uppercase', textAlign: 'center' },
  compactCostLabel: { fontSize: 19, lineHeight: 24 },
  label: KatchaUI.type.action,
  compactLabel: { fontSize: 13.5 },
  disabled: { opacity: 0.45 },
});
