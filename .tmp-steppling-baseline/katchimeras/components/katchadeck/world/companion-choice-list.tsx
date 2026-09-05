import { Pressable, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import {
  companionChoiceColumnCount,
  COMPANION_CHOICE_GAP,
} from '@/hooks/use-companion-adaptive-panel';

export type CompanionChoiceListOption = {
  id: string;
  icon?: IconSymbolName | null;
  label: string;
};

export function CompanionChoiceList({
  accentColor = KatchaUI.companionScenePanel.optionIcon,
  disabled = false,
  onSelect,
  options,
  presentation = 'responsive-grid',
  selectedOptionId = null,
}: {
  accentColor?: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  options: readonly CompanionChoiceListOption[];
  presentation?: 'responsive-grid' | 'single-column';
  selectedOptionId?: string | null;
}) {
  const { width } = useWindowDimensions();
  const useGrid = presentation === 'responsive-grid'
    && companionChoiceColumnCount(width, options.length) === 2;

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: useGrid ? 'row' : 'column',
        flexWrap: useGrid ? 'wrap' : 'nowrap',
        gap: COMPANION_CHOICE_GAP,
      }}>
      {options.map((option) => {
        const selected = option.id === selectedOptionId;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: selected
                ? KatchaUI.companionScenePanel.optionBackgroundSelected
                : KatchaUI.companionScenePanel.optionBackground,
              borderColor: selected ? accentColor : KatchaUI.companionScenePanel.optionBorder,
              borderCurve: 'continuous',
              borderRadius: 18,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 10,
              minHeight: 52,
              opacity: disabled && !selected ? 0.62 : pressed ? 0.72 : 1,
              paddingHorizontal: 15,
              paddingVertical: 9,
              transform: [{ scale: pressed ? 0.985 : 1 }],
              width: useGrid ? '48%' : '100%',
            })}>
            {option.icon ? (
              <View style={{ alignItems: 'center', backgroundColor: `${accentColor}24`, borderRadius: 999, height: 34, justifyContent: 'center', width: 34 }}>
                <IconSymbol color={accentColor} name={option.icon} size={19} />
              </View>
            ) : null}
            <ThemedText
              selectable
              style={{ flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 }}
              lightColor={KatchaUI.companionScenePanel.optionInk}
              darkColor={KatchaUI.companionScenePanel.optionInk}>
              {option.label}
            </ThemedText>
            {selected ? (
              <IconSymbol color={accentColor} name="checkmark" size={15} weight="bold" />
            ) : disabled ? (
              <View style={{ width: 15 }} />
            ) : (
              <IconSymbol color={KatchaUI.companionScenePanel.optionIcon} name="chevron.right" size={15} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
