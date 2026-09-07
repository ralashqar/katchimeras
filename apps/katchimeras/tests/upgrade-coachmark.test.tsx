import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('coachmark uses overlay-local coordinates and measured bubble height without blocking the target', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const motion = nativeMotionHarness(); const frames: (() => void)[] = [];
  const module = loadNativeModule('components/katchadeck/onboarding/companion-ftue-coachmark.tsx', {
    'react-native': nativeViews,
    'react-native-reanimated': { ...motion.animated, FadeOut: motion.animated.FadeIn },
    'expo-image': { Image: 'Image' },
    '@incubator/presentation/spotlight': { Spotlight: 'Spotlight' },
    '@incubator/game-ui/speech-tooltip': { SpeechTooltip: 'Tooltip' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/utils/speech-text': { normalizeSpeechText: (text: string) => text },
    '@/components/katchadeck/egg-avatar/egg-avatar': { EggAvatar: 'Egg' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/constants/theme': { KatchaDeckUI: { typography: { ftueHeroTitle: {} } } },
    '@/features/egg-avatar/egg-avatar-provider': { useEggAvatar: () => ({ equippedFaceId: 'gentle-smile', equippedSkinId: 'base' }) },
    '@incubator/art-merge-world/ui/ftue-hand.webp': 1,
  }, { setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: (fn: () => void) => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {} });
  const Coach = module.CompanionFtueCoachmark as React.ComponentType<Record<string, unknown>>;
  let targetY = 600;
  const targetRef = { current: { measureInWindow: (fn: Function) => fn(50, targetY, 260, 64) } };
  const props = { targetRef, placement: 'above', message: [{ text: 'Use 40 Glow to clear this mist.' }] };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Coach {...props} />, { createNodeMock: () => ({ measureInWindow: (fn: Function) => fn(10, 40, 390, 740) }) }); });
  await act(async () => frames.splice(0).forEach((fn) => fn()));
  const spotlight = () => tree!.root.findByType(host('Spotlight'));
  const tooltip = () => tree!.root.findByType(host('Tooltip'));
  assert.equal(spotlight().props.focus.x, 33); assert.equal(spotlight().props.focus.y, 553);
  assert.equal(spotlight().props.screen.height, 740);
  assert.equal(tooltip().props.top, 443);
  await act(async () => tooltip().props.onLayout({ nativeEvent: { layout: { height: 150 } } }));
  assert.equal(tooltip().props.top, 389, 'wrapped text stays above the upgrade button');
  assert.equal(tooltip().props.interactive, false);
  const root = tree!.root.findAllByType(host('AnimatedView')).find((node) => node.props.collapsable === false)!;
  assert.equal(root.props.pointerEvents, 'box-none', 'upgrade button remains tappable through the guide');
  targetY = 500;
  await act(async () => tree!.update(<Coach {...props} targetRevision={1} />));
  await act(async () => frames.splice(0).forEach((fn) => fn()));
  assert.equal(spotlight().props.focus.y, 453); assert.equal(tooltip().props.top, 289);
  await act(async () => tree!.unmount());
});
