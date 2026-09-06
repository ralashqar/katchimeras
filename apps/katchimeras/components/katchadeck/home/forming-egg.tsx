import { StyleSheet, View } from 'react-native';

import { EggShell } from '@/components/katchadeck/home/egg-shell';
import { HeroAuraFrame } from '@/components/katchadeck/home/hero-aura-frame';
import { ThemedText } from '@/components/themed-text';
import type { EggVisualState } from '@/types/home';

type FormingEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  caption?: string;
  interactive?: boolean;
};

export function FormingEgg({
  egg,
  onPress,
  reactionKey = 0,
  caption,
  interactive = false,
}: FormingEggProps) {
  return (
    <View style={styles.shell}>
      <HeroAuraFrame aura={egg} interactive={interactive} onPress={onPress}>
        {(motion) => <EggShell egg={egg} motion={motion} reactionKey={reactionKey} />}
      </HeroAuraFrame>

      <View style={styles.captionWrap}>
        <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
          {egg.label}
        </ThemedText>
        {caption ? (
          <ThemedText style={styles.caption} lightColor="#EAF1FF" darkColor="#EAF1FF">
            {caption}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 16,
  },
  captionWrap: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 280,
  },
  label: {
    fontSize: 11,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
