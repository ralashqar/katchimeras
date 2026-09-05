import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { loadCompanionOverlay, loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('Grow moves the whole root left, then its destination in from right; Back reverses both legs', async () => {
  const clock = nativeMotionHarness();
  const overlay = loadCompanionOverlay(clock, false);
  const Host = overlay.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
  let navigation: any;
  function Root() { navigation = overlay.useCompanionActionNavigation(); return React.createElement('RootCard'); }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host><Root /></Host>); });
  const root = tree!.root.findByType('RootCard' as React.ElementType);
  const x = (style: any) => style.read().transform[0].translateX || 0;
  assert.equal(x(navigation.rootStyle), 0);
  await act(async () => { assert.equal(navigation.navigate(true), true); });
  assert.equal(navigation.busy, true);
  assert.equal(navigation.navigate(false), false, 'double taps cannot interrupt the page handoff');
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.rootStyle), -216);
  assert.equal(x(navigation.destinationStyle), 432, 'destination waits outside the screen');
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.rootStyle), -432);
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.destinationStyle), 216);
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.destinationStyle), 0);
  assert.equal(navigation.busy, false);
  let closed = 0;
  await act(async () => navigation.navigate(false, () => closed++));
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.destinationStyle), 216);
  assert.equal(x(navigation.rootStyle), -432);
  await act(async () => clock.advance(220));
  assert.equal(x(navigation.destinationStyle), 432);
  assert.equal(x(navigation.rootStyle), -216);
  assert.equal(closed, 0);
  await act(async () => clock.advance(110));
  assert.equal(x(navigation.rootStyle), 0);
  assert.equal(closed, 1);
  assert.equal(navigation.active, false);
  assert.equal(tree!.root.findByType('RootCard' as React.ElementType), root, 'no remount or entry replay');
  await act(async () => tree!.unmount());
});

test('only the originating companion camera retains its covered interaction', () => {
  const { companionCameraCoversRoute: covers } = loadNativeModule('hooks/use-companion-camera-cover.ts', { 'expo-router': {} });
  const params = { companionActivityId: 'capture-1', companionReturnTo: '/katchimeras' };
  assert.equal(covers('/moment-capture', params, '/katchimeras'), true);
  assert.equal(covers('/moment-capture', params, '/katchimera/companion:mossprout'), false);
  assert.equal(covers('/moment-capture', { ...params, companionReturnTo: '/katchimera/companion%3Amossprout' }, '/katchimera/companion:mossprout'), true);
  assert.equal(covers('/merge', params, '/katchimeras'), false);
  assert.equal(covers('/moment-capture', {}, '/katchimeras'), false);
  for (const file of ['app/(tabs)/katchimeras.tsx', 'components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'components/katchadeck/world/katchimera-companion-route-screen.tsx']) {
    assert.match(readFileSync(file, 'utf8'), /useCompanionCameraCover/);
  }
});


test('camera header stays bounded below the safe area and cancel/complete each pop only the camera', async () => {
  for (const outcome of ['cancel', 'complete', 'denied'] as const) {
    let backs = 0; let dismissals = 0; let cancellations = 0; let photos = 0;
    const router = { canGoBack: () => true, back: () => { backs++; }, canDismiss: () => true, dismiss: () => { dismissals++; }, replace: () => assert.fail('must retain the origin route') };
    const motion = nativeMotionHarness();
    const Camera = React.forwardRef(function CameraMock(_props, ref) { React.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'file:///cache/photo.jpg' }) })); return React.createElement('Camera'); });
    const mocks: Record<string, unknown> = {};
    // Dependencies unrelated to navigation/camera rendering are inert in this harness.
    for (const match of readFileSync('app/moment-capture.tsx', 'utf8').matchAll(/from '(.*?)'/g)) {
      if (match[1].startsWith('@/')) mocks[match[1]] = {};
    }
    Object.assign(mocks, {
      'react-native': { ...nativeViews, Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'Spinner' },
      'react-native-reanimated': { ...motion.animated, FadeOut: motion.animated.FadeIn },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
      'expo-camera': { CameraView: Camera, useCameraPermissions: () => [{ granted: outcome !== 'denied', canAskAgain: false }, () => {}] },
      'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ companionActivityId: 'capture', companionReturnTo: '/katchimeras' }) },
      'expo-image': { Image: 'Image' }, 'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: { Medium: 'medium' } },
      'expo-location': { getForegroundPermissionsAsync: async () => ({ granted: false }) },
      '@/components/katchadeck/ui/screen-close-button': { ScreenCloseButton: 'Back' },
      '@/components/katchadeck/ui/katchimera-back-button': { KatchimeraBackButton: 'Back' },
      '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionIcon: 'Icon' },
      '@/components/katchadeck/ui/game-surface': { GameSurface: 'Surface' },
      '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
      '@/components/themed-text': { ThemedText: 'Text' },
      '@/constants/meadow-theme': { Meadow: { ink: '#432', inkSoft: '#654', leafDeep: '#453' } },
      '@/constants/theme': { Lantern: { moon50: '#fff' } },
      '@/hooks/use-home-screen-state': { useHomeScreenState: () => ({ selectedDay: null }) },
      '@/utils/photo-vision': { analyzePhoto: async () => null },
      '@/utils/photo-place-resolution': { resolvePhotoPlace: async () => null },
      '@/utils/safe-navigation': loadNativeModule('utils/safe-navigation.ts', {}),
      '@/utils/mossprout-life-activity-storage': { cancelMossproutNatureCapture: () => { cancellations++; }, finishMossproutNatureCapture: () => { photos++; } },
      '@/utils/mossprout-nature-capture': { prepareMossproutNaturePhoto: () => ({ uri: 'file:///saved.jpg' }) },
    });
    const Screen = loadNativeModule('app/moment-capture.tsx', mocks).default as React.ComponentType;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Screen />); });
    const back = tree!.root.findByType('Back' as React.ElementType);
    if (outcome === 'denied') assert.equal(back.props.variant, 'back');
    else assert.equal(back.props.accessibilityLabel, 'Go back');
    if (outcome !== 'denied') {
      const header = tree!.root.findByType('Card' as React.ElementType);
      const row = header.parent!.parent!;
      const frame = row.props.style[1];
      assert.equal(back.parent, row, 'Back and guidance share one top row');
      assert.equal(row.props.style[0].flexDirection, 'row');
      assert.equal(frame.top, 69, 'both controls clear the safe area together');
      assert.equal(frame.left, 16); assert.equal(frame.right, 16, 'text wraps within the screen');
      assert.equal(header.parent!.props.style.flex, 1, 'guidance fills the remaining width');
      assert.equal(header.parent!.props.style.minWidth, 0);
      assert.equal(back.props.style.flexShrink, 0, 'Back keeps its full touch target');
      assert.equal(header.props.title, 'Show Mossprout something growing');
    } else assert.equal(tree!.root.findByType('Surface' as React.ElementType).props.tone, 'cream');
    if (outcome === 'complete') {
      await act(async () => tree!.root.findByProps({ accessibilityLabel: 'Capture moment' }).props.onPress());
      assert.equal(photos, 1);
      assert.equal(cancellations, 0);
    } else {
      await act(async () => tree!.root.findByType('Back' as React.ElementType).props.onPress());
      assert.equal(cancellations, 1);
    }
    assert.equal(backs, 1); assert.equal(dismissals, 0);
    await act(async () => tree!.unmount());
  }
});


test('shared submenus retain the departing content until Back finishes, including a quick reversal', async () => {
  const clock = nativeMotionHarness();
  const overlay = loadCompanionOverlay(clock, false);
  const Host = overlay.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
  const Submenu = overlay.CompanionSlidingSubmenu as React.ComponentType<{ visible: boolean; children: React.ReactNode }>;
  const Root = 'Root' as React.ElementType;
  const Orders = 'Orders' as React.ElementType;
  const render = (open: boolean, count = 2) => <Host><Root /><Submenu visible={open}><Orders count={count} /></Submenu></Host>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(render(false)); });
  const root = tree!.root.findByType(Root);
  await act(async () => tree!.update(render(true)));
  await act(async () => clock.advance(110));
  await act(async () => tree!.update(render(false)));
  assert.equal(tree!.root.findByType(Orders).props.count, 2);
  await act(async () => clock.advance(330));
  await act(async () => clock.advance(220));
  assert.equal(tree!.root.findAllByType(Orders).length, 1, 'the outgoing submenu survives until the root returns');
  await act(async () => clock.advance(220));
  assert.equal(tree!.root.findAllByType(Orders).length, 0);
  await act(async () => tree!.update(render(true)));
  await act(async () => clock.advance(440));
  const orders = tree!.root.findByType(Orders);
  await act(async () => tree!.update(render(true, 3)));
  assert.equal(tree!.root.findByType(Orders), orders, 'live order updates do not restart the page');
  assert.equal(orders.props.count, 3);
  assert.equal(tree!.root.findByType(Root), root);
  await act(async () => tree!.unmount());
});

test('general destination pages use the latest Back direction for their outgoing page', async () => {
  const clock = nativeMotionHarness();
  const motion = loadNativeModule('hooks/use-companion-destination-motion.ts', {
    'react-native': nativeViews,
    'react-native-reanimated': { ...clock.animated, FadeOut: clock.animated.FadeIn },
  });
  let page: any;
  function Screen({ direction }: { direction: number }) { page = motion.useCompanionDestinationMotion(direction); return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Screen direction={1} />); });
  const oldPageExit = page.exiting;
  assert.equal(page.entering().initialValues.transform[0].translateX, 432);
  assert.equal(oldPageExit().animations.transform[0].translateX.to, -432);
  const arrival = page.entering().animations.transform[0].translateX;
  assert.equal(arrival.delay, 220);
  assert.equal(arrival.child.duration, 220);
  await act(async () => tree!.update(<Screen direction={-1} />));
  assert.equal(page.entering().initialValues.transform[0].translateX, -432);
  assert.equal(oldPageExit().animations.transform[0].translateX.to, 432, 'old page exits right on Back, not in its earlier forward direction');
  await act(async () => tree!.unmount());
});


for (const reducedMotion of [false, true]) {
  test(`row removal retains and animates the measured tray footprint (reduced motion: ${reducedMotion})`, async () => {
    const clock = nativeMotionHarness();
    const overlay = loadCompanionOverlay(clock, reducedMotion);
    const removals: (() => void)[] = [];
    function RemovalSignal({ index }: { index: number }) {
      removals[index] = overlay.useCompanionStackRemoval();
      return null;
    }
    const Host = overlay.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
    const Overlay = overlay.CompanionSceneOverlay as React.ComponentType<{ visible: boolean; children: React.ReactNode }>;
    const render = (removed: boolean) => <Host>
      <RemovalSignal index={0} />{React.createElement('SurvivingCard')}{removed ? null : React.createElement('ExitingCard')}
      <Overlay visible><RemovalSignal index={1} />{React.createElement('GrowCards')}{removed ? null : React.createElement('ExitingGrowCard')}</Overlay>
    </Host>;
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(render(false)); });
    const survivor = tree!.root.findByType('SurvivingCard' as React.ElementType);
    const grow = tree!.root.findByType('GrowCards' as React.ElementType);
    const measurements = tree!.root.findAllByType('View' as React.ElementType).filter((view) => view.props.onLayout);
    assert.equal(measurements.length, 2, 'root and Grow outlet each measure their own content');
    const measure = (index: number, height: number, width = 360) => measurements[index].props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
    const footprint = (index: number) => measurements[index].parent!.props.style[1].read().height;
    assert.equal(footprint(0), undefined, 'first layout uses intrinsic content height');
    await act(async () => { measure(0, 300); measure(1, 240); });
    assert.equal(footprint(0), 300);
    assert.equal(footprint(1), 240);
    assert.ok(measurements.every((view) => view.props.style.position === 'absolute' && view.props.style.top === 0), 'content remains top-aligned and independent of the animated footprint');
    assert.ok(measurements.every((view) => view.parent!.props.layout === undefined), 'does not rely on native layout-transition dispatch');

    // Remove the actual bottom nodes, then deliver their native content-size
    // measurements. Neither React removal nor measurement may shrink instantly.
    await act(async () => { removals.forEach((prepare) => prepare()); tree!.update(render(true)); });
    assert.equal(tree!.root.findAllByType('ExitingCard' as React.ElementType).length, 0);
    assert.equal(tree!.root.findAllByType('ExitingGrowCard' as React.ElementType).length, 0);
    assert.equal(footprint(0), 300);
    assert.equal(footprint(1), 240);
    await act(async () => { measure(0, 220); measure(1, 160); });
    assert.equal(footprint(0), 300, 'old root footprint survives the removal commit');
    assert.equal(footprint(1), 240, 'old submenu footprint survives the removal commit');
    const duration = reducedMotion ? 100 : 300;
    await act(async () => clock.advance(duration / 2));
    assert.equal(footprint(0), 260);
    assert.equal(footprint(1), 200);
    assert.equal(800 - footprint(0), 540, 'bottom-anchored upper cards move down through the gap');
    // Repeated onLayout events must not restart the settle or create a loop.
    await act(async () => { measure(0, 220); measure(1, 160); });
    await act(async () => clock.advance(duration / 2));
    assert.equal(footprint(0), 220);
    assert.equal(footprint(1), 160);
    assert.equal(tree!.root.findByType('SurvivingCard' as React.ElementType), survivor);
    assert.equal(tree!.root.findByType('GrowCards' as React.ElementType), grow);

    await act(async () => { removals[0](); measure(0, 180); });
    await act(async () => clock.advance(duration / 2));
    assert.equal(footprint(0), 200);
    await act(async () => { removals[0](); measure(0, 140); });
    assert.equal(footprint(0), 200, 'a second removal starts from the visible height');
    await act(async () => clock.advance(duration));
    assert.equal(footprint(0), 140);
    await act(async () => measure(0, 140));
    assert.equal(footprint(0), 140, 'equal-sized replacements leave the footprint stable');
    await act(async () => measure(0, 250));
    assert.equal(footprint(0), 250, 'opening a new panel uses its final height immediately');
    await act(async () => measure(0, 64));
    assert.equal(footprint(0), 64, 'switching to Continue does not slide down from the previous panel height');
    await act(async () => measure(0, 180, 500));
    assert.equal(footprint(0), 180, 'orientation changes lay out at the new width immediately');
    await act(async () => measure(1, 0));
    assert.equal(footprint(1), 0, 'a dismissed submenu does not leave a shrinking empty overlay');
    await act(async () => tree!.unmount());
  });
}
