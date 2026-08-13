import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { GameUI } from '@/constants/game-ui';

export function GamePanel({ children, elevated = false, style }: { children: ReactNode; elevated?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, elevated && styles.panelElevated, style]}>{children}</View>;
}

export function GameTopBar({ leading, title, trailing, style }: { leading?: ReactNode; title?: string; trailing?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.topBar, style]}>{leading ?? <View style={styles.topSlot} />}{title ? <ThemedText numberOfLines={1} style={styles.topTitle} lightColor={GameUI.color.cream} darkColor={GameUI.color.cream}>{title}</ThemedText> : <View style={styles.topSpacer} />}{trailing ?? <View style={styles.topSlot} />}</View>;
}

export function GameHudBar({ children, content, density = 'regular', leading, style, tone = 'default', trailing }: {
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

export function GameHudControl({ accessibilityHint, accessibilityLabel, children, disabled = false, onPress, style, tone = 'default' }: {
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
    style={({ pressed }) => [styles.hudControl, tone === 'glass' && styles.hudControlGlass, style, pressed && styles.pressed]}>
    {children}
  </Pressable>;
}

export function GameHudItem({ accessibilityLabel, children, style, tone = 'default' }: { accessibilityLabel: string; children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'glass' }) {
  return <View accessibilityLabel={accessibilityLabel} style={[styles.hudItem, tone === 'glass' && styles.hudItemGlass, style]}>{children}</View>;
}

export function GameIconButton({ icon, label, onPress }: { icon: IconSymbolName; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><IconSymbol color={GameUI.color.gold} name={icon} size={19} /></Pressable>;
}

export function GameHeroStage({ artwork, children, eyebrow, title }: { artwork: ReactNode; children?: ReactNode; eyebrow?: string; title: string }) {
  return <View style={styles.hero}><View pointerEvents="none" style={styles.heroArtwork}>{artwork}</View><View style={styles.heroCopy}>{eyebrow ? <ThemedText style={styles.eyebrow} lightColor={GameUI.color.goldStrong} darkColor={GameUI.color.goldStrong}>{eyebrow}</ThemedText> : null}<ThemedText adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} selectable style={styles.heroTitle} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{title}</ThemedText>{children}</View></View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: GameUI.color.parchment, borderColor: GameUI.color.line, borderCurve: 'continuous', borderRadius: GameUI.radius.card, borderWidth: 1, padding: GameUI.spacing.md },
  panelElevated: { backgroundColor: GameUI.color.parchmentRaised, boxShadow: GameUI.shadow.card },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: GameUI.layout.touchTarget },
  topSlot: { height: GameUI.layout.touchTarget, width: GameUI.layout.touchTarget },
  topSpacer: { flex: 1 },
  topTitle: { ...GameUI.type.title, flex: 1, textAlign: 'center' },
  hudBar: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 43, paddingHorizontal: 1 },
  hudBarCompact: { gap: 5, minHeight: 40 },
  hudBarGlass: { backgroundColor: 'transparent' },
  hudContent: { flex: 1, minWidth: 0 },
  hudTrailing: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  hudControl: { alignItems: 'center', backgroundColor: GameUI.color.wood, borderColor: GameUI.color.lineLight, borderCurve: 'continuous', borderRadius: GameUI.radius.control, borderWidth: 1, boxShadow: GameUI.shadow.chrome, flexDirection: 'row', gap: 5, height: 39, justifyContent: 'center', paddingHorizontal: 9 },
  hudControlGlass: { backgroundColor: 'rgba(255,249,233,0.84)', borderColor: 'rgba(255,255,246,0.76)', borderRadius: 14, boxShadow: '0 4px 12px rgba(37,69,65,0.18), inset 0 1px 0 rgba(255,255,255,0.9)', height: 38 },
  hudItem: { alignItems: 'center', backgroundColor: GameUI.color.wood, borderColor: GameUI.color.lineLight, borderCurve: 'continuous', borderRadius: GameUI.radius.control, borderWidth: 1, boxShadow: GameUI.shadow.chrome, flexDirection: 'row', height: 39, justifyContent: 'center', paddingHorizontal: 9 },
  hudItemGlass: { backgroundColor: 'rgba(255,249,233,0.84)', borderColor: 'rgba(255,255,246,0.76)', borderRadius: 14, boxShadow: '0 4px 12px rgba(37,69,65,0.18), inset 0 1px 0 rgba(255,255,255,0.9)', height: 38 },
  iconButton: { alignItems: 'center', backgroundColor: GameUI.color.wood, borderColor: GameUI.color.lineLight, borderRadius: GameUI.radius.control, borderWidth: 1, height: GameUI.layout.touchTarget, justifyContent: 'center', width: GameUI.layout.touchTarget },
  hero: { backgroundColor: GameUI.color.parchment, borderCurve: 'continuous', borderRadius: GameUI.radius.hero, boxShadow: GameUI.shadow.card, minHeight: 174, overflow: 'hidden', position: 'relative' },
  heroArtwork: { bottom: 0, left: 0, position: 'absolute', top: 0, width: '52%' },
  heroCopy: { alignSelf: 'flex-end', gap: 5, justifyContent: 'center', minHeight: 174, paddingHorizontal: 14, width: '52%' },
  eyebrow: GameUI.type.label,
  heroTitle: GameUI.type.display,
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
