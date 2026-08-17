import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { HomeDayRecord, StoredHomeDayRecord } from '../types/home';
import {
  IDLE_TODAY_HATCH_PRESENTATION,
  todayHatchPresentationReducer,
  todayDailyHatchActive,
  todayHatchRunsInPlace,
  todayHatchShowsResident,
  todayHatchShowsTomorrow,
} from '../utils/today-hatch-presentation';

const egg = {
  accentColor: '#F0C66D',
  coreColor: '#FFF1B5',
  haloColor: '#E8B95C',
  intensity: 0.8,
  label: 'A forming egg',
  shimmer: true,
  swirl: 0.4,
} as HomeDayRecord['egg'];

const day = {
  id: 'day-2026-07-22',
  isoDate: '2026-07-22',
  isToday: true,
  kind: 'day',
  egg,
} as HomeDayRecord;

const committedDay = {
  id: day.id,
  isoDate: day.isoDate,
  state: 'hatched',
  creature: { id: 'creature-1' },
} as StoredHomeDayRecord;

test('hatch presentation advances monotonically and reveals Tomorrow last', () => {
  let state = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', animationKey: 1, day });
  assert.equal(state.phase, 'preparing');
  assert.equal(state.egg, egg);

  state = todayHatchPresentationReducer(state, { type: 'committed', day: committedDay });
  assert.equal(state.phase, 'shaking');
  assert.equal(todayHatchShowsResident(state.phase), false);

  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'crossfading_subject' });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'world_shift' });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'dashboard_settling' });
  assert.equal(todayHatchShowsResident(state.phase), true);
  assert.equal(todayHatchShowsTomorrow(state.phase), false);

  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'complete' });
  assert.equal(todayHatchShowsTomorrow(state.phase), true);
});

test('late or out-of-order actions cannot rewind or replace the active hatch', () => {
  let state = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', animationKey: 1, day });
  state = todayHatchPresentationReducer(state, { type: 'committed', day: committedDay });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'world_shift' });
  const rewound = todayHatchPresentationReducer(state, { type: 'advance', phase: 'crossfading_subject' });
  assert.equal(rewound.phase, 'world_shift');

  const otherDay = { ...committedDay, id: 'different-day' };
  const replaced = todayHatchPresentationReducer(state, { type: 'committed', day: otherDay });
  assert.equal(replaced.committedDay?.id, committedDay.id);
});

test('failure and completion restore an idle, retryable presentation', () => {
  const preparing = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', animationKey: 1, day });
  const failed = todayHatchPresentationReducer(preparing, { type: 'failed', reason: 'Try again' });
  assert.equal(failed.phase, 'idle');
  assert.equal(failed.error, 'Try again');
  assert.equal(failed.dayId, null);

  const retried = todayHatchPresentationReducer(failed, { type: 'begin', animationKey: 2, day });
  assert.equal(retried.phase, 'preparing');
  assert.equal(retried.error, null);
  assert.equal(retried.animationKey, 2);
  assert.deepEqual(
    todayHatchPresentationReducer(retried, { type: 'reset' }),
    IDLE_TODAY_HATCH_PRESENTATION,
  );
});

test('Discovery Hatch holds the revealed companion in Home until interaction', () => {
  const creature = { id: 'ftue-discovery-mossprout', name: 'Mossprout' } as NonNullable<StoredHomeDayRecord['creature']>;
  let state = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, {
    type: 'begin_discovery', animationKey: 1, day, creature,
  });
  state = todayHatchPresentationReducer(state, { type: 'advance', phase: 'awaiting_interaction' });
  assert.equal(state.policy, 'ftue_discovery');
  assert.equal(state.phase, 'awaiting_interaction');
  assert.equal(state.creatureOverride?.name, 'Mossprout');
  assert.equal(todayHatchShowsTomorrow(state.phase), false);
  assert.equal(todayHatchRunsInPlace(state), true);
  assert.equal(todayDailyHatchActive(state), false);
});

test('Daily Hatch is active without replacing the mounted Today room', () => {
  const daily = todayHatchPresentationReducer(IDLE_TODAY_HATCH_PRESENTATION, { type: 'begin', animationKey: 1, day });
  assert.equal(todayDailyHatchActive(daily), true);
  const newDay = todayHatchPresentationReducer(daily, { type: 'advance', phase: 'new_day_intro' });
  assert.equal(todayDailyHatchActive(newDay), false);
  assert.equal(todayHatchRunsInPlace(daily), false);
  assert.equal(todayDailyHatchActive(IDLE_TODAY_HATCH_PRESENTATION), false);
});

test('Daily Hatch preserves the live Today Egg and camera framing', () => {
  const today = readFileSync(path.join(process.cwd(), 'app/(tabs)/today.tsx'), 'utf8');
  const egg = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-kingdom-egg-hero.tsx'), 'utf8');
  const nurture = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-nurture-experience.tsx'), 'utf8');
  const motion = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-environment-motion.tsx'), 'utf8');

  assert.match(today, /frozen: dailyHatchActive \|\| discoveryHatchInPlace/);
  assert.equal((today.match(/frozen: dailyHatchActive \|\| discoveryHatchInPlace/g) ?? []).length, 2);
  assert.match(egg, /opacity: 1 - discoveryEggExit\.value/);
  assert.match(egg, /scale: 1 - discoveryEggExit\.value \* 0\.82/);
  assert.match(egg, /discoveryPhase === 'new_day_intro' \|\| discoveryPhase === 'restoring_today'/);
  assert.match(egg, /const discoveryWispTop = eggFrame\.top \+ \(eggFrame\.height - discoveryWispSize\) \/ 2/);
  assert.match(egg, /discoveryHatch\.dayId}:\$\{discoveryHatch\.animationKey}:discovery/);
  assert.match(egg, /discoveryHatch && !returningFromDailyHatch/);
  assert.match(egg, /discoveryEggExit\.value = 0/);
  assert.doesNotMatch(today, /onboardingFocus=\{dailyNewDayIntro \|\|/);
  assert.doesNotMatch(today, /scriptedPinchStartScale=\{dailyNewDayIntro/);
  assert.match(today, /key=\{`today-nurture:\$\{formingDay\.id}:\$\{formingDay\.growth\?\.cycleStartedAt \?\? 'initial'}`\}/);
  assert.doesNotMatch(today, /TodayTileHatchReveal/);
  assert.match(nurture, /dailyHatchPhase === 'shaking'[\s\S]*?DAILY_HATCH_SHAKE_CAMERA_SCALE[\s\S]*?duration: 460/);
  assert.match(nurture, /dailyHatchPhase === 'cracking'[\s\S]*?DAILY_HATCH_REVEAL_CAMERA_SCALE[\s\S]*?duration: 550/);
  assert.match(nurture, /dailyHatchPhase === 'crossfading_subject' \|\| dailyHatchPhase === 'subject_settling'/);
  assert.match(nurture, /additionalScale=\{hatchCameraScale\}/);
  assert.ok((nurture.match(/\(environmentMotion\?\.pinchScale\.value \?\? 1\) \* hatchCameraScale\.value/g) ?? []).length >= 2);
  assert.match(motion, /additionalScale\?: SharedValue<number>/);
  assert.match(motion, /\(motion\?\.pinchScale\.value \?\? 1\) \* \(additionalScale\?\.value \?\? 1\)/);
});

test('the new Today Egg fades in at its reset size before progress returns', () => {
  const today = readFileSync(path.join(process.cwd(), 'app/(tabs)/today.tsx'), 'utf8');
  const nurture = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-nurture-experience.tsx'), 'utf8');
  const hatchController = readFileSync(path.join(process.cwd(), 'features/today/use-hatch-controller.ts'), 'utf8');

  assert.match(nurture, /opacity: newDayEggEntry\.value/);
  assert.doesNotMatch(nurture, /scale: 0\.72 \+ newDayEggEntry\.value \* 0\.28/);
  assert.match(nurture, /style=\{\[styles\.eggStage[\s\S]*?newDayIntro \? \([\s\S]*?<CelebrationParticles[\s\S]*?top: explorationEggFrame\.centerY[\s\S]*?tier=\{2\}[\s\S]*?tint="#E4B34B"[\s\S]*?<TodayKingdomEggHero/);
  assert.match(nurture, /newDayConfetti: \{ left: '50%', zIndex: 0 \}/);
  assert.match(nurture, /!hatchReadyFocus && !newDayIntro && \(!onboardingFocus \|\| onboardingTopHudVisible\) \? <Animated\.View[\s\S]*?FadeIn\.duration\(220\)[\s\S]*?<TodayTopHud/);
  assert.match(nurture, /!hatchReadyFocus && !onboardingFocus && !newDayIntro \? <Animated\.View[\s\S]*?FadeIn\.duration\(reduceMotion \? 100 : 320\)[\s\S]*?<GrowthMeter/);
  assert.match(today, /<FtueGuideCopy[\s\S]*?eyebrow: 'New day'[\s\S]*?formatNewDayDate[\s\S]*?hero/);
  assert.doesNotMatch(today, /styles\.newDayEyebrow|styles\.newDayDate/);
  assert.match(hatchController, /homeRepository\.save\(claimedState, \{ allowTodayReset: true, notify: false \}\)/);
});

test('Daily Hatch reveals one full, flippable card in a claim splash', () => {
  const today = readFileSync(path.join(process.cwd(), 'app/(tabs)/today.tsx'), 'utf8');
  const splash = readFileSync(path.join(process.cwd(), 'components/katchadeck/cards/daily-card-claim-splash.tsx'), 'utf8');
  const viewer = readFileSync(path.join(process.cwd(), 'components/katchadeck/cards/daily-card-viewer.tsx'), 'utf8');

  assert.match(today, /<DailyCardClaimSplash[\s\S]*?card=\{hatchLeadCard\}[\s\S]*?day=\{hatchCardDay\}/);
  assert.doesNotMatch(today, /CardDeckCarousel|hatchDeckCards|hatchDeckContent/);
  assert.match(splash, /<DailyCardViewer[\s\S]*?showFaceControls=\{false\}/);
  assert.match(splash, /<RotatingRadialSunburst/);
  assert.match(splash, /<Modal[\s\S]*?presentationStyle="fullScreen"/);
  assert.match(splash, /label="Claim Day Card"/);
  assert.doesNotMatch(splash, /NEW WISP|NEW SCENE|Show moments/);
  assert.doesNotMatch(viewer, /\.enabled\(!reduceMotion && face === 'front'\)/);
});

test('the retrospective hatch-ready Egg uses the Achievement rays and Energy ripple', () => {
  const nurture = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-nurture-experience.tsx'), 'utf8');
  const egg = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-kingdom-egg-hero.tsx'), 'utf8');

  assert.match(nurture, /isReady=\{hatchPresentation \? false : hatchReadyFocus \|\| ready\}/);
  assert.match(egg, /readyShake\.value = withRepeat/);
  assert.match(egg, /<RotatingRadialSunburst/);
  assert.match(egg, /primary=\{readyRipple\}/);
  assert.match(egg, /withTiming\(1, \{ duration: 420, easing: Easing\.out\(Easing\.cubic\) \}\)/);
  assert.doesNotMatch(egg, /ReadyEggAura|readyAuraPulse|readyRayRotation|READY_RAY_COUNT/);
});
