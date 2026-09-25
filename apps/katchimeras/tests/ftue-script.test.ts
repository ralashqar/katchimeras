import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from './helpers/content-fs';
import test from 'node:test';
import { roundedMultiCutoutSegments } from '@/features/onboarding/spotlight-geometry';


import { FTUE_ACTION_CATALOG, FTUE_HANDLER_REGISTRY } from '@/features/onboarding/ftue-action-registry';
import {
  activeFtueNavigationPolicy,
  ftueForegroundKeepsResidentMerge,
  ftueLocksSurfaceNavigation,
  ftueOwnsOpeningHome,
  ftueResumeTargetMatches,
  residentJourneyReachedMatchResult,
} from '@/features/onboarding/ftue-navigation-policy';
import type { JourneyDayRecord } from '@/types/relationship-progression';
import {
  FTUE_EGG_ANSWER_GROWTH_REWARD,
  MOSSPROUT_FTUE_SCRIPT,
  MOSSPROUT_WORLD_EGG_CLOSE_ZOOM,
  MOSSPROUT_WORLD_EGG_ENTRY_ZOOM,
  MOSSPROUT_WORLD_EGG_REST_ZOOM,
  mossproutFtueAction,
  mossproutFtueStep,
  mossproutFtueUsesHostedCompanionStage,
  mossproutWorldEggZoom,
  validateMossproutFtueScript,
  mossproutFtueShowsWorldGarden,
} from '@/features/onboarding/mossprout-ftue-script';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { ftueNeedsV28QuestionnaireRestart, ftueV28QuestionnaireLoopRecoveryStep, streamlinedFtueStep } from '@/features/onboarding/ftue-migration-policy';
import { MOSSPROUT_BOND_SHARE_PROMPTS, MOSSPROUT_SUPPORT_STYLE_OPTIONS, mossproutBondShareSelection, mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { MOSSPROUT_GARDEN_INTRO_BEATS, mossproutGardenIntroBeat } from '@/features/onboarding/mossprout-garden-intro';
import {
  reduceResidentFtueNavigationSession,
  residentMergeLiveRouteDecision,
  type ResidentFtueNavigationSession,
} from '@/features/onboarding/resident-ftue-navigation-session';
import { ftueNavigationYieldsToDevRecovery } from '@/features/onboarding/ftue-dev-recovery';
import { mossproutFtueConversationDefinitions } from '@/constants/mossprout-ftue-conversations';
import { buildYesterdayStepEnergyOffer, mergeStepEnergyPreview } from '@/utils/merge-world/economy-policy';
import {
  FTUE_OPENING_CAMERA_DURATION_MS,
  FTUE_OPENING_UI_DELAY_MS,
  FTUE_OPENING_CAMERA_PAN_Y,
  clampFtueCameraPanToCoverage,
  ftueHomeCameraPanTarget,
  ftueHomeCameraPinchTarget,
  mossproutGroveEggCameraPanTarget,
  mossproutGroveEggCameraPinchTarget,
  mossproutGroveEggEnergyRatio,
} from '@/features/onboarding/ftue-home-camera';
import { eggScaleForEnergyRatio } from '@/utils/today-growth';
import { MOSSPROUT_HELP_OPTIONS, MOSSPROUT_DAY_OPTIONS, MOSSPROUT_WATER_OPTIONS, mossproutSeedIntroduction } from '@/features/onboarding/mossprout-ftue-copy';
import { mergeFtueDisplayGuide } from '@/features/onboarding/merge-ftue-guidance';

test('Merge speech guidance is one green line and appears only for first-use mechanics', () => {
  const mergeSteps = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) => step.surface === 'merge');
  const visible = mergeSteps.flatMap((step) => {
    const guide = mergeFtueDisplayGuide(step);
    return guide ? [{ id: step.id, guide }] : [];
  });
  assert.deepEqual(visible.map(({ id }) => id), [
    'merge.serve_sprout',
    'merge.plant.spawn',
    'merge.plant.seed_pairs',
    'merge.return_note',
    'merge.resident_parcel',
    'merge.resident_card',
  ]);
  for (const { guide } of visible) {
    assert.equal(guide.eyebrow, '');
    assert.equal(guide.body, '');
    assert.ok(guide.title.length <= 42);
  }
  // The Garden lesson's beats each say their one line; a free beat's line follows whatever the finger points at.
  const long = { eyebrow: 'old', title: 'A much longer title', body: 'A much longer explanation.' };
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.parcel', cue: { kind: 'tap', target: { kind: 'tray_parcel', arrivalId: 'x' } }, guide: long })?.title, 'Open the parcel.');
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.spawn', cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } }, guide: long })?.title, 'Tap the Basket for a Seed.');
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.grow', cue: { kind: 'drag', from: { kind: 'board_cell', cell: 1 }, to: { kind: 'board_cell', cell: 2 } }, guide: long })?.title, 'Grow a Plant. Two of the same make the next.');
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.grow', cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } }, guide: long })?.title, 'Grow a Plant. Two of the same make the next.');
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.serve', cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'o' } }, guide: long })?.title, 'Give it here.');
  assert.equal(mergeFtueDisplayGuide({ id: 'glow.lesson.single.match-2', cue: { kind: 'drag', from: { kind: 'board_cell', cell: 1 }, to: { kind: 'board_cell', cell: 2 } }, guide: long }), null, 'the sleeper matches are gone from the lesson');
});

test('the spotlight cutout and the Garden handoff keep their shape without the obsolete plant-order tray', () => {
  const holes = [{ x: 20, y: 30, width: 280, height: 130 }, { x: 180, y: 480, width: 160, height: 240 }];
  const mask = roundedMultiCutoutSegments(holes, 16, { width: 360, height: 780 });
  const dimmed = (x: number, y: number) => mask.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  assert.equal(dimmed(150, 90), false);
  assert.equal(dimmed(260, 600), false);
  assert.equal(dimmed(180, 300), true);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.doesNotMatch(screen, /FrozenMergeOrderTrayCard|gardenHandoffOrder|gardenRequestBubble/);
  assert.deepEqual(mossproutFtueStep('world.garden_handoff')?.spotlight?.targets,
    [{ kind: 'haven_garden_button', characterId: 'mossprout' }]);
  assert.doesNotMatch(readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8'), /CHAIR_ART|chairArt|order-chair/);
  assert.match(screen, /ref=\{setGardenClusterNode\}/);
});

test('terminal meditation restores Back and finishes FTUE before exiting interaction', () => {
  const meditationRun = { status: 'active', stepId: 'companion.meditating' } as const;
  assert.equal(ftueLocksSurfaceNavigation(meditationRun, 'companion'), false);
  assert.equal(ftueLocksSurfaceNavigation(meditationRun, 'haven'), false);
  assert.equal(ftueLocksSurfaceNavigation({ status: 'active', stepId: 'companion.first_rest' }, 'companion'), true);
  assert.equal(mossproutFtueAction('companion.meditating', 'companion.tend_garden')?.nextStepId, 'complete');

  const kingdom = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const route = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  assert.match(kingdom, /!upgradePresentation && \(!ftueStepId \|\| ftueStepId === 'companion\.meditating'\)/);
  const exitHandler = kingdom.slice(kingdom.indexOf('const requestResidentInteractionExit'), kingdom.indexOf('const pulseVisibleResident'));
  assert.match(exitHandler, /run\?\.status === 'active' && run\.stepId === 'companion\.meditating'[\s\S]*?advanceFtueActionDurably[\s\S]*?setInteractionExitNonce/);
  assert.match(exitHandler, /else if \(ftueStepId && run\?\.status !== 'complete'\) return/);
  assert.match(exitHandler, /ftueStepId && ftueStepId !== 'companion\.meditating'[\s\S]*?hardwareBackPress[\s\S]*?requestResidentInteractionExit\(\)/);
  assert.match(route, /onCloseCompanion=\{\(\) => \{[\s\S]*?run\.stepId === 'companion\.meditating'[\s\S]*?completeFtueProfileStep\(\)/);
  assert.match(route, /if \(run\.stepId === 'companion\.meditating'\) return continueToMist\(\)/);
});

test('Mossprout FTUE script has valid transitions and registered handlers', () => {
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'world.mist_open');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.terminalStepId, 'complete');
  assert.equal(mossproutFtueStep('world.egg_intro')?.actions[0]?.nextStepId, 'egg.opening');
  assert.equal(mossproutFtueStep('grove.egg_inspect'), null);
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
  }
});

test('Mossprout dialogue FTUE steps own their durable world-camera framing', () => {
  const dialogueStepIds = [
    'companion.first_meeting',
    'companion.nickname',
    'companion.bond_intro',
    'companion.garden_intro',
    'companion.order_preview',
    'companion.chapter_zero_return',
    'companion.bond_spotlight',
    'companion.day_one_action',
    'companion.resident_affinity',
    'companion.resident_parcel_ready',
    'companion.resident_match_result',
  ] as const;

  for (const stepId of dialogueStepIds) {
    const camera = mossproutFtueStep(stepId)?.camera;
    assert.equal(camera?.kind, 'focus_target', `${stepId} should restore a focused camera`);
    if (camera?.kind !== 'focus_target') continue;
    assert.deepEqual(camera.target, { kind: 'haven_resident', characterId: 'mossprout' });
    assert.equal(camera.zoom, MOSSPROUT_WORLD_EGG_REST_ZOOM);
    assert.equal(camera.anchorY, 0.5);
  }
});

test('local player details stay bounded while the first FTUE resident stays fixed to Petalimp', () => {
  const profile = readFileSync('features/onboarding/mossprout-profile.ts', 'utf8');
  const state = readFileSync('utils/onboarding-state.ts', 'utf8');
  assert.match(state, /replace\(\/\[\\u0000-\\u001F\\u007F\]\/g, ' '\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)/);
  assert.match(state, /Array\.from\(normalized\)\.slice\(0, 20\)\.join\(''\)/);
  assert.match(profile, /mossy_forest: 'fernip'/);
  assert.match(profile, /flower_meadow: 'petalimp'/);
  assert.match(profile, /rainy_pond: 'drizzlet'/);
  assert.match(profile, /windy_hill: 'driftkin'/);
  assert.match(profile, /RESIDENT_BY_PLACE\[placeId\] \?\? null/);
  assert.match(profile, /MOSSPROUT_FTUE_FIRST_RESIDENT_ID: KatchimeraSkinId = 'petalimp'/);
  assert.match(profile, /field === 'companionPlaceId'[\s\S]*?MOSSPROUT_FTUE_FIRST_RESIDENT_ID/);
});

test('the first Bond action turns a soft intention into a Seed direction', () => {
  assert.equal(MOSSPROUT_BOND_SHARE_PROMPTS.length, 1);
  assert.equal(MOSSPROUT_BOND_SHARE_PROMPTS.every((prompt) => prompt.options.length === 3), true);
  assert.equal(MOSSPROUT_SUPPORT_STYLE_OPTIONS.length, 4);
  const selection = mossproutBondShareSelection('desired-help:progress');
  assert.match(selection!.prompt.prompt, /One seed survived under my roots/);
  assert.equal(selection?.answer.label, 'Then let’s find out.');
  assert.equal(mossproutBondShareSelection('desired-help:energy')?.answer.label, 'Getting some energy back');
  assert.equal(mossproutBondShareSelection('desired-help:good_day')?.answer.label, 'Just having a good day');
  assert.equal(mossproutBondShareSelection('desired-help:not-an-answer'), null);
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

test('script migration collapses the mistaken parallel opening into the existing Egg steps', () => {
  const runtime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  assert.match(runtime, /'egg\.companion_goal': 'egg\.opening'/);
  assert.match(runtime, /'egg\.support_need': 'egg\.context'/);
  assert.match(runtime, /'egg\.notice_focus': 'egg\.mind'/);
  assert.match(runtime, /rewrittenEggQuestionnaireNeedsRestart = ftueNeedsV28QuestionnaireRestart\(run\)/);
  assert.doesNotMatch(runtime, /legacyReadyNeedsQuestionnaire|startsWith\('egg\.nature_detail\.'\)/);
  assert.match(runtime, /stepId: replacementOpeningStep[\s\S]*?\? replacementOpeningStep/);
  assert.match(runtime, /if \(snapshot === undefined\)[\s\S]*?const migrated = migrateCurrentScript\(snapshot\)/);
  assert.doesNotMatch(runtime, /if \(snapshot !== undefined\) return snapshot/);
  const replacedWorldEntrySet = runtime.match(/replacedWorldEntrySteps = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '';
  assert.doesNotMatch(replacedWorldEntrySet, /world\.egg_intro|grove\.egg_inspect/);
  assert.match(runtime, /replacedWorldEntrySteps\.has\(migratedStepId\)[\s\S]*?\? 'world\.egg_intro'/);
  assert.match(runtime, /removedEggInspectSteps = new Set\(\['grove\.egg_inspect'\]\)[\s\S]*?\? 'egg\.opening'/);
  assert.match(runtime, /replacedWorldCompletionSteps[\s\S]*?'haven\.reveal'[\s\S]*?'world\.complete'/);
  assert.match(runtime, /needsResidentParcelConfirmation[\s\S]*?run\.scriptVersion < 21[\s\S]*?companion\.resident_parcel_ready/);
  assert.match(runtime, /needsV33FirstBloomBridge[\s\S]*?run\.scriptVersion === 32[\s\S]*?run\.stepId === 'haven\.reveal'[\s\S]*?'companion\.resident_parcel_ready'/);
  assert.match(runtime, /removedFrictionSteps = new Set\(\['haven\.first_bloom'\]\)[\s\S]*?'companion\.resident_parcel_ready'/);
});

test('the current fifth answer stays on Hatch instead of restarting the questionnaire', () => {
  const readyRun = {
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: 'egg.ready',
    status: 'active' as const,
  };
  assert.equal(ftueNeedsV28QuestionnaireRestart(readyRun), false);
  assert.equal(ftueNeedsV28QuestionnaireRestart({ ...readyRun, scriptVersion: 27 }), true);
});

test('a save already affected by the questionnaire loop recovers directly to Hatch', () => {
  const loopedRun = {
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: 'egg.opening',
    status: 'active' as const,
    answers: Object.fromEntries([
      'egg.desired_feeling',
      'egg.main_difficulty',
      'egg.support_style',
      'egg.life_priority',
      'egg.companion_place',
    ].map((actionId) => [actionId, { actionId }])),
  };
  assert.equal(ftueV28QuestionnaireLoopRecoveryStep(loopedRun), 'egg.ready');
  assert.equal(ftueV28QuestionnaireLoopRecoveryStep({
    ...loopedRun,
    answers: { ...loopedRun.answers, 'egg.companion_place': undefined },
  }), null);
});

test('backend catalog contains only allowlisted privacy-safe action ids', () => {
  assert.ok(FTUE_ACTION_CATALOG.some((item) => item.stepId === 'egg.opening' && item.actionId === 'egg.day_texture' && item.backendEvent));
  assert.ok(FTUE_ACTION_CATALOG.every((item) => !('optionId' in item)));
});

test('Supabase receipt allowlist matches every backend FTUE action', () => {
  const v24Migration = readFileSync('supabase/migrations/20260825224500_register_mossprout_ftue_v24.sql', 'utf8');
  const v25Migration = readFileSync('supabase/migrations/20260825235500_register_mossprout_ftue_v25.sql', 'utf8');
  const v26Migration = readFileSync('supabase/migrations/20260826003000_register_mossprout_ftue_v26.sql', 'utf8');
  const v27Migration = readFileSync('supabase/migrations/20260826090000_register_mossprout_ftue_v27.sql', 'utf8');
  const v28Migration = readFileSync('supabase/migrations/20260826120000_register_mossprout_ftue_v28.sql', 'utf8');
  const v29Migration = readFileSync('supabase/migrations/20260826143000_register_mossprout_ftue_v29.sql', 'utf8');
  const v30Migration = readFileSync('supabase/migrations/20260826170000_register_mossprout_ftue_v30.sql', 'utf8');
  const v31Migration = readFileSync('supabase/migrations/20260826193000_register_mossprout_ftue_v31.sql', 'utf8');
  const v32Migration = readFileSync('supabase/migrations/20260826210000_register_mossprout_ftue_v32.sql', 'utf8');
  const v33Migration = readFileSync('supabase/migrations/20260826211000_register_mossprout_ftue_v33.sql', 'utf8');
  const v34Migration = readFileSync('supabase/migrations/20260901120000_register_mossprout_ftue_v34.sql', 'utf8');
  const v35Migration = readFileSync('supabase/migrations/20260901153000_register_mossprout_ftue_v35.sql', 'utf8');
  const v36Migration = readFileSync('supabase/migrations/20260902120000_register_mossprout_ftue_v36.sql', 'utf8');
  const v37Migration = readFileSync('supabase/migrations/20260902143000_register_mossprout_ftue_v37.sql', 'utf8');
  const v38Migration = readFileSync('supabase/migrations/20260902154500_register_mossprout_ftue_v38.sql', 'utf8');
  const v39Migration = readFileSync('supabase/migrations/20260902170000_register_mossprout_ftue_v39.sql', 'utf8');
  const v40Migration = readFileSync('supabase/migrations/20260903100000_register_mossprout_ftue_v40.sql', 'utf8');
  const v41Migration = readFileSync('supabase/migrations/20260903153000_register_mossprout_ftue_v41.sql', 'utf8');
  const v43Migration = readFileSync(`supabase/migrations/${readdirSync('supabase/migrations').find((name) => name.endsWith('_register_mossprout_ftue_v43.sql'))}`, 'utf8');
  const v44Migration = readFileSync(`supabase/migrations/${readdirSync('supabase/migrations').find((name) => name.endsWith('_register_mossprout_ftue_v44.sql'))}`, 'utf8');
  const v42Migration = readFileSync('supabase/migrations/20260903170000_register_mossprout_ftue_v42.sql', 'utf8');
  const v23Migration = readFileSync('supabase/migrations/20260825223000_register_mossprout_ftue_v23.sql', 'utf8');
  const v22Migration = readFileSync('supabase/migrations/20260825190000_register_mossprout_ftue_v22.sql', 'utf8');
  const v21Migration = readFileSync('supabase/migrations/20260825173000_register_mossprout_ftue_v21.sql', 'utf8');
  const v20Migration = readFileSync('supabase/migrations/20260825150000_register_mossprout_ftue_v20.sql', 'utf8');
  const migration = readFileSync('supabase/migrations/20260823194500_register_mossprout_ftue_v19.sql', 'utf8');
  const v18Migration = readFileSync('supabase/migrations/20260823173000_register_mossprout_ftue_v18.sql', 'utf8');
  const v17Migration = readFileSync('supabase/migrations/20260822173032_register_mossprout_ftue_v17.sql', 'utf8');
  const priorMigration = readFileSync('supabase/migrations/20260818170000_register_mossprout_ftue_v16.sql', 'utf8');
  for (const item of FTUE_ACTION_CATALOG.filter((entry) => entry.backendEvent)) {
    assert.match(`${priorMigration}\n${v17Migration}\n${v18Migration}\n${migration}\n${v20Migration}\n${v21Migration}\n${v22Migration}\n${v23Migration}\n${v24Migration}\n${v25Migration}\n${v26Migration}\n${v27Migration}\n${v28Migration}\n${v29Migration}\n${v30Migration}\n${v31Migration}\n${v32Migration}\n${v33Migration}\n${v34Migration}\n${v35Migration}\n${v36Migration}\n${v37Migration}\n${v38Migration}\n${v39Migration}\n${v40Migration}\n${v41Migration}\n${v42Migration}\n${v43Migration}`, new RegExp(`'${item.stepId}',\\s*'${item.actionId}'`));
  }
  assert.match(v24Migration, /script_version = 23/);
  assert.match(v25Migration, /script_version = 24/);
  assert.match(v26Migration, /script_version = 25/);
  assert.match(v27Migration, /script_version = 26/);
  assert.match(v28Migration, /script_version = 27/);
  assert.match(v29Migration, /script_version = 28/);
  assert.match(v30Migration, /script_version = 29/);
  assert.match(v31Migration, /script_version = 30/);
  assert.match(v32Migration, /script_version = 31/);
  assert.match(v33Migration, /script_version = 32/);
  assert.match(v34Migration, /script_version = 33/);
  assert.match(v35Migration, /script_version = 34/);
  assert.match(v36Migration, /script_version = 35/);
  assert.match(v36Migration, /not \(step_id = 'haven\.first_bloom' and action_id = 'haven\.continue_to_resident'\)/);
  assert.match(v37Migration, /script_version = 36/);
  assert.match(v37Migration, /step_id not in \('world\.egg_intro', 'grove\.egg_inspect'\)/);
  assert.match(v38Migration, /script_version = 37/);
  assert.match(v38Migration, /'world\.egg_intro', 'world\.inspect_mossprout_egg', 'haven'/);
  assert.match(v39Migration, /script_version = 38/);
  assert.match(v39Migration, /'egg\.opening', 'egg\.day_texture', 'haven'/);
  assert.match(v40Migration, /script_version = 39/);
  assert.match(v40Migration, /'world\.first_bloom_restore', 'world\.restore_with_first_bloom', 'haven'/);
  assert.match(v40Migration, /'companion\.meditating', 'companion\.tend_garden', 'companion'/);
  assert.match(v41Migration, /script_version = 40/);
  assert.match(v41Migration, /'companion\.first_insight', 'companion\.confirm_first_reflection', 'companion'/);
  assert.match(v43Migration, /script_version = 42/);
  assert.match(v44Migration, /script_version = 43/);
  assert.match(v44Migration, /select script_id, 44, step_id, action_id, surface/);
  assert.match(v42Migration, /script_version = 41/);
  assert.match(v42Migration, /'world\.garden_arrival', 'world\.plant_first_seed', 'haven'/);
  assert.match(v23Migration, /script_version = 22/);
  assert.match(v22Migration, /script_version = 21/);
  assert.match(migration, /script_version = 18/);
  assert.doesNotMatch(migration, /step_id not in/);
  assert.doesNotMatch(`${priorMigration}\n${migration}\n${v20Migration}\n${v24Migration}\n${v25Migration}\n${v26Migration}\n${v27Migration}\n${v28Migration}\n${v29Migration}\n${v30Migration}\n${v31Migration}\n${v32Migration}\n${v33Migration}`, /option_id|option_label|answer_text/);
});

test('FTUE step conversion is retired from the Mossprout first session', () => {
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
  assert.match(today, /actionId: 'steps'[\s\S]*?amount: TODAY_GROWTH_REWARDS\.movement[\s\S]*?sourceId: `yesterday-steps:\$\{claimDayId\}`/);
  assert.match(today, /energyAmount: TODAY_GROWTH_REWARDS\.movement[\s\S]*?mergeEnergyAmount: energy/);
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
  assert.equal(mergeStepEnergyPreview(300), 0);
  assert.equal(mergeStepEnergyPreview(6_300), 0);
  assert.equal(mergeStepEnergyPreview(30_000), 0);
  assert.equal(buildYesterdayStepEnergyOffer({ dayId: '2026-08-14', observedAt: '2026-08-14T23:59:00.000Z', observedSteps: 299 }), null);
  assert.equal(buildYesterdayStepEnergyOffer({ dayId: '2026-08-14', observedAt: '2026-08-14T23:59:00.000Z', observedSteps: 300 }), null);
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

test('every active FTUE node has a canonical cold-start route', () => {
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    if (step.id === MOSSPROUT_FTUE_SCRIPT.terminalStepId) continue;
    const policy = activeFtueNavigationPolicy({ status: 'active', stepId: step.id });
    assert.ok(policy, `missing navigation policy for ${step.id}`);
    assert.equal(policy.surface, step.surface);
    if (step.surface === 'merge') assert.equal(policy.resume.kind, 'merge');
    else if (['companion.day_one_action', 'companion.garden_intro', 'companion.order_preview'].includes(step.id)) assert.equal(policy.resume.kind, 'haven');
    else if (step.surface === 'companion') assert.equal(policy.resume.kind, 'companion');
    else if (step.surface === 'haven' || step.surface === 'today' || step.surface === 'hatch') assert.equal(policy.resume.kind, 'haven');
    else assert.equal(policy.resume.kind, 'today');
  }
});

test('a durably earned resident card restores the explicit FTUE match result', () => {
  const completedResidentJourney = {
    familyId: 'mossprout',
    status: 'complete',
    matchedCardId: 'petalimp',
    completionReceipt: { cardId: 'petalimp' },
  } as JourneyDayRecord;

  assert.equal(residentJourneyReachedMatchResult({ status: 'active', stepId: 'merge.resident_card_reward' }, [completedResidentJourney]), true);
  assert.equal(residentJourneyReachedMatchResult({ status: 'active', stepId: 'companion.resident_parcel_ready' }, [completedResidentJourney]), true);
  assert.equal(residentJourneyReachedMatchResult({ status: 'complete', stepId: 'complete' }, [completedResidentJourney]), false);
  assert.equal(residentJourneyReachedMatchResult({ status: 'active', stepId: 'companion.first_meeting' }, [completedResidentJourney]), false);
});

test('resident Merge navigation distinguishes handoff, foreground recovery, pause, and completion', () => {
  const idle: ResidentFtueNavigationSession = { generation: 0, phase: 'idle' };
  const handoff = reduceResidentFtueNavigationSession(idle, { type: 'begin_handoff' });
  assert.deepEqual(handoff, { generation: 1, phase: 'handoff' });
  assert.equal(residentMergeLiveRouteDecision({
    pathname: '/katchimera/companion:mossprout',
    runActive: true,
    session: handoff,
    stepId: 'merge.resident_parcel',
    yieldsToRecoveryRoute: false,
  }), 'none', 'the normal CTA must own its transition');

  const recovery = reduceResidentFtueNavigationSession(handoff, { type: 'app_backgrounded' });
  assert.equal(recovery.phase, 'recovery_pending');
  assert.equal(reduceResidentFtueNavigationSession(recovery, { type: 'cancel_handoff' }).phase, 'idle');
  assert.equal(residentMergeLiveRouteDecision({
    pathname: '/katchimera/companion:mossprout',
    runActive: true,
    session: recovery,
    stepId: 'merge.resident_card',
    yieldsToRecoveryRoute: false,
  }), 'restore_merge', 'a late iOS companion route must return to Merge');
  assert.equal(residentMergeLiveRouteDecision({
    pathname: '/katchimera/companion:mossprout/activity',
    runActive: true,
    session: recovery,
    stepId: 'merge.resident_card',
    yieldsToRecoveryRoute: false,
  }), 'none');

  const presented = reduceResidentFtueNavigationSession(recovery, { type: 'merge_presented' });
  assert.equal(presented.phase, 'merge_presented');
  const paused = reduceResidentFtueNavigationSession(presented, { type: 'pause' });
  assert.equal(paused.phase, 'paused');
  assert.equal(residentMergeLiveRouteDecision({
    pathname: '/katchimera/companion:mossprout',
    runActive: true,
    session: paused,
    stepId: 'merge.resident_orders',
    yieldsToRecoveryRoute: false,
  }), 'none');
  assert.equal(reduceResidentFtueNavigationSession(paused, { type: 'begin_handoff' }).phase, 'handoff');
  assert.equal(reduceResidentFtueNavigationSession(presented, { type: 'finish' }).phase, 'idle');
  assert.equal(residentMergeLiveRouteDecision({
    pathname: '/dev-tools',
    runActive: true,
    session: presented,
    stepId: 'merge.resident_orders',
    yieldsToRecoveryRoute: true,
  }), 'none');
});

test('FTUE navigation always yields to the four-finger Developer Tools recovery route', () => {
  assert.equal(ftueNavigationYieldsToDevRecovery('/dev-tools', true), true);
  assert.equal(ftueNavigationYieldsToDevRecovery('/dev-profile-snapshots', true), true);
  assert.equal(ftueNavigationYieldsToDevRecovery('/explore', true), true);
  assert.equal(ftueNavigationYieldsToDevRecovery('/katchimera/companion:mossprout', true), false);
  assert.equal(ftueNavigationYieldsToDevRecovery('/dev-tools', false), false);
});

test('the first resident Garden handoff uses one shared parcel panel without a second speech bubble', () => {
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const stage = readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const panel = readFileSync('components/katchadeck/world/mossprout-journey-request-panel.tsx', 'utf8');
  const conversation = readFileSync('constants/mossprout-story-conversations.ts', 'utf8');
  const conversationFlow = readFileSync('features/companion/use-companion-conversation-flow.ts', 'utf8');
  assert.match(interaction, /residentParcelGardenPanelActive = props\.ftueResidentHandoffActive[\s\S]*?!props\.ftueResidentStoryResume/);
  assert.match(interaction, /showSpeechBubble=\{!props\.suppressWorldSpeech && ftueHasIntentionalSpeech && !narrativeOverlayVisible[\s\S]*?&& props\.ftueProfileStep !== 'bond_choice' && props\.ftueProfileStep !== 'notice_bond' && !initialConversationHandoffPending && \(Boolean\(companionSpeechTitle\) \|\| !residentParcelGardenPanelActive\)\}/);
  assert.match(interaction, /residentParcelHandoffActive: residentParcelGardenPanelActive,/);
  assert.match(stage, /residentParcelHandoffActive \? <View[\s\S]*?<MossproutJourneyRequestPanel/);
  assert.match(stage, /actionLabel="Go to the Garden"[\s\S]*?eyebrow="GARDEN PARCEL"/);
  assert.match(stage, /countLabel="1 parcel"/);
  assert.match(stage, /residentParcelHandoffActive[\s\S]*?styles\.residentParcelStage/);
  assert.match(stage, /residentParcelPanel[\s\S]*?fitContent/);
  assert.match(panel, /<CompanionMergeRequestTray[\s\S]*?countLabel=\{countLabel\}/);
  assert.match(panel, /fitContent && styles\.fitContent/);
  assert.match(conversation, /id: 'mossprout:game:form-finder'[\s\S]*?id: 'reveal'[\s\S]*?nextNodeId: null/);
  assert.doesNotMatch(conversation, /Their parcel is waiting in the garden/);
  assert.match(conversationFlow, /directResidentParcelHandoff[\s\S]*?node\?\.kind !== 'form_reveal'[\s\S]*?onContinue\(\)/);
});

test('Merge FTUE updates one persistent finger and spotlight tree for each measured target', () => {
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.doesNotMatch(overlay, /presentationKey/);
  assert.match(overlay, /<Animated\.View[\s\S]*?entering=\{FadeIn\.duration\(150\)\}[\s\S]*?<MergeFtueEggGuide/);
  assert.doesNotMatch(overlay, /key=\{`spotlight:|key=\{`cue:/);
  assert.match(overlay, /measurementGenerationRef/);
  assert.match(overlay, /stateRef\.current/);
  assert.match(overlay, /currentLayout\.targetRevision === targetRevision/);
  assert.match(overlay, /resetKey=\{`\$\{currentLayout\?\.targetRevision/);
  assert.match(overlay, /cancelAnimation\(progress\);[\s\S]*?progress\.value = 0;[\s\S]*?resetKey/);
  assert.doesNotMatch(overlay, /return \(\) => \{\s*cancelAnimation\(progress\);\s*progress\.value = 0/);
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
  assert.match(
    home,
    /const sceneLift = sceneHandoffProgress[\s\S]*?: sceneOnly[\s\S]*?\? 0[\s\S]*?: onboardingFocus[\s\S]*?\? HOME_SCENE_Y_OFFSET[\s\S]*?: -100 \+ sceneVerticalNudge/,
  );
  assert.match(home, /HOME_FTUE_CAMERA_SCALE - 1\) \* onboardingCameraProgress\.value/);
  assert.match(home, /<View pointerEvents="none" style=\{styles\.focusSceneViewport\}>[\s\S]*?<Animated\.View style=\{\[styles\.focusSceneCamera, focusSceneStyle\]\}>[\s\S]*?<TodayEnvironmentViewportMotionLayer/);
  assert.match(home, /<\/TodayEnvironmentViewportMotionLayer>[\s\S]*?<\/Animated\.View>[\s\S]*?<\/View>[\s\S]*?<Animated\.View[\s\S]*?projectedEggStageStyle[\s\S]*?<TodayKingdomEggHero/);
  assert.match(home, /focusSceneViewport: \{ \.\.\.StyleSheet\.absoluteFillObject, overflow: 'hidden' \}/);
  assert.match(home, /focusSceneCamera: \{ \.\.\.StyleSheet\.absoluteFillObject \}/);
  assert.match(home, /projectedCameraScale=\{projectedEggCameraScale\}/);
  assert.match(home, /<\/Animated\.View>[\s\S]*?<View[\s\S]*style=\{\[styles\.chrome/);
});

test('the opening camera pinches in before revealing UI and retreats across five questions', () => {
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const motion = readFileSync('components/katchadeck/home/today-environment-motion.tsx', 'utf8');

  assert.equal(ftueHomeCameraPinchTarget('egg.opening', 2), 2);
  const openingScale = ftueHomeCameraPinchTarget('egg.opening', 2)!;
  const contextScale = ftueHomeCameraPinchTarget('egg.context', 2)!;
  const mindScale = ftueHomeCameraPinchTarget('egg.mind', 2)!;
  const natureScale = ftueHomeCameraPinchTarget('egg.nature_theme', 2)!;
  const detailScale = ftueHomeCameraPinchTarget('egg.companion_identity', 2)!;
  const readyScale = ftueHomeCameraPinchTarget('egg.ready', 2)!;
  const ratios = [openingScale / contextScale, contextScale / mindScale, mindScale / natureScale, natureScale / detailScale, detailScale / readyScale];
  assert.ok(ratios.every((ratio) => Math.abs(ratio - ratios[0]!) < 1e-9));
  assert.equal(ftueHomeCameraPinchTarget('egg.ready', 2), 1);
  assert.equal(ftueHomeCameraPinchTarget('energy.steps_offer', 2), 1);
  assert.equal(ftueHomeCameraPinchTarget('companion.first_meeting', 2), null);
  assert.equal(ftueHomeCameraPanTarget('egg.opening'), FTUE_OPENING_CAMERA_PAN_Y);
  assert.equal(ftueHomeCameraPanTarget('egg.context'), FTUE_OPENING_CAMERA_PAN_Y * (4 / 5));
  assert.equal(ftueHomeCameraPanTarget('egg.mind'), FTUE_OPENING_CAMERA_PAN_Y * (3 / 5));
  assert.equal(ftueHomeCameraPanTarget('egg.nature_theme'), FTUE_OPENING_CAMERA_PAN_Y * (2 / 5));
  assert.equal(ftueHomeCameraPanTarget('egg.companion_identity'), FTUE_OPENING_CAMERA_PAN_Y * (1 / 5));
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

test('each Discovery Egg answer grants the same visual Growth', () => {
  const questionSteps = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) =>
    ['egg.opening', 'egg.context', 'egg.mind', 'egg.nature_theme', 'egg.companion_identity'].includes(step.id)
  );
  assert.equal(questionSteps.length, 5);
  assert.deepEqual(
    questionSteps.map((step) => step.actions[0]?.growthReward),
    Array.from({ length: 5 }, () => FTUE_EGG_ANSWER_GROWTH_REWARD),
  );
});

test('scripted Egg faces use the stable image transition instead of animated-style cleanup', () => {
  const artwork = (readFileSync('components/katchadeck/egg-avatar/egg-avatar-artwork.tsx', 'utf8') + readFileSync(require.resolve('@incubator/avatar/layered-avatar'), 'utf8'));
  const player = readFileSync(require.resolve('@incubator/avatar/expressions'), 'utf8');
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
  assert.match(home, /openingQuestionAwaitingAnswer = \(scriptedTextChoiceAction\?\.id === 'egg\.day_texture'[\s\S]*?&& !currentScriptedTextSelection/);
  assert.match(home, /onboardingEggSleeping = Boolean\(onboardingFocus && \([\s\S]*?scriptedMoodAction && !scriptedMoodSelection[\s\S]*?openingQuestionAwaitingAnswer/);
  assert.match(home, /regularEggSleeping = Boolean\(!onboardingFocus && growth\.energyRatio <= 0\)/);
  assert.match(home, /eggSleeping = onboardingEggSleeping \|\| regularEggSleeping/);
  assert.match(home, /forceSleeping=\{eggSleeping\}/);
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

test('FTUE CTA actions use the shared glowing primary button without a post-hatch handoff', () => {
  const actions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(actions, /action\.presentation === 'cta_action'/);
  assert.match(actions, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?label=\{action\.title\}/);
  assert.doesNotMatch(route, /Talk to Mossprout/);
});

test('opening FTUE removes the white environment fade and introduces UI from below', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /!onboardingFocus \? <View pointerEvents="none" style=\{styles\.environmentFade\} \/> : null/);
  assert.match(readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8'), /entering=\{FadeInDown\.duration\(260\)\.easing\(Easing\.out\(Easing\.cubic\)\)\}/);
  assert.match(readFileSync('features/today/use-shared-action-panel-lifecycle.ts', 'utf8'), /enterFromBottom \? FadeInDown : FadeInUp/);
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
  assert.match(home, /export function EggQuestionPanel/);
  assert.match(home, /function EggQuestionPanel[\s\S]*?<InlineCheckInPanel[\s\S]*?illustratedChoices/);
  assert.match(home, /illustratedChoices[\s\S]*?styles\.illustratedChoiceGrid/);
  assert.match(home, /function MeasuredIllustratedChoice/);
  assert.match(home, /getFtueChoiceArt\(option\)/);
  assert.match(home, /<FtueEnergyBadge amount=\{action\.growthReward\}/);
  assert.match(home, /illustratedAvailableWidth = illustratedGridWidth \|\| illustratedFallbackWidth/);
  assert.match(home, /function getFtueChoiceColumnCount\(choiceCount: number\)/);
  assert.match(home, /if \(choiceCount <= 3\) return Math\.max\(1, choiceCount\)/);
  assert.match(home, /if \(choiceCount === 4\) return 2/);
  assert.match(home, /const visibleOptions = options\.slice\(0, moodQuestion \? 5 : 4\)/);
  assert.match(home, /ftueQuestionLayout && styles\.ftueQuestionAnchor/);
  assert.match(home, /illustrated && !ftueQuestionLayout/);
  assert.match(home, /showGlint=\{!ftueQuestionLayout\}/);
  assert.match(home, /style=\{ftueQuestionLayout \? styles\.ftueQuestionReward : styles\.inlineReward\}/);
  assert.match(home, /setIllustratedGridWidth\(\(current\) => current === measuredWidth \? current : measuredWidth\)/);
  assert.match(home, /setScriptedTextCompletion/);
  assert.match(home, /key=\{scriptedTextChoiceAction\.id\}/);
  assert.match(home, /scriptedRowActions = scriptedActions\.filter\(\(action\) => action\.presentation !== 'inline_choice' && action\.presentation !== 'route_action'\)/);
  assert.match(home, /fullRowIllustratedChoices=\{action\.id\.startsWith\('egg\.'\) && !moodQuestion\}/);
  assert.match(home, /illustratedColumnCount = fullRowIllustratedChoices \? 1 : getFtueChoiceColumnCount\(choices\.length\)/);
  assert.match(home, /fullRowIllustratedChoiceGrid: \{ flexDirection: 'column', flexWrap: 'nowrap'/);
  assert.match(home, /fullRowIllustratedChoice: \{ flexDirection: 'row'/);
});

test('sequential FTUE choice panels cannot consume the previous question completion', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /currentScriptedTextSelection = scriptedTextSelection\?\.action\.instanceId === scriptedTextActionInstanceId/);
  assert.match(home, /currentScriptedTextCompletion = scriptedTextCompletion\?\.action\.instanceId === scriptedTextActionInstanceId/);
  assert.match(home, /selection=\{currentScriptedTextSelection\}/);
  assert.match(home, /completionEvent=\{currentScriptedTextCompletion\}/);
  assert.match(home, /ownedSelection = selection\?\.action\.instanceId === action\.instanceId/);
  assert.match(home, /ownedCompletionEvent = completionEvent\?\.action\.instanceId === action\.instanceId/);
  assert.match(home, /completionKey: ownedCompletionEvent\?\.id/);
  assert.match(readFileSync('features/today/use-shared-action-panel-lifecycle.ts', 'utf8'), /if \(!completionKey \|\| completedKeyRef\.current === completionKey\) return/);
});

test('Steppling discovery spotlights the exact parcel before any board merge', () => {
  const parcelStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'discovery.steppling.parcel');
  const target = { kind: 'tray_parcel', arrivalId: 'arrival:discovery:discovery:ftue-steppling' } as const;
  assert.deepEqual(parcelStep?.interaction, { mode: 'exclusive', allowed: { kind: 'parcel_tap', target } });
  assert.deepEqual(parcelStep?.cue, { kind: 'tap', target });
  assert.deepEqual(parcelStep?.spotlight?.targets, [target]);
  assert.equal(parcelStep?.edges?.[0]?.event.type, 'arrival_claimed');
});

test('FTUE inline questions wrap cleanly and do not expose daily-action skip controls', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /<InlineMood[\s\S]*?allowSkip=\{false\}/);
  assert.match(home, /function EggQuestionPanel[\s\S]*?<InlineCheckInPanel[\s\S]*?allowSkip=\{false\}/);
  assert.match(home, /disabled=\{interactionLocked \|\| !allowSkip\}/);
  assert.match(home, /\{allowSkip \? \([\s\S]*?accessibilityLabel=\{`Skip \$\{action\.title\} for today`\}/);
  assert.match(home, /numberOfLines=\{2\}[\s\S]*?inlineQuestionRequired/);
  assert.match(home, /illustratedCardContent:[^\n]*gap: 5[^\n]*paddingVertical: 7/);
  assert.match(home, /illustratedHeading:[^\n]*minHeight: 48/);
  assert.match(home, /illustratedChoice:[^\n]*minHeight: 70[^\n]*paddingTop: 2/);
  assert.match(home, /illustratedChoiceThreeColumn:[^\n]*minHeight: 66/);
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

test('Mossprout reveal name sits below the Egg stage and hatch has no redundant interaction dock', () => {
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const button = readFileSync('components/katchadeck/ui/katcha-button.tsx', 'utf8');
  assert.match(egg, /top: eggFrame\.top \+ eggFrame\.height \+ 8/);
  assert.match(egg, /discoveryName: \{ \.\.\.KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.doesNotMatch(egg, /Math\.min\(TODAY_KINGDOM_STAGE_HEIGHT - 36/);
  assert.doesNotMatch(route, /label="Talk to Mossprout"/);
  assert.match(button, /label: \{ \.\.\.GAME_CTA\.label/);
});

test('Discovery Hatch remains inside the forming Home Egg stage', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(home, /discoveryHatch=\{hatchPresentation\}/);
  assert.match(egg, /expressionSequence=\{[\s\S]*?discoveryHatch && !discoveryPhaseAtLeast/);
  assert.match(egg, /DISCOVERY_CRACK_ONE/);
  assert.doesNotMatch(home, /<TodayTileHatchReveal/);
  assert.match(route, /hatchOwnership: dailyHatchActive \? 'daily_in_place' : discoveryHatchInPlace \? 'discovery_in_place'/);
  assert.match(route, /hatchPresentation=\{isHatching \? hatchPresentation : null\}/);
});

test('FTUE Mossprout hatches as the animated hovering hero with Egg celebration rays', () => {
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const animatedArt = readFileSync('components/katchadeck/world/creature-animated-art.tsx', 'utf8');
  const idleSources = readFileSync('constants/creature-idle-animation-sources.ts', 'utf8');

  assert.match(egg, /discoveryHatch\?\.policy === 'ftue_discovery'[\s\S]*?discoveryCreature\?\.visualKey === 'mossprout'/);
  assert.match(egg, /<RotatingRadialSunburst[\s\S]*?baseOpacity=\{0\.9\}/);
  assert.match(egg, /<CreatureAnimatedArt[\s\S]*?fallbackSource=\{discoveryCreatureSource\}/);
  assert.match(egg, /discoveryPhaseAtLeast\(discoveryPhase, 'subject_settling'\)/);
  assert.match(egg, /translateY: discoveryCreatureHover\.value[\s\S]*?\* -5[\s\S]*?1 - \(discoveryHandoffProgress\?\.value \?\? 0\)/);
  assert.match(animatedArt, /useAppleWebpCodec=\{false\}/);
  assert.match(animatedArt, /useReducedMotion\(\)/);
  assert.match(idleSources, /'mossprout': require\('@incubator\/art-animations\/mossprout-idle\.webp'\)/);
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
  const exploration = readFileSync(require.resolve('@incubator/environments/cinematic'), 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(environment, /if \(frozen\) \{[\s\S]*?cancelAnimation\(pinchScale\);[\s\S]*?return;/);
  assert.match(exploration, /if \(frozen\) \{[\s\S]*?cancelAnimation\(translateX\);/);
  assert.match(route, /frozen: dailyHatchActive \|\| discoveryHatchInPlace/);
  assert.match(route, /const explorationBackgroundActive = isForming[\s\S]*?\|\| !dailyHatchActive/);
});


test('world Garden stays hidden through Mossprout dialogue and Grow, but returns for planting and restoration', () => {
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    if (step.surface === 'companion' || step.id.startsWith('egg.') || step.id === 'companion.first_meeting') {
      assert.equal(mossproutFtueShowsWorldGarden(step.id), false, step.id);
    }
  }
  for (const stepId of ['world.garden_arrival', 'world.garden_handoff']) {
    assert.equal(mossproutFtueShowsWorldGarden(stepId), true, stepId);
  }
  for (const stepId of [undefined, null, 'complete']) assert.equal(mossproutFtueShowsWorldGarden(stepId), true);
  assert.equal(mossproutFtueShowsWorldGarden('world.egg_intro'), false);
  assert.equal(mossproutFtueShowsWorldGarden('world.first_seed_grew'), false, 'Continue back to Mossprout owns this step');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  // The Garden cluster (the Merge button) itself waits for the Garden lesson in Steppling's discovery: never during the first session.
  assert.match(screen, /!stepplingSurfaceOpen && !upgradePresentation && !activeInteractionResidentId && !kingdomGoalGuideActive && !sharedUpgrade && havenMergeBoardActive && !ftueStepId \? \(/);
});

test('a consumed first-meeting launch cannot keep overhead FTUE speech hidden', () => {
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const gate = interaction.slice(interaction.indexOf('const initialConversationHandoffPending'), interaction.indexOf('const requestStoryConversation'));
  assert.match(gate, /!initialConversationObservedActiveRef.current/);
  assert.match(gate, /conversationSession.status === 'completed'/);
});
