import { Image, type ImageSource } from 'expo-image';
import { memo, type RefObject, useEffect } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_CATALOG, GameUI, formatGameCurrency, type GameCurrencyId } from '@/constants/game-ui';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';

const CURRENCY_VALUE_COLOR = 'rgb(68, 51, 31)';
const CURRENCY_SUFFIX_COLOR = 'rgb(126, 106, 77)';

export type GameCurrencyBalance = {
  art?: ImageSource | number;
  countdownSeconds?: number;
  id: GameCurrencyId;
  pulseNonce?: number;
  suffix?: string;
  targetRef?: RefObject<View | null>;
  value: number;
};

export const GameCurrencyHud = memo(function GameCurrencyHud({ balances, compact = false, tone = 'default', style }: {
  balances: readonly GameCurrencyBalance[];
  compact?: boolean;
  tone?: 'default' | 'glass';
  style?: StyleProp<ViewStyle>;
}) {
  return <View accessibilityLabel="Currencies" style={[styles.row, compact && styles.rowCompact, style]}>
    {balances.map((balance) => <GameCurrencyPill compact={compact} key={balance.id} tone={tone} {...balance} />)}
  </View>;
});

const GameCurrencyPill = memo(function GameCurrencyPill({ art, compact, countdownSeconds, id, pulseNonce = 0, suffix, targetRef, tone, value }: GameCurrencyBalance & { compact: boolean; tone: 'default' | 'glass' }) {
  const definition = GAME_CURRENCY_CATALOG[id];
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulseNonce < 1) return;
    pulse.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 150 }));
    return () => cancelAnimation(pulse);
  }, [pulse, pulseNonce]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.09 }] }));
  const glass = tone === 'glass';
  const countdown = countdownSeconds != null ? formatCurrencyCountdown(countdownSeconds) : null;
  return <Animated.View accessibilityLabel={`${definition.label}: ${value}${suffix ?? ''}${countdown ? `. Next in ${countdown}` : ''}`} ref={targetRef} style={[styles.pill, compact && styles.pillCompact, glass && styles.pillGlass, animatedStyle]}>
    <GameSurface contentStyle={[styles.pillContent, compact && styles.pillContentCompact]} density="compact" radius={14} style={styles.pillSurface} tone="cream">
      <View style={[styles.currencyIcon, compact && styles.currencyIconCompact, glass && styles.currencyIconGlass]}>
        {art ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={art} style={[styles.art, compact && styles.artCompact, glass && styles.artGlass]} transition={0} /> : <IconSymbol color={definition.tint} name={definition.icon} size={compact ? 21 : glass ? 33 : 30} />}
      </View>
      <ThemedText selectable style={[styles.value, compact && styles.valueCompact, glass && styles.valueGlass]} lightColor={CURRENCY_VALUE_COLOR} darkColor={CURRENCY_VALUE_COLOR}>
        {formatGameCurrency(value)}{suffix ? <ThemedText style={[styles.suffix, glass && styles.suffixGlass]} lightColor={CURRENCY_SUFFIX_COLOR} darkColor={CURRENCY_SUFFIX_COLOR}>{suffix}</ThemedText> : null}
      </ThemedText>
      {countdown ? <View pointerEvents="none" style={styles.countdownBanner}>
        <ThemedText style={styles.countdownText} lightColor={GameUI.color.cream} darkColor={GameUI.color.cream}>{countdown}</ThemedText>
      </View> : null}
    </GameSurface>
  </Animated.View>;
});

export function formatCurrencyCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}m ${String(safeSeconds % 60).padStart(2, '0')}s`;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 20, paddingLeft: 22, width: '100%' },
  rowCompact: { gap: 10, paddingLeft: 12 },
  pill: { flex: 1, flexBasis: 0, height: 30, maxWidth: 88, minWidth: 0, overflow: 'visible' },
  pillCompact: { flex: 0, height: 24, minWidth: 43 },
  pillGlass: { height: 29 },
  pillSurface: { flex: 1, overflow: 'visible' },
  pillContent: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center', paddingLeft: 25, paddingRight: 5, paddingVertical: 0 },
  pillContentCompact: { paddingLeft: 18, paddingRight: 3, paddingVertical: 0 },
  currencyIcon: { alignItems: 'center', height: 39, justifyContent: 'center', left: -15, position: 'absolute', top: -2, transform: [{ translateY: -3 }], width: 39 },
  currencyIconCompact: { height: 28, left: -9, top: -1, transform: [{ translateY: -2 }], width: 28 },
  currencyIconGlass: { height: 41, left: -17, top: -3, transform: [{ translateY: -4 }], width: 41 },
  art: { height: 40, width: 40 },
  artCompact: { height: 27, width: 27 },
  artGlass: { height: 42, width: 42 },
  countdownBanner: { alignItems: 'center', backgroundColor: 'rgba(67,42,29,0.9)', borderColor: 'rgba(255,249,233,0.24)', borderRadius: 999, borderWidth: 1, bottom: -17, boxShadow: '0 3px 7px rgba(47,29,18,0.28)', minHeight: 20, paddingHorizontal: 9, position: 'absolute' },
  countdownText: { fontFamily: GameUI.type.title.fontFamily, fontSize: 11, fontVariant: ['tabular-nums'], lineHeight: 15 },
  value: { ...GameUI.type.numeric, flexShrink: 1, fontFamily: GameUI.type.title.fontFamily, fontSize: 16, letterSpacing: -0.25, lineHeight: 19, textAlign: 'center' },
  valueCompact: { fontSize: 12, lineHeight: 14 },
  valueGlass: { fontSize: 16, lineHeight: 19 },
  suffix: { fontFamily: GameUI.type.body.fontFamily, fontSize: 8, fontWeight: '800' },
  suffixGlass: { fontSize: 7.5 },
});
