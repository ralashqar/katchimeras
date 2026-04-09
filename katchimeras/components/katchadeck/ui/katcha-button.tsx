import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/components/katchadeck/motion';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI } from '@/constants/theme';

type KatchaButtonVariant = 'primary' | 'secondary' | 'premium';
type KatchaButtonIcon = 'arrow.right' | 'sparkles' | 'arrow.counterclockwise' | 'xmark' | 'star.fill';

type KatchaButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: KatchaButtonVariant;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  icon?: KatchaButtonIcon;
};

export function KatchaButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
  glow = false,
  icon,
}: KatchaButtonProps) {
  const press = usePressMotion();

  const iconColor = variant === 'secondary' ? '#F8FBFF' : '#0B1221';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.pressable, style, disabled ? styles.disabled : null]}>
      <Animated.View
        style={[
          styles.shadowWrap,
          press.animatedStyle,
          variant === 'premium'
            ? styles.premiumShadow
            : variant === 'secondary'
              ? styles.secondaryShadow
              : styles.primaryShadow,
        ]}>
        <View
          style={[
            styles.clipShell,
            variant === 'premium'
              ? styles.premiumSurface
              : variant === 'secondary'
                ? styles.secondarySurface
                : styles.primarySurface,
          ]}>
          {variant === 'secondary' ? (
            <View style={[StyleSheet.absoluteFill, styles.secondaryFill]} />
          ) : (
            <LinearGradient
              colors={variant === 'premium' ? ['#F2E0FF', '#FFD8C0'] : ['#E9F1FF', '#D0DDF6']}
              style={StyleSheet.absoluteFill}
            />
          )}
          {variant !== 'secondary' ? (
            <LinearGradient
              colors={
                glow
                  ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)']
                  : ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']
              }
              style={styles.sheen}
            />
          ) : null}
          <View style={styles.labelRow}>
            <ThemedText
              style={
                variant === 'premium'
                  ? styles.premiumLabel
                  : variant === 'secondary'
                    ? styles.secondaryLabel
                    : styles.primaryLabel
              }
              lightColor={variant === 'secondary' ? '#F8FBFF' : variant === 'premium' ? '#18111E' : '#0B1221'}
              darkColor={variant === 'secondary' ? '#F8FBFF' : variant === 'premium' ? '#18111E' : '#0B1221'}>
              {label}
            </ThemedText>
            {icon ? <IconSymbol color={iconColor} name={icon} size={16} /> : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    backgroundColor: 'transparent',
  },
  shadowWrap: {
    backgroundColor: 'transparent',
    borderRadius: KatchaDeckUI.radii.pill,
  },
  clipShell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: KatchaDeckUI.radii.pill,
    justifyContent: 'center',
    minHeight: 60,
    overflow: 'hidden',
    paddingHorizontal: 24,
    position: 'relative',
  },
  primaryShadow: {
    boxShadow: KatchaDeckUI.shadows.soft,
  },
  premiumShadow: {
    boxShadow: KatchaDeckUI.shadows.premium,
  },
  secondaryShadow: {
    boxShadow: 'none',
  },
  primarySurface: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
  },
  premiumSurface: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
  },
  secondarySurface: {
    borderColor: 'rgba(208,221,255,0.22)',
    borderWidth: 1,
  },
  secondaryFill: {
    backgroundColor: 'rgba(18, 27, 47, 0.92)',
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  primaryLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    color: '#0B1221',
  },
  secondaryLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    color: '#F8FBFF',
  },
  premiumLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    color: '#1B1324',
  },
  sheen: {
    borderRadius: 999,
    height: '72%',
    left: '6%',
    opacity: 0.8,
    position: 'absolute',
    top: '8%',
    width: '40%',
  },
  disabled: {
    opacity: 0.45,
  },
});
