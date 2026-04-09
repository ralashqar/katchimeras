import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

type HeroShowcaseCaptionProps = {
  title: string;
};

export function HeroShowcaseCaption({ title }: HeroShowcaseCaptionProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(220)} style={styles.shell}>
      <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#D4E1FF" darkColor="#D4E1FF">
        A day in motion
      </ThemedText>
      <ThemedText type="subtitle" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {title}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
});
