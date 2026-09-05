import { Image } from 'expo-image';
import { Pressable, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

export type ActionTileProps = {
  art?: ImageSourcePropType;
  compact?: boolean;
  description?: string;
  disabled?: boolean;
  icon: IconSymbolName;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tint: string;
  title: string;
};

export function ActionTile({ art, compact = false, description, disabled = false, icon, onPress, selected = false, style, tint, title }: ActionTileProps) {
  const { tokens } = useKatchaSurface();
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        compact && styles.compact,
        { backgroundColor: selected ? `${tint}28` : tokens.subtle, borderColor: selected ? `${tint}88` : tokens.border },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {art ? <Image contentFit="contain" source={art} style={compact ? styles.artCompact : styles.art} /> : <IconSymbol name={icon} size={compact ? 22 : 27} color={tint} />}
      <ThemedText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={compact ? 2 : 1} style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>{title}</ThemedText>
      {description && !compact ? <ThemedText numberOfLines={2} style={styles.description} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{description}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, borderWidth: 1, flex: 1, gap: 7, justifyContent: 'center', minHeight: 94, paddingHorizontal: 10, paddingVertical: 14 },
  compact: { minHeight: 76, paddingVertical: 10 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.48 },
  art: { height: 34, width: 34 },
  artCompact: { height: 28, width: 28 },
  title: { ...KatchaUI.type.action, fontSize: 12.5, textAlign: 'center' },
  description: { ...KatchaUI.type.body, fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
