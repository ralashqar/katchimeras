import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import type { UIAdapters } from './contracts';
import type { createGameSurfaces } from './game-surface';
export function createGamePrimitives<IconSymbolName extends string>({GameUI, ThemedText, IconSymbol, GameSurface}: UIAdapters<IconSymbolName> & {GameSurface: ReturnType<typeof createGameSurfaces<IconSymbolName>>['GameSurface']}) {
function GamePanel({ children, elevated = false, style }: { children: ReactNode; elevated?: boolean; style?: StyleProp<ViewStyle> }) {
  return <GameSurface density={elevated ? 'feature' : 'regular'} style={style} tone="cream">{children}</GameSurface>;
}

function GameTopBar({ leading, title, trailing, style }: { leading?: ReactNode; title?: string; trailing?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.topBar, style]}>{leading ?? <View style={styles.topSlot} />}{title ? <ThemedText numberOfLines={1} style={styles.topTitle} lightColor={GameUI.color.cream} darkColor={GameUI.color.cream}>{title}</ThemedText> : <View style={styles.topSpacer} />}{trailing ?? <View style={styles.topSlot} />}</View>;
}

function GameHudBar({ children, content, density = 'regular', leading, style, tone = 'default', trailing }: {
  children?: ReactNode;
  content?: ReactNode;
  density?: 'regular' | 'compact';
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'glass';
  trailing?: ReactNode;
}) {
  return <View style={[styles.hudBar, density === 'compact' && styles.hudBarCompact, tone === 'glass' && styles.hudBarGlass, style]}>
    {children ?? <>{leading}{content ? <View style={styles.hudContent}>{content}</View> : null}{trailing ? <View style={styles.hudTrailing}>{trailing}</View> : null}</>}
  </View>;
}

function GameHudControl({ accessibilityHint, accessibilityLabel, children, disabled = false, onPress, style, tone = 'default' }: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'glass';
}) {
  return <Pressable
    accessibilityHint={accessibilityHint}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.hudControlPressable, style, pressed && styles.pressed]}>
    <GameSurface contentStyle={styles.hudControlContent} density="compact" radius={14} style={styles.hudControlSurface} tone={tone === 'glass' ? 'cream' : 'dark'}>{children}</GameSurface>
  </Pressable>;
}

function GameHudItem({ accessibilityLabel, children, style, tone = 'default' }: { accessibilityLabel: string; children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'glass' }) {
  return <GameSurface contentStyle={styles.hudItemContent} density="compact" radius={14} style={[styles.hudItem, style]} tone={tone === 'glass' ? 'cream' : 'dark'}><View accessibilityLabel={accessibilityLabel} style={styles.hudItemRow}>{children}</View></GameSurface>;
}

function GameIconButton({ icon, label, onPress }: { icon: IconSymbolName; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol color={GameUI.color.gold} name={icon} size={19} /></Pressable>;
}

function GameHeroStage({ artwork, children, eyebrow, title }: { artwork: ReactNode; children?: ReactNode; eyebrow?: string; title: string }) {
  return <View style={styles.hero}><View pointerEvents="none" style={styles.heroArtwork}>{artwork}</View><View style={styles.heroCopy}>{eyebrow ? <ThemedText style={styles.eyebrow} lightColor={GameUI.color.goldStrong} darkColor={GameUI.color.goldStrong}>{eyebrow}</ThemedText> : null}<ThemedText adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} selectable style={styles.heroTitle} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{title}</ThemedText>{children}</View></View>;
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: GameUI.layout.touchTarget },
  topSlot: { height: GameUI.layout.touchTarget, width: GameUI.layout.touchTarget },
  topSpacer: { flex: 1 },
  topTitle: { ...GameUI.type.title, flex: 1, textAlign: 'center' },
  hudBar: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 35, paddingHorizontal: 1 },
  hudBarCompact: { gap: 5, minHeight: 33 },
  hudBarGlass: { backgroundColor: 'transparent' },
  hudContent: { flex: 1, minWidth: 0 },
  hudTrailing: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  hudControlPressable: { height: 31 },
  hudControlSurface: { flex: 1 },
  hudControlContent: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 5, justifyContent: 'center', paddingHorizontal: 9, paddingVertical: 1 },
  hudItem: { height: 31 },
  hudItemContent: { flex: 1, paddingHorizontal: 0, paddingVertical: 0 },
  hudItemRow: { alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  iconButton: { alignItems: 'center', backgroundColor: GameUI.color.wood, borderColor: GameUI.color.lineLight, borderRadius: GameUI.radius.control, borderWidth: 1, height: GameUI.layout.touchTarget, justifyContent: 'center', width: GameUI.layout.touchTarget },
  hero: { backgroundColor: GameUI.color.parchment, borderCurve: 'continuous', borderRadius: GameUI.radius.hero, boxShadow: GameUI.shadow.card, minHeight: 174, overflow: 'hidden', position: 'relative' },
  heroArtwork: { bottom: 0, left: 0, position: 'absolute', top: 0, width: '52%' },
  heroCopy: { alignSelf: 'flex-end', gap: 5, justifyContent: 'center', minHeight: 174, paddingHorizontal: 14, width: '52%' },
  eyebrow: GameUI.type.label,
  heroTitle: GameUI.type.display,
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});

return { GamePanel, GameTopBar, GameHudBar, GameHudControl, GameHudItem, GameIconButton, GameHeroStage };
}
