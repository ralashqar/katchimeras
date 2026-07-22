import { useIsFocused } from '@react-navigation/native';
import {
  BlurMask,
  Canvas,
  LinearGradient,
  Path,
  Rect,
  vec,
  usePathValue,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { useDevAtmosphereState } from '@/hooks/use-dev-atmosphere-state';
import {
  atmosphereParticleCount,
  atmosphereTargetIncludes,
  generateAtmosphereParticles,
  type AtmospherePlane,
  type AtmosphereSettings,
} from '@/utils/atmosphere';

type AtmosphereLayerProps = {
  active?: boolean;
  plane: AtmospherePlane;
  reduceMotionOverride?: boolean;
  settings: AtmosphereSettings;
  style?: ViewStyle;
};

export const AtmosphereLayer = memo(function AtmosphereLayer({
  active = true,
  plane,
  reduceMotionOverride = false,
  settings,
  style,
}: AtmosphereLayerProps) {
  const isFocused = useIsFocused();
  const deviceReduceMotion = useReducedMotion();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const visible = settings.preset !== 'none';
  const planeHasContent = plane === 'background'
    || settings.preset === 'rain'
    || settings.preset === 'snow'
    || settings.preset === 'storm';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  if (!visible || !planeHasContent) return null;

  const motionActive = active
    && isFocused
    && appIsActive
    && !settings.paused
    && !deviceReduceMotion
    && !reduceMotionOverride;

  return (
    <Animated.View
      key={`${plane}-${settings.preset}`}
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
      pointerEvents="none"
      style={[styles.layer, style]}>
      <AtmosphereCanvas
        active={motionActive}
        plane={plane}
        reduceMotion={deviceReduceMotion || reduceMotionOverride}
        settings={settings}
      />
    </Animated.View>
  );
});

export const DevAtmosphereLayer = memo(function DevAtmosphereLayer({
  plane,
  style,
  target,
}: {
  plane: AtmospherePlane;
  style?: ViewStyle;
  target: 'today' | 'kingdom';
}) {
  const devState = useDevAtmosphereState();
  if (!atmosphereTargetIncludes(devState.target, target)) return null;
  return <AtmosphereLayer plane={plane} settings={devState.settings} style={style} />;
});

function AtmosphereCanvas({
  active,
  plane,
  reduceMotion,
  settings,
}: {
  active: boolean;
  plane: AtmospherePlane;
  reduceMotion: boolean;
  settings: AtmosphereSettings;
}) {
  const { height, width } = useWindowDimensions();
  const elapsed = useSharedValue(0);
  const count = plane === 'foreground'
    ? atmosphereParticleCount(settings.preset, settings.quality, width, settings.intensity)
    : 0;
  const particles = useMemo(
    () => generateAtmosphereParticles(count, settings.seed + (settings.preset === 'snow' ? 997 : 0)),
    [count, settings.preset, settings.seed],
  );

  useEffect(() => {
    elapsed.value = 0;
  }, [elapsed, settings.preset, settings.seed]);

  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    elapsed.value += Math.min(frame.timeSincePreviousFrame ?? 16.67, 34);
  }, false);

  useEffect(() => {
    frameCallback.setActive(active);
    return () => frameCallback.setActive(false);
  }, [active, frameCallback]);

  const precipitationPath = usePathValue((path) => {
    'worklet';
    if (plane !== 'foreground') return;
    const time = reduceMotion ? 0 : elapsed.value;
    const preset = settings.preset;
    const wind = settings.wind;
    const rain = preset === 'rain' || preset === 'storm';
    if (!rain && preset !== 'snow') return;

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (rain) {
        const length = (12 + particle.size * 20) * particle.depth;
        const speed = (0.45 + particle.speed * 0.52) * particle.depth;
        const travel = height + length * 2;
        const rawY = particle.y * height + time * speed;
        const y = ((rawY % travel) + travel) % travel - length;
        const rawX = particle.x * width + time * wind * 0.075 * particle.drift + y * wind * 0.08;
        const x = ((rawX % (width + 40)) + width + 40) % (width + 40) - 20;
        path.moveTo(x, y);
        path.lineTo(x + wind * length * 0.42, y + length);
      } else {
        const radius = (1.6 + particle.size * 2.6) * particle.depth;
        const speed = (0.018 + particle.speed * 0.032) * particle.depth;
        const travel = height + radius * 4;
        const rawY = particle.y * height + time * speed;
        const y = ((rawY % travel) + travel) % travel - radius * 2;
        const sway = Math.sin(time * 0.0012 * particle.drift + particle.phase) * (12 + particle.depth * 18);
        const rawX = particle.x * width + sway + time * wind * 0.018;
        const x = ((rawX % (width + 30)) + width + 30) % (width + 30) - 15;
        path.addCircle(x, y, radius);
      }
    }
  });

  const hazePath = usePathValue((path) => {
    'worklet';
    if (plane !== 'background') return;
    const time = reduceMotion ? 0 : elapsed.value;
    const direction = settings.wind === 0 ? 0.12 : settings.wind;
    for (let index = 0; index < 3; index += 1) {
      const bandWidth = width * (0.9 + index * 0.24);
      const bandHeight = height * (0.17 + index * 0.035);
      const travel = width + bandWidth;
      const rawX = -bandWidth * 0.66 + index * width * 0.42 + time * direction * (0.004 + index * 0.0015);
      const x = ((rawX % travel) + travel) % travel - bandWidth;
      const y = height * (0.25 + index * 0.2);
      path.addOval({ x, y, width: bandWidth, height: bandHeight });
      path.addOval({ x: x + travel, y, width: bandWidth, height: bandHeight });
    }
  });

  const stormFlash = useDerivedValue(() => {
    if (plane !== 'foreground' || !active || settings.preset !== 'storm' || reduceMotion) return 0;
    const phase = (elapsed.value % 8_600) / 8_600;
    if (phase > 0.018 && phase < 0.032) return (1 - Math.abs(phase - 0.025) / 0.007) * 0.18 * settings.intensity;
    if (phase > 0.054 && phase < 0.066) return (1 - Math.abs(phase - 0.06) / 0.006) * 0.09 * settings.intensity;
    return 0;
  });

  const isHaze = settings.preset === 'fog' || settings.preset === 'smog';
  const isPrecipitation = settings.preset === 'rain' || settings.preset === 'snow' || settings.preset === 'storm';
  const rainOpacity = (settings.preset === 'storm' ? 0.72 : 0.48) * settings.intensity;
  const snowOpacity = 0.82 * settings.intensity;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        {plane === 'background' && settings.preset === 'storm' ? (
          <Rect x={0} y={0} width={width} height={height} opacity={0.3 * settings.intensity}>
            <LinearGradient start={vec(width / 2, 0)} end={vec(width / 2, height)} colors={['#172840', '#40566A', '#243746']} />
          </Rect>
        ) : null}
        {plane === 'background' && settings.preset === 'snow' ? (
          <Rect x={0} y={0} width={width} height={height} color="#DDF3FA" opacity={0.08 * settings.intensity} />
        ) : null}
        {plane === 'background' && settings.preset === 'rain' ? (
          <Rect x={0} y={0} width={width} height={height} opacity={0.12 * settings.intensity}>
            <LinearGradient start={vec(width / 2, 0)} end={vec(width / 2, height)} colors={['#385B78', '#7190A2', '#A9C1C8']} />
          </Rect>
        ) : null}
        {plane === 'background' && isHaze ? (
          <>
            <Rect x={0} y={0} width={width} height={height} opacity={(settings.preset === 'smog' ? 0.26 : 0.18) * settings.intensity}>
              <LinearGradient
                start={vec(width / 2, 0)}
                end={vec(width / 2, height)}
                colors={settings.preset === 'smog' ? ['#766C55', '#B2A17C', '#D3C49D'] : ['#DCE7E6', '#ECF2EE', '#F8F4E8']}
              />
            </Rect>
            <Path path={hazePath} color={settings.preset === 'smog' ? '#B4A170' : '#F3F7F0'} opacity={(settings.preset === 'smog' ? 0.34 : 0.42) * settings.intensity}>
              <BlurMask blur={38} style="normal" />
            </Path>
          </>
        ) : null}
        {plane === 'foreground' && isPrecipitation ? (
          <Path
            path={precipitationPath}
            color={settings.preset === 'snow' ? '#FFFDF2' : '#D9F2FF'}
            opacity={settings.preset === 'snow' ? snowOpacity : rainOpacity}
            style={settings.preset === 'snow' ? 'fill' : 'stroke'}
            strokeCap="round"
            strokeWidth={settings.preset === 'storm' ? 2.1 : 1.55}
          />
        ) : null}
        {plane === 'foreground' && settings.preset === 'storm' ? (
          <Rect x={0} y={0} width={width} height={height} color="#EEF8FF" opacity={stormFlash} />
        ) : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
