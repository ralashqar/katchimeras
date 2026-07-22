import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { HomeArchetypeId } from '@/types/world-identity';
import { kingdomHomeTileForIdentity, kingdomSurfaceTileAlignment } from '@/utils/kingdom-surface-tiles';
import {
  todayEggCountdownTop,
  todayEggStageFrame,
  todayKingdomHeroLayout,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';
import todayScene from '@/data/today-scene.json';

type TodayKingdomEggHeroProps = {
  homeArchetypeId?: HomeArchetypeId | null;
  onEggPress?: () => void;
  pinchStrength?: number;
};

type TodayKingdomEggOverlayProps = {
  children: ReactNode;
  homeArchetypeId?: HomeArchetypeId | null;
};

const TODAY_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.png');

export function TodayKingdomEggHero({
  homeArchetypeId,
  onEggPress,
  pinchStrength = 1,
}: TodayKingdomEggHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const tileSource = kingdomHexTileSourceForLod(tile, layout.tileSize > 512 ? 'full' : 'medium');
  const eggFrame = todayEggStageFrame(layout.eggCenterY, layout.eggStageScale);

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      <TodayFallbackCloudScene
        focusY={layout.eggCenterY
          + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio}
        pinchStrength={pinchStrength}
        environment={(
          <Image
            cachePolicy="memory-disk"
            contentFit="contain"
            pointerEvents="none"
            source={tileSource}
            style={[
              styles.tile,
              {
                height: layout.tileFrame.height,
                marginLeft: layout.tileFrame.left,
                top: layout.tileFrame.top,
                width: layout.tileFrame.width,
              },
            ]}
            transition={0}
          />
        )}
        frontTop={layout.tileFaceBottomY}>
        <View
          pointerEvents="box-none"
          style={[
            styles.egg,
            {
              height: eggFrame.height,
              top: eggFrame.top,
            },
          ]}>
          <Pressable
            accessibilityLabel="Today egg"
            accessibilityRole="button"
            disabled={!onEggPress}
            onPress={onEggPress}
            style={[
              styles.eggImageFrame,
              { width: 200 * layout.eggStageScale },
            ]}>
            <Image
              allowDownscaling={false}
              cachePolicy="memory-disk"
              contentFit="contain"
              pointerEvents="none"
              priority="high"
              recyclingKey="today-kingdom-egg-high-resolution"
              source={TODAY_EGG_SOURCE}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </Pressable>
        </View>
      </TodayFallbackCloudScene>
    </View>
  );
}

/** Camera-synchronised UI anchor rendered on the neighborhood's UI plane. */
export function TodayKingdomEggOverlay({ children, homeArchetypeId }: TodayKingdomEggOverlayProps) {
  const { width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.belowEgg,
        { top: todayEggCountdownTop(layout.eggCenterY, layout.eggStageScale) },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    width: '100%',
  },
  tile: {
    left: '50%',
    position: 'absolute',
  },
  egg: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  eggImageFrame: {
    height: '100%',
  },
  belowEgg: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
});
