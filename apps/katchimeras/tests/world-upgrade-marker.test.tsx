import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
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
test('both tutorial marker spotlight targets enclose the full badge at every zoom and pulse', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness();
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-marker.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', AccessibilityInfo: {}, findNodeHandle: () => null },
    'react-native-reanimated': { ...motion.animated, withSpring: () => 1, withRepeat: () => 1 },
    'expo-image': { Image: 'Image' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'ProgressBar' },
    '@/features/world-upgrades/world-upgrade-stories': { upgradePercent: () => 100 },
    '@incubator/art-world/ui/upgrade-toy-v1.png': 1,
    '@incubator/art-world/ui/clear-mist-toy-v1.png': 2,
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
    assert.equal(tree!.root.findByType(host('Pressable')).props.style.width, 68);
    await act(async () => tree!.update(<Marker {...props} hidden />));
    assert.equal(registrations.at(-1), null);
    await act(async () => tree!.unmount());
  }
});
