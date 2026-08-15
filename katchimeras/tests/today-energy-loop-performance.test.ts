import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  clearTodayEnergyTraces,
  markTodayEnergyPhase,
  startTodayEnergyTrace,
  subscribeTodayEnergyMetrics,
} from '@/utils/today-energy-loop-performance';
import {
  clearTodayEnergyFeedback,
  getTodayEnergyFeedbackSnapshot,
  isRecentFinalTodayEnergyArrival,
  publishTodayEnergyFeedback,
} from '@/features/today/today-energy-feedback';

test('energy loop traces preserve transaction identity and finish cleanly', () => {
  clearTodayEnergyTraces();
  const metrics: string[] = [];
  const unsubscribe = subscribeTodayEnergyMetrics((metric) => metrics.push(`${metric.transactionId}:${metric.phase}`));
  const id = startTodayEnergyTrace('mood');
  markTodayEnergyPhase(id, 'reward_launch');
  markTodayEnergyPhase(id, 'egg_settled');
  markTodayEnergyPhase(id, 'token_arrival');
  unsubscribe();
  assert.deepEqual(metrics, [
    `${id}:action_press`,
    `${id}:reward_launch`,
    `${id}:egg_settled`,
  ]);
});

test('reset clears transient energy arrivals so a remounted meter cannot replay them', () => {
  clearTodayEnergyFeedback();
  const initialKey = getTodayEnergyFeedbackSnapshot().key;
  publishTodayEnergyFeedback(4, 3, 5);
  assert.equal(getTodayEnergyFeedbackSnapshot().index, 3);

  clearTodayEnergyFeedback();
  assert.deepEqual(getTodayEnergyFeedbackSnapshot(), {
    amount: 0,
    count: 0,
    index: -1,
    key: initialKey + 2,
    publishedAt: null,
  });
});

test('a final token landing remains visible to an activation commit in the next render', () => {
  clearTodayEnergyFeedback();
  publishTodayEnergyFeedback(4, 4, 5);
  const arrival = getTodayEnergyFeedbackSnapshot();
  assert.equal(isRecentFinalTodayEnergyArrival(arrival, arrival.publishedAt ?? 0), true);
  assert.equal(isRecentFinalTodayEnergyArrival(arrival, (arrival.publishedAt ?? 0) + 1201), false);
});

test('hatch readiness never overrides the earned Energy used for egg size', () => {
  const heroSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    'utf8',
  );
  assert.doesNotMatch(heroSource, /const energyRatio = isReady/);
  assert.match(
    heroSource,
    /const energyRatio = Math\.min\(1, Math\.max\(0, growthProgress \?\? growthStage \/ 6\)\)/,
  );
});

test('the final feed token publishes only after its Energy commit can render', () => {
  const controllerSource = readFileSync(
    path.join(process.cwd(), 'features', 'today', 'use-egg-feed-controller.ts'),
    'utf8',
  );
  assert.match(
    controllerSource,
    /pendingFeedCommit\.current\?\.\(\)[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?publishTodayEnergyFeedback/,
  );
  assert.match(
    controllerSource,
    /if \(index === count - 1\) \{[\s\S]*?pendingFinalEnergyFeedbackRef\.current = \{ amount, count, index \};[\s\S]*?\} else \{[\s\S]*?publishTodayEnergyFeedback/,
  );
  assert.match(controllerSource, /Haptics\.ImpactFeedbackStyle\.Soft/);
  assert.match(controllerSource, /Haptics\.ImpactFeedbackStyle\.Light/);
  assert.match(controllerSource, /Haptics\.ImpactFeedbackStyle\.Medium/);
  assert.match(controllerSource, /growthHapticTimerRef\.current = setTimeout\([\s\S]*?170/);
  assert.match(controllerSource, /const FEED_ARRIVAL_WATCHDOG_MS = 2_500/);
  assert.match(controllerSource, /feedArrivalWatchdogRef\.current = setTimeout\([\s\S]*?settleActiveFeedRef\.current\(nextFeed\.nonce\)/);
});

test('manual journal action feedback waits until its native sheet is dismissed', () => {
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const journalSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx'),
    'utf8',
  );
  assert.match(todaySource, /queueCareCompletionAfterJournalDismiss\(completingCareAction\)/);
  assert.match(todaySource, /rewardAlreadyAnimated = false/);
  assert.match(todaySource, /runAfterNativeModalDismiss\(\(\) => \{[\s\S]*?queueCareCompletion\(action, rewardAlreadyAnimated\)/);
  assert.match(todaySource, /deferredCareMergeEnergyRef\.current = guidedCapture\.mergeEnergyAmount \?\? 0;[\s\S]*queueCareCompletionAfterJournalDismiss\(guidedCapture\.action\)/);
  assert.match(todaySource, /launchJournalRewardFromBottomAfterDismiss\(\{[\s\S]*mergeEnergyAmount: journalMergeReward\?\.totalEnergy \?\? 0/);
  assert.match(todaySource, /runAfterNativeModalDismiss\(\(\) => \{[\s\S]*currencyFrom: from,[\s\S]*imageSource: GAME_CURRENCY_ART\.energy/);
  assert.match(todaySource, /hapticOnSave=\{!pendingCareIntent\}/);
  assert.match(journalSource, /if \(hapticOnSave\) successHaptic\(\)/);
});

test('yesterday step Energy is a required top action with synchronized counters', () => {
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const nurtureSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'),
    'utf8',
  );
  const stepRowIndex = nurtureSource.indexOf('<YesterdayStepEnergyRow');
  const moodRowIndex = nurtureSource.indexOf('{displayedMoodAction || displayedSleepAction');
  assert.ok(stepRowIndex >= 0 && stepRowIndex < moodRowIndex);
  assert.match(nurtureSource, /This action cannot be skipped/);
  assert.match(todaySource, /buildYesterdayStepEnergyOffer\(\{[\s\S]*?existing: mergeState\.stepEnergyByDay\[yesterday\.dayId\]/);
  assert.match(todaySource, /setEnergyHudValueOverride\(wallet\.energy\)[\s\S]*?claimDailyStepEnergy/);
  assert.match(todaySource, /onMergeEnergyTokenArrive: \(amount\) => \{[\s\S]*?setEnergyHudValueOverride\(beforeEnergy \+ arrivedEnergy\)[\s\S]*?offer\.observedSteps - arrivedEnergy \* STEPS_PER_MERGE_ENERGY/);
  assert.match(todaySource, /receiptId: `daily-steps:\$\{formingDay\?\.isoDate \?\? 'today'\}:\$\{offer\.dayId\}`/);
});

test('developer Reset Today makes yesterday step Energy claimable again', () => {
  const resetSource = readFileSync(
    path.join(process.cwd(), 'features', 'today', 'reset-today-for-debug.ts'),
    'utf8',
  );
  const engineSource = readFileSync(
    path.join(process.cwd(), 'utils', 'merge-world', 'engine.ts'),
    'utf8',
  );

  assert.match(resetSource, /toLocalDateId\(shiftLocalDate\(resetDay, -1\)\)/);
  assert.match(resetSource, /resetMergeWorldActivityForDayForDebug\(state\.today\.isoDate, now\.getTime\(\), yesterdayDayId\)/);
  assert.match(engineSource, /if \(stepEnergyDayId\) delete stepEnergyByDay\[stepEnergyDayId\]/);
});

test('inline completion uses one active-day normalization for artifact, Growth, and care', () => {
  const actionsSource = readFileSync(path.join(process.cwd(), 'game', 'days', 'actions.ts'), 'utf8');
  const atomicFunction = actionsSource.match(
    /export function completeInlineTodayEnergyAction[\s\S]*?\n}\n\nexport function/,
  )?.[0] ?? '';

  assert.match(atomicFunction, /artifact\.kind === 'mood'/);
  assert.match(atomicFunction, /completeEnergyAction\(/);
  assert.match(atomicFunction, /return normalizeActiveHomeState\(/);
  assert.equal((atomicFunction.match(/normalizeActiveHomeState\(/g) ?? []).length, 1);
});

test('forming nurture presentation does not mount the legacy Today scene underneath', () => {
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const heroSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    'utf8',
  );
  const nurtureSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'),
    'utf8',
  );
  const feedSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'egg-feed-overlay.tsx'),
    'utf8',
  );
  assert.match(todaySource, /\{!isForming \? \(\s*<>[\s\S]*?<ScrollView/);
  assert.match(todaySource, /const hasVisibleLegacyPrompt = !isForming && Boolean\(formingActivePrompt\)/);
  assert.doesNotMatch(todaySource, /const hasActivePrompt = isForming && Boolean\(formingActivePrompt\)/);
  assert.match(todaySource, /energyLoopStatus === 'rewarding'[\s\S]*?\|\| energyLoopStatus === 'entering'/);
  assert.match(todaySource, /actionListLocked=\{[\s\S]*?energyLoopStatus === 'launching'[\s\S]*?energyLoopStatus === 'awaiting_completion'[\s\S]*?energyLoopStatus === 'rewarding'/);
  assert.doesNotMatch(heroSource, /kingdom-surface-tiles|world-visuals|TodayFallbackCloudScene/);
  assert.match(heroSource, /transientEffectsMounted \? <>/);
  assert.match(heroSource, /setTransientEffectsMounted\(false\)/);
  assert.match(heroSource, /useEggAvatar\(\)/);
  assert.match(heroSource, /<EggAvatarArtwork/);
  assert.match(heroSource, /skinId=\{equippedSkinId\}/);
  assert.match(heroSource, /faceId=\{forceSleeping \? 'sleepy' : equippedFaceId\}/);
  assert.doesNotMatch(heroSource, /cutouts\/egg-base/);
  assert.match(nurtureSource, /\(enterFromBottom \? FadeInDown : FadeInUp\)\.delay\(55\)\.duration\(320\)/);
  assert.match(nurtureSource, /function useActionRowLayout[\s\S]*?LinearTransition\.duration\(300\)/);
  assert.ok((nurtureSource.match(/<Animated\.View layout=\{rowLayout\}>/g) ?? []).length >= 3);
  assert.match(nurtureSource, /<Animated\.View layout=\{actionHandoffLayout\} style=\{styles\.checkInGroup\}>/);
  assert.match(nurtureSource, /const INITIAL_ACTION_STACK_SETTLE_MS = 560/);
  assert.match(nurtureSource, /const ACTION_BATCH_LAYOUT_SETTLE_MS = 680/);
  assert.match(nurtureSource, /newlyIntroducedRemainingActionIds\.has\(action\.instanceId\)[\s\S]*?ACTION_BATCH_LAYOUT_SETTLE_MS \+ index \* 55/);
  assert.match(nurtureSource, /if \(!actionListLocked && !completionIsStandard && !checkInTransitionActive\)/);
  assert.match(nurtureSource, /checkInTransitionActive \|\| actionListLocked[\s\S]*?settledRemainingActionsRef\.current/);
  assert.ok((nurtureSource.match(/FadeInUp\.delay\(entryDelayMs\)\.duration\(300\)/g) ?? []).length >= 2);
  assert.match(nurtureSource, /actionStackOpacity\.value = withTiming\(1,[\s\S]*?duration: reduceMotion \? 100 : 360/);
  assert.match(nurtureSource, /pointerEvents=\{actionStackInteractive \? 'auto' : 'none'\}/);
  assert.match(nurtureSource, /Gesture\.Native\(\)\.simultaneousWithExternalGesture\([\s\S]*?careSwipeExternalGesture,[\s\S]*?environmentGesture/);
  assert.match(nurtureSource, /\.activeOffsetX\(\[-CARE_SWIPE_ACTIVATION_DISTANCE, CARE_SWIPE_ACTIVATION_DISTANCE\]\)/);
  assert.match(nurtureSource, /shouldClose = event\.translationX <= -CARE_SWIPE_CLOSE_DISTANCE \|\| event\.velocityX <= -360/);
  assert.match(nurtureSource, /<HatchRevealAction onAdd=\{onAddJournal\}/);
  assert.match(nurtureSource, /fixedActionClusterTop \+ fixedActionClusterHeight \+ 8/);
  assert.match(
    nurtureSource,
    /const nurtureToastTop = fixedActionClusterTop[\s\S]*?Math\.max\(fixedActionClusterHeight, NURTURE_ACTION_CLUSTER_FALLBACK_HEIGHT\)[\s\S]*?NURTURE_TOAST_TOP_GAP/,
  );
  assert.doesNotMatch(nurtureSource, /const nurtureToastTop = panelStart/);
  assert.match(nurtureSource, /<MicrocopyToast message=\{microcopy\} placementStyle=\{\{ top: nurtureToastTop \}\} \/>/);
  assert.match(todaySource, /<MicrocopyToast message=\{isForming && formingDay && nurtureGrowth && !isHatching \? null : microcopy\} \/>/);
  assert.match(feedSource, /const TOKEN_HOVER_MS = 150/);
  assert.match(feedSource, /const TOKEN_FLIGHT_MS = 380/);
  assert.match(feedSource, /const TOKEN_STAGGER_MS = 65/);
  assert.match(feedSource, /<Image contentFit="contain" source=\{GAME_CURRENCY_ART\.energy\} style=\{styles\.energyTokenArt\}/);
  assert.doesNotMatch(feedSource, /contextMote/);
  assert.doesNotMatch(nurtureSource, /leaf\.fill/);
});
