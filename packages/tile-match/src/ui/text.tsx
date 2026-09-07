import { Text, type TextProps } from 'react-native';
export function GameText({ color, variant: _variant, fit, align, ...props }: TextProps & { color?: string; variant?: string; fit?: boolean; align?: 'left' | 'center' | 'right' }) {
  return <Text {...props} adjustsFontSizeToFit={fit} style={[{ color, textAlign: align, fontSize: 12, fontWeight: '800' }, props.style]} />;
}
