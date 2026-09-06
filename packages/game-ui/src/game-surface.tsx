import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { UIAdapters } from './contracts';
import type { GameSurfaceTone } from './theme';
export function createGameSurfaces<IconSymbolName extends string>({GameUI, ThemedText, IconSymbol}: UIAdapters<IconSymbolName>) {
function GameSurface({ children, contentStyle, density = 'regular', radius, style, tone = 'cream' }: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  density?: 'compact' | 'regular' | 'feature';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: GameSurfaceTone;
}) {
  const tokens = GameUI.surface[tone];
  const resolvedRadius = radius ?? (density === 'compact' ? 14 : density === 'feature' ? 22 : 18);
  const shadow = density === 'feature'
    ? `0 8px 20px ${tokens.shadow}`
    : density === 'compact'
      ? `0 3px 8px ${tokens.shadow}`
      : `0 5px 13px ${tokens.shadow}`;
  return <View style={[styles.surface, { borderColor: tokens.rim, borderRadius: resolvedRadius, boxShadow: shadow }, style]}>
    <LinearGradient colors={[tokens.top, tokens.bottom]} end={{ x: 0.75, y: 1 }} start={{ x: 0.25, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: resolvedRadius - 2 }]} />
    <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: tokens.highlight, borderRadius: resolvedRadius }]} />
    <View style={[styles.content, density === 'compact' && styles.contentCompact, density === 'feature' && styles.contentFeature, contentStyle]}>{children}</View>
  </View>;
}

function GameIconWell({ children, size = 40, style, tone = 'cream' }: { children: ReactNode; size?: number; style?: StyleProp<ViewStyle>; tone?: GameSurfaceTone }) {
  const tokens = GameUI.surface[tone];
  return <View style={[styles.iconWell, { borderColor: tokens.rim, boxShadow: `0 4px 9px ${tokens.shadow}`, height: size, width: size }, style]}>
    <LinearGradient colors={[tokens.top, tokens.bottom]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[styles.iconHighlight, { backgroundColor: tokens.highlight }]} />
    <View style={styles.iconContent}>{children}</View>
  </View>;
}

function GameBadge({ icon, label, style, tone = 'gold' }: { icon?: IconSymbolName; label?: string | number; style?: StyleProp<ViewStyle>; tone?: GameSurfaceTone }) {
  const tokens = GameUI.surface[tone];
  return <View style={[styles.badge, { backgroundColor: tokens.bottom, borderColor: tokens.rim, boxShadow: `0 3px 7px ${tokens.shadow}` }, style]}>
    {icon ? <IconSymbol color={tokens.ink} name={icon} size={10} /> : null}
    {label != null ? <ThemedText style={styles.badgeText} lightColor={tokens.ink} darkColor={tokens.ink}>{label}</ThemedText> : null}
  </View>;
}

function GameRewardChip({ amount, art, icon, tone = 'gold' }: { amount: number; art?: ImageSource | number; icon?: IconSymbolName; tone?: GameSurfaceTone }) {
  const tokens = GameUI.surface[tone];
  return <GameSurface contentStyle={styles.rewardContent} density="compact" radius={13} tone={tone}>
    {art ? <Image accessibilityIgnoresInvertColors contentFit="contain" source={art} style={styles.rewardArt} transition={0} /> : icon ? <IconSymbol color={tokens.ink} name={icon} size={15} /> : null}
    <ThemedText style={styles.rewardText} lightColor={tokens.ink} darkColor={tokens.ink}>+{amount}</ThemedText>
  </GameSurface>;
}

const styles = StyleSheet.create({
  surface: { borderCurve: 'continuous', borderWidth: 1.5, overflow: 'hidden', position: 'relative' },
  topHighlight: { height: 1.5, left: 7, opacity: 0.88, position: 'absolute', right: 7, top: 2 },
  content: { padding: 12, position: 'relative' },
  contentCompact: { padding: 7 },
  contentFeature: { padding: 16 },
  iconWell: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  iconHighlight: { height: 1.5, left: 5, opacity: 0.9, position: 'absolute', right: 5, top: 2 },
  iconContent: { alignItems: 'center', flex: 1, justifyContent: 'center', width: '100%' },
  badge: { alignItems: 'center', borderRadius: 999, borderWidth: 1.5, flexDirection: 'row', gap: 2, justifyContent: 'center', minHeight: 21, minWidth: 21, paddingHorizontal: 5 },
  badgeText: { ...GameUI.type.numeric, fontFamily: GameUI.type.title.fontFamily, fontSize: 10.5, lineHeight: 13 },
  rewardContent: { alignItems: 'center', flexDirection: 'row', gap: 1, minHeight: 31, paddingHorizontal: 7, paddingVertical: 3 },
  rewardArt: { height: 24, transform: [{ scale: 1.28 }], width: 24 },
  rewardText: { fontFamily: GameUI.type.title.fontFamily, fontSize: 12, fontVariant: ['tabular-nums'], lineHeight: 15 },
});

return { GameSurface, GameIconWell, GameBadge, GameRewardChip };
}
