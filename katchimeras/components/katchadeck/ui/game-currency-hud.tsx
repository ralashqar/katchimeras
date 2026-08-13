import { Image, type ImageSource } from 'expo-image';
import { memo, type RefObject, useEffect } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_CATALOG, GameUI, formatGameCurrency, type GameCurrencyId } from '@/constants/game-ui';

const TODAY_GLASS_VALUE_COLOR = 'rgb(68, 51, 31)';
const TODAY_GLASS_SUFFIX_COLOR = 'rgb(126, 106, 77)';

export type GameCurrencyBalance = {
  art?: ImageSource | number;
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

const GameCurrencyPill = memo(function GameCurrencyPill({ art, compact, id, pulseNonce = 0, suffix, targetRef, tone, value }: GameCurrencyBalance & { compact: boolean; tone: 'default' | 'glass' }) {
  const definition = GAME_CURRENCY_CATALOG[id];
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulseNonce < 1) return;
    pulse.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 150 }));
    return () => cancelAnimation(pulse);
  }, [pulse, pulseNonce]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.09 }] }));
  const glass = tone === 'glass';
  const valueColor = glass ? TODAY_GLASS_VALUE_COLOR : GameUI.color.cream;
  const suffixColor = glass ? TODAY_GLASS_SUFFIX_COLOR : GameUI.color.creamMuted;
  return <Animated.View accessibilityLabel={`${definition.label}: ${value}${suffix ?? ''}`} ref={targetRef} style={[styles.pill, compact && styles.pillCompact, glass && styles.pillGlass, animatedStyle]}>
    {art ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={art} style={[styles.art, compact && styles.artCompact, glass && styles.artGlass]} transition={0} /> : <View style={glass ? styles.symbolWellGlass : undefined}><IconSymbol color={definition.tint} name={definition.icon} size={compact ? 13 : glass ? 17 : 17} /></View>}
    <ThemedText selectable style={[styles.value, compact && styles.valueCompact, glass && styles.valueGlass]} lightColor={valueColor} darkColor={valueColor}>
      {formatGameCurrency(value)}{suffix ? <ThemedText style={[styles.suffix, glass && styles.suffixGlass]} lightColor={suffixColor} darkColor={suffixColor}>{suffix}</ThemedText> : null}
    </ThemedText>
  </Animated.View>;
});

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  rowCompact: { gap: 3 },
  pill: { alignItems: 'center', backgroundColor: GameUI.color.wood, borderColor: GameUI.color.lineLight, borderCurve: 'continuous', borderRadius: GameUI.radius.control, borderWidth: 1, boxShadow: GameUI.shadow.chrome, flex: 1, flexDirection: 'row', gap: 3, height: 39, minWidth: 0, overflow: 'hidden', paddingHorizontal: 7 },
  pillCompact: { backgroundColor: 'rgba(59,47,37,0.9)', borderRadius: GameUI.radius.pill, flex: 0, height: 30, minWidth: 43, paddingHorizontal: 6 },
  pillGlass: { backgroundColor: 'rgba(255,249,233,0.84)', borderColor: 'rgba(255,255,246,0.76)', borderRadius: 14, boxShadow: '0 4px 12px rgba(37,69,65,0.18), inset 0 1px 0 rgba(255,255,255,0.9)', gap: 1, height: 38, justifyContent: 'center', paddingHorizontal: 5 },
  art: { height: 34, width: 34 },
  artCompact: { height: 18, width: 18 },
  artGlass: { height: 27, width: 27 },
  symbolWellGlass: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
  value: { ...GameUI.type.numeric, flexShrink: 1, fontSize: 15.5, lineHeight: 20 },
  valueCompact: { fontSize: 11, lineHeight: 15 },
  valueGlass: { fontSize: 13, lineHeight: 17 },
  suffix: { fontFamily: GameUI.type.body.fontFamily, fontSize: 8, fontWeight: '800' },
  suffixGlass: { fontSize: 7.5 },
});
