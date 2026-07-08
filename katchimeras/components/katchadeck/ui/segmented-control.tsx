import { Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle, View } from 'react-native';

import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type SegmentedControlOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type SegmentedControlProps<TValue extends string> = {
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  variant?: 'chip' | 'bar';
  style?: StyleProp<ViewStyle>;
  optionStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  activeTextColor?: string;
  inactiveTextColor?: string;
};

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  variant = 'chip',
  style,
  optionStyle,
  labelStyle,
  activeTextColor,
  inactiveTextColor,
}: SegmentedControlProps<TValue>) {
  const isBar = variant === 'bar';

  return (
    <View style={[isBar ? styles.barContainer : styles.chipContainer, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              isBar ? styles.barOption : styles.chipOption,
              active ? (isBar ? styles.barOptionActive : styles.chipOptionActive) : null,
              pressed ? styles.pressed : null,
              optionStyle,
            ]}>
            <ThemedText
              style={[isBar ? styles.barLabel : styles.chipLabel, labelStyle]}
              lightColor={active ? activeTextColor ?? Lantern.ink900 : inactiveTextColor ?? Lantern.moon300}
              darkColor={active ? activeTextColor ?? Lantern.ink900 : inactiveTextColor ?? Lantern.moon300}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(215, 228, 255, 0.12)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  barOption: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 9,
  },
  barOptionActive: {
    backgroundColor: Lantern.moon50,
  },
  barLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  chipOption: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipOptionActive: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderColor: 'rgba(200,216,255,0.3)',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: KatchaDeckUI.typography.pill.fontWeight,
  },
  pressed: {
    opacity: 0.82,
  },
});
