import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions } from 'react-native';

// Background framing (zoom + vertical offset) — tuned in data/today-scene.json.
import todayScene from '@/data/today-scene.json';

// The Meadow scene background (scripts/generate-today-scene.py — style-anchored
// to the world base), shared by the Today page, onboarding, and Hatch Your Past
// so every egg moment lives in the SAME place.
const TODAY_BG = require('@incubator/art-world/today/today_bg.webp');

// The egg/membrane framing the home page applies to LanternEgg — exported so
// other scenes (onboarding, Hatch Your Past) render the identical egg.
export function todayEggFraming() {
  return {
    scale: todayScene.egg?.scale ?? 1,
    offsetY: todayScene.egg?.offsetY ?? 0,
    membraneScale: todayScene.membrane?.scale ?? 1,
    membraneOffsetY: todayScene.membrane?.offsetY ?? 0,
  };
}

// Distance from the safe-area top to the TOP of the home page's 258px egg
// stage: content paddingTop 8 + week strip (~86: 58 orb + pointer band + label)
// + heroStage marginTop 26. Other scenes anchor their egg here so it never moves.
export const HOME_EGG_STAGE_TOP = 120;
// The home shell scale every mount passes (today.tsx uses 0.72 everywhere).
export const HOME_EGG_SHELL_SCALE = 0.72;

export function MeadowSceneBackdrop() {
  const { height } = useWindowDimensions();
  // A gentle zoom plus a vertical shift, clamped so the scaled image always
  // fills the frame (same math as the Today page).
  const bgScale = Math.max(1, todayScene.background?.scale ?? 1);
  const slack = ((bgScale - 1) * height) / 2;
  const bgOffsetY = Math.min(slack, Math.max(-slack, todayScene.background?.offsetY ?? 0));

  return (
    <>
      <Image
        source={TODAY_BG}
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: bgOffsetY }, { scale: bgScale }] }]}
        contentFit="cover"
        pointerEvents="none"
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(30, 20, 10, 0.04)', 'rgba(30, 20, 10, 0.12)', 'rgba(30, 20, 10, 0.42)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
