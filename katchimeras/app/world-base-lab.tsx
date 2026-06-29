import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import {
  BASE_OBJECT_FRAC,
  getBaseLayout,
  type BaseAnchor,
  type BaseSlot,
} from '@/utils/world-base-layout';
import { worldAssetSource, worldBaseSource } from '@/utils/world-visuals';

// DEV TOOL — author the normalised POI anchors for an image-base world patch.
// Renders the real base PNG + a representative real sprite per slot, each
// draggable. Drag a sprite so its base (the ring handle) seats where it should
// live on the island, then "Dump anchors" prints a calibrated DEFAULT_ANCHORS
// block to paste into utils/world-base-layout.ts. Reachable from the Dev tab.

// The object's bottom pixel sits this far down its 1:2 frame (matches OBJECT_BOTTOM_FRAC
// in world-canvas) — so the sprite seats its feet on the anchor point.
const OBJECT_BOTTOM_FRAC = 0.96;

// A real, existing world asset to stand in for each slot while authoring.
const REP_ASSET: Record<BaseSlot, string> = {
  memory: 'memory_tree_3',
  notes: 'notes_journal_2',
  journey: 'active_bridge',
  places: 'exploration_tower',
  sleep: 'sleep_good',
  food: 'food_stall',
  reflection: 'calm_pond',
  egg: 'meaningful_crystal',
  landmark_1: 'landmark_festival',
  landmark_2: 'landmark_arch',
  landmark_3: 'landmark_gate',
};

function clampUnit(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

type DotProps = {
  anchor: BaseAnchor;
  boxW: number;
  boxH: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, nx: number, ny: number) => void;
};

function AnchorDot({ anchor, boxW, boxH, selected, onSelect, onChange }: DotProps) {
  const source = worldAssetSource(REP_ASSET[anchor.id as BaseSlot]);
  // Seat point in px within the fitted base box.
  const x = useSharedValue(anchor.nx * boxW);
  const y = useSharedValue(anchor.ny * boxH);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(onSelect)(anchor.id);
    })
    .onUpdate((e) => {
      x.value = clampUnit((startX.value + e.translationX) / boxW) * boxW;
      y.value = clampUnit((startY.value + e.translationY) / boxH) * boxH;
      runOnJS(onChange)(anchor.id, x.value / boxW, y.value / boxH);
    });

  const seatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  // Object footprint width on the fitted base.
  const w = boxW * BASE_OBJECT_FRAC * anchor.scale;
  const h = w * 2;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.seat, seatStyle]}>
        {/* Sprite, bottom-snapped so its feet land on the seat point. */}
        {source ? (
          <Image
            source={source}
            pointerEvents="none"
            contentFit="contain"
            style={{ position: 'absolute', width: w, height: h, left: -w / 2, top: -OBJECT_BOTTOM_FRAC * h, opacity: selected ? 1 : 0.92 }}
          />
        ) : null}
        {/* Seat handle — the point that rides the ground. */}
        <View style={[styles.handle, selected ? styles.handleSelected : null]} />
        <View style={styles.dotLabelWrap} pointerEvents="none">
          <Text style={styles.dotLabel}>{anchor.id}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function WorldBaseLabScreen() {
  const baseId = 'base_meadow';
  const layout = useMemo(() => getBaseLayout(baseId), [baseId]);
  const baseSource = worldBaseSource(baseId);

  const [anchors, setAnchors] = useState<Record<string, BaseAnchor>>(() => ({ ...layout.anchors }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [dump, setDump] = useState<string | null>(null);

  const onBaseLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setBox({ w: width, h: width / layout.aspect });
  };

  const handleChange = (id: string, nx: number, ny: number) => {
    setAnchors((prev) => ({ ...prev, [id]: { ...prev[id], nx, ny } }));
  };
  const adjust = (key: 'scale' | 'z', delta: number) => {
    if (!selectedId) return;
    setAnchors((prev) => {
      const a = prev[selectedId];
      const next = key === 'scale' ? Math.max(0.3, Math.round((a.scale + delta) * 100) / 100) : Math.max(0, a.z + delta);
      return { ...prev, [selectedId]: { ...a, [key]: next } };
    });
  };

  const buildDump = () => {
    const lines = Object.values(anchors)
      .map(
        (a) =>
          `  ${a.id}: { id: '${a.id}', nx: ${a.nx.toFixed(3)}, ny: ${a.ny.toFixed(3)}, scale: ${a.scale.toFixed(2)}, z: ${a.z} },`
      )
      .join('\n');
    const text = `const DEFAULT_ANCHORS: Record<BaseSlot, BaseAnchor> = {\n${lines}\n};`;
    // eslint-disable-next-line no-console
    console.log('\n' + text + '\n');
    setDump(text);
  };

  const sel = selectedId ? anchors[selectedId] : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'World Base Lab' }} />
      <AmbientBackground
        accentColor="rgba(125,232,205,0.14)"
        colors={['#090B12', '#10192A', '#171E34']}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <ThemedText type="label" style={styles.kicker} lightColor="#7DE8CD" darkColor="#7DE8CD">
          Dev tool · {baseId}
        </ThemedText>
        <ThemedText type="bodyLarge" style={styles.body} lightColor="#DCE6FF" darkColor="#DCE6FF">
          Drag each POI so its base ring seats on the island. Then "Dump anchors" → paste into
          utils/world-base-layout.ts.
        </ThemedText>

        {/* The base + draggable anchors. */}
        <View style={styles.stageWrap}>
          <View style={[styles.stage, { height: box.h || undefined, aspectRatio: box.h ? undefined : layout.aspect }]} onLayout={onBaseLayout}>
            {baseSource ? (
              <Image source={baseSource} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
            ) : (
              <View style={styles.missing}>
                <Text style={styles.missingText}>base_meadow.png missing — run scripts/generate-world-base.py</Text>
              </View>
            )}
            {box.w > 0 &&
              Object.values(anchors).map((a) => (
                <AnchorDot
                  key={a.id}
                  anchor={a}
                  boxW={box.w}
                  boxH={box.h}
                  selected={selectedId === a.id}
                  onSelect={setSelectedId}
                  onChange={handleChange}
                />
              ))}
          </View>
        </View>

        {/* Selected anchor controls. */}
        <View style={styles.panel}>
          {sel ? (
            <>
              <Text style={styles.panelTitle}>
                {sel.id} — nx {sel.nx.toFixed(3)} · ny {sel.ny.toFixed(3)}
              </Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>scale {sel.scale.toFixed(2)}</Text>
                <Pressable style={styles.btn} onPress={() => adjust('scale', -0.05)}>
                  <Text style={styles.btnText}>−</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => adjust('scale', 0.05)}>
                  <Text style={styles.btnText}>+</Text>
                </Pressable>
                <Text style={[styles.rowLabel, { marginLeft: 16 }]}>z {sel.z}</Text>
                <Pressable style={styles.btn} onPress={() => adjust('z', -1)}>
                  <Text style={styles.btnText}>−</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => adjust('z', 1)}>
                  <Text style={styles.btnText}>+</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.panelHint}>Tap a POI to select it.</Text>
          )}
          <Pressable style={styles.dumpBtn} onPress={buildDump}>
            <Text style={styles.dumpBtnText}>Dump anchors → console + below</Text>
          </Pressable>
        </View>

        {dump ? (
          <View style={styles.dumpBox}>
            <Text selectable style={styles.dumpText}>
              {dump}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  content: { padding: 20, paddingBottom: 80 },
  kicker: { marginTop: 8 },
  body: { marginTop: 6, marginBottom: 14 },
  stageWrap: { borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(8,10,18,0.5)' },
  stage: { width: '100%', position: 'relative' },
  missing: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 20 },
  missingText: { color: '#FFB4B4', textAlign: 'center', fontSize: 13 },
  // A zero-size node positioned at the seat point; children are absolute around it.
  seat: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  handle: {
    position: 'absolute',
    left: -7,
    top: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(125,232,205,0.5)',
    borderWidth: 2,
    borderColor: '#0A0E16',
  },
  handleSelected: { backgroundColor: '#FFC36B', borderColor: '#fff' },
  dotLabelWrap: { position: 'absolute', left: 10, top: -10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(8,10,18,0.78)' },
  dotLabel: { color: '#DCE6FF', fontSize: 9, fontWeight: '700' },
  panel: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: 'rgba(20,17,31,0.6)', borderWidth: 1, borderColor: 'rgba(125,232,205,0.25)' },
  panelTitle: { color: '#F8FBFF', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  panelHint: { color: '#9FB0CC', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { color: '#DCE6FF', fontSize: 13, fontWeight: '700', marginRight: 8 },
  btn: { width: 34, height: 34, borderRadius: 10, marginRight: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(125,232,205,0.16)' },
  btnText: { color: '#7DE8CD', fontSize: 20, fontWeight: '800' },
  dumpBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,195,107,0.18)' },
  dumpBtnText: { color: '#FFC36B', fontSize: 14, fontWeight: '800' },
  dumpBox: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: 'rgba(8,10,18,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dumpText: { color: '#CFE6DD', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
});
