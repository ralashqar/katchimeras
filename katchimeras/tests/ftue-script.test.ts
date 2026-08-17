import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FTUE_ACTION_CATALOG, FTUE_HANDLER_REGISTRY } from '@/features/onboarding/ftue-action-registry';
import { ftueHidesBottomBar, ftueOwnsOpeningHome } from '@/features/onboarding/ftue-navigation-policy';
import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, validateMossproutFtueScript } from '@/features/onboarding/mossprout-ftue-script';
import { mossproutFtueConversationDefinitions } from '@/constants/mossprout-ftue-conversations';
import { buildYesterdayStepEnergyOffer, mergeStepEnergyPreview } from '@/utils/merge-world/economy-policy';

test('Mossprout FTUE script has valid transitions and registered handlers', () => {
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'egg.opening');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.terminalStepId, 'complete');
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
  }
});

test('the Egg asks three focused questions before Hatch and each offers privacy', () => {
  const opening = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'egg.opening');
  assert.equal(opening?.actions.length, 1);
  const personalSteps = ['egg.opening', 'egg.context', 'egg.mind'].map((id) => MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === id));
  assert.equal(personalSteps.length, 3);
  personalSteps.forEach((step) => {
    assert.equal(step?.actions.length, 1);
    assert.ok(step?.actions[0]?.options?.some((option) => option.private));
  });
  assert.equal(mossproutFtueAction('egg.opening', 'egg.feeling')?.nextStepId, 'egg.context');
  assert.equal(mossproutFtueAction('egg.context', 'egg.context.activity')?.nextStepId, 'egg.mind');
  assert.equal(mossproutFtueAction('egg.mind', 'egg.mind.focus')?.nextStepId, 'egg.ready');
});

test('every Egg question keeps Home focused and normal Hatch is impossible during discovery FTUE', () => {
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const controller = readFileSync('features/today/use-today-hatch-reveal-controller.ts', 'utf8');
  assert.match(route, /ftueRun\.stepId\.startsWith\('egg\.'\)/);
  assert.match(route, /if \(discoveryHatchActive\) \{[\s\S]*?ftueRun\?\.stepId === 'egg\.ready'[\s\S]*?handleDiscoveryReveal\(FTUE_MOSSPROUT_CREATURE\);[\s\S]*?return;/);
  assert.match(route, /allowDailyHatch: !discoveryHatchActive/);
  assert.match(route, /natural\.qualifyingActionCount >= 3/);
  assert.match(controller, /!allowDailyHatch[\s\S]*?hatchingActiveRef\.current/);
});

test('script migration rechecks a cached two-answer run instead of bypassing the third question', () => {
  const runtime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  assert.match(runtime, /run\.stepId === 'egg\.ready'[\s\S]*?run\.answers\['egg\.mind\.focus'\] == null/);
  assert.match(runtime, /if \(snapshot === undefined\)[\s\S]*?const migrated = migrateCurrentScript\(snapshot\)/);
  assert.doesNotMatch(runtime, /if \(snapshot !== undefined\) return snapshot/);
});

test('backend catalog contains only allowlisted privacy-safe action ids', () => {
  assert.ok(FTUE_ACTION_CATALOG.some((item) => item.actionId === 'egg.feeling' && item.backendEvent));
  assert.ok(FTUE_ACTION_CATALOG.every((item) => !('optionId' in item)));
});

test('Supabase receipt allowlist matches every backend FTUE action', () => {
  const migration = readFileSync('supabase/migrations/20260815143000_register_mossprout_ftue_v11.sql', 'utf8');
  for (const item of FTUE_ACTION_CATALOG.filter((entry) => entry.backendEvent)) {
    assert.match(migration, new RegExp(`'${item.stepId}',\\s*'${item.actionId}'`));
  }
  assert.doesNotMatch(migration, /option_id|option_label|answer_text/);
});

test('Chapter 0 previews its requests and scripts spawn, merge, Energy recovery, and serve objectives', () => {
  const mergeStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.seed_drag');
  const serveStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.serve_sprout');
  const spawnStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.plant.spawn');
  const pairStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.plant.seed_pairs');
  const finalServeStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.serve_plant');
  assert.equal(mossproutFtueAction('merge.seed_drag', 'merge.create_sprout')?.handlerId, 'merge_item_created');
  assert.equal(mergeStep?.edges?.[0]?.nextStepId, 'merge.plant.spawn');
  assert.equal(spawnStep?.edges?.[0]?.requiredCount, undefined);
  assert.equal(pairStep?.edges?.[0]?.event.type, 'dream_echo_cleared');
  assert.equal(pairStep?.edges?.[0]?.nextStepId, 'merge.serve_sprout');
  assert.equal(serveStep?.edges?.[0]?.nextStepId, 'merge.plant.sprout_pair');
  assert.equal(finalServeStep?.edges?.[0]?.nextStepId, 'merge.energy.spawn_pair');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.energy.last_seed')?.edges?.[0]?.nextStepId, 'merge.energy_exhausted');
  assert.equal(mossproutFtueAction('merge.energy_exhausted', 'merge.tell_me_more')?.nextStepId, 'energy.capture');
  assert.equal(mossproutFtueAction('energy.journal_reward', 'energy.check_steps')?.handlerId, 'pedometer_steps');
  assert.equal(mossproutFtueAction('energy.steps_offer', 'energy.convert_steps')?.nextStepId, 'energy.steps_reward');
  assert.equal(mossproutFtueAction('energy.steps_reward', 'energy.return')?.nextStepId, 'merge.energy.finish_seed');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.some((step) => step.id === 'energy.steps_permission'), false);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.energy.clear_plant_echo')?.edges?.[0]?.event.type, 'dream_echo_cleared');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.energy.serve_plant')?.edges?.[0]?.nextStepId, 'merge.return_note');
  const returnNote = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.return_note');
  assert.equal(returnNote?.interaction?.mode, 'exclusive');
  assert.deepEqual(returnNote?.spotlight?.targets, [{ kind: 'tray_chat_note', noteId: 'mossprout:chapter-0:return-note' }]);
  assert.equal(mergeStep?.interaction?.mode, 'exclusive');
  assert.equal(serveStep?.interaction?.mode, 'exclusive');
  assert.deepEqual(mergeStep?.spotlight?.targets, [
    { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 },
    { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 },
  ]);
  assert.equal(mergeStep?.spotlight?.grouping, 'bounding_rect');
  assert.deepEqual(serveStep?.spotlight?.targets, [
    { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:first-sprout', requirementIndex: 0 },
    { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' },
  ]);
  assert.ok(mossproutFtueAction('companion.order_preview', 'companion.open_garden'));
});

test('FTUE step energy checks yesterday, skips below 300, and always exposes the return action', () => {
  const today = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const pedometer = readFileSync('utils/pedometer-steps.ts', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const scriptedActions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const feed = readFileSync('features/today/use-egg-feed-controller.ts', 'utf8');
  assert.match(pedometer, /import\('expo-sensors'\)/);
  assert.match(pedometer, /Pedometer/);
  assert.match(pedometer, /getStepCountAsync\(start, end\)/);
  assert.match(today, /getPedometerAccess/);
  assert.doesNotMatch(today, /requestPedometerAccess/);
  assert.match(today, /ftueStepDays\.at\(-2\)/);
  assert.match(today, /nextStepId: energy > 0 \? 'energy\.steps_offer' : 'energy\.steps_reward'/);
  assert.match(today, /setFtueDisplayedSteps\(Math\.max\(remainingSteps/);
  assert.match(today, /mergeEnergyAmount: energy/);
  assert.match(today, /onMergeEnergyTokenArrive/);
  assert.doesNotMatch(today, /<FtueLifeEnergyOverlay/);
  assert.match(nurture, /scriptedStepEnergy/);
  assert.match(nurture, /onboardingTopHudVisible/);
  assert.match(scriptedActions, /DASHBOARD_STAT_ART\.steps/);
  assert.match(scriptedActions, /name="arrow\.right"/);
  assert.match(scriptedActions, /GAME_CURRENCY_ART\.energy/);
  assert.match(scriptedActions, /energy\.convert_steps/);
  assert.match(feed, /pendingMergeEnergyTokenArriveRef/);
  assert.equal(mergeStepEnergyPreview(299), 0);
  assert.equal(mergeStepEnergyPreview(300), 1);
  assert.equal(mergeStepEnergyPreview(6_300), 20);
  assert.equal(buildYesterdayStepEnergyOffer({ dayId: '2026-08-14', observedAt: '2026-08-14T23:59:00.000Z', observedSteps: 299 }), null);
  assert.deepEqual(
    buildYesterdayStepEnergyOffer({ dayId: '2026-08-14', observedAt: '2026-08-14T23:59:00.000Z', observedSteps: 300 }),
    { dayId: '2026-08-14', energy: 1, observedAt: '2026-08-14T23:59:00.000Z', observedSteps: 300 },
  );
  assert.equal(mossproutFtueAction('energy.steps_reward', 'energy.return')?.title, 'Back to Mossprout');
});

test('FTUE Energy recovery uses one general reflection with no journal hierarchy', () => {
  const capture = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'energy.capture');
  const reflection = capture?.actions[0];
  const today = readFileSync('app/(tabs)/today.tsx', 'utf8');

  assert.equal(capture?.actions.length, 1);
  assert.equal(reflection?.id, 'energy.reflect');
  assert.equal(reflection?.presentation, 'inline_choice');
  assert.equal(reflection?.promptKind, 'day_word');
  assert.equal(reflection?.nextStepId, 'energy.journal_reward');
  assert.deepEqual(reflection?.options?.map((option) => option.domainChoiceId), ['lovely', 'quiet', 'full', 'hard']);
  assert.ok(reflection?.options?.every((option) => !option.private));
  assert.match(today, /const completesEnergyCapture = action\.id === 'energy\.reflect'/);
  assert.match(today, /completesEnergyCapture \? \{ mergeEnergyAmount: MOSSPROUT_FTUE_JOURNAL_ENERGY \} : \{\}/);
  assert.match(today, /await completeFtueJournalCapture\(action\.id, sourceId, \{ id: option\.id, label: option\.label \}\)/);
  assert.doesNotMatch(today, /pendingFtueJournalCapture|completingFtueCapture|ftuePhotoEvidenceRef/);
});

test('Mossprout remembers the day, branches playfully, then reveals the shared two-order preview', () => {
  const firstMeetings = mossproutFtueConversationDefinitions.filter((definition) => definition.id.startsWith('mossprout:ftue:first-meeting:'));
  assert.ok(firstMeetings.every((definition) => definition.version === 2));
  for (const definition of firstMeetings) {
    const arrived = definition.nodes.find((node) => node.id === 'arrived');
    assert.equal(arrived?.kind, 'choice');
    if (arrived?.kind === 'choice') assert.equal(arrived.options.length, 2);
    assert.ok(definition.nodes.some((node) => node.id === 'plan'));
  }
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const mossproutStage = readFileSync('components/katchadeck/world/mossprout-ftue-story-stage.tsx', 'utf8');
  const feastleStage = readFileSync('components/katchadeck/world/feastle-story-stage.tsx', 'utf8');
  const baristabbitStage = readFileSync('components/katchadeck/world/baristabbit-story-stage.tsx', 'utf8');
  assert.match(interaction, /MossproutFtueStoryStage/);
  assert.match(mossproutStage, /CompanionMergeRequestTray/);
  assert.match(mossproutStage, /MOSSPROUT_CHAPTER_ZERO_REQUESTS/);
  assert.match(feastleStage, /CompanionMergeRequestTray/);
  assert.match(baristabbitStage, /CompanionMergeRequestTray/);
});

test('Merge FTUE never inserts guide panels into the fixed board layout', () => {
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const invariant = merge.indexOf('{/* Static game geometry');
  const mergeArea = merge.indexOf('<View style={styles.mergeArea}>');
  assert.ok(invariant >= 0 && mergeArea > invariant);
  assert.doesNotMatch(merge.slice(invariant, mergeArea), /chapterGuide|ftueStep\.guide|KatchaInlineNotice|ThemedText/);
  assert.doesNotMatch(merge, /const chapterGuide|const legacyChapterGuide/);
  assert.match(merge, /Future guidance belongs in an absolute world-space[\s\S]*?tray, counter, and board retain identical frames/);
});

test('Merge FTUE spotlight is an absolute non-layout overlay with transparent target cutouts', () => {
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(overlay, /StyleSheet\.absoluteFillObject/);
  assert.match(overlay, /pointerEvents="none"/);
  assert.match(overlay, /FillType\.EvenOdd/);
  assert.match(overlay, /usePathValue/);
  assert.match(overlay, /spotlightTransitionDurationMs: 420/);
  assert.match(overlay, /withTiming\(frame\.x, timing\)/);
  assert.match(overlay, /const ringPath = usePathValue[\s\S]*?<Path color=\{theme\.focusRingColor\}/);
  assert.match(overlay, /spotlight\.targets/);
  assert.match(overlay, /spotlight\.grouping === 'bounding_rect'[\s\S]*?boundingFrame\(resolved\)/);
  assert.match(merge, /spotlight=\{active && !serveFlight \? ftueStep\?\.spotlight \?\? null : null\}/);
});

test('Merge FTUE updates one persistent finger and spotlight tree for each measured target', () => {
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.doesNotMatch(overlay, /presentationKey|entering=|exiting=/);
  assert.doesNotMatch(overlay, /key=\{`spotlight:|key=\{`cue:/);
  assert.match(overlay, /measurementGenerationRef/);
  assert.match(overlay, /stateRef\.current/);
  assert.match(overlay, /currentLayout\.targetRevision === targetRevision/);
  assert.match(overlay, /resetKey=\{`\$\{currentLayout\?\.targetRevision/);
  assert.match(overlay, /cancelAnimation\(progress\);[\s\S]*?progress\.value = 0;[\s\S]*?resetKey/);
  assert.doesNotMatch(overlay, /return \(\) => \{\s*cancelAnimation\(progress\);\s*progress\.value = 0/);
});

test('the active FTUE hides the bottom bar only on the tab presenting its current step', () => {
  const tabLayout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const devTools = readFileSync('app/(tabs)/explore.tsx', 'utf8');
  const policy = readFileSync('features/onboarding/ftue-navigation-policy.ts', 'utf8');
  assert.match(policy, /'egg\.opening'/);
  assert.match(policy, /'hatch\.reveal'/);
  assert.doesNotMatch(policy, /'companion\.first_meeting'/);
  assert.match(tabLayout, /const activeRoute = props\.state\.routes\[props\.state\.index\]\?\.name/);
  assert.match(tabLayout, /ftueHidesBottomBar\(ftueRun, activeRoute\)/);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'egg.opening' }, 'today'), true);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'hatch.reveal' }, 'today'), true);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'companion.first_meeting' }, 'today'), false);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'merge.energy_exhausted' }, 'games'), true);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'merge.energy_exhausted' }, 'today'), false);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'energy.capture' }, 'today'), true);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'energy.capture' }, 'games'), false);
  assert.equal(ftueHidesBottomBar({ status: 'active', stepId: 'merge.energy.finish_seed' }, 'games'), true);
  assert.equal(ftueHidesBottomBar({ status: 'complete', stepId: 'complete' }, 'today'), false);
  assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId: 'hatch.reveal' }), true);
  assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId: 'companion.first_meeting' }), false);
  assert.doesNotMatch(tabLayout, /ftueLocked\s*\?\s*null/);
  assert.match(devTools, /Restart first-session onboarding · keep profile/);
  assert.match(devTools, /beginFirstSession\(\{ restart: true \}\)/);
  assert.match(devTools, /await resetTodayForDebug\(\);[\s\S]*?beginFirstSession\(\{ restart: true \}\);[\s\S]*?await resetKatchimeraProgressForDebug\(\{ resetAt \}\)/);
  assert.match(devTools, /It resets Today, Katchimera progress, and the Merge board/);
});

test('FTUE cross-surface CTAs navigate between sibling tabs under the shared curtain', () => {
  const today = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const transition = readFileSync('features/navigation/game-screen-transition.tsx', 'utf8');
  assert.match(merge, /router\.navigate\(\{ pathname: '\/today', params: \{ onboardingCapture: '1' \} \}\)/);
  assert.doesNotMatch(merge, /router\.dismissTo\(\{ pathname: '\/today'/);
  assert.match(today, /router\.navigate\(\{ pathname: '\/games', params: \{ familyId: 'mossprout' \} \}\)/);
  assert.doesNotMatch(today, /router\.push\(\{ pathname: '\/\(tabs\)\/games'/);
  assert.match(transition, /const commitPhase = useCallback[\s\S]*?phaseRef\.current = next;[\s\S]*?setPhase\(next\);/);
  assert.match(transition, /commitPhase\('covered'\)[\s\S]*?current\.navigate\(\)[\s\S]*?commitPhase\('waiting_ready'\)/);
});

test('companion and Merge FTUE steps never suppress the normal Today action rotation', () => {
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(route, /const ftueOpeningOwnsHome = ftueOwnsOpeningHome\(ftueRun\)/);
  assert.match(route, /if \(!ftueOpeningOwnsHome \|\| !formingDay\) return nurtureCare\.active/);
  assert.doesNotMatch(route, /if \(ftueRun\?\.status === 'active'\) return \[\]/);
});

test('the tabless opening uses a centered full-bleed Home camera without scaling its UI', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const layout = readFileSync('constants/home-loop-layout.ts', 'utf8');
  assert.match(layout, /HOME_FTUE_CAMERA_SCALE = 1\.16/);
  assert.match(layout, /HOME_FTUE_CAMERA_Y_OFFSET = -24/);
  assert.match(home, /sceneLift = onboardingFocus \? HOME_SCENE_Y_OFFSET : -100 \+ sceneVerticalNudge/);
  assert.match(home, /HOME_FTUE_CAMERA_SCALE - 1\) \* onboardingCameraProgress\.value/);
  assert.match(home, /<View pointerEvents="none" style=\{styles\.focusSceneViewport\}>[\s\S]*?<Animated\.View style=\{\[styles\.focusSceneCamera, focusSceneStyle\]\}>[\s\S]*?<TodayEnvironmentViewportMotionLayer/);
  assert.match(home, /<\/TodayEnvironmentViewportMotionLayer>[\s\S]*?<\/Animated\.View>[\s\S]*?<\/View>[\s\S]*?<Animated\.View[\s\S]*?projectedEggStageStyle[\s\S]*?<TodayKingdomEggHero/);
  assert.match(home, /focusSceneViewport: \{ \.\.\.StyleSheet\.absoluteFillObject, overflow: 'hidden' \}/);
  assert.match(home, /focusSceneCamera: \{ \.\.\.StyleSheet\.absoluteFillObject \}/);
  assert.match(home, /projectedCameraScale=\{projectedEggCameraScale\}/);
  assert.match(home, /<\/Animated\.View>[\s\S]*?<View[\s\S]*style=\{\[styles\.chrome/);
});

test('the opening camera slowly pinches in before revealing UI and retreats across three questions', async () => {
  const {
    FTUE_OPENING_CAMERA_DURATION_MS,
    FTUE_OPENING_UI_DELAY_MS,
    FTUE_OPENING_CAMERA_PAN_Y,
    clampFtueCameraPanToCoverage,
    ftueHomeCameraPanTarget,
    ftueHomeCameraPinchTarget,
  } = await import('../features/onboarding/ftue-home-camera');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const motion = readFileSync('components/katchadeck/home/today-environment-motion.tsx', 'utf8');

  assert.equal(ftueHomeCameraPinchTarget('egg.opening', 2), 2);
  const openingScale = ftueHomeCameraPinchTarget('egg.opening', 2)!;
  const contextScale = ftueHomeCameraPinchTarget('egg.context', 2)!;
  const mindScale = ftueHomeCameraPinchTarget('egg.mind', 2)!;
  const readyScale = ftueHomeCameraPinchTarget('egg.ready', 2)!;
  assert.ok(Math.abs(openingScale / contextScale - contextScale / mindScale) < 1e-9);
  assert.ok(Math.abs(contextScale / mindScale - mindScale / readyScale) < 1e-9);
  assert.equal(ftueHomeCameraPinchTarget('egg.ready', 2), 1);
  assert.equal(ftueHomeCameraPinchTarget('energy.steps_offer', 2), 1);
  assert.equal(ftueHomeCameraPinchTarget('companion.first_meeting', 2), null);
  assert.equal(ftueHomeCameraPanTarget('egg.opening'), FTUE_OPENING_CAMERA_PAN_Y);
  assert.equal(ftueHomeCameraPanTarget('egg.context'), FTUE_OPENING_CAMERA_PAN_Y * (2 / 3));
  assert.equal(ftueHomeCameraPanTarget('egg.mind'), FTUE_OPENING_CAMERA_PAN_Y * (1 / 3));
  assert.equal(ftueHomeCameraPanTarget('egg.ready'), 0);
  assert.equal(ftueHomeCameraPanTarget('energy.capture'), 0);
  assert.equal(clampFtueCameraPanToCoverage({
    projectedBottom: 840,
    projectedTop: -100,
    requestedPanY: -72,
    viewportHeight: 800,
  }), -40);
  assert.equal(clampFtueCameraPanToCoverage({
    projectedBottom: 920,
    projectedTop: -100,
    requestedPanY: -72,
    viewportHeight: 800,
  }), -72);
  assert.equal(clampFtueCameraPanToCoverage({
    projectedBottom: 920,
    projectedTop: -30,
    requestedPanY: 50,
    viewportHeight: 800,
  }), 30);
  assert.equal(clampFtueCameraPanToCoverage({
    edgeBleed: 2,
    projectedBottom: 840,
    projectedTop: -100,
    requestedPanY: -72,
    viewportHeight: 800,
  }), -38);
  assert.ok(FTUE_OPENING_UI_DELAY_MS >= FTUE_OPENING_CAMERA_DURATION_MS);
  assert.match(route, /setTimeout\(\(\) => setFtueOpeningUiVisible\(true\), FTUE_OPENING_UI_DELAY_MS\)/);
  assert.match(route, /scriptedCameraPinchTarget = ftueCameraPinchTarget \?\? regularCameraPinchTarget/);
  assert.match(route, /scriptedPinchScale: scriptedCameraPinchTarget/);
  assert.match(route, /onboardingCameraPanY=\{ftueHomeCameraPanTarget/);
  assert.match(route, /onboardingCameraDurationMs=\{ftueHomeCameraDuration/);
  assert.match(route, /onboardingUiVisible=\{ftueOpeningUiVisible && !ftueEnergyBridgeStep\}/);
  assert.match(nurture, /onboardingFocus && onboardingUiVisible && onboardingGuide/);
  assert.match(motion, /withTiming\(resolvedScriptedPinchScale/);
  assert.match(motion, /enabled\(enabled && !frozen && !scriptedGestureLocked\)/);
  assert.match(nurture, /onboardingCameraPanTranslateY\.value = reduceMotion[\s\S]*?withTiming\(onboardingCameraPanY/);
  assert.match(nurture, /clampedOnboardingCameraPanY = useDerivedValue/);
  assert.match(nurture, /if \(onboardingCameraProgress\.value <= 0\) return 0;[\s\S]*?clampFtueCameraPanToCoverage/u);
  assert.match(nurture, /clampFtueCameraPanToCoverage\(\{[\s\S]*?edgeBleed: FTUE_CAMERA_COVERAGE_BLEED,[\s\S]*?projectedBottom,[\s\S]*?projectedTop,[\s\S]*?requestedPanY: onboardingCameraPanTranslateY\.value/);
  assert.match(nurture, /HOME_FTUE_CAMERA_Y_OFFSET \* onboardingCameraProgress\.value[\s\S]*?clampedOnboardingCameraPanY\.value/);
});

test('each Discovery Egg answer grants the same visual Growth', async () => {
  const { FTUE_EGG_ANSWER_GROWTH_REWARD, MOSSPROUT_FTUE_SCRIPT } = await import('../features/onboarding/mossprout-ftue-script');
  const questionSteps = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) =>
    ['egg.opening', 'egg.context', 'egg.mind'].includes(step.id)
  );
  assert.equal(questionSteps.length, 3);
  assert.deepEqual(
    questionSteps.map((step) => step.actions[0]?.growthReward),
    [FTUE_EGG_ANSWER_GROWTH_REWARD, FTUE_EGG_ANSWER_GROWTH_REWARD, FTUE_EGG_ANSWER_GROWTH_REWARD],
  );
});

test('scripted Egg faces use the stable image transition instead of animated-style cleanup', () => {
  const artwork = readFileSync('components/katchadeck/egg-avatar/egg-avatar-artwork.tsx', 'utf8');
  const player = readFileSync('components/katchadeck/egg-avatar/use-egg-expression-player.ts', 'utf8');
  assert.match(artwork, /transition=\{faceTransitionDuration\}/);
  assert.match(artwork, /useEggExpressionPlayer/);
  assert.doesNotMatch(artwork, /useAnimatedStyle|useSharedValue/);
  assert.match(player, /if \(!sequence\?\.length\)/);
  assert.match(player, /const timers = sequence\.map/);
  assert.doesNotMatch(player, /setPresentation\([^)]*baseFaceId[^)]*\)[\s\S]*const timers/);
});

test('the first FTUE prompt sleeps, feeds through happy faces, and lifts a small Egg onto its platform', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const feed = readFileSync('features/today/use-egg-feed-controller.ts', 'utf8');
  assert.match(home, /onboardingEggSleeping = Boolean\(onboardingFocus && scriptedMoodAction && !scriptedMoodSelection\)/);
  assert.match(home, /forceSleeping=\{onboardingEggSleeping\}/);
  assert.match(egg, /faceId=\{forceSleeping \? 'sleepy' : equippedFaceId\}/);
  assert.match(egg, /forceSleeping[\s\S]*?showForcedSleepIndicator[\s\S]*?!isActivated && showDormantIndicator/);
  assert.match(egg, /TODAY_DORMANT_ZZZ_TOP_OFFSET = 92/);
  assert.match(egg, /lightColor="#5B3A70"/);
  assert.match(egg, /textShadowColor: 'rgba\(255,246,220,0\.96\)'/);
  assert.match(home, /showForcedSleepIndicator=\{false\}/);
  assert.match(home, /stageScale=\{explorationEggFrame\.scale \* HOME_FTUE_CAMERA_SCALE\}/);
  assert.match(egg, /shouldRasterizeIOS=\{false\}/);
  assert.match(egg, /FEED_HAPPY_EXPRESSION_IDS = \['big-grin', 'happy-squint'\]/);
  assert.match(egg, /\{ faceId: equippedFaceId, atMs: 900/);
  assert.match(egg, /expressionSequenceKey=\{discoveryHatch \? `[\s\S]*?`feed:\$\{feedExpressionKey\}`/);
  assert.match(feed, /setEggFeedLaunchKey\(\(key\) => key \+ 1\)/);
  assert.match(egg, /platformLift = \(1 - visualGrowth\.value\)[\s\S]*?\* SMALL_EGG_PLATFORM_LIFT[\s\S]*?\* eggStageScale[\s\S]*?\* \(projectedCameraScale\?\.value \?\? 1\)/);
  assert.match(home, /baseEggBottomY = stageTop[\s\S]*?explorationEggFrame\.top[\s\S]*?explorationEggFrame\.height/);
  assert.match(home, /pinchedEggBottomY = scenePinchFocusY[\s\S]*?baseEggBottomY - scenePinchFocusY\) \* pinchScale/);
  assert.match(home, /translateY: projectedEggBottomY - baseEggBottomY/);
  assert.match(egg, /transformOrigin: 'center bottom'/);
  assert.match(egg, /translateY: -platformLift - activationPulse\.value/);
  assert.match(egg, /TODAY_EGG_NATIVE_SURFACE_SCALE =/);
  assert.match(egg, /height: eggFrame\.height \* TODAY_EGG_NATIVE_SURFACE_SCALE/);
  assert.match(egg, /width: 200 \* eggStageScale \* TODAY_EGG_NATIVE_SURFACE_SCALE/);
  assert.match(egg, /const growthScale = 0\.5 \+ visualGrowth\.value \* 0\.5/);
  assert.match(egg, /scale: growthScale[\s\S]*?\* reactionScale[\s\S]*?\* \(projectedCameraScale\?\.value \?\? 1\)[\s\S]*?\/ TODAY_EGG_NATIVE_SURFACE_SCALE/);
  assert.match(egg, /Camera, growth and reaction are composed into this one downscale/);
  assert.doesNotMatch(egg, /eggMotionStyle[\s\S]*?scale: 1\s*\+ feedbackPulse/);
  assert.doesNotMatch(egg, /height: eggFrame\.height \* growthScale/);
  assert.match(egg, /shouldRasterizeIOS=\{false\}/);
  assert.match(egg, /platformLift = \(1 - growth\.value\) \* SMALL_EGG_PLATFORM_LIFT \* stageScale/);
});

test('scripted actions reuse the regular cream action surface and staged row motion', () => {
  const actions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  assert.match(actions, /tone="cream"/);
  assert.match(actions, /FadeInUp\.duration\(300\)/);
  assert.match(actions, /FadeOutUp\.duration\(230\)/);
  assert.match(actions, /action\.presentation !== 'inline_choice'/);
  assert.doesNotMatch(actions, /ChoiceChip|expandedId|departingId/);
  assert.doesNotMatch(actions, /tone=\{expanded \? 'gold'/);
});

test('FTUE CTA actions use the same glowing primary button as Talk to Mossprout', () => {
  const actions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(actions, /action\.presentation === 'cta_action'/);
  assert.match(actions, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?label=\{action\.title\}[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
  assert.match(route, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?label="Talk to Mossprout"[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
});

test('opening FTUE removes the white environment fade and introduces UI from below', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /!onboardingFocus \? <View pointerEvents="none" style=\{styles\.environmentFade\} \/> : null/);
  assert.match(home, /entering=\{FadeInDown\.duration\(260\)\.easing\(Easing\.out\(Easing\.cubic\)\)\}/);
  assert.match(home, /enterFromBottom \? FadeInDown : FadeInUp/);
  assert.ok((home.match(/enterFromBottom/g) ?? []).length >= 8);
});

test('the first FTUE feeling beat uses the real Home mood action', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(home, /scriptedMoodAction && scriptedPanelCareAction/);
  assert.match(home, /<InlineMood/);
  assert.match(home, /function InlineMood[\s\S]*?<InlineCheckInPanel[\s\S]*?illustratedChoices/);
  assert.match(home, /candidate\.domainChoiceId === selection\.id/);
  assert.match(route, /scriptedPanelCareAction=\{ftuePanelCareAction\}/);
});

test('mood and sleep reuse the compact illustrated answer-card treatment', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /function InlineMood[\s\S]*?surface: FTUE_CHOICE_TONES\[index % FTUE_CHOICE_TONES\.length\]\.surface[\s\S]*?illustratedChoices/);
  assert.match(home, /function InlineSleep[\s\S]*?surface: FTUE_CHOICE_TONES\[index % FTUE_CHOICE_TONES\.length\]\.surface[\s\S]*?illustratedChoices/);
  assert.match(home, /illustrated && allowSkip && styles\.illustratedQuestionAnchorSkippable/);
});

test('later FTUE choice beats specialize the same inline check-in panel lifecycle', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /function InlineScriptedChoice/);
  assert.match(home, /function InlineScriptedChoice[\s\S]*?<InlineCheckInPanel[\s\S]*?illustratedChoices/);
  assert.match(home, /illustratedChoices \? styles\.illustratedChoiceGrid/);
  assert.match(home, /function MeasuredIllustratedChoice/);
  assert.match(home, /getFtueChoiceArt\(option\)/);
  assert.match(home, /<FtueEnergyBadge amount=\{action\.growthReward\}/);
  assert.match(home, /illustratedAvailableWidth = illustratedGridWidth \|\| illustratedFallbackWidth/);
  assert.match(home, /function getFtueChoiceColumnCount\(choiceCount: number\)/);
  assert.match(home, /if \(choiceCount <= 3\) return Math\.max\(1, choiceCount\)/);
  assert.match(home, /if \(choiceCount === 4\) return 2/);
  assert.match(home, /illustratedColumnCount = getFtueChoiceColumnCount\(choices\.length\)/);
  assert.match(home, /setIllustratedGridWidth\(\(current\) => current === measuredWidth \? current : measuredWidth\)/);
  assert.match(home, /setScriptedTextCompletion/);
  assert.match(home, /key=\{scriptedTextChoiceAction\.id\}/);
  assert.match(home, /scriptedRowActions = scriptedActions\.filter\(\(action\) => action\.presentation !== 'inline_choice' && action\.presentation !== 'route_action'\)/);
});

test('sequential FTUE choice panels cannot consume the previous question completion', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /currentScriptedTextSelection = scriptedTextSelection\?\.action\.instanceId === scriptedTextActionInstanceId/);
  assert.match(home, /currentScriptedTextCompletion = scriptedTextCompletion\?\.action\.instanceId === scriptedTextActionInstanceId/);
  assert.match(home, /selection=\{currentScriptedTextSelection\}/);
  assert.match(home, /completionEvent=\{currentScriptedTextCompletion\}/);
  assert.match(home, /ownedSelection = selection\?\.action\.instanceId === action\.instanceId/);
  assert.match(home, /ownedCompletionEvent = completionEvent\?\.action\.instanceId === action\.instanceId/);
  assert.match(home, /if \(!ownedCompletionEvent \|\| completedEventRef\.current === ownedCompletionEvent\.id\) return/);
});

test('FTUE inline questions wrap cleanly and do not expose daily-action skip controls', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /<InlineMood[\s\S]*?allowSkip=\{false\}/);
  assert.match(home, /function InlineScriptedChoice[\s\S]*?<InlineCheckInPanel[\s\S]*?allowSkip=\{false\}/);
  assert.match(home, /disabled=\{interactionLocked \|\| !allowSkip\}/);
  assert.match(home, /\{allowSkip \? \([\s\S]*?accessibilityLabel=\{`Skip \$\{action\.title\} for today`\}/);
  assert.match(home, /numberOfLines=\{2\}[\s\S]*?inlineQuestionRequired/);
  assert.match(home, /illustratedChoice:[^\n]*minHeight: 88[^\n]*paddingTop: 4/);
  assert.match(home, /illustratedChoiceThreeColumn:[^\n]*minHeight: 82/);
});

test('FTUE copy uses the shared cozy-game type hierarchy and stays concise', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const guide = readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8');
  const actions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const theme = readFileSync('constants/theme.ts', 'utf8');
  const eggSteps = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) => step.id.startsWith('egg.'));
  assert.match(theme, /ftueHeroTitle:[\s\S]*?AppFontFamilies\.fredokaBold/);
  assert.match(theme, /ftueBody:[\s\S]*?AppFontFamilies\.manrope/);
  assert.match(theme, /ftuePanelTitle:[\s\S]*?AppFontFamilies\.fredokaBold/);
  assert.match(home, /import \{ FtueGuideCopy \} from '@\/components\/katchadeck\/onboarding\/ftue-guide-copy'/);
  assert.match(guide, /KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.match(home, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  assert.match(actions, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  eggSteps.forEach((step) => {
    assert.ok(step.guide.title.split(/\s+/).length <= 5, `${step.id} title is too long`);
    assert.ok(step.guide.body.split(/\s+/).length <= 7, `${step.id} body is too long`);
  });
});

test('FTUE guide copy groups layered gold and supporting copy on one dark contrast surface', () => {
  const guide = readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8');
  const theme = readFileSync('constants/theme.ts', 'utf8');
  assert.match(theme, /gold: '#F6C653'/);
  assert.match(theme, /goldDeep: '#75450A'/);
  assert.match(guide, /styles\.titleShadow/);
  assert.match(guide, /lightColor=\{KatchaDeckUI\.ftue\.gold\}/);
  assert.match(guide, /lightColor=\{KatchaDeckUI\.ftue\.goldDeep\}/);
  assert.match(guide, /style=\{styles\.eyebrowPill\}/);
  assert.match(guide, /style=\{styles\.contentPanel\}/);
  assert.match(guide, /backgroundColor: KatchaDeckUI\.ftue\.contentSurface/);
  assert.match(guide, /lightColor=\{KatchaDeckUI\.ftue\.contentText\}/);
  assert.doesNotMatch(guide, /bodyPanel/);
});

test('Mossprout reveal name sits below the Egg stage and the interaction dock shares FTUE type', () => {
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const button = readFileSync('components/katchadeck/ui/katcha-button.tsx', 'utf8');
  assert.match(egg, /top: eggFrame\.top \+ eggFrame\.height \+ 8/);
  assert.match(egg, /discoveryName: \{ \.\.\.KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.doesNotMatch(egg, /Math\.min\(TODAY_KINGDOM_STAGE_HEIGHT - 36/);
  assert.match(route, /label="Talk to Mossprout"[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
  assert.match(route, /discoveryInteractionHint: \{[\s\S]*?KatchaDeckUI\.typography\.ftuePanelBody/);
  assert.match(button, /labelStyle\?: StyleProp<TextStyle>/);
});

test('Discovery Hatch remains inside the forming Home Egg stage', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(home, /discoveryHatch=\{hatchPresentation\}/);
  assert.match(egg, /expressionSequence=\{[\s\S]*?discoveryHatch && !discoveryPhaseAtLeast/);
  assert.match(egg, /DISCOVERY_CRACK_ONE/);
  assert.doesNotMatch(home, /<TodayTileHatchReveal/);
  assert.match(route, /hatchOwnership: dailyHatchActive \? 'daily_surface' : discoveryHatchInPlace \? 'discovery_in_place'/);
  assert.match(route, /hatchPresentation=\{isHatching && hatchPresentation\.policy === 'ftue_discovery'/);
});

test('Discovery Hatch waits for creature art and fails back to a retryable Egg', () => {
  const controller = readFileSync('features/today/use-today-hatch-reveal-controller.ts', 'utf8');
  assert.match(controller, /!assetsReadyRef\.current\.subject/);
  assert.match(controller, /DISCOVERY_ASSET_WATCHDOG_MS/);
  assert.match(controller, /handleHatchSubjectError/);
  assert.match(controller, /Tap Hatch to try again/);
  assert.doesNotMatch(controller, /handleDiscoveryReveal[\s\S]*?setTimeout\(\(\) => schedulePresentation\(runId\), 1_200\)/);
});

test('Discovery Hatch freezes Home motion without resetting its camera values', () => {
  const environment = readFileSync('components/katchadeck/home/today-environment-motion.tsx', 'utf8');
  const exploration = readFileSync('components/katchadeck/home/today-exploration-background.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(environment, /if \(frozen\) \{[\s\S]*?cancelAnimation\(pinchScale\);[\s\S]*?return;/);
  assert.match(exploration, /if \(frozen\) \{[\s\S]*?cancelAnimation\(translateX\);/);
  assert.match(route, /frozen: discoveryHatchInPlace/);
  assert.match(route, /const explorationBackgroundActive = !dailyHatchActive/);
});
