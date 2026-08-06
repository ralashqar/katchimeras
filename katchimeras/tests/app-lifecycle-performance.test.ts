import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { appSurfaceForPathname } from '@/utils/app-activity';
import {
  acquireLifecycleResource,
  lifecycleResourceSnapshot,
  resetLifecycleResourcesForTests,
} from '@/utils/lifecycle-performance';

test('only foreground mini-game routes enter game activity mode', () => {
  assert.equal(appSurfaceForPathname('/today'), 'standard');
  assert.equal(appSurfaceForPathname('/games'), 'standard');
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

test('native watcher creation is guarded against late async completion', () => {
  const locationSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-day-location-capture.ts'), 'utf8');
  const liveStepSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'quests', 'live-step-quest.tsx'), 'utf8');
  assert.match(locationSource, /const nextSubscription = await Location\.watchPositionAsync/);
  assert.match(locationSource, /if \(!active\) \{\s*nextSubscription\.remove\(\)/);
  assert.match(liveStepSource, /if \(!mounted\.current\) \{\s*nextWatch\.remove\(\)/);
  assert.match(liveStepSource, /mounted\.current = false;\s*cleanup\(\)/);
});

test('game mode releases background UI work and avoids full Kingdom hydration', () => {
  const tabsSource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const captureSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'day-capture-session.tsx'), 'utf8');
  const gameSource = readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'game-hub-game-route-screen.tsx'), 'utf8');
  assert.match(tabsSource, /name="today"[\s\S]*?freezeOnBlur: false/);
  assert.match(todaySource, /if \(!screenFocused\) return <View style=\{styles\.inactiveScreen\}/);
  assert.match(captureSource, /enabled: !!todayId && !gameActive/g);
  assert.doesNotMatch(gameSource, /useAllDays|deriveKingdom|applyWardrobeToKingdom/);
});

test('Today remounts from current home state before a cancelled capture can show fresh check-ins', () => {
  const homeStateSource = readFileSync(path.join(process.cwd(), 'hooks', 'use-home-screen-state.ts'), 'utf8');
  const mutationSource = readFileSync(path.join(process.cwd(), 'features', 'today', 'use-home-state-mutation.ts'), 'utf8');
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  assert.match(
    homeStateSource,
    /useState<StoredHomeState \| null>\(\(\) => homeRepository\.load\(\)\)/,
  );
  assert.match(homeStateSource, /hasSynchronizedStateRef\.current\s*&&\s*!forceDerive/);
  assert.match(mutationSource, /const current = homeRepository\.load\(\) \?\? storedStateRef\?\.current \?\? null/);
  assert.match(todaySource, /homeRepository\.flush\(\)\.then\(\(\) => \{\s*router\.push\(\{ pathname: '\/moment-capture'/);
});
