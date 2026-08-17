import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { EggAvatarProfileScreen } from '@/components/katchadeck/egg-avatar/egg-avatar-profile-screen';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { TodayKingdomEggHero } from '@/components/katchadeck/home/today-kingdom-egg-hero';
import { HOME_SCENE_Y_OFFSET } from '@/constants/home-loop-layout';
import { useWisps } from '@/features/wisps/wisp-provider';
import { useScenes } from '@/features/scenes/scene-provider';
import { useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { useAllDays } from '@/hooks/use-all-days';
import { eggAvatarCustomizerCamera } from '@/utils/egg-avatar-customizer-camera';
import { resolveHatchHour } from '@/game/days/lifecycle';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import {
  todayExplorationEggStageFrame,
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { todayGrowthSummary } from '@/utils/today-growth';

const YOU_AVATAR_RELATIVE_Y_OFFSET = 18;

export default function YouScreen() {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { days } = useAllDays({ refreshOnFocus: false });
  const { equippedWispId } = useWisps();
  const { equippedSceneId } = useScenes();

  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const growth = useMemo(() => today && today.state !== 'hatched'
    ? todayGrowthSummary(today, resolveHatchHour(loadOnboardingProfile()))
    : null, [today]);
  const imageSize = Math.max(height, width);
  // This is the measured resting position from Today: safe-area content inset,
  // its 85dp timeline row, the 26dp stage gap, and the shared scene offset.
  const stageTop = insets.top
    + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA
    + HOME_SCENE_Y_OFFSET;
  const eggFrame = todayExplorationEggStageFrame(width, height, stageTop);
  const camera = eggAvatarCustomizerCamera({
    bottomInset: insets.bottom,
    subjectCenterY: stageTop + eggFrame.centerY,
    topInset: insets.top,
    viewportHeight: height,
  });
  const projectedCameraScale = useSharedValue(camera.scale);

  useEffect(() => {
    projectedCameraScale.value = camera.scale;
  }, [camera.scale, projectedCameraScale]);
  // You is a lightweight sibling tab whose tree is committed synchronously.
  // Do not gate repeat entries on native image/layout callbacks: cached images
  // are not required to replay onLoad, which could strand the curtain waiting.
  useGameSurfaceReadiness('you', {
    background: true,
    data: true,
    foreground: true,
    layout: true,
  }, focused);

  if (!focused) return <View style={styles.inactive} />;

  const eggStageTop = stageTop + YOU_AVATAR_RELATIVE_Y_OFFSET;
  const baseEggBottomY = eggStageTop + eggFrame.top + eggFrame.height;
  const projectedEggBottomY = height / 2
    + (baseEggBottomY - height / 2) * camera.scale
    + camera.translateY;
  const projectedEggTranslateY = projectedEggBottomY - baseEggBottomY;

  return (
    <View style={styles.screen}>
      <View
        pointerEvents="none"
        style={[
          styles.cameraPlane,
          {
            transform: [
              { translateY: camera.translateY },
              { scale: camera.scale },
            ],
          },
        ]}>
        <TodayExplorationBackground
          backgroundKey={equippedSceneId}
          imageSize={imageSize}
          verticalOffset={HOME_SCENE_Y_OFFSET}
        />
      </View>
      {/* Keep the Egg out of the scaled full-screen camera texture. Its native
          high-resolution surface receives the camera scale directly, while
          this stage projects the same bottom-centre world anchor as the scene. */}
      <View
        pointerEvents="none"
        style={[
          styles.heroStage,
          {
            top: eggStageTop,
            transform: [{ translateY: projectedEggTranslateY }],
          },
        ]}>
        <TodayKingdomEggHero
          accentColor={today?.egg.accentColor}
          companionWispId={equippedWispId}
          coreColor={today?.egg.coreColor}
          explorationStageTop={stageTop}
          growthProgress={1}
          growthStage={6}
          hideKingdomEnvironmentArt
          isActivated={growth?.isActivated ?? true}
          isReady={growth?.isReady ?? false}
          pinchStrength={0}
          projectedCameraScale={projectedCameraScale}
          showDormantIndicator={false}
        />
      </View>
      <EggAvatarProfileScreen bottomInset={insets.bottom} days={days} />
    </View>
  );
}

const styles = StyleSheet.create({
  inactive: { flex: 1 },
  screen: { backgroundColor: '#32271F', flex: 1 },
  cameraPlane: { ...StyleSheet.absoluteFillObject },
  heroStage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
  },
});
