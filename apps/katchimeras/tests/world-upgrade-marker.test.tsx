import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { readFileSync } from './helpers/content-fs';
import { upgradeUsesTutorialNarrative } from '@/features/world-upgrades/world-upgrade-stories';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { GLOW_DISCOVERY_FLOW } from '@/features/onboarding/glow-discovery-flow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('only the two first tutorial clearings bypass the upgrade narrative', () => {
  assert.equal(upgradeUsesTutorialNarrative('haven:mossprout', 1, MOSSPROUT_FTUE_FLOW.id), true);
  assert.equal(upgradeUsesTutorialNarrative('mist:steppling-home', 1, GLOW_DISCOVERY_FLOW.id), true);
  assert.equal(upgradeUsesTutorialNarrative('haven:mossprout', 1, 'world-upgrade:haven:mossprout:1'), false);
  assert.equal(upgradeUsesTutorialNarrative('mist:steppling-home', 1, 'world-upgrade:mist:steppling-home:1'), false);
  assert.equal(upgradeUsesTutorialNarrative('nature:pond-sanctuary', 1, GLOW_DISCOVERY_FLOW.id), false);
  assert.equal(upgradeUsesTutorialNarrative('haven:mossprout', 2, MOSSPROUT_FTUE_FLOW.id), false);
});
const bubbleScaleOf = (nodes: { props: { style?: unknown } }[]) => {
  const bubble = nodes.find((node) => Array.isArray(node.props.style) && (node.props.style as { backgroundColor?: string }[])[0]?.backgroundColor)!;
  const styles = bubble.props.style as { read?: () => { transform: { scale: number }[] } }[];
  return styles.at(-1)!.read!().transform[0].scale;
};
test('both tutorial marker spotlight targets enclose the full badge at every zoom and pulse', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-marker.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', AccessibilityInfo: {}, findNodeHandle: () => null },
    'react-native-reanimated': { ...motion.animated, withSpring: () => 1, withRepeat: () => 1 },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/features/world-upgrades/world-upgrade-stories': { upgradePercent: () => 100 },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
    '@/game/days/visuals': { getCreatureVisual: () => null },
    '@incubator/art-world/ui/upgrade-toy-v1.png': 1,
    '@incubator/art-world/ui/clear-mist-toy-v1.png': 2,
    '@incubator/art-cutouts/egg-base.webp': 3,
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'RotatingRadialSunburst' },
  });
  const Marker = module.WorldUpgradeMarker as React.ComponentType<Record<string, unknown>>;
  for (const id of ['haven:mossprout', 'mist:steppling-home']) {
    const cameraScale = { value: 1 }; const proxyNode = { name: 'visual envelope' }; const buttonNode = { name: 'button' };
    const registrations: unknown[] = [];
    const props = { offer: { id, action: id.startsWith('mist') ? 'Clear mist' : 'Restore', cost: 40, missingGlow: 0, affordable: true },
      frame: { left: 100, top: 100, width: 600, height: 500 }, cameraScale, cameraX: { value: 0 }, cameraY: { value: 0 },
      sceneWidth: 1000, sceneHeight: 1000, moving: false, onPress() {}, onTargetChange: (_id: string, node: unknown) => registrations.push(node) };
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Marker {...props} />, { createNodeMock: (element) => element.type === 'Pressable' ? buttonNode : proxyNode }); });
    const animated = tree!.root.findAllByType(host('AnimatedView'));
    const proxy = animated.find((node) => node.props.collapsable === false)!;
    const bubble = animated.find((node) => node.props.style[0].backgroundColor)!;
    await act(async () => bubble.props.onLayout({ nativeEvent: { layout: { height: 88 } } }));
    assert.equal(registrations.at(-1), proxyNode, 'FTUE measures the painted badge, not the fixed tap target');
    for (const zoom of [0.5, 1, 3]) {
      cameraScale.value = zoom;
      const bounds = proxy.props.style[1].read();
      const peakScale = 600 * 0.15 / 68 * zoom * 1.045;
      assert.ok(bounds.left <= 34 - 34 * peakScale);
      assert.ok(bounds.left + bounds.width >= 34 + 34 * peakScale);
      assert.ok(bounds.top <= 34 - (44 + 10) * peakScale, 'tail and rim remain in the spotlight');
      assert.ok(bounds.top + bounds.height >= 34 + (44 + 4) * peakScale, 'percentage and shadow remain in the spotlight');
    }
    await act(async () => proxy.props.onLayout());
    assert.equal(registrations.at(-2), null); assert.equal(registrations.at(-1), proxyNode, 'layout changes invalidate cached spotlight measurements');
    const pressable = tree!.root.findByType(host('Pressable'));
    assert.equal(pressable.props.style[0].width, 68);
    // The press target follows the painted bubble, never smaller than its 68pt floor.
    for (const zoom of [0.5, 1, 3]) {
      cameraScale.value = zoom;
      const visual = 600 * 0.15 / 68 * zoom;
      const hit = pressable.props.style[1].read().transform[0].scale;
      const bubble = bubbleScaleOf(tree!.root.findAllByType(host('AnimatedView')));
      assert.equal(hit, Math.max(1, visual), `zoom ${zoom}: hit target scale`);
      assert.ok(Math.abs(hit * bubble - visual) < 1e-9, `zoom ${zoom}: painted size unchanged`);
    }
    assert.equal(pressable.props.hitSlop, 6);
    await act(async () => tree!.update(<Marker {...props} hidden />));
    assert.equal(registrations.at(-1), null);
    await act(async () => tree!.unmount());
  }
});

test('a tap on a marker is never disabled by its own touch: the camera reads moving only once a pan activates, and a non-pan touch settles', () => {
  const camera = readFileSync(require.resolve('@incubator/environments/hex-camera'), 'utf8');
  const pan = camera.slice(camera.indexOf('Gesture.Pan()'), camera.indexOf('Gesture.Pinch()'));
  const onBegin = pan.slice(pan.indexOf('.onBegin('), pan.indexOf('.onStart('));
  assert.doesNotMatch(onBegin, /beginMotion/, 'touch down must not flip isMoving; the marker Pressable is disabled by it');
  assert.match(onBegin, /panActivated\.value = false/);
  assert.match(pan, /\.onStart\(\(\) => \{\s*panActivated\.value = true;\s*runOnJS\(beginMotion\)\(\);/);
  assert.match(pan, /\.onFinalize\(\(\) => \{[\s\S]*?if \(panActivated\.value\) return;\s*runOnJS\(commitSnapshot\)\(tx\.value, ty\.value, scale\.value, false\);/);
  const marker = readFileSync('components/katchadeck/world/world-upgrade-marker.tsx', 'utf8');
  assert.match(marker, /disabled=\{moving \|\| hidden \|\| inert\}/, 'the marker still yields while the camera is really moving');
});

test('an inert marker is visible but cannot be opened and does not pulse', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness();
  let repeats = 0;
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-marker.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', AccessibilityInfo: {}, findNodeHandle: () => null },
    'react-native-reanimated': { ...motion.animated, withSpring: () => 1, withRepeat: () => { repeats++; return 1; } },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/features/world-upgrades/world-upgrade-stories': { upgradePercent: () => 0 },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
    '@/game/days/visuals': { getCreatureVisual: () => null },
    '@incubator/art-world/ui/upgrade-toy-v1.png': 1,
    '@incubator/art-world/ui/clear-mist-toy-v1.png': 2,
    '@incubator/art-cutouts/egg-base.webp': 3,
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'RotatingRadialSunburst' },
    '@incubator/art-world/hex/kingdom_dream_mist_lock_v1_512.webp': 3,
  });
  const Marker = module.WorldUpgradeMarker as React.ComponentType<Record<string, unknown>>;
  const props = { offer: { id: 'nature:pond-sanctuary', action: 'Restore', cost: 40, missingGlow: 40, affordable: true, eligible: true, name: 'Pond Sanctuary' },
    frame: { left: 100, top: 100, width: 600, height: 500 }, cameraScale: { value: 1 }, cameraX: { value: 0 }, cameraY: { value: 0 },
    sceneWidth: 1000, sceneHeight: 1000, moving: false, onPress() {} };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Marker {...props} inert />); });
  const pressable = tree!.root.findByType(host('Pressable'));
  assert.equal(pressable.props.disabled, true);
  assert.equal(pressable.props.accessibilityState.disabled, true);
  assert.equal(repeats, 0, 'no pulse while inert');
  assert.ok(pressable.props.style[1].read().opacity < 1, 'dimmed');
  await act(async () => { tree!.update(<Marker {...props} />); });
  assert.equal(tree!.root.findByType(host('Pressable')).props.disabled, false);
  assert.ok(repeats > 0, 'pulses once it is the player’s business');
  await act(async () => { tree!.unmount(); });
});

test('a hatchable tile’s marker is a silhouette Egg: still and dim asleep, rays turning while saving, warm and quick when the light is enough', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness();
  let repeats = 0;
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-marker.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', AccessibilityInfo: {}, findNodeHandle: () => null },
    'react-native-reanimated': { ...motion.animated, withSpring: () => 1, withRepeat: () => { repeats++; return 1; } },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/features/world-upgrades/world-upgrade-stories': { upgradePercent: () => 50 },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
    '@/game/days/visuals': { getCreatureVisual: () => null },
    '@incubator/art-world/ui/upgrade-toy-v1.png': 1,
    '@incubator/art-world/ui/clear-mist-toy-v1.png': 2,
    '@incubator/art-cutouts/egg-base.webp': 3,
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'RotatingRadialSunburst' },
    '@incubator/art-world/hex/kingdom_dream_mist_lock_v1_512.webp': 4,
  });
  const Marker = module.WorldUpgradeMarker as React.ComponentType<Record<string, unknown>>;
  const base = { id: 'mist:baristabbit-home', action: 'Clear mist', cost: 60, name: 'A lit window' };
  const frame = { frame: { left: 100, top: 100, width: 600, height: 500 }, cameraScale: { value: 1 }, cameraX: { value: 0 }, cameraY: { value: 0 }, sceneWidth: 1000, sceneHeight: 1000, moving: false, onPress() {} };
  const hatchable = (state: 'sleeping' | 'saving' | 'ready') => ({ companion: 'baristabbit', state, sleepingLine: 'The Mist still holds this one.' });
  let tree: ReactTestRenderer;
  // Asleep: no rays, no bar, the silhouette dim, the tile's own line as the hint, and no pulse.
  await act(async () => { tree = create(<Marker {...frame} offer={{ ...base, missingGlow: 60, affordable: false, eligible: false, lockedReason: 'The Mist still holds this one.', lockedLabel: 'Held', hatchable: hatchable('sleeping') }} />); });
  assert.equal(tree!.root.findAllByType(host('RotatingRadialSunburst')).length, 0, 'no rays while asleep');
  assert.equal(tree!.root.findAllByType(host('ProgressBar')).length, 0, 'no bar while asleep');
  const asleep = tree!.root.findByType(host('Pressable'));
  assert.match(asleep.props.accessibilityLabel, /still under the Mist/);
  assert.equal(asleep.props.accessibilityHint, 'The Mist still holds this one.');
  assert.equal(repeats, 0, 'no pulse while asleep');
  const eggs = tree!.root.findAllByType(host('Image')).filter((node) => node.props.source === 3);
  assert.equal(eggs.length, 1, 'the silhouette is the egg art, tinted');
  assert.ok((eggs[0]!.props.style as { tintColor?: string }[]).some((style) => style?.tintColor), 'a silhouette, not the egg');
  // Saving: rays turn slowly, the bar shows the light so far.
  await act(async () => { tree!.update(<Marker {...frame} offer={{ ...base, missingGlow: 30, affordable: false, eligible: true, hatchable: hatchable('saving') }} />); });
  const slow = tree!.root.findByType(host('RotatingRadialSunburst'));
  assert.equal(slow.props.rotationDurationMs, 26_000);
  assert.equal(tree!.root.findAllByType(host('ProgressBar')).length, 1);
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityValue.text, '30 of 60 Glow');
  assert.equal(repeats, 0, 'no pulse until the light is enough');
  // Ready: the rays quicken, the silhouette warms, and the marker pulses like any affordable upgrade.
  await act(async () => { tree!.update(<Marker {...frame} offer={{ ...base, missingGlow: 0, affordable: true, eligible: true, hatchable: hatchable('ready') }} />); });
  assert.equal(tree!.root.findByType(host('RotatingRadialSunburst')).props.rotationDurationMs, 11_000);
  const warm = tree!.root.findAllByType(host('Image')).find((node) => node.props.source === 3)!;
  assert.ok((warm.props.style as { tintColor?: string }[]).some((style) => style?.tintColor === '#F2B457'), 'warm from inside');
  assert.ok(repeats > 0, 'pulses once affordable');
  // The rays stop when the marker moves or is hidden: nothing turns off-screen.
  await act(async () => { tree!.update(<Marker {...frame} moving offer={{ ...base, missingGlow: 0, affordable: true, eligible: true, hatchable: hatchable('ready') }} />); });
  assert.equal(tree!.root.findByType(host('RotatingRadialSunburst')).props.active, false);
  const source = readFileSync('components/katchadeck/world/world-upgrade-marker.tsx', 'utf8');
  assert.doesNotMatch(source.slice(source.indexOf('function HatchableEggFace'), source.indexOf('const styles')), /boxShadow|shadow/, 'no shadows on the Egg face');
});
