import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createEggHapticSequence, type EggHapticCue } from '@/utils/egg-haptic-sequence';
import { HATCH_PHASE_DELAYS_MS, REDUCED_HATCH_PHASE_DELAYS_MS } from '@/utils/hatch-reveal-timing';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const reduced of [false, true]) test(`reward pack artwork persists from sealed to the shared hatch sequence (reduced: ${reduced})`, async context => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const motion = nativeMotionHarness();
  const impacts: EggHapticCue[] = [];
  let rattleStarts = 0;
  const module = loadNativeModule('components/katchadeck/wisps/wisp-pack-anticipation.tsx', {
    'react-native': nativeViews,
    'expo-image': { Image: 'Image' },
    'react-native-reanimated': { ...motion.animated, useReducedMotion: () => reduced },
    '@/components/katchadeck/ui/egg-hatch-motion': {
      eggHatchRattle: () => { rattleStarts++; return 1; }, eggHatchPulse: () => 1,
      EGG_HATCH_SHAKE_X: 7, EGG_HATCH_SHAKE_ROTATION: 5.6,
    },
    '@/features/today/egg-haptics': { createEggHatchHaptics: (quick: boolean) => createEggHapticSequence(cue => impacts.push(cue), quick) },
    '@/components/katchadeck/ui/radial-sunburst': { RotatingRadialSunburst: 'Rays' },
    '@/constants/wisp-card-art': { WISP_CARD_ART: { pack: 'pack' } },
    './wisp-pack-handoff': { WISP_PACK_HANDOFF_MS: 150, WISP_PACK_HANDOFF_SCALE: 0.72 },
  });
  let completed = 0;
  let renderer!: ReactTestRenderer;
  const Component = module.WispPackAnticipation as React.ComponentType<{ opening: boolean; onDone: () => void }>;
  const done = () => completed++;
  await act(async () => { renderer = create(<Component opening={false} onDone={done} />); });
  const sealedImage = renderer.root.findByType('Image' as any);
  const sealedStage = renderer.root.findByProps({ accessibilityLabel: 'Sealed Wisp card pack' }).props.style;
  await act(async () => { context.mock.timers.tick(2000); });
  assert.deepEqual(impacts, []);
  assert.equal(completed, 0);
  await act(async () => renderer.update(<Component opening onDone={done} />));
  assert.equal(renderer.root.findByType('Image' as any), sealedImage, 'the pack artwork stays mounted');
  assert.deepEqual(renderer.root.findByProps({ accessibilityLabel: 'Opening Wisp card pack' }).props.style, sealedStage, 'opening does not change layout');
  const timing = reduced ? REDUCED_HATCH_PHASE_DELAYS_MS : HATCH_PHASE_DELAYS_MS;
  // Small clock steps preserve the interleaving of the shared interval and phase timers.
  for (let elapsed = 0; elapsed < timing.subjectSettling; elapsed += 10) {
    await act(async () => { context.mock.timers.tick(10); });
  }
  assert.equal(rattleStarts, reduced ? 0 : 1, 'cracking never stops/restarts the continuous shake');
  assert.equal(impacts.filter(cue => cue === 'shake').length, reduced ? 1 : 10);
  assert.deepEqual(impacts.slice(-2), ['hatch', 'settle']);
  assert.equal(completed, 1);
  // The pack never blinks out: it hands over still visible and part-shrunk, and the card page carries the shrink on.
  const packMotion = renderer.root.findAllByType('AnimatedView' as any).at(-1)!.props.style.read();
  motion.advance(1000);
  const handed = renderer.root.findAllByType('AnimatedView' as any).at(-1)!.props.style.read();
  assert.ok(packMotion.opacity === 1 || reduced, 'full motion never fades the pack');
  assert.equal(handed.opacity, reduced ? 0 : 1);
  assert.ok(Math.abs(handed.transform.at(-1).scale - (reduced ? 1 : 0.72)) < 1e-9, 'it hands over at the scale the card page starts from');
  await act(async () => renderer.unmount());
  impacts.length = 0;
  await act(async () => { renderer = create(<Component opening onDone={done} />); });
  await act(async () => renderer.unmount());
  await act(async () => { context.mock.timers.tick(2000); });
  assert.deepEqual(impacts, []);
  assert.equal(completed, 1, 'unmounted packs never vibrate or advance a closed screen');
});

test('shared egg rattle is an uninterrupted infinite sequence with the existing 62ms swings', () => {
  const module = loadNativeModule('components/katchadeck/ui/egg-hatch-motion.ts', {
    'react-native-reanimated': {
      Easing: { linear: 'linear' },
      withTiming: (to: number, options: object) => ({ to, ...options }),
      withSequence: (...steps: object[]) => steps,
      withRepeat: (steps: object[], count: number, reverse: boolean) => ({ steps, count, reverse }),
    },
  });
  const rattle = module.eggHatchRattle();
  assert.equal(rattle.count, -1);
  assert.equal(rattle.reverse, true);
  assert.deepEqual(JSON.parse(JSON.stringify(rattle.steps)), [{ to: 1, duration: 62, easing: 'linear' }, { to: -1, duration: 62, easing: 'linear' }]);
});

test('Lantern planting registers the actual CTA for the existing seed finger and spotlight', () => {
  for (const [wispPlanting, ftueStepId, expected] of [[true, undefined, true], [false, 'world.garden_arrival', true], [false, undefined, false]] as const) {
    let registered: unknown;
    const module = loadNativeModule('components/katchadeck/roster/katchimera-kingdom-screen.tsx', {}, {
      wispPlanting, ftueStepId, useCallback: (callback: Function) => callback,
      registerFtueTarget: (key: string, node: unknown) => { assert.equal(key, 'garden-plant-button:mossprout'); registered = node; },
    }, 'setGardenWorldOfferNode');
    const button = { kind: 'native-button' };
    module.setGardenWorldOfferNode(button);
    assert.equal(registered, expected ? button : null);
    module.setGardenWorldOfferNode(null);
    assert.equal(registered, null);
  }
});
