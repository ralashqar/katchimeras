import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { appSurfaceForPathname } from '@/utils/app-activity';
import {
  beginCriticalInteractionWork,
  criticalInteractionWorkActive,
  waitForCriticalInteractionIdle,
} from '@/utils/critical-interaction';
import {
  acquireLifecycleResource,
  foregroundLifecycleViolations,
  lifecycleResourceSnapshot,
  resetLifecycleResourcesForTests,
} from '@/utils/lifecycle-performance';

test('only foreground mini-game routes enter game activity mode', () => {
  assert.equal(appSurfaceForPathname('/today'), 'standard');
  assert.equal(appSurfaceForPathname('/games'), 'game');
  assert.equal(appSurfaceForPathname('/game/quest-feastle-merge'), 'game');
  assert.equal(appSurfaceForPathname('/katchimera/companion:cheerlet/quest/quest-cheerlet-block-party/game'), 'game');
});

test('repeated game resources return to a zero baseline', () => {
  resetLifecycleResourcesForTests();
  for (let index = 0; index < 30; index += 1) {
    const releases = [
      acquireLifecycleResource('game_route', `round-${index}`),
      acquireLifecycleResource('timer', `round-${index}`),
      acquireLifecycleResource('audio_player', `round-${index}`),
    ];
    releases.forEach((release) => release());
    releases.forEach((release) => release());
    assert.equal(lifecycleResourceSnapshot().total, 0);
  }
});

test('thirty foreground cycles retain only the active heavy surface', () => {
  resetLifecycleResourcesForTests();
  const releaseProvider = acquireLifecycleResource('merge_provider', 'retained-merge-state');
  for (let index = 0; index < 30; index += 1) {
    const releaseToday = acquireLifecycleResource('today_scene', `today-${index}`);
    assert.deepEqual(foregroundLifecycleViolations('today'), []);
    releaseToday();

    const releaseCompanion = acquireLifecycleResource('companion_scene', `companion-${index}`);
    const releaseSheet = acquireLifecycleResource('companion_sheet', `sheet-${index}`);
    assert.deepEqual(foregroundLifecycleViolations('companion'), []);
    releaseSheet();
    releaseCompanion();

    const releaseBoard = acquireLifecycleResource('merge_board', `board-${index}`);
    const releaseSubscription = acquireLifecycleResource('store_subscription', `subscription-${index}`);
    const releaseAppState = acquireLifecycleResource('app_state_listener', `app-state-${index}`);
    assert.deepEqual(foregroundLifecycleViolations('merge'), []);
    releaseAppState();
    releaseSubscription();
    releaseBoard();
  }
  releaseProvider();
  assert.equal(lifecycleResourceSnapshot().total, 0);
});

test('foreground isolation reports retained hidden work', () => {
  resetLifecycleResourcesForTests();
  const releases = [
    acquireLifecycleResource('today_scene', 'hidden-today'),
    acquireLifecycleResource('companion_scene', 'visible-companion'),
    acquireLifecycleResource('store_subscription', 'hidden-merge-subscription'),
  ];
  assert.deepEqual(foregroundLifecycleViolations('companion'), [
    'today_scene:1>0',
    'store_subscription:1>0',
  ]);
  releases.forEach((release) => release());
});

test('nested critical interactions release deferred work only after the final lease', async () => {
  const releaseFirst = beginCriticalInteractionWork();
  const releaseSecond = beginCriticalInteractionWork();
  let resumed = false;
  const waiter = waitForCriticalInteractionIdle().then(() => { resumed = true; });

  releaseFirst();
  await Promise.resolve();
  assert.equal(criticalInteractionWorkActive(), true);
  assert.equal(resumed, false);

  releaseSecond();
  await waiter;
  assert.equal(criticalInteractionWorkActive(), false);
  assert.equal(resumed, true);
  releaseSecond();
});

test('passive capture is one-shot while live game watchers guard late async completion', () => {
  const locationSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-day-location-capture.ts'), 'utf8');
  const stepSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-day-step-capture.ts'), 'utf8');
  const liveStepSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'live-step-quest.tsx'), 'utf8');
  assert.match(locationSource, /Location\.getCurrentPositionAsync/);
  assert.doesNotMatch(locationSource, /watchPositionAsync|location_watcher/);
  assert.match(locationSource, /lastStartedRequestKeyRef\.current >= requestKey/);
  assert.match(stepSource, /Pedometer\.getStepCountAsync/);
  assert.doesNotMatch(stepSource, /Pedometer\.watchStepCount|pedometer_watcher/);
  assert.match(stepSource, /lastStartedRequestKeyRef\.current >= requestKey/);
  assert.match(liveStepSource, /if \(!mounted\.current\) \{\s*nextWatch\.remove\(\)/);
  assert.match(liveStepSource, /mounted\.current = false;\s*cleanup\(\)/);
});

test('game mode releases background UI work and avoids full Kingdom hydration', () => {
  const tabsSource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const mergeRouteSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-world-route-screen.tsx'), 'utf8');
  const mergeBoardSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'feastle-persistent-merge-board.tsx'), 'utf8');
  const mergeProviderSource = readFileSync(path.join(process.cwd(), 'features', 'merge-world', 'merge-world-provider.tsx'), 'utf8');
  const companionRouteSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx'), 'utf8');
  const companionSheetSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const captureSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'day-capture-session.tsx'), 'utf8');
  const gameSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'game-hub-game-route-screen.tsx'), 'utf8');
  assert.match(tabsSource, /name="today"[\s\S]*?freezeOnBlur: false/);
  assert.match(tabsSource, /name="games"[\s\S]*?freezeOnBlur: false/);
  assert.match(mergeRouteSource, /useIsFocused/);
  assert.match(mergeRouteSource, /isFocused \? hydrateAllDays\(homeState, profile, now\) : days/);
  assert.match(mergeRouteSource, /\[allKatchimerasAvailable, days, isFocused\]/);
  assert.match(mergeRouteSource, /\{isFocused \? <>/);
  assert.match(mergeRouteSource, /<MergeWorldProvider active=\{isFocused\}/);
  assert.match(mergeBoardSource, /useDisposableTimers\('merge-board-feedback'\)/);
  assert.match(mergeBoardSource, /acquireLifecycleResource\('merge_board'/);
  assert.match(mergeBoardSource, /effectsPaused\.value = 0/);
  assert.match(mergeBoardSource, /timers\.cancelAll\(\)/);
  assert.match(mergeBoardSource, /animateEntrance[\s\S]*?\? spritesFromState/);
  assert.match(mergeProviderSource, /if \(!active\) return;[\s\S]*?subscribeCompanionQuickGoals/);
  assert.match(mergeProviderSource, /if \(!active \|\| loading\) return;/);
  assert.match(mergeProviderSource, /if \(!activeRef\.current\) return null;/);
  assert.match(companionRouteSource, /if \(!isFocused\) return <View style=\{styles\.inactiveScreen\} \/>;/);
  assert.match(companionSheetSource, /if \(!props\.active \|\| !idealSkinOnboardingRequired/);
  assert.match(todaySource, /if \(!screenFocused\) return <View style=\{styles\.inactiveScreen\}/);
  assert.ok((captureSource.match(/enabled: captureGates\.captureEnabled/g) ?? []).length >= 3);
  assert.match(captureSource, /const captureActive = pathname === '\/today'/);
  assert.doesNotMatch(gameSource, /useAllDays|deriveKingdom|applyWardrobeToKingdom/);
});

test('Today capture uses staggered cooldown gates and incremental photo cursors', () => {
  const gateSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-passive-capture-gates.ts'), 'utf8');
  const captureSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'day-capture-session.tsx'), 'utf8');
  const photoSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-recent-photo-map-seeding.ts'), 'utf8');
  assert.match(gateSource, /PASSIVE_CAPTURE_STEP_COOLDOWN_MS = 15 \* 60_000/);
  assert.match(gateSource, /PASSIVE_CAPTURE_LOCATION_COOLDOWN_MS = 30 \* 60_000/);
  assert.match(gateSource, /PASSIVE_CAPTURE_INITIAL_STEP_DELAY_MS = 700/);
  assert.match(gateSource, /PASSIVE_CAPTURE_INITIAL_LOCATION_DELAY_MS = 1_200/);
  assert.match(gateSource, /PASSIVE_CAPTURE_INITIAL_PHOTO_DELAY_MS = 2_400/);
  assert.match(gateSource, /AppState\.addEventListener\('change'/);
  assert.match(captureSource, /blocked: criticalInteractionActive \|\| gameActive/);
  assert.match(photoSource, /LAST_SCANNED_PHOTO_CREATED_AT_KEY/);
  assert.match(photoSource, /lastScannedCreatedAt \+ 1/);
  assert.doesNotMatch(photoSource, /recent-photo-map-seeded-day/);
});

test('Today buffers passive samples and persistence while its reward loop is active', () => {
  const captureSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'day-capture-session.tsx'), 'utf8');
  const storageSource = readFileSync(path.join(process.cwd(), 'utils', 'home-storage.ts'), 'utf8');
  assert.match(captureSource, /criticalInteractionActive/);
  assert.match(captureSource, /pendingLocationRef/);
  assert.match(captureSource, /pendingStepRef/);
  assert.match(captureSource, /pendingPhotosRef/);
  assert.match(storageSource, /await waitForCriticalInteractionIdle\(\)/);
});

test('Today remounts from current home state before a cancelled capture can show fresh check-ins', () => {
  const homeStateSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-home-screen-state.ts'), 'utf8');
  const mutationSource = readFileSync(path.join(process.cwd(), 'features', 'today', 'use-home-state-mutation.ts'), 'utf8');
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  assert.match(
    homeStateSource,
    /initialRepositoryStateRef\.current = homeRepository\.load\(\)/,
  );
  assert.match(homeStateSource, /hydrateHomeState\(initialRepositoryStateRef\.current \?\? null, loadOnboardingProfile\(\), new Date\(\)\)\.state/);
  assert.match(homeStateSource, /deriveHomeViewModel\(storedState, profile, now\)/);
  assert.match(homeStateSource, /hasSynchronizedStateRef\.current\s*&&\s*!forceDerive/);
  assert.match(mutationSource, /const current = homeRepository\.load\(\) \?\? storedStateRef\?\.current \?\? null/);
  assert.match(todaySource, /homeRepository\.flush\(\)\.then\(\(\) => \{\s*router\.push\(\{ pathname: '\/moment-capture'/);
});

test('heavy game surfaces navigate only under the shared readiness curtain', () => {
  const rootSource = readFileSync(path.join(process.cwd(), 'app', '_layout.tsx'), 'utf8');
  const transitionSource = readFileSync(path.join(process.cwd(), 'features', 'navigation', 'game-screen-transition.tsx'), 'utf8');
  const tabBarSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'meadow-tab-bar.tsx'), 'utf8');
  const mergeSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-world-screen.tsx'), 'utf8');
  const companionSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');

  assert.match(rootSource, /<GameScreenTransitionProvider>[\s\S]*?<Stack>/);
  assert.match(transitionSource, /setPhase\('covering'\)[\s\S]*?current\.navigate\(\)[\s\S]*?setPhase\('waiting_ready'\)/);
  assert.match(transitionSource, /READINESS_TIMEOUT_MS = 8_000/);
  assert.match(transitionSource, /useReducedMotion\(\)/);
  assert.match(tabBarSource, /games: 'merge'[\s\S]*?today: 'today'/);
  assert.match(mergeSource, /useGameSurfaceReadiness\('merge',[\s\S]*?foreground: boardMetrics != null/);
  assert.match(companionSource, /useGameSurfaceReadiness\('companion',[\s\S]*?transitionCreatureReady/);
});
