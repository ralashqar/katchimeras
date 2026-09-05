import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { Colors, KatchaDeckUI } from '@/constants/theme';
import { usePressMotion } from '@/components/katchadeck/motion';

type ChoiceCardProps = {
  title: string;
  description: string;
  selected?: boolean;
  accentColor?: string;
  leading?: React.ReactNode;
  onPress?: () => void;
};

export function ChoiceCard({
  title,
  description,
  selected = false,
  accentColor = KatchaDeckUI.palette.moonBlue,
  leading,
  onPress,
}: ChoiceCardProps) {
  const press = usePressMotion();

  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <Animated.View style={press.animatedStyle}>
        <GlassPanel
          borderColor={selected ? accentColor : Colors.dark.border}
          contentStyle={styles.content}
          fillColor={selected ? 'rgba(200,216,255,0.14)' : Colors.dark.glass}
          intensity={selected ? 40 : 28}
          style={selected ? styles.selectedShell : null}>
          <View style={styles.row}>
            {leading ?? <View style={[styles.dot, { backgroundColor: accentColor }]} />}
            <View style={styles.copy}>
              <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
                {title}
              </ThemedText>
              <ThemedText style={styles.description} lightColor="#DCE6FF" darkColor="#DCE6FF">
                {description}
              </ThemedText>
            </View>
          </View>
        </GlassPanel>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectedShell: {
    boxShadow: KatchaDeckUI.shadows.soft,
  },
  content: {
    paddingHorizontal: KatchaDeckUI.spacing.md,
    paddingVertical: KatchaDeckUI.spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: KatchaDeckUI.spacing.sm,
  },
  dot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 19,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
