import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/components/katchadeck/motion';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { GAME_CTA } from '@/constants/game-cta';
import { AnimatedBorderHighlight } from './animated-border-highlight';

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
  const foreground = primary ? GAME_CTA.text : destructive ? tokens.destructiveText : tokens.text;
  const fill = destructive ? tokens.destructive : tertiary ? 'transparent' : tokens.elevated;
  const rim = primary ? GAME_CTA.rim : destructive ? tokens.destructivePressed : tokens.borderStrong;
  const radius = size === 'compact' ? GAME_CTA.compactRadius : GAME_CTA.radius;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? (cost ? `${label}, ${cost.amount.toLocaleString()} ${cost.currency === 'coins' ? 'Glow' : cost.currency === 'energy' ? 'Energy' : 'Bond'}` : label)}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (disabled || loading) return;
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.pressable, fullWidth && styles.fullWidth, style, (disabled || loading) && styles.disabled]}>
      <Animated.View style={[styles.shadow, { borderRadius: radius }, fullWidth && styles.fullWidth, press.animatedStyle, primary && { boxShadow: GAME_CTA.shadow }]}>
        <View style={[
          styles.rim,
          size === 'compact' && styles.compactRim,
          fullWidth && styles.fullWidth,
          { borderColor: rim, backgroundColor: tertiary ? 'transparent' : rim, borderRadius: radius },
          tertiary && styles.tertiaryRim,
        ]}>
          <View style={[styles.fill, size === 'compact' && styles.compactFill, { backgroundColor: fill, borderRadius: radius - 3 }]}>
            {primary ? <LinearGradient colors={GAME_CTA.face} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
            {primary ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius - 3, boxShadow: GAME_CTA.bevel }]} /> : null}
            <View style={[styles.labelRow, cost && styles.costRow]}>
              <View style={[styles.labelRow, cost && styles.actionGroup]}>
                {loading ? <ActivityIndicator color={foreground} size="small" /> : null}
                {icon && !loading ? <IconSymbol color={foreground} name={icon} size={size === 'compact' ? 15 : 17} /> : null}
                <ThemedText style={[styles.label, size === 'compact' && styles.compactLabel]} lightColor={foreground} darkColor={foreground}>{label}</ThemedText>
              </View>
              {cost ? <View style={styles.currencyGroup}>
                <Image source={GAME_CURRENCY_ART[cost.currency]} contentFit="contain" transition={0} style={[styles.currencyIcon, size === 'compact' && styles.compactCurrencyIcon]} />
                <ThemedText style={[styles.label, size === 'compact' && styles.compactLabel]} lightColor={foreground} darkColor={foreground}>{cost.amount.toLocaleString()}</ThemedText>
              </View> : null}
            </View>
          </View>
        </View>
        {(primary || glow) && !disabled && !loading ? <AnimatedBorderHighlight
          borderRadius={radius} inset={1.5} strokeWidth={2} glowStrokeWidth={0}
          orbitDurationMs={2800} pauseDurationMs={1800}
        /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { backgroundColor: 'transparent' },
  fullWidth: { width: '100%' },
  shadow: { backgroundColor: 'transparent', position: 'relative' },
  rim: { borderCurve: 'continuous', borderWidth: 3, borderBottomWidth: 5, minHeight: 58, position: 'relative' },
  tertiaryRim: { borderWidth: 0, borderBottomWidth: 0 },
  compactRim: { minHeight: 48 },
  fill: { alignItems: 'center', borderCurve: 'continuous', flex: 1, justifyContent: 'center', minHeight: 50, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 9, position: 'relative' },
  compactFill: { minHeight: 44, paddingHorizontal: 14 },
  labelRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 8, justifyContent: 'center', maxWidth: '100%' },
  costRow: { alignSelf: 'stretch', justifyContent: 'center', gap: 12 },
  actionGroup: { flexShrink: 1, justifyContent: 'center' },
  currencyGroup: { alignItems: 'center', flexDirection: 'row', gap: 6, flexShrink: 0 },
  currencyIcon: { width: 40, height: 44 },
  compactCurrencyIcon: { width: 32, height: 36 },
  label: { ...GAME_CTA.label, flexShrink: 1 },
  compactLabel: GAME_CTA.compactLabel,
  disabled: { opacity: 0.45 },
});
