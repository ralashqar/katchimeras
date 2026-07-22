import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { HomeArchetypeId } from '@/types/world-identity';
import { kingdomHomeTileForIdentity, kingdomSurfaceTileAlignment } from '@/utils/kingdom-surface-tiles';
import { todayKingdomHeroLayout, TODAY_KINGDOM_STAGE_HEIGHT } from '@/utils/today-kingdom-hero-layout';
import { kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import { TodayFallbackCloudScene } from '@/components/katchadeck/home/today-fallback-cloud-scene';
import todayScene from '@/data/today-scene.json';

type TodayKingdomEggHeroProps = {
  children: ReactNode;
  homeArchetypeId?: HomeArchetypeId | null;
};

export function TodayKingdomEggHero({ children, homeArchetypeId }: TodayKingdomEggHeroProps) {
  const { width: windowWidth } = useWindowDimensions();
  const tile = kingdomHomeTileForIdentity(homeArchetypeId);
  const layout = todayKingdomHeroLayout(windowWidth, kingdomSurfaceTileAlignment(tile));
  const tileSource = kingdomHexTileSourceForLod(tile, layout.tileSize > 512 ? 'full' : 'medium');

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      <TodayFallbackCloudScene
        focusY={layout.eggCenterY
          + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio}
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
              top: layout.eggCenterY
                - TODAY_KINGDOM_STAGE_HEIGHT / 2
                + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio,
              transform: [{ scale: layout.eggStageScale }],
            },
          ]}>
          {children}
        </View>
      </TodayFallbackCloudScene>
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
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
});
