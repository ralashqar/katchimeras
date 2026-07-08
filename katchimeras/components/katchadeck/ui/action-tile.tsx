import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';

type ActionTileProps = {
  icon: IconSymbolName;
  title: string;
  tint: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ActionTile({ icon, title, tint, onPress, style }: ActionTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: `${tint}1C`, borderColor: `${tint}55` },
        pressed ? { backgroundColor: `${tint}30` } : null,
        style,
      ]}>
      <IconSymbol name={icon} size={26} color={tint} />
      <ThemedText
        style={styles.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        lightColor={Lantern.moon50}
        darkColor={Lantern.moon50}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 94,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
  },
});
