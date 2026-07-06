import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import tileLayout from '@/data/world-tile-layout.json';
import { worldBaseSource } from '@/utils/world-visuals';

// DEV TOOL — the Tile Layout Lab: calibrate ISOMETRIC ADJACENCY offsets.
// Each base is a square image with an isometric diamond top face; a neighbor
// sits across each edge at (±w, ±h) × image size — EVERY SIDE HAS ITS OWN
// magnitudes (data/world-tile-layout.json `sides`, seeded from the calibrated
// pair 0.53/0.4). This page is ABOUT OFFSETS: pick a side, step its W/H,
// watch the seam close; the tile graphic itself is one cycle button.

const BASE_IDS = ['base_garden_main', 'base_garden_bricks', 'base_garden_cobble', 'base_garden_velvet', 'base_garden_velvet_roads', 'base_garden_nest', 'base_garden_winding', 'base_garden_brickcross', 'base_garden_diagonal', 'base_garden_plaza', 'base_garden_toy', 'base_garden_uniform', 'base_garden_grass', 'base_garden_flat', 'base_garden_wildflower', 'base_garden_simple', 'base_garden', 'base_env3', 'plot_base_1', 'plot_base_2', 'base_env2', 'base_meadow'];
const TILE_PX = 340;

type SideId = 'ne' | 'se' | 'sw' | 'nw';
type SideOffsets = Record<SideId, { w: number; h: number }>;
const SIDES: { id: SideId; label: string; sx: 1 | -1; sy: 1 | -1 }[] = [
  { id: 'ne', label: 'NE', sx: 1, sy: -1 },
  { id: 'se', label: 'SE', sx: 1, sy: 1 },
  { id: 'sw', label: 'SW', sx: -1, sy: 1 },
  { id: 'nw', label: 'NW', sx: -1, sy: -1 },
];

// Fallbacks = the CANONICAL diamond offsets (935/2048, 748/2048) — never the
// legacy hand-tuned 0.53/0.4, which pushed neighbors ~16%/9.5% too far and
// read as a wall+gap seam whenever a stale bundle missed `sides` in the JSON.
const JSON_SIDES: SideOffsets = {
  ne: { w: tileLayout.sides?.ne?.w ?? 0.4565, h: tileLayout.sides?.ne?.h ?? 0.3652 },
  se: { w: tileLayout.sides?.se?.w ?? 0.4565, h: tileLayout.sides?.se?.h ?? 0.3652 },
  sw: { w: tileLayout.sides?.sw?.w ?? 0.4565, h: tileLayout.sides?.sw?.h ?? 0.3652 },
  nw: { w: tileLayout.sides?.nw?.w ?? 0.4565, h: tileLayout.sides?.nw?.h ?? 0.3652 },
};

export default function DevTileLabScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [baseIndex, setBaseIndex] = useState(0);
  const [selectedSide, setSelectedSide] = useState<SideId>('ne');
  const [solo, setSolo] = useState(false);
  const [sides, setSides] = useState<SideOffsets>(JSON_SIDES);
  // Iso camera preview: affine transforms of the WHOLE stage — tiles and
  // offsets move together so seams stay closed at any setting.
  //   tilt  = camera elevation (scaleY): symmetric, both edge slopes = 0.8 × tilt.
  //   shear = camera orbit (skewY, expressed as a slope delta m): asymmetric —
  //           NE/SW axis slope becomes tilt × (0.8 − m), SE/NW tilt × (0.8 + m).
  //           skewY (not skewX) so verticals — walls, props — keep standing upright.
  // To bake a look, re-warp the asset to those two slopes and set JSON h per pair.
  const [tilt, setTilt] = useState(1);
  const [shear, setShear] = useState(0);

  const baseId = BASE_IDS[baseIndex];
  const source = worldBaseSource(baseId);

  const offsets = useMemo(
    () =>
      SIDES.map((side) => ({
        ...side,
        dx: side.sx * sides[side.id].w * TILE_PX,
        dy: side.sy * sides[side.id].h * TILE_PX,
      })),
    [sides]
  );

  const stepSelected = (axis: 'w' | 'h', delta: number) => {
    setSides((current) => {
      const next = Math.max(0.05, Math.min(1.2, Math.round((current[selectedSide][axis] + delta) * 1000) / 1000));
      return { ...current, [selectedSide]: { ...current[selectedSide], [axis]: next } };
    });
  };

  // Pinch + pan stage.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(0.4, Math.min(8, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      tx.value = savedTx.value + event.translationX;
      ty.value = savedTy.value + event.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
      tx.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedTx.value = 0;
      savedTy.value = 0;
    });
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const tileAt = (dx: number, dy: number) => ({
    position: 'absolute' as const,
    left: width / 2 - TILE_PX / 2 + dx,
    top: height / 2 - TILE_PX / 2 + dy,
    width: TILE_PX,
    height: TILE_PX,
  });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Tile Layout Lab', headerShown: false }} />
      <AmbientBackground colors={['#0B0D14', '#12172A', '#181D33']} showOrbs={false} />

      <GestureDetector gesture={Gesture.Exclusive(Gesture.Simultaneous(pinch, pan), doubleTap)}>
        <Animated.View style={[StyleSheet.absoluteFill, stageStyle]}>
          {/* Isometric painter's order: tiles LOWER on screen render ON TOP —
              NE/NW sit under the centre tile, SE/SW over it. Sorting the whole
              set (centre included) by screen Y gives consistent z-depth; the
              same rule applies when the real world renders multiple tiles. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scaleY: tilt }, { skewY: `${(Math.atan(shear) * 180) / Math.PI}deg` }] },
            ]}
            pointerEvents="none">
            {source
              ? [
                  { key: 'center', dx: 0, dy: 0, dim: false },
                  ...offsets
                    .filter((side) => !solo || side.id === selectedSide)
                    .map((side) => ({ key: side.id, dx: side.dx, dy: side.dy })),
                ]
                  .sort((left, right) => left.dy - right.dy)
                  .map((tile) => (
                    <Image
                      key={tile.key}
                      source={source}
                      style={tileAt(tile.dx, tile.dy)}
                      contentFit="contain"
                      pointerEvents="none"
                    />
                  ))
              : null}
          </View>
        </Animated.View>
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close the Tile Lab"
        hitSlop={10}
        onPress={() => router.back()}
        style={[styles.exitButton, { top: insets.top + 10 }]}>
        <IconSymbol name="xmark" size={15} color="#E8EEFF" />
      </Pressable>

      <View style={[styles.controls, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
        <View style={styles.controlCard}>
          {/* Side selector + solo + tile cycle — one row, offsets are the star. */}
          <View style={styles.row}>
            {SIDES.map((side) => (
              <Pressable
                key={side.id}
                onPress={() => setSelectedSide(side.id)}
                style={[styles.chip, selectedSide === side.id ? styles.chipActive : null]}>
                <ThemedText style={styles.chipLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                  {side.label}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable onPress={() => setSolo((current) => !current)} style={[styles.chip, solo ? styles.chipActive : null]}>
              <ThemedText style={styles.chipLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                solo
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setBaseIndex((current) => (current + 1) % BASE_IDS.length)} style={styles.chip}>
              <ThemedText style={styles.chipLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
                🖼 {baseId.replace('base_', '').replace('plot_base_', 'plot ')}
              </ThemedText>
            </Pressable>
          </View>

          {/* The selected side's offsets. */}
          <View style={styles.row}>
            <OffsetStepper label={`${selectedSide.toUpperCase()} W`} value={sides[selectedSide].w} onStep={(d) => stepSelected('w', d)} />
            <OffsetStepper label="H" value={sides[selectedSide].h} onStep={(d) => stepSelected('h', d)} />
            {(() => {
              // Loud when the stage deviates from the canonical JSON offsets —
              // a stepped/stale value is the usual cause of "seam gaps" reports.
              const tuned =
                SIDES.some(
                  (side) =>
                    Math.abs(sides[side.id].w - JSON_SIDES[side.id].w) > 0.0005 ||
                    Math.abs(sides[side.id].h - JSON_SIDES[side.id].h) > 0.0005
                ) ||
                tilt !== 1 ||
                shear !== 0;
              return (
                <Pressable
                  onPress={() => {
                    setSides(JSON_SIDES);
                    setTilt(1);
                    setShear(0);
                  }}
                  style={[styles.chip, tuned ? styles.chipWarn : null]}>
                  <ThemedText
                    style={styles.chipLabel}
                    lightColor={tuned ? '#FFC36B' : '#E8EEFF'}
                    darkColor={tuned ? '#FFC36B' : '#E8EEFF'}>
                    {tuned ? '⚠ tuned — reset' : 'reset'}
                  </ThemedText>
                </Pressable>
              );
            })()}
          </View>

          {/* Iso camera preview — tilt + shear on the whole stage; slopes shown for the 0.8-native uniform tile. */}
          <View style={styles.row}>
            <OffsetStepper
              label="TILT"
              value={tilt}
              step={0.025}
              bigStep={0.1}
              onStep={(d) => setTilt((current) => Math.max(0.4, Math.min(1.5, Math.round((current + d) * 1000) / 1000)))}
            />
            <OffsetStepper
              label="SHEAR"
              value={shear}
              step={0.025}
              bigStep={0.1}
              onStep={(d) => setShear((current) => Math.max(-0.5, Math.min(0.5, Math.round((current + d) * 1000) / 1000)))}
            />
            <ThemedText style={styles.readout} lightColor="#8C96B8" darkColor="#8C96B8">
              ↗ {(tilt * (0.8 - shear)).toFixed(2)} · ↘ {(tilt * (0.8 + shear)).toFixed(2)}
            </ThemedText>
          </View>

          {/* All four sides at a glance — paste back into world-tile-layout.json. */}
          <ThemedText style={styles.readout} lightColor="#8C96B8" darkColor="#8C96B8">
            {SIDES.map((side) => `${side.label} ${sides[side.id].w.toFixed(3)}/${sides[side.id].h.toFixed(3)}`).join('  ·  ')}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

// −/＋ stepper: tap = ±step, long-press = ±bigStep.
function OffsetStepper({
  label,
  value,
  onStep,
  step = 0.005,
  bigStep = 0.025,
}: {
  label: string;
  value: number;
  onStep: (delta: number) => void;
  step?: number;
  bigStep?: number;
}) {
  return (
    <View style={styles.stepper}>
      <ThemedText style={styles.stepperLabel} lightColor="#8C96B8" darkColor="#8C96B8">
        {label}
      </ThemedText>
      <Pressable hitSlop={6} onPress={() => onStep(-step)} onLongPress={() => onStep(-bigStep)} style={styles.stepperBtn}>
        <ThemedText style={styles.chipLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
          −
        </ThemedText>
      </Pressable>
      <ThemedText style={styles.stepperValue} lightColor="#FFC36B" darkColor="#FFC36B">
        {value.toFixed(3)}
      </ThemedText>
      <Pressable hitSlop={6} onPress={() => onStep(step)} onLongPress={() => onStep(bigStep)} style={styles.stepperBtn}>
        <ThemedText style={styles.chipLabel} lightColor="#E8EEFF" darkColor="#E8EEFF">
          ＋
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B0D14', flex: 1 },
  exitButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(216,228,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 34,
    zIndex: 20,
  },
  controls: { left: 12, position: 'absolute', right: 12 },
  controlCard: {
    backgroundColor: 'rgba(11,13,20,0.92)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: 'rgba(255,195,107,0.2)', borderColor: '#FFC36B' },
  chipWarn: { backgroundColor: 'rgba(255,195,107,0.14)', borderColor: '#FFC36B', borderStyle: 'dashed' },
  chipLabel: { fontSize: 11.5, fontWeight: '800' },
  readout: { fontSize: 10.5, fontWeight: '600' },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  stepperLabel: { fontSize: 10.5, fontWeight: '800' },
  stepperBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepperValue: { fontSize: 11.5, fontWeight: '800', minWidth: 40, textAlign: 'center' },
});
