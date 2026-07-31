import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import type { HomeVisualKey } from '@/types/home';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import { companionHomeStageLayout } from '@/utils/companion-home-layout';

export const CompanionHomeEnvironmentStage = memo(
  function CompanionHomeEnvironmentStage({
    backgroundKey,
    creature,
    layer = 'both',
    name,
    visualKey,
  }: {
    backgroundKey: TodayExplorationBackgroundKey | null;
    creature: QuestionnaireImageSource;
    layer?: 'background' | 'creature' | 'both';
    name: string;
    visualKey: HomeVisualKey;
  }) {
    const { height, width } = useWindowDimensions();
    const layout = companionHomeStageLayout(width, height, visualKey);
    const stageTransform = {
      transform: [
        { translateX: layout.translateX },
        { translateY: layout.translateY },
      ],
    } as const;
    const showBackground = layer === 'background' || layer === 'both';
    const showCreature = layer === 'creature' || layer === 'both';

    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          showCreature && !showBackground && styles.creatureLayerRoot,
        ]}>
        {showBackground && backgroundKey ? (
          <View style={[styles.backgroundPlane, stageTransform]}>
            <TodayExplorationBackground
              backgroundKey={backgroundKey}
              imageSize={layout.backgroundImageSize}
            />
          </View>
        ) : null}

        {showCreature ? <View style={[styles.creaturePlane, stageTransform]}>
          <View
            style={[
              styles.creatureFrame,
              {
                height: layout.creatureFrame.size,
                marginLeft: -layout.creatureFrame.size / 2,
                top: layout.creatureFrame.top,
                width: layout.creatureFrame.size,
              },
            ]}>
            <CreatureGroundShadow
              frameSize={layout.creatureFrame.size}
              visualKey={visualKey}
            />
            <Image
              accessibilityLabel={`${name}, your Katchimera`}
              cachePolicy="memory-disk"
              contentFit="contain"
              priority="high"
              source={creature}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </View>
        </View> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  backgroundPlane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  creaturePlane: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  creatureLayerRoot: {
    zIndex: 2,
  },
  creatureFrame: {
    left: '50%',
    position: 'absolute',
  },
});
