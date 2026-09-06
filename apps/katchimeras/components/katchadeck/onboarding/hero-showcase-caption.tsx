import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

type HeroShowcaseCaptionProps = {
  title: string;
  subtitle?: string;
  variant?: 'default' | 'captionOnly';
};

export function HeroShowcaseCaption({
  title,
  subtitle,
  variant = 'default',
}: HeroShowcaseCaptionProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(220)} style={styles.shell}>
      <View style={[styles.pill, variant === 'captionOnly' ? styles.captionOnlyPill : null]}>
        <ThemedText
          type="default"
          style={[styles.title, variant === 'captionOnly' ? styles.captionOnlyTitle : null]}
          lightColor="#F8FBFF"
          darkColor="#F8FBFF">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="label" style={styles.subtitle} lightColor="#C9D8FF" darkColor="#C9D8FF">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  pill: {
    backgroundColor: 'rgba(9, 13, 24, 0.82)',
    borderColor: 'rgba(216, 228, 255, 0.16)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 2,
    minWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  captionOnlyPill: {
    minWidth: undefined,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  title: {
    fontSize: 13,
    letterSpacing: -0.1,
    lineHeight: 17,
    textAlign: 'center',
  },
  captionOnlyTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
