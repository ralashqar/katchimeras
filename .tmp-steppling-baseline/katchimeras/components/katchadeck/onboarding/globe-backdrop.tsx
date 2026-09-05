import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurMask, Canvas, Circle, Group, Line, Path, Skia } from '@shopify/react-native-skia';
import type { HeroArcLayer } from '@/constants/onboarding-hero';

type GlobeBackdropProps = {
  size: number;
  pathVisible: boolean;
  orbitVisible: boolean;
  highlightVisible: boolean;
  reducedMotion?: boolean;
};

export function GlobeBackdrop({
  size,
  pathVisible,
  orbitVisible,
  highlightVisible,
  reducedMotion = false,
}: GlobeBackdropProps) {
  const [pathProgress, setPathProgress] = useState(pathVisible ? 1 : 0);
  const globePulse = useSharedValue(0.94);
  const pathOpacity = useSharedValue(pathVisible && !orbitVisible ? 1 : 0);
  const highlightOpacity = useSharedValue(highlightVisible ? 1 : 0);

  useEffect(() => {
    globePulse.value = withRepeat(
      withTiming(1.04, {
        duration: reducedMotion ? 1600 : 2600,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [globePulse, reducedMotion]);

  useEffect(() => {
    pathOpacity.value = withTiming(pathVisible && !orbitVisible ? 1 : 0, {
      duration: reducedMotion ? 180 : 760,
      easing: Easing.out(Easing.cubic),
    });
  }, [orbitVisible, pathOpacity, pathVisible, reducedMotion]);

  useEffect(() => {
    if (!pathVisible) {
      setPathProgress(0);
      return;
    }

    let frameId = 0;
    const startedAt = Date.now();
    const duration = reducedMotion ? 520 : 1800;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(elapsed / duration, 1);
      setPathProgress(next);

      if (next < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    setPathProgress(0);
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [pathVisible, reducedMotion]);

  useEffect(() => {
    highlightOpacity.value = withTiming(highlightVisible ? 1 : 0, {
      duration: reducedMotion ? 180 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [highlightOpacity, highlightVisible, reducedMotion]);

  const globeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: globePulse.value }],
  }));

  const pathStyle = useAnimatedStyle(() => ({
    opacity: pathOpacity.value,
    transform: [{ scale: 0.98 + pathOpacity.value * 0.02 }],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
    transform: [{ scale: 0.92 + highlightOpacity.value * 0.08 }],
  }));

  const globeLines = useMemo(() => {
    const center = size / 2;
    const radius = size * 0.41;
    const verticalOffsets = [-0.45, 0, 0.45];
    const horizontalOffsets = [-0.4, 0, 0.4];

    return {
      outerRadius: radius,
      innerRadius: radius * 0.92,
      meridians: verticalOffsets.map((offset) => {
        const width = radius * (0.35 + Math.abs(offset) * 0.34);
        return Skia.XYWHRect(center - width / 2, center - radius, width, radius * 2);
      }),
      latitudes: horizontalOffsets.map((offset) => {
        const height = radius * (0.28 + Math.abs(offset) * 0.2);
        const rect = Skia.XYWHRect(center - radius, center - height / 2 + offset * radius, radius * 2, height);
        const path = Skia.Path.Make();
        path.addArc(rect, 180, 180);
        return path;
      }),
      pathCurves: [
        [
          { x: center - radius * 0.58, y: center + radius * 0.38 },
          { x: center - radius * 0.26, y: center + radius * 0.1 },
          { x: center + radius * 0.04, y: center - radius * 0.12 },
          { x: center + radius * 0.42, y: center - radius * 0.3 },
        ],
      ],
      center,
    };
  }, [size]);

  const arcLayers = useMemo<readonly HeroArcLayer[]>(
    () => [
      {
        id: 'inner-arc',
        radius: size * 0.31,
        strokeWidth: 2,
        sweepSize: 66,
        color: 'rgba(200,216,255,0.74)',
        opacity: 0.8,
        rotationDuration: 26000,
        segmentStarts: [-16, 118, 222],
      },
      {
        id: 'middle-arc',
        radius: size * 0.41,
        strokeWidth: 1.5,
        sweepSize: 42,
        color: 'rgba(95,168,123,0.56)',
        opacity: 0.72,
        rotationDuration: 34000,
        segmentStarts: [34, 168, 278],
      },
      {
        id: 'outer-arc',
        radius: size * 0.51,
        strokeWidth: 1.5,
        sweepSize: 30,
        color: 'rgba(227,160,110,0.5)',
        opacity: 0.56,
        rotationDuration: 42000,
        segmentStarts: [86, 196, 318],
      },
    ],
    [size]
  );

  const arcPaths = useMemo(() => {
    return globeLines.pathCurves.map((curve, index) => {
      const path = Skia.Path.Make();
      path.moveTo(curve[0].x, curve[0].y);
      path.cubicTo(curve[1].x, curve[1].y, curve[2].x, curve[2].y, curve[3].x, curve[3].y);
      return { id: `curve-${index}`, path };
    });
  }, [globeLines.pathCurves]);

  return (
    <View pointerEvents="none" style={[styles.shell, { height: size, width: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, globeStyle]}>
        <Canvas style={{ height: size, width: size }}>
          <Circle color="rgba(200,216,255,0.12)" cx={globeLines.center} cy={globeLines.center} r={size * 0.18}>
            <BlurMask blur={26} style="solid" />
          </Circle>
          <Circle color="rgba(106,95,232,0.12)" cx={globeLines.center} cy={globeLines.center} r={size * 0.28}>
            <BlurMask blur={42} style="solid" />
          </Circle>
          <Circle color="rgba(8,13,26,0.82)" cx={globeLines.center} cy={globeLines.center} r={globeLines.outerRadius} />
          <Circle
            color="rgba(200,216,255,0.18)"
            cx={globeLines.center}
            cy={globeLines.center}
            r={globeLines.outerRadius}
            style="stroke"
            strokeWidth={1.2}
          />
          <Circle
            color="rgba(200,216,255,0.08)"
            cx={globeLines.center}
            cy={globeLines.center}
            r={globeLines.innerRadius}
            style="stroke"
            strokeWidth={1}
          />
          {globeLines.meridians.map((rect, index) => (
            <Path
              color="rgba(200,216,255,0.1)"
              key={`meridian-${index}`}
              path={(() => {
                const path = Skia.Path.Make();
                path.addOval(rect);
                return path;
              })()}
              style="stroke"
              strokeWidth={1}
            />
          ))}
          {globeLines.latitudes.map((path, index) => (
            <Path
              color="rgba(200,216,255,0.08)"
              key={`latitude-${index}`}
              path={path}
              style="stroke"
              strokeWidth={1}
            />
          ))}
          <Line
            color="rgba(200,216,255,0.06)"
            p1={{ x: globeLines.center - globeLines.outerRadius, y: globeLines.center }}
            p2={{ x: globeLines.center + globeLines.outerRadius, y: globeLines.center }}
            strokeWidth={1}
          />
        </Canvas>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, pathStyle]}>
        <Canvas style={{ height: size, width: size }}>
          <Group>
            {arcPaths.map((arc) => (
              <Path
                color="rgba(154,200,255,0.82)"
                key={arc.id}
                path={arc.path}
                end={pathProgress}
                start={0}
                strokeCap="round"
                strokeWidth={3}
                style="stroke">
                <BlurMask blur={8} style="solid" />
              </Path>
            ))}
          </Group>
        </Canvas>
      </Animated.View>

      <Animated.View style={[styles.highlightShell, StyleSheet.absoluteFill, highlightStyle]}>
        <Canvas style={{ height: size, width: size }}>
          <Circle color="rgba(154,200,255,0.2)" cx={globeLines.center + size * 0.16} cy={globeLines.center - size * 0.08} r={size * 0.1}>
            <BlurMask blur={20} style="solid" />
          </Circle>
        </Canvas>
      </Animated.View>
      {arcLayers.map((layer) => (
        <RotatingArcLayer key={layer.id} layer={layer} size={size} />
      ))}
    </View>
  );
}

function RotatingArcLayer({ size, layer }: { size: number; layer: HeroArcLayer }) {
  const rotation = useSharedValue(0);
  const paths = useMemo(() => {
    const center = size / 2;
    const rect = Skia.XYWHRect(center - layer.radius, center - layer.radius, layer.radius * 2, layer.radius * 2);

    return layer.segmentStarts.map((segmentStart) => {
      const path = Skia.Path.Make();
      path.addArc(rect, segmentStart, layer.sweepSize);
      return path;
    });
  }, [layer.radius, layer.segmentStarts, layer.sweepSize, size]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: layer.rotationDuration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [layer.rotationDuration, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: layer.opacity,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.arcLayer, { height: size, width: size }, animatedStyle]}>
      <Canvas style={{ height: size, width: size }}>
        {paths.map((path, index) => (
          <Path
            color={layer.color}
            key={`${layer.id}-${index}`}
            path={path}
            strokeCap="round"
            strokeWidth={layer.strokeWidth}
            style="stroke"
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  highlightShell: {
    position: 'absolute',
  },
  arcLayer: {
    position: 'absolute',
  },
});
