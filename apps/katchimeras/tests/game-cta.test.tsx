import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { roundedBorderGradient, roundedBorderPoint } from '@/utils/rounded-border-track';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('border travels equal distances on straight edges and round corners, including wide CTAs', () => {
  for (const [width, height, radius] of [[380, 58, 20], [150, 58, 17], [58, 58, 29]]) {
    const perimeter = 2 * (width + height - 4 * radius) + 2 * Math.PI * radius;
    const samples = Math.ceil(perimeter * 2);
    const step = perimeter / samples;
    let previous = roundedBorderPoint(width, height, radius, 0);
    for (let index = 1; index <= samples; index++) {
      const next = roundedBorderPoint(width, height, radius, index / samples);
      const travelled = Math.hypot(next.x - previous.x, next.y - previous.y);
      assert.ok(Math.abs(travelled - step) < 0.0001, `uneven travel at ${width}×${height}, sample ${index}`);
      previous = next;
    }
  }
});

test('gradient head and falloff track the perimeter without reversing or flashing at the seam', () => {
  const stops = [0, 0.27, 0.37, 0.45, 0.5, 0.55, 0.63, 0.73, 1];
  for (const progress of [0, 0.1, 0.249, 0.5, 0.87, 0.99999, 1]) {
    const { positions, rotation } = roundedBorderGradient(380, 58, 20, progress, stops);
    assert.equal(positions[0], 0);
    assert.equal(positions.at(-1), 1);
    for (let index = 1; index < positions.length; index++) assert.ok(positions[index] > positions[index - 1]);
    stops.forEach((stop, index) => {
      const expected = roundedBorderPoint(380, 58, 20, progress + stop);
      const angle = rotation + positions[index] * Math.PI * 2;
      const actualAngle = Math.atan2(expected.y - 29, expected.x - 190);
      assert.ok(Math.abs(Math.sin(angle) - Math.sin(actualAngle)) < 1e-10);
      assert.ok(Math.abs(Math.cos(angle) - Math.cos(actualAngle)) < 1e-10);
    });
  }
  assert.deepEqual(roundedBorderGradient(380, 58, 20, 0, stops), roundedBorderGradient(380, 58, 20, 1, stops));
});

test('CTA border stops in background, resumes in foreground, and stays still with reduced motion', async () => {
  let foreground = true;
  let reducedMotion = false;
  let started = 0;
  let cancelled = 0;
  const module = loadNativeModule('components/katchadeck/ui/animated-border-highlight.tsx', {
    'react-native': nativeViews,
    '@shopify/react-native-skia': {
      Canvas: 'Canvas', Group: 'Group', RoundedRect: 'RoundedRect',
      SweepGradient: 'SweepGradient', BlurMask: 'BlurMask', vec: (x: number, y: number) => ({ x, y }),
    },
    '@/hooks/use-app-foreground': { useAppForeground: () => foreground },
    'react-native-reanimated': {
      useReducedMotion: () => reducedMotion,
      useSharedValue: (initial: number) => React.useRef({ value: initial }).current,
      useDerivedValue: (read: () => unknown) => ({ read }),
      useAnimatedReaction: () => {},
      Easing: { linear: (value: number) => value },
      withTiming: (value: number) => value,
      withRepeat: (value: number) => { started++; return value; },
      cancelAnimation: () => { cancelled++; },
    },
  });
  const Highlight = module.AnimatedBorderHighlight as React.ComponentType<{ borderRadius: number }>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Highlight borderRadius={20} />); });
  assert.equal(started, 1);
  foreground = false;
  await act(async () => tree!.update(<Highlight borderRadius={20} />));
  assert.equal(started, 1, 'background rendering never starts another orbit');
  assert.equal(cancelled, 1, 'the foreground orbit is cancelled');
  foreground = true;
  await act(async () => tree!.update(<Highlight borderRadius={20} />));
  assert.equal(started, 2);
  reducedMotion = true;
  await act(async () => tree!.update(<Highlight borderRadius={20} />));
  assert.equal(started, 2, 'reduced motion keeps a static highlight');
  const beforeUnmount = cancelled;
  await act(async () => tree!.unmount());
  assert.equal(cancelled, beforeUnmount + 1);
});

test('quest CTA delegates state and callbacks to the same game button', async () => {
  const module = loadNativeModule('components/katchadeck/world/quests/quest-experience-ui.tsx', {
    'react-native': nativeViews,
    'expo-image': { Image: 'Image' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/constants/katcha-ui': { KatchaUI: { type: {} } },
    '@/constants/theme': { Lantern: {} },
  });
  const Action = module.ExperienceAction as React.ComponentType<Record<string, unknown>>;
  const host = 'Button' as unknown as React.ComponentType;
  let pressed = 0;
  const onPress = () => { pressed++; };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Action label="Complete and return" disabled onPress={onPress} />); });
  assert.equal(tree!.root.findByType(host).props.disabled, true);
  await act(async () => tree!.update(<Action label="Complete and return" onPress={onPress} />));
  assert.equal(tree!.root.findByType(host).props.variant, 'primary');
  await act(async () => tree!.root.findByType(host).props.onPress());
  assert.equal(pressed, 1);
  await act(async () => tree!.update(<Action label="Back to quest" quiet onPress={onPress} />));
  assert.equal(tree!.root.findByType(host).props.variant, 'tertiary');
  await act(async () => tree!.unmount());
});
