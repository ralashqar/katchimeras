import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { AmbientEnvironmentDrift } from '@/components/katchadeck/ui/ambient-environment-drift';
import type { HomeVisualKey } from '@/types/home';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';

export function CompanionGameBackdrop({
  backgroundKey,
  creature,
  name,
  paused,
  strong = false,
  visualKey,
}: {
  backgroundKey: TodayExplorationBackgroundKey | null;
  creature: QuestionnaireImageSource;
  name: string;
  paused?: SharedValue<number>;
  strong?: boolean;
  visualKey: HomeVisualKey;
}) {
  return (
    <View pointerEvents="none" style={styles.root}>
      <AmbientEnvironmentDrift paused={paused}>
        <CompanionHomeEnvironmentStage
          backgroundKey={backgroundKey}
          creature={creature}
          layer="background"
          name={name}
          visualKey={visualKey}
        />
      </AmbientEnvironmentDrift>
      <View style={[styles.scrim, strong && styles.scrimStrong]} />
      <LinearGradient
        colors={
          strong
            ? ['rgba(5,6,14,0.78)', 'rgba(7,7,18,0.70)', 'rgba(4,5,12,0.84)']
            : ['rgba(8,10,18,0.54)', 'rgba(9,11,20,0.42)', 'rgba(5,7,14,0.66)']
        }
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#11131B',
    overflow: 'hidden',
    zIndex: 0,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,8,14,0.28)',
  },
  scrimStrong: {
    backgroundColor: 'rgba(3,4,10,0.56)',
  },
});
