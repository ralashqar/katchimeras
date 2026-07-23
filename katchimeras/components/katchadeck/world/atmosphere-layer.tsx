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
import { SpriteAtmosphereAtlas } from '@/components/katchadeck/world/sprite-atmosphere-atlas';
import {
  atmosphereParticleCount,
  atmospherePresetHasForeground,
  atmospherePresetUsesAuthoredSprites,
  atmospherePresetSeedOffset,
  atmosphereTargetIncludes,
  generateAtmosphereParticles,
  type AtmospherePlane,
  type AtmosphereRenderer,
  type AtmosphereSettings,
} from '@/utils/atmosphere';

type AtmosphereLayerProps = {
  active?: boolean;
  plane: AtmospherePlane;
  reduceMotionOverride?: boolean;
  renderer?: AtmosphereRenderer;
  settings: AtmosphereSettings;
  style?: ViewStyle;
};

export const AtmosphereLayer = memo(function AtmosphereLayer({
  active = true,
  plane,
  reduceMotionOverride = false,
  renderer = 'atlas',
  settings,
  style,
}: AtmosphereLayerProps) {
  const isFocused = useIsFocused();
  const deviceReduceMotion = useReducedMotion();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const visible = settings.preset !== 'none';
  const planeHasContent = plane === 'background'
    || atmospherePresetHasForeground(settings.preset);

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
        renderer={renderer}
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
  return (
    <>
      <AtmosphereLayer plane={plane} renderer={devState.renderer} settings={devState.settings} style={style} />
      <AtmosphereLayer plane={plane} renderer={devState.renderer} settings={devState.accentSettings} style={style} />
    </>
  );
});

export const ResolvedAtmosphereLayer = memo(function ResolvedAtmosphereLayer({
  plane,
  settings,
  style,
  target = 'today',
}: {
  plane: AtmospherePlane;
  settings: readonly AtmosphereSettings[];
  style?: ViewStyle;
  target?: 'today' | 'kingdom';
}) {
  const devState = useDevAtmosphereState();
  const devOverride = atmosphereTargetIncludes(devState.target, target)
    && (devState.settings.preset !== 'none' || devState.accentSettings.preset !== 'none');
  const layers = devOverride
    ? [devState.settings, devState.accentSettings]
    : settings;
  return (
    <>
      {layers.map((layer, index) => (
        <AtmosphereLayer
          key={`${layer.preset}-${layer.seed}-${index}`}
          plane={plane}
          renderer={devOverride ? devState.renderer : 'atlas'}
          settings={layer}
          style={style}
        />
      ))}
    </>
  );
});

function AtmosphereCanvas({
  active,
  plane,
  reduceMotion,
  renderer,
  settings,
}: {
  active: boolean;
  plane: AtmospherePlane;
  reduceMotion: boolean;
  renderer: AtmosphereRenderer;
  settings: AtmosphereSettings;
}) {
  const { height, width } = useWindowDimensions();
  const elapsed = useSharedValue(0);
  const count = plane === 'foreground'
    ? atmosphereParticleCount(settings.preset, settings.quality, width, settings.intensity)
    : 0;
  const particles = useMemo(
    () => generateAtmosphereParticles(
      count,
      settings.seed + atmospherePresetSeedOffset(settings.preset),
    ),
    [count, settings.preset, settings.seed],
  );
  const useAtlasSprites = renderer === 'atlas'
    && atmospherePresetUsesAuthoredSprites(settings.preset);

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

  const expressivePath = usePathValue((path) => {
    'worklet';
    if (plane !== 'foreground') return;
    const preset = settings.preset;
    const expressive = preset !== 'none'
      && preset !== 'rain'
      && preset !== 'snow'
      && preset !== 'fog'
      && preset !== 'smog'
      && preset !== 'storm'
      && preset !== 'heat_shimmer';
    if (!expressive) return;

    const time = reduceMotion ? 0 : elapsed.value;
    const wind = settings.wind;
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const size = (1.5 + particle.size * 3.1) * particle.depth;
      const sway = Math.sin(time * 0.0008 * particle.drift + particle.phase)
        * (8 + particle.depth * 22);
      const upward = preset === 'cozy_embers'
        || preset === 'fireflies'
        || preset === 'golden_motes'
        || preset === 'idea_sparks'
        || preset === 'memory_shimmer';
      const horizontal = preset === 'journey_breeze' || preset === 'social_ribbons';
      let x: number;
      let y: number;

      if (horizontal) {
        const speed = (0.018 + particle.speed * 0.032) * (0.75 + particle.depth * 0.45);
        const travel = width + 100;
        const rawX = particle.x * width + time * speed * (wind < -0.05 ? -1 : 1);
        x = ((rawX % travel) + travel) % travel - 50;
        y = particle.y * height + Math.sin(time * 0.001 * particle.drift + particle.phase) * 13;
      } else {
        const speedBase = preset === 'celebration_drift' ? 0.012 : preset === 'quiet_dust' ? 0.007 : 0.015;
        const speed = (speedBase + particle.speed * speedBase * 1.15) * particle.depth;
        const travel = height + 60;
        const rawY = particle.y * height + time * speed * (upward ? -1 : 1);
        y = ((rawY % travel) + travel) % travel - 30;
        x = particle.x * width + sway + time * wind * 0.008 * particle.drift;
        x = ((x % (width + 40)) + width + 40) % (width + 40) - 20;
      }

      if (preset === 'journey_breeze') {
        const length = 12 + particle.size * 22;
        path.moveTo(x - length / 2, y);
        path.cubicTo(x - length * 0.1, y - 2, x + length * 0.2, y + 2, x + length / 2, y);
      } else if (preset === 'social_ribbons') {
        const length = 14 + particle.size * 24;
        path.moveTo(x - length / 2, y);
        path.cubicTo(x - length * 0.18, y - 7, x + length * 0.15, y + 7, x + length / 2, y);
      } else if (preset === 'celebration_drift') {
        const angle = particle.phase + time * 0.00035 * particle.drift;
        const dx = Math.cos(angle) * size * 1.7;
        const dy = Math.sin(angle) * size * 1.7;
        path.moveTo(x - dx, y - dy);
        path.lineTo(x + dy * 0.55, y - dx * 0.55);
        path.lineTo(x + dx, y + dy);
        path.lineTo(x - dy * 0.55, y + dx * 0.55);
        path.close();
      } else if (preset === 'petal_drift') {
        path.addOval({ x: x - size * 1.1, y: y - size * 0.55, width: size * 2.2, height: size * 1.1 });
        path.addOval({ x: x - size * 0.25, y: y - size, width: size * 0.9, height: size * 1.8 });
      } else if (preset === 'falling_leaves') {
        path.moveTo(x, y - size * 1.4);
        path.lineTo(x + size, y);
        path.lineTo(x, y + size * 1.4);
        path.lineTo(x - size, y);
        path.close();
        path.moveTo(x, y - size);
        path.lineTo(x, y + size * 1.65);
      } else if (preset === 'dandelion_seeds') {
        path.addCircle(x, y, Math.max(0.8, size * 0.38));
        path.moveTo(x, y + size * 0.3);
        path.lineTo(x + size * 0.7, y + size * 2.2);
      } else if (preset === 'idea_sparks' || preset === 'memory_shimmer') {
        const arm = size * (preset === 'memory_shimmer' ? 2 : 1.55);
        path.moveTo(x - arm, y);
        path.lineTo(x + arm, y);
        path.moveTo(x, y - arm);
        path.lineTo(x, y + arm);
        path.addCircle(x, y, Math.max(0.7, size * 0.35));
      } else if (preset === 'dream_wisps') {
        const length = size * 4.2;
        path.moveTo(x - length / 2, y);
        path.cubicTo(x - length * 0.15, y - size, x + length * 0.15, y + size, x + length / 2, y);
      } else {
        path.addCircle(x, y, size * (preset === 'quiet_dust' ? 0.45 : 0.72));
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

  const isHaze = settings.preset === 'fog' || settings.preset === 'smog' || settings.preset === 'heat_shimmer';
  const isPrecipitation = settings.preset === 'rain' || settings.preset === 'snow' || settings.preset === 'storm';
  const expressiveStyle = expressiveAtmosphereStyle(settings.preset);
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
            <Rect x={0} y={0} width={width} height={height} opacity={(settings.preset === 'smog' ? 0.26 : settings.preset === 'heat_shimmer' ? 0.09 : 0.18) * settings.intensity}>
              <LinearGradient
                start={vec(width / 2, 0)}
                end={vec(width / 2, height)}
                colors={settings.preset === 'smog'
                  ? ['#766C55', '#B2A17C', '#D3C49D']
                  : settings.preset === 'heat_shimmer'
                    ? ['#F7B768', '#FFD99A', '#FFF0C8']
                    : ['#DCE7E6', '#ECF2EE', '#F8F4E8']}
              />
            </Rect>
            <Path path={hazePath} color={settings.preset === 'smog' ? '#B4A170' : settings.preset === 'heat_shimmer' ? '#FFD89A' : '#F3F7F0'} opacity={(settings.preset === 'smog' ? 0.34 : settings.preset === 'heat_shimmer' ? 0.14 : 0.42) * settings.intensity}>
              <BlurMask blur={settings.preset === 'heat_shimmer' ? 24 : 38} style="normal" />
            </Path>
          </>
        ) : null}
        {plane === 'background' && expressiveStyle ? (
          <Rect
            color={expressiveStyle.background}
            height={height}
            opacity={expressiveStyle.backgroundOpacity * settings.intensity}
            width={width}
            x={0}
            y={0}
          />
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
        {plane === 'foreground' && useAtlasSprites ? (
          <SpriteAtmosphereAtlas
            elapsed={elapsed}
            height={height}
            intensity={settings.intensity}
            particles={particles}
            preset={settings.preset}
            reduceMotion={reduceMotion}
            width={width}
            wind={settings.wind}
          />
        ) : null}
        {plane === 'foreground' && expressiveStyle && !useAtlasSprites ? (
          <>
            {expressiveStyle.glow ? (
              <Path
                color={expressiveStyle.color}
                opacity={0.34 * settings.intensity}
                path={expressivePath}
                strokeCap="round"
                strokeWidth={expressiveStyle.strokeWidth}
                style={expressiveStyle.stroke ? 'stroke' : 'fill'}>
                <BlurMask blur={expressiveStyle.blur} style="normal" />
              </Path>
            ) : null}
            <Path
              color={expressiveStyle.color}
              opacity={expressiveStyle.opacity * settings.intensity}
              path={expressivePath}
              strokeCap="round"
              strokeWidth={expressiveStyle.strokeWidth}
              style={expressiveStyle.stroke ? 'stroke' : 'fill'}>
              {settings.preset === 'celebration_drift' ? (
                <LinearGradient
                  colors={['#FFB65A', '#F7E27A', '#F49BC4', '#8ED8D1', '#A997F2']}
                  end={vec(width, height)}
                  start={vec(0, 0)}
                />
              ) : null}
            </Path>
          </>
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

type ExpressiveStyle = {
  background: string;
  backgroundOpacity: number;
  blur: number;
  color: string;
  glow: boolean;
  opacity: number;
  stroke: boolean;
  strokeWidth: number;
};

function expressiveAtmosphereStyle(preset: AtmosphereSettings['preset']): ExpressiveStyle | null {
  switch (preset) {
    case 'celebration_drift':
      return { background: '#FFD66D', backgroundOpacity: 0.025, blur: 0, color: '#F6C861', glow: false, opacity: 0.9, stroke: false, strokeWidth: 1 };
    case 'golden_motes':
      return { background: '#F4B64D', backgroundOpacity: 0.055, blur: 7, color: '#FFE38B', glow: true, opacity: 0.9, stroke: false, strokeWidth: 1 };
    case 'fireflies':
      return { background: '#183C35', backgroundOpacity: 0.045, blur: 8, color: '#E9FF8A', glow: true, opacity: 0.88, stroke: false, strokeWidth: 1 };
    case 'petal_drift':
      return { background: '#F5A9C4', backgroundOpacity: 0.035, blur: 0, color: '#FFD1DE', glow: false, opacity: 0.84, stroke: false, strokeWidth: 1 };
    case 'falling_leaves':
      return { background: '#A85D2A', backgroundOpacity: 0.035, blur: 0, color: '#E49345', glow: false, opacity: 0.82, stroke: false, strokeWidth: 1.15 };
    case 'dandelion_seeds':
      return { background: '#E9E2BB', backgroundOpacity: 0.025, blur: 2, color: '#FFF8D7', glow: false, opacity: 0.78, stroke: true, strokeWidth: 1.1 };
    case 'cozy_embers':
      return { background: '#B45B27', backgroundOpacity: 0.055, blur: 7, color: '#FFB85C', glow: true, opacity: 0.9, stroke: false, strokeWidth: 1 };
    case 'dream_wisps':
      return { background: '#6E6BC1', backgroundOpacity: 0.055, blur: 8, color: '#DAD8FF', glow: true, opacity: 0.58, stroke: true, strokeWidth: 1.5 };
    case 'idea_sparks':
      return { background: '#7054A5', backgroundOpacity: 0.035, blur: 6, color: '#F6D57B', glow: true, opacity: 0.9, stroke: true, strokeWidth: 1.45 };
    case 'journey_breeze':
      return { background: '#58A9B2', backgroundOpacity: 0.025, blur: 2, color: '#D9F6ED', glow: false, opacity: 0.66, stroke: true, strokeWidth: 1.35 };
    case 'memory_shimmer':
      return { background: '#D7A4DD', backgroundOpacity: 0.035, blur: 7, color: '#FFF1B3', glow: true, opacity: 0.88, stroke: true, strokeWidth: 1.5 };
    case 'social_ribbons':
      return { background: '#D78091', backgroundOpacity: 0.04, blur: 3, color: '#FFD0C8', glow: false, opacity: 0.72, stroke: true, strokeWidth: 1.8 };
    case 'quiet_dust':
      return { background: '#E7D9B5', backgroundOpacity: 0.018, blur: 4, color: '#FFF4D2', glow: true, opacity: 0.54, stroke: false, strokeWidth: 1 };
    default:
      return null;
  }
}
