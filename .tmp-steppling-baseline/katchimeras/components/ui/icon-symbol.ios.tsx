import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const MATERIAL_FALLBACKS = {
  'face.very_happy': 'sentiment-very-satisfied',
  'face.happy': 'sentiment-satisfied',
  'face.neutral': 'sentiment-neutral',
  'face.sad': 'sentiment-dissatisfied',
  'face.very_sad': 'sentiment-very-dissatisfied',
} satisfies Record<string, MaterialIconName>;

export type IconSymbolName = SymbolViewProps['name'] | keyof typeof MATERIAL_FALLBACKS;

function isMaterialFallback(name: IconSymbolName): name is keyof typeof MATERIAL_FALLBACKS {
  return Object.prototype.hasOwnProperty.call(MATERIAL_FALLBACKS, name);
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle | ViewStyle>;
  weight?: SymbolWeight;
}) {
  if (isMaterialFallback(name)) {
    return <MaterialIcons color={color} size={size} name={MATERIAL_FALLBACKS[name]} style={style as StyleProp<TextStyle>} />;
  }

  return (
    <SymbolView
      weight={weight}
      tintColor={color as string}
      resizeMode="scaleAspectFit"
      name={name as SymbolViewProps['name']}
      style={[
        {
          width: size,
          height: size,
        },
        style as StyleProp<ViewStyle>,
      ]}
    />
  );
}
