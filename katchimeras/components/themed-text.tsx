import { StyleSheet, Text, type TextProps } from 'react-native';

import { KatchaDeckUI } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'display'
    | 'hero'
    | 'onboardingDisplay'
    | 'onboardingLabel'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'bodyLarge'
    | 'label'
    | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'display' ? styles.display : undefined,
        type === 'hero' ? styles.hero : undefined,
        type === 'onboardingDisplay' ? styles.onboardingDisplay : undefined,
        type === 'onboardingLabel' ? styles.onboardingLabel : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'bodyLarge' ? styles.bodyLarge : undefined,
        type === 'label' ? styles.label : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: KatchaDeckUI.typography.body,
  defaultSemiBold: {
    ...KatchaDeckUI.typography.body,
    fontWeight: '600',
  },
  title: KatchaDeckUI.typography.headline,
  display: KatchaDeckUI.typography.display,
  hero: KatchaDeckUI.typography.hero,
  onboardingDisplay: KatchaDeckUI.typography.onboardingDisplay,
  onboardingLabel: KatchaDeckUI.typography.onboardingLabel,
  subtitle: KatchaDeckUI.typography.subtitle,
  bodyLarge: KatchaDeckUI.typography.bodyLarge,
  label: KatchaDeckUI.typography.label,
  link: {
    ...KatchaDeckUI.typography.body,
    color: KatchaDeckUI.palette.deepNavy,
    fontWeight: '600',
  },
});
