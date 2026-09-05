import { Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle, View } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaDeckUI } from '@/constants/theme';

export type SegmentedControlOption<TValue extends string> = {
  value: TValue;
  label: string;
  icon?: IconSymbolName;
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
  const { surface, tokens } = useKatchaSurface();
  const isBar = variant === 'bar';

  return (
    <View style={[isBar ? styles.barContainer : styles.chipContainer, isBar && { backgroundColor: tokens.subtle, borderColor: tokens.border }, style]}>
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
              !isBar ? { backgroundColor: surface === 'parchment' ? tokens.elevated : tokens.subtle, borderColor: tokens.border } : null,
              active ? (isBar ? styles.barOptionActive : styles.chipOptionActive) : null,
              active ? { backgroundColor: isBar ? tokens.elevated : surface === 'parchment' ? tokens.accent : `${tokens.accent}24`, borderColor: surface === 'parchment' ? tokens.accentPressed : tokens.borderStrong } : null,
              pressed ? styles.pressed : null,
              optionStyle,
            ]}>
            <View style={styles.optionLabelRow}>
              {option.icon ? (
                <IconSymbol
                  color={active ? activeTextColor ?? tokens.text : inactiveTextColor ?? tokens.textSecondary}
                  name={option.icon}
                  size={15}
                />
              ) : null}
              <ThemedText
                style={[isBar ? styles.barLabel : styles.chipLabel, labelStyle]}
                lightColor={active ? activeTextColor ?? tokens.text : inactiveTextColor ?? tokens.textSecondary}
                darkColor={active ? activeTextColor ?? tokens.text : inactiveTextColor ?? tokens.textSecondary}>
                {option.label}
              </ThemedText>
            </View>
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
    backgroundColor: 'transparent',
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
  optionLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center' },
  pressed: {
    opacity: 0.82,
  },
});
