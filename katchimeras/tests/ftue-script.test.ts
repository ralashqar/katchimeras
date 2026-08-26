import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
import { FTUE_EGG_ANSWER_GROWTH_REWARD, MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, mossproutFtueStep, validateMossproutFtueScript } from '@/features/onboarding/mossprout-ftue-script';
import { ftueNeedsV28QuestionnaireRestart, ftueV28QuestionnaireLoopRecoveryStep } from '@/features/onboarding/ftue-migration-policy';
import { MOSSPROUT_BOND_SHARE_PROMPTS, mossproutBondShareSelection } from '@/features/onboarding/mossprout-bond-share';
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

test('Mossprout FTUE script has valid transitions and registered handlers', () => {
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'haven.home_notice');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.terminalStepId, 'complete');
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
  }
});

test('the Egg asks three lightweight attunement questions before Hatch', () => {
  const personalStepIds = ['egg.opening', 'egg.context', 'egg.mind'];
  const personalSteps = personalStepIds.map((id) => MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === id));
  personalSteps.forEach((step) => {
    assert.equal(step?.actions.length, 1);
    assert.equal(step?.actions[0]?.handlerId, 'player_profile');
    assert.equal(step?.actions[0]?.options?.length, 3);
  });
  assert.equal(mossproutFtueAction('egg.opening', 'egg.desired_feeling')?.nextStepId, 'egg.context');
  assert.equal(mossproutFtueAction('egg.context', 'egg.main_difficulty')?.nextStepId, 'egg.mind');
  assert.equal(mossproutFtueAction('egg.mind', 'egg.support_style')?.nextStepId, 'egg.ready');
  assert.deepEqual(
    personalSteps.map((step) => step?.actions[0]?.title),
    [
      'What sounds best right now?',
      'How are you feeling right now?',
      'What would you like a little more of lately?',
    ],
  );
  assert.deepEqual(
    personalSteps.map((step) => step?.actions[0]?.options?.map((option) => option.label)),
    [
      ['Somewhere peaceful', 'Somewhere new', 'Somewhere lively'],
      ['Tired', 'Okay', 'Good'],
      ['Energy', 'Calm', 'Something new'],
    ],
  );
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

test('the first Bond action opens one real multiple-choice question before completion', () => {
  assert.equal(MOSSPROUT_BOND_SHARE_PROMPTS.length, 1);
  assert.equal(MOSSPROUT_BOND_SHARE_PROMPTS.every((prompt) => prompt.options.length === 4), true);
  const selection = mossproutBondShareSelection('hard-day-help:getting_outside');
  assert.equal(selection?.prompt.prompt, 'What usually helps when your day isn’t going well?');
  assert.equal(selection?.answer.label, 'Getting outside');
  assert.equal(mossproutBondShareSelection('hard-day-help:not-an-answer'), null);
});

test('Bond sharing leads into Mossprout’s concise Garden restoration story', () => {
  assert.deepEqual(MOSSPROUT_GARDEN_INTRO_BEATS.map((beat) => beat.line), [
    'Thank you for telling me. Can I share something too?',
    'This Garden used to be bright and full of little friends.',
    'But it grew wild, and they stopped visiting.',
    'I tried to care for it alone. I couldn\'t keep up.',
    'If we restore it together, maybe my friends will come home.',
    'Come on. I\'ll show you our Garden.',
  ]);
  assert.equal(mossproutGardenIntroBeat(0).actionLabel, 'Of course');
  assert.equal(mossproutGardenIntroBeat(99).actionLabel, 'Show me the Garden');

  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const stage = readFileSync('components/katchadeck/world/mossprout-ftue-story-stage.tsx', 'utf8');
  const orders = readFileSync('utils/merge-world/chapter-zero-policy.ts', 'utf8');
  assert.match(interaction, /ftueProfileStep === 'garden_intro'[\s\S]*?ftueGardenStoryBeat\.line/);
  assert.match(interaction, /ftueGardenStoryBeatIndex < MOSSPROUT_GARDEN_INTRO_BEATS\.length - 1[\s\S]*?props\.onFtueProfileContinue\?\.\(\)/);
  assert.match(stage, /gardenStoryActionLabel[\s\S]*?<PrimaryAction icon=\{gardenStoryActionIcon\} label=\{gardenStoryActionLabel\}/);
  assert.match(orders, /title: 'The First Bloom'[\s\S]*?description: 'Bring two Sprouts together to make the Grove grow again\.'/);
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
  assert.match(runtime, /needsPreParcelHavenReveal[\s\S]*?run\.scriptVersion < 16[\s\S]*?run\.stepId === 'discovery\.steppling\.parcel'/);
  assert.match(runtime, /needsResidentParcelConfirmation[\s\S]*?run\.scriptVersion < 21[\s\S]*?companion\.resident_parcel_ready/);
  assert.match(runtime, /needsV33FirstBloomBridge[\s\S]*?run\.scriptVersion === 32[\s\S]*?run\.stepId === 'haven\.reveal'[\s\S]*?'haven\.first_bloom'/);
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
  assert.ok(FTUE_ACTION_CATALOG.some((item) => item.stepId === 'egg.opening' && item.actionId === 'egg.desired_feeling' && item.backendEvent));
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
  const v23Migration = readFileSync('supabase/migrations/20260825223000_register_mossprout_ftue_v23.sql', 'utf8');
  const v22Migration = readFileSync('supabase/migrations/20260825190000_register_mossprout_ftue_v22.sql', 'utf8');
  const v21Migration = readFileSync('supabase/migrations/20260825173000_register_mossprout_ftue_v21.sql', 'utf8');
  const v20Migration = readFileSync('supabase/migrations/20260825150000_register_mossprout_ftue_v20.sql', 'utf8');
  const migration = readFileSync('supabase/migrations/20260823194500_register_mossprout_ftue_v19.sql', 'utf8');
  const v18Migration = readFileSync('supabase/migrations/20260823173000_register_mossprout_ftue_v18.sql', 'utf8');
  const v17Migration = readFileSync('supabase/migrations/20260822173032_register_mossprout_ftue_v17.sql', 'utf8');
  const priorMigration = readFileSync('supabase/migrations/20260818170000_register_mossprout_ftue_v16.sql', 'utf8');
  for (const item of FTUE_ACTION_CATALOG.filter((entry) => entry.backendEvent)) {
    assert.match(`${priorMigration}\n${v17Migration}\n${v18Migration}\n${migration}\n${v20Migration}\n${v21Migration}\n${v22Migration}\n${v23Migration}\n${v24Migration}\n${v25Migration}\n${v26Migration}\n${v27Migration}\n${v28Migration}\n${v29Migration}\n${v30Migration}\n${v31Migration}\n${v32Migration}\n${v33Migration}`, new RegExp(`'${item.stepId}',\\s*'${item.actionId}'`));
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
  assert.match(v23Migration, /script_version = 22/);
  assert.match(v22Migration, /script_version = 21/);
  assert.match(migration, /script_version = 18/);
  assert.doesNotMatch(migration, /step_id not in/);
  assert.doesNotMatch(`${priorMigration}\n${migration}\n${v20Migration}\n${v24Migration}\n${v25Migration}\n${v26Migration}\n${v27Migration}\n${v28Migration}\n${v29Migration}\n${v30Migration}\n${v31Migration}\n${v32Migration}\n${v33Migration}`, /option_id|option_label|answer_text/);
});

test('Chapter 0 uses four Seeds, two Sprouts, a First Bloom, then one request', () => {
  const mergeStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.seed_drag');
  const serveStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.serve_sprout');
  const spawnStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.plant.spawn');
  const pairStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.plant.seed_pairs');
  const finalServeStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.serve_plant');
  const sproutEchoStep = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.plant.sprout_pair');
  assert.equal(mossproutFtueAction('merge.seed_drag', 'merge.create_sprout')?.handlerId, 'merge_item_created');
  assert.equal(mergeStep?.edges?.[0]?.nextStepId, 'merge.second_seed_drag');
  assert.equal(mossproutFtueStep('merge.second_seed_drag')?.edges?.[0]?.nextStepId, 'merge.first_bloom');
  assert.equal(mossproutFtueStep('merge.first_bloom')?.edges?.[0]?.nextStepId, 'merge.serve_sprout');
  assert.equal(sproutEchoStep?.edges?.[0]?.nextStepId, 'merge.serve_plant');
  assert.equal(spawnStep?.edges?.[0]?.requiredCount, undefined);
  assert.equal(pairStep?.edges?.[0]?.event.type, 'dream_echo_cleared');
  assert.equal(pairStep?.edges?.[0]?.nextStepId, 'merge.serve_sprout');
  assert.equal(serveStep?.edges?.[0]?.nextStepId, 'companion.chapter_zero_return');
  assert.equal(mossproutFtueAction('companion.chapter_zero_return', 'companion.complete_chapter_zero_return')?.nextStepId, 'haven.first_bloom');
  assert.equal(mossproutFtueAction('companion.bond_intro', 'companion.acknowledge_friendship')?.nextStepId, 'companion.bond_spotlight');
  assert.equal(mossproutFtueAction('companion.bond_spotlight', 'companion.acknowledge_bond')?.nextStepId, 'companion.day_one_action');
  assert.equal(mossproutFtueAction('companion.day_one_action', 'companion.choose_bond_share')?.options?.length, 4);
  assert.equal(mossproutFtueAction('companion.day_one_action', 'companion.complete_day_one_action')?.nextStepId, 'companion.garden_intro');
  assert.equal(mossproutFtueAction('companion.resident_affinity', 'companion.complete_resident_affinity')?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueAction('companion.resident_parcel_ready', 'companion.open_resident_parcel')?.nextStepId, 'merge.resident_parcel');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_dialogue')?.edges?.[0]?.nextStepId, 'merge.resident_seed_spawn');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_seed_spawn')?.edges?.[0]?.nextStepId, 'merge.resident_seed_echo');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_seed_echo')?.edges?.[0]?.nextStepId, 'merge.resident_sprout_echo');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_sprout_echo')?.edges?.[0]?.nextStepId, 'merge.resident_orders');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_orders')?.edges?.[0]?.requiredCount, undefined);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_orders')?.interaction?.mode, 'exclusive');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_card_reward')?.edges?.[0]?.nextStepId, 'companion.resident_match_result');
  assert.equal(mossproutFtueAction('haven.first_bloom', 'haven.continue_to_resident')?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueAction('companion.resident_match_result', 'companion.ack_resident_match_result')?.nextStepId, 'haven.reveal');
  assert.equal(mossproutFtueAction('haven.reveal', 'haven.reveal_world')?.nextStepId, 'complete');
  assert.equal(finalServeStep?.edges?.[0]?.nextStepId, 'companion.chapter_zero_return');
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
    { kind: 'order_card', orderId: 'mossprout:chapter-0:first-sprout' },
    { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:first-sprout', requirementIndex: 0 },
  ]);
  assert.ok(mossproutFtueAction('companion.order_preview', 'companion.open_garden'));
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

test('Mossprout remembers the day, learns a garden preference, then offers one narrative Garden objective', () => {
  const firstMeetings = mossproutFtueConversationDefinitions.filter((definition) => definition.id.startsWith('mossprout:ftue:first-meeting:'));
  assert.ok(firstMeetings.every((definition) => definition.version === 5));
  for (const definition of firstMeetings) {
    const remembered = definition.nodes.find((node) => node.id === 'remembered');
    assert.equal(remembered?.kind, 'choice');
    if (remembered?.kind === 'choice') assert.equal(remembered.options.length, 1);
    assert.ok(definition.nodes.some((node) => node.id === 'hello'));
    assert.ok(definition.nodes.some((node) => node.id === 'stuck'));
  }
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const mossproutStage = readFileSync('components/katchadeck/world/mossprout-ftue-story-stage.tsx', 'utf8');
  const bondShare = readFileSync('features/onboarding/mossprout-bond-share.ts', 'utf8');
  const companionRoute = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const feastleStage = readFileSync('components/katchadeck/world/feastle-story-stage.tsx', 'utf8');
  const baristabbitStage = readFileSync('components/katchadeck/world/baristabbit-story-stage.tsx', 'utf8');
  assert.match(interaction, /MossproutFtueStoryStage/);
  assert.match(mossproutStage, /CompanionMergeRequestTray/);
  assert.match(mossproutStage, /MOSSPROUT_CHAPTER_ZERO_REQUESTS/);
  assert.match(interaction, /What should I call you/);
  assert.match(interaction, /ftueGardenStoryBeat\.line/);
  assert.match(interaction, /Let\\'s make this little corner welcoming again/);
  assert.match(interaction, /bubbleBody=\{mossproutFtueSpeechTitle[\s\S]*?\? undefined/);
  assert.match(interaction, /bubbleVariant=\{quickGoalPickerOpen && !mossproutFtueSpeechTitle \? 'questionnaire' : 'default'\}/);
  assert.match(mossproutStage, /<Modal/);
  assert.match(mossproutStage, /DayActionCardSurface/);
  assert.match(mossproutStage, /DayActionCompletedRow/);
  assert.match(mossproutStage, /title="Introduce yourself"/);
  assert.match(mossproutStage, /INTRODUCTION_REWARD/);
  assert.match(mossproutStage, /mode === 'intro_action'[\s\S]*?style=\{styles\.plainActionStage\}/);
  assert.match(mossproutStage, /plainActionStage: \{ gap: 7 \}/);
  assert.match(mossproutStage, /mode === 'bond_choice'[\s\S]*?MOSSPROUT_BOND_SHARE_PROMPTS\[0\]\.options\.map/);
  assert.match(mossproutStage, /onContinue\?\.\(`\$\{MOSSPROUT_BOND_SHARE_PROMPTS\[0\]\.id\}:\$\{option\.id\}`\)/);
  assert.match(bondShare, /What usually helps when your day isn’t going well\?/);
  assert.match(bondShare, /Getting outside[\s\S]*?Being with someone[\s\S]*?Having time alone[\s\S]*?Doing something I enjoy/);
  assert.match(mossproutStage, /ref=\{actionStackTargetRef\}[\s\S]*?style=\{styles\.bondChoiceStack\}/);
  assert.match(companionRoute, /stepId === 'companion\.bond_spotlight' \|\| ftueRun\.stepId === 'companion\.day_one_action'[\s\S]*?\? 'bond_choice'/);
  assert.match(interaction, /activeBondQuestionId=\{ftueBondQuestionId\}[\s\S]*?onBondQuestionChange=\{setFtueBondQuestionId\}/);
  assert.match(interaction, /ftueBondShare\?\.answer\.reply[\s\S]*?ftueBondShare\?\.prompt\.reply[\s\S]*?ftueBondQuestion\?\.prompt/);
  assert.match(interaction, /Mossprout will remember this/);
  assert.match(interaction, /message: 'Mossprout remembers your answers',[\s\S]*?placement: 'middle'/);
  assert.match(interaction, /message: 'Mossprout will remember this',[\s\S]*?placement: 'middle'/);
  assert.match(mossproutStage, /Answer Mossprout/);
  assert.match(mossproutStage, /color: KatchaUI\.companionScenePanel\.optionInk/);
  assert.match(mossproutStage, /justifyContent: 'flex-end'/);
  assert.doesNotMatch(mossproutStage, /Bond level Familiar|Bond · Familiar|bondBadge/);
  assert.doesNotMatch(mossproutStage, /What should I call you/);
  assert.match(mossproutStage, /slice\(0, 1\)/);
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

test('Merge FTUE spotlight uses a lifecycle-safe native rounded cutout', () => {
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(overlay, /StyleSheet\.absoluteFillObject/);
  assert.match(overlay, /pointerEvents="none"/);
  assert.match(overlay, /<SpotlightDimMask/);
  assert.match(overlay, /<NativeMultiSpotlightDimMask/);
  assert.match(overlay, /roundedMultiCutoutSegments\(frames, radius, screen\)/);
  assert.match(overlay, /Math\.hypot\(screen\.width, screen\.height\)/);
  assert.match(overlay, /borderRadius: slot\.corner\.value/);
  assert.match(overlay, /boxShadow: `0 0 0 \$\{spreadRadius\}px \$\{color\}`/);
  assert.doesNotMatch(overlay, /SpotlightCornerFillers|spotlightCornerFiller/);
  assert.match(overlay, /<NativeSpotlightRing slot=\{slot0\}/);
  assert.doesNotMatch(overlay, /@shopify\/react-native-skia|<Canvas|usePathValue|BlurMask/);
  assert.match(overlay, /spotlightTransitionDurationMs: 420/);
  assert.match(overlay, /withTiming\(frame\.x, timing\)/);
  assert.match(overlay, /borderColor: theme\.focusRingColor/);
  assert.match(overlay, /spotlight\.targets/);
  assert.match(overlay, /spotlight\.grouping === 'bounding_rect'[\s\S]*?boundingFrame\(resolved\)/);
  assert.match(merge, /mergeGuidanceVisible = active && !serveFlight && !parcelFlight/);
  assert.match(merge, /spotlight=\{mergeGuidanceVisible \? mergeGuidanceSpotlight : null\}/);
  assert.match(merge, /const mergeGuidanceSpotlight = ftueStep\?\.spotlight \?\? postFtueDiscoveryGuidance\.spotlight/);
  assert.match(merge, /const mergeGuidanceGuide = ftueStep\?\.surface === 'merge' \? ftueStep\.guide : null/);
  assert.match(merge, /guide=\{mergeGuidanceVisible \? mergeGuidanceGuide : null\}/);
  assert.match(overlay, /<MergeFtueEggGuide[\s\S]*?guideAnchorFrame\(spotlight, currentLayout\.spotlightFrames\)/);
  assert.ok(overlay.indexOf('<MergeFtueEggGuide') < overlay.indexOf('<FtueFingerCue'), 'the finger must render above the guide bubble');
  assert.match(overlay, /pointerEvents="box-none"[\s\S]*?<MergeFtueEggGuide/);
  assert.match(overlay, /guideDismissible = Boolean\(spotlight\?\.dismissOnGuideClose\)[\s\S]*?guideDismissed = Boolean\(guideDismissible && guideKey && dismissedGuideKey === guideKey\)[\s\S]*?spotlightDismissed = guideDismissed/);
  assert.match(overlay, /if \(!guideDismissible \|\| !showGuide \|\| !guideKey\) return;[\s\S]*?setTimeout\(\(\) => setDismissedGuideKey\(guideKey\), GUIDE_AUTO_DISMISS_MS\)/);
  assert.match(overlay, /guideDismissible \? <Pressable[\s\S]*?accessibilityLabel="Dismiss Merge guidance"[\s\S]*?onPress=\{dismissGuide\}[\s\S]*?: null/);
  assert.match(overlay, /!spotlightDismissed \? \([\s\S]*?<FtueSpotlight[\s\S]*?\) : null/);
  assert.match(overlay, /entering=\{FadeIn\.duration\(150\)\}[\s\S]*?exiting=\{FadeOut\.duration\(150\)\}/);
  assert.match(overlay, /function MergeFtueEggGuide[\s\S]*?pointerEvents="none"[\s\S]*?styles\.eggGuideAvatar[\s\S]*?<EggAvatar[^>]*size=\{76\}/);
  assert.match(overlay, /hand: \{ position: 'absolute', zIndex: 4 \}/);
  assert.doesNotMatch(overlay, /eggGuideAvatar(?:Badge|Background|Ring)/);
  assert.match(overlay, /target\.kind === 'order_card'[\s\S]*?`order-card:\$\{target\.orderId\}`/);
  const rail = readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8');
  assert.match(rail, /const orderCardTargetKey = `order-card:\$\{order\.id\}`[\s\S]*?ref=\{setOrderCardTargetRef\}/);
});

test('post-Garden companion FTUE owns navigation and has a durable resume target', () => {
  const mergeScreen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(mergeScreen, /useFtueNavigationLock\(ftueRun, 'merge', active\)/);
  assert.match(mergeScreen, /disabled=\{ftueNavigationLocked && !residentFtueActive\}/);
  assert.match(mergeScreen, /returnToResidentStory[\s\S]*?residentResume: '1'/);
  assert.match(mergeScreen, /BackHandler\.addEventListener\('hardwareBackPress'[\s\S]*?returnToResidentStory\(\)/);
  assert.match(mergeScreen, /<Stack\.Screen options=\{\{ gestureEnabled: !residentFtueActive \}\}/);
  const bondRun = { status: 'active' as const, stepId: 'companion.bond_spotlight' };
  const bondPolicy = activeFtueNavigationPolicy(bondRun);
  assert.deepEqual(bondPolicy?.resume, { kind: 'companion', creatureId: 'companion:mossprout', ftue: '1' });
  assert.equal(ftueLocksSurfaceNavigation(bondRun, 'companion'), true);
  assert.equal(ftueLocksSurfaceNavigation(bondRun, 'merge'), false);
  assert.equal(ftueResumeTargetMatches(bondPolicy!.resume, '/katchimera/companion%3Amossprout', { ftue: '1' }), true);
  assert.equal(ftueResumeTargetMatches(bondPolicy!.resume, '/katchimera/companion%3Amossprout'), false);

  const conversationPolicy = activeFtueNavigationPolicy({ status: 'active', stepId: 'companion.first_meeting' });
  assert.deepEqual(conversationPolicy?.resume, { kind: 'haven' });
  assert.equal(ftueLocksSurfaceNavigation({ status: 'active', stepId: 'companion.first_meeting' }, 'haven'), true);
  const earlyMergePolicy = activeFtueNavigationPolicy({ status: 'active', stepId: 'merge.seed_drag' });
  assert.deepEqual(earlyMergePolicy?.resume, { kind: 'merge', creatureId: 'companion:mossprout' });
  const capturePolicy = activeFtueNavigationPolicy({ status: 'active', stepId: 'energy.capture' });
  assert.deepEqual(capturePolicy?.resume, { kind: 'haven' });
  assert.equal(ftueResumeTargetMatches(capturePolicy!.resume, '/katchimeras'), true);

  const returnPolicy = activeFtueNavigationPolicy({ status: 'active', stepId: 'companion.chapter_zero_return' });
  assert.deepEqual(returnPolicy?.resume, {
    kind: 'companion',
    creatureId: 'companion:mossprout',
    ftue: 'chapter-zero-return',
  });
  assert.equal(ftueResumeTargetMatches(returnPolicy!.resume, '/katchimera/companion:mossprout', { ftue: 'chapter-zero-return' }), true);
  assert.equal(ftueResumeTargetMatches(returnPolicy!.resume, '/katchimera/companion:mossprout'), false);
  const residentParcelPolicy = activeFtueNavigationPolicy({ status: 'active', stepId: 'merge.resident_parcel' });
  assert.deepEqual(residentParcelPolicy?.resume, { kind: 'merge', creatureId: 'companion:mossprout' });
  assert.equal(ftueLocksSurfaceNavigation({ status: 'active', stepId: 'merge.resident_parcel' }, 'merge'), false);
  assert.equal(activeFtueNavigationPolicy({ status: 'complete', stepId: 'complete' }), null);
  assert.equal(ftueForegroundKeepsResidentMerge(
    { status: 'active', stepId: 'companion.resident_parcel_ready' },
    '/katchimera/companion%3Amossprout/activity',
    null,
  ), true);
  assert.equal(ftueForegroundKeepsResidentMerge(
    { status: 'active', stepId: 'merge.resident_card' },
    '/katchimera/companion:mossprout/activity',
    'merge.resident_card',
  ), true);
  assert.equal(ftueForegroundKeepsResidentMerge(
    { status: 'active', stepId: 'companion.resident_parcel_ready' },
    '/katchimera/companion:mossprout',
    null,
  ), false);
});

test('route-changing FTUE actions persist before navigation and owned companion UI fails closed', () => {
  const runtime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  const today = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const companion = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const kingdomCompanion = readFileSync('components/katchadeck/world/kingdom-companion-screen.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const reconciler = readFileSync('features/onboarding/ftue-navigation-reconciler.tsx', 'utf8');
  const haven = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');

  const writeThroughIndex = runtime.indexOf('setStoredJson(STORAGE_KEY, next)');
  const publishSnapshotIndex = runtime.indexOf('snapshot = next', writeThroughIndex);
  assert.ok(writeThroughIndex >= 0 && writeThroughIndex < publishSnapshotIndex);
  assert.doesNotMatch(runtime, /setStoredJsonAsync|pendingPersistence|persistenceWorker/);
  assert.match(runtime, /advanceFtueActionDurably[\s\S]*?commitFtueAction\(\{ \.\.\.input, skipContentFlowDispatch: true \}\)[\s\S]*?await flushFtuePersistence\(\)[\s\S]*?await dispatchFtueActionToContentFlow/);
  assert.doesNotMatch(today, /Talk to Mossprout|talkToMossprout/);
  assert.match(haven, /ftueStep\?\.id === 'companion\.first_meeting'/);
  assert.match(haven, /companionActive && companionVisualReady \? \([\s\S]*?<KatchimeraCompanionRouteScreen/);
  assert.match(haven, /<KatchimeraCompanionRouteScreen[\s\S]*?hostedInHaven/);
  assert.match(companion, /surfaceActive = hostedInHaven \|\| isFocused/);
  assert.match(companion, /\(!discovery\.ready && !hostedInHaven\)/);
  assert.match(companion, /forceMossproutAvailable=\{hostedInHaven\}/);
  assert.match(kingdomCompanion, /!ftueConversationDefinitionId && !forceMossproutAvailable/);
  assert.match(companion, /openFtueGarden = useCallback\(async \(\) => \{[\s\S]*?transitionTo\(\{[\s\S]*?navigate: async \(\) => \{[\s\S]*?await advanceFtueActionDurably[\s\S]*?result\.step\?\.surface !== 'merge'[\s\S]*?router\.push/);
  assert.match(haven, /companionActive && companionVisualReady[\s\S]*?<KatchimeraCompanionRouteScreen/);
  assert.doesNotMatch(reconciler, /hatch\.talk_to_mossprout|run\.stepId === 'hatch\.reveal'/);
  assert.match(companion, /ftueCompanionSurfaceOwned = Boolean\([\s\S]*?mossproutFtueStep\(navigationFtueRun\.stepId\)\?\.surface === 'companion'/);
  assert.match(interaction, /!showMossproutDashboard[\s\S]*?!props\.ftueCompanionSurfaceOwned \|\| residentFtueDashboard/);
  assert.match(interaction, /residentParcelHandoffActive=\{residentParcelGardenPanelActive\}/);
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

test('global route coordinators navigate across the root Stack and nested Tabs boundary', () => {
  const ftueReconciler = readFileSync('features/onboarding/ftue-navigation-reconciler.tsx', 'utf8');
  const contentFlowCoordinator = readFileSync('features/content-flow/content-flow-navigation-coordinator.tsx', 'utf8');
  const profileReconciler = readFileSync('features/dev-profile-launch-reconciler.tsx', 'utf8');
  const onboardingRoute = readFileSync('app/onboarding.tsx', 'utf8');
  const assetLab = readFileSync('app/dev-asset-lab.tsx', 'utf8');

  assert.match(ftueReconciler, /router\.navigate\(hrefForResumeTarget\(policy\.resume\)\)/);
  assert.doesNotMatch(ftueReconciler, /router\.replace\(hrefForResumeTarget/);
  assert.match(contentFlowCoordinator, /router\.navigate\(\{ pathname: owner\.work\.target\.pathname/);
  assert.doesNotMatch(contentFlowCoordinator, /router\.replace\(\{ pathname: owner\.work\.target\.pathname/);
  assert.match(profileReconciler, /if \(route\) router\.navigate\(route\)/);
  assert.match(onboardingRoute, /router\.navigate\(mode === 'identity' \? '\/\(tabs\)\/you' : '\/\(tabs\)\/katchimeras'\)/);
  assert.doesNotMatch(assetLab, /router\.replace\('\/\(tabs\)\/katchimeras'\)/);
});

test('resident discovery pauses on one standard Mossprout action card and resumes the exact Merge step', () => {
  const route = readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  const reconciler = readFileSync('features/onboarding/ftue-navigation-reconciler.tsx', 'utf8');
  const companion = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const conversationScene = readFileSync('components/katchadeck/world/companion-conversation-scene.tsx', 'utf8');
  const conversationFlow = readFileSync('features/companion/use-companion-conversation-flow.ts', 'utf8');
  const stage = readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const navigationSession = readFileSync('features/onboarding/resident-ftue-navigation-session.ts', 'utf8');
  assert.match(route, /residentResume[\s\S]*?residentStoryResumeRequested=\{residentResume === '1'\}/);
  assert.match(reconciler, /residentResumeRequested[\s\S]*?run\.stepId\.startsWith\('merge\.resident_'\)[\s\S]*?return;/);
  assert.match(reconciler, /initialResumeHandledRef[\s\S]*?initialResumeHandledRef\.current = true;[\s\S]*?restoreOwnedStep/);
  assert.doesNotMatch(reconciler, /useFtueRun|liveRun\?\.stepId/);
  assert.match(reconciler, /finally \{[\s\S]*?restoringRef\.current = false;[\s\S]*?run = loadFtueRun\(\);[\s\S]*?const currentPathname/);
  assert.match(reconciler, /residentMergeSessionBlocksReconciliation\(\) \|\| residentMergeSessionOwnsRoute\(\)[\s\S]*?loadMergeWorldState/);
  assert.match(reconciler, /loadMergeWorldState\(\)[\s\S]*?residentMergeSessionBlocksReconciliation\(\) \|\| residentMergeSessionOwnsRoute\(\)[\s\S]*?return;/);
  assert.match(reconciler, /nextState !== 'active'\) markResidentMergeRecoveryPending\(\)[\s\S]*?restoreLiveResidentRoute\(\)[\s\S]*?restoreOwnedStep/);
  assert.match(reconciler, /pathname, residentSession, restoreLiveResidentRoute/);
  assert.match(reconciler, /ftueForegroundKeepsResidentMerge\(run, currentPathname, residentCanonicalStep\)[\s\S]*?repairFtueStep\(run\.stepId, repairTarget\)[\s\S]*?return;/);
  assert.match(merge, /returnToResidentStory[\s\S]*?pauseResidentMerge\(\)[\s\S]*?residentResume: '1'/);
  assert.match(merge, /ackResidentCardReveal[\s\S]*?announcement: 'Returning to Mossprout'[\s\S]*?target: 'companion'/);
  assert.match(merge, /ackResidentCardReveal[\s\S]*?Promise\.all\(\[flushMergeWorld\(\), flushFtuePersistence\(\)\]\)[\s\S]*?Returning to Mossprout/);
  assert.match(merge, /markResidentMergePresented\(\)/);
  assert.match(merge, /finishResidentMergeSession\(\)[\s\S]*?returnToMatchResult/);
  assert.match(navigationSession, /'idle'[\s\S]*?'handoff'[\s\S]*?'merge_presented'[\s\S]*?'recovery_pending'[\s\S]*?'paused'/);
  assert.match(companion, /residentStoryResumeActive[\s\S]*?initialConversationDefinitionId=\{!residentStoryResumeActive/);
  assert.doesNotMatch(interaction, /A VEILED PARCEL IS WAITING|Return to the exact resident step you left/);
  assert.match(interaction, /residentFtueDashboard = props\.familyId === 'mossprout'[\s\S]*?props\.ftueResidentHandoffActive[\s\S]*?dashboardRouteActive = route\.kind === 'dashboard'[\s\S]*?residentFtueDashboard[\s\S]*?props\.ftueCompanionSurfaceOwned/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?pendingStoryConversationRef\.current = null[\s\S]*?openedStoryConversationRef\.current = null[\s\S]*?showFeastleStoryHome\(\)/);
  assert.match(interaction, /onCompletedExit=\{exitCompletedConversation\}/);
  assert.match(conversationScene, /session\.status === 'completed'[\s\S]*?<ConversationCompletion[\s\S]*?Closest match found[\s\S]*?onContinue=\{onCompletedExit\}/);
  assert.match(interaction, /companionInitialConversationCompletionReady[\s\S]*?if \(props\.ftueResidentMatchResultActive\) return/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?mossprout:game:form-finder[\s\S]*?onInitialConversationComplete/);
  assert.match(companion, /completeResidentResultExit[\s\S]*?authoredTerminalExit[\s\S]*?ownedKatchimeraCards[\s\S]*?resident_discovery[\s\S]*?nextStepId: 'haven\.reveal'/);
  assert.match(companion, /authoredTerminalExit = run\.stepId === 'companion\.resident_match_result'[\s\S]*?if \(!authoredTerminalExit && !residentRecoveryExit\) return false/);
  assert.match(companion, /actionId: 'companion\.ack_resident_match_result'[\s\S]*?nextStepId: 'haven\.reveal'[\s\S]*?flushFtuePersistence\(\)/);
  assert.match(interaction, /completedInitialConversationRef = useRef[\s\S]*?completedConversationExitRef = useRef/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?completedConversationExitRef\.current === completedConversationSessionId/);
  assert.doesNotMatch(conversationScene, /Returning to \$\{name\}/);
  assert.match(conversationFlow, /session\.status === 'completed'[\s\S]*?if \(directResidentParcelHandoff\) return;[\s\S]*?onComplete/);
  assert.match(interaction, /\(route\.kind === 'visit' \|\| route\.kind === 'conversation'\) && !residentFtueDashboard/);
  assert.match(interaction, /if \(!props\.active \|\| !residentFtueDashboard\) return;[\s\S]*?showFeastleStoryHome\(\)/);
  assert.match(interaction, /dashboardRouteActive && props\.familyId === 'mossprout'[\s\S]*?<MossproutStoryStage/);
  assert.match(interaction, /residentStoryResumeActive=\{props\.ftueResidentStoryResume\}/);
  assert.match(stage, /if \(residentStoryResumeActive\) return \[residentResumeAction\]/);
  assert.match(stage, /title: residentStoryResumeTitle[\s\S]*?onResumeResidentStory/);
  assert.match(stage, /!residentStoryResumeActive \? <KatchimeraBottomDock/);
  assert.match(companion, /residentStoryResumeRequested[\s\S]*?isResidentMergePaused\(\)[\s\S]*?ftueResidentHandoffActive/);
  assert.match(companion, /residentMergeFtueActive && !residentStoryResumeActive/);
});

test('completed FTUE query flags cannot retain companion conversation or resident dashboard ownership', () => {
  const route = readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  const companion = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');

  assert.match(route, /firstMeetingFtueActive = ftueRun\?\.status === 'active'[\s\S]*?ftueRun\.stepId === 'companion\.first_meeting'/);
  assert.match(route, /ftue === '1' && firstMeetingFtueActive/);
  assert.match(companion, /residentParcelReady = Boolean\(navigationFtueRun\?\.status === 'active'[\s\S]*?latestMossproutJourney\?\.matchedCardId/);
  assert.match(companion, /ftueResidentHandoffActive = Boolean\(navigationFtueRun\?\.status === 'active'[\s\S]*?residentParcelReady\)\)/);
  assert.match(route, /ftueRouteOrigin=\{isMossprout && Boolean\(ftue\)\}/);
  assert.match(companion, /ftueRouteOrigin && navigationFtueRun\?\.status !== 'active'[\s\S]*?router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/);
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
  assert.match(interaction, /showSpeechBubble=\{!initialConversationHandoffPending && \(Boolean\(mossproutFtueSpeechTitle\) \|\| !residentParcelGardenPanelActive\)\}/);
  assert.match(interaction, /residentParcelHandoffActive=\{residentParcelGardenPanelActive\}/);
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

test('resident parcel and card guidance swaps only after its newly measured target is ready', () => {
  const script = readFileSync('features/onboarding/mossprout-ftue-script.ts', 'utf8');
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const board = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  const art = readFileSync('constants/merge-world-art.ts', 'utf8');
  assert.match(script, /id: 'merge\.resident_parcel'[\s\S]*?kind: 'parcel_tap'[\s\S]*?kind: 'active_resident_parcel'/);
  assert.match(script, /id: 'merge\.resident_card'[\s\S]*?kind: 'board_drag'[\s\S]*?kind: 'active_resident_card_item'[\s\S]*?kind: 'active_resident_card_node'/);
  assert.match(script, /id: 'merge\.resident_seed_spawn'[\s\S]*?kind: 'generator_tap'[\s\S]*?generatorId: 'wild-garden'/);
  assert.match(script, /id: 'merge\.resident_seed_echo'[\s\S]*?echoId: 'mossprout-seed-echo'[\s\S]*?nextStepId: 'merge\.resident_sprout_echo'/);
  assert.match(script, /id: 'merge\.resident_sprout_echo'[\s\S]*?echoId: 'mossprout-sprout-echo'[\s\S]*?nextStepId: 'merge\.resident_orders'/);
  assert.match(script, /id: 'merge\.resident_orders'[\s\S]*?title: 'Serve the Plant\.'[\s\S]*?kind: 'active_resident_order_serve'[\s\S]*?dismissOnGuideClose: true/);
  assert.equal(mossproutFtueStep('merge.resident_orders')?.spotlight?.dismissOnGuideClose, true);
  assert.equal(mossproutFtueStep('merge.resident_parcel')?.spotlight?.dismissOnGuideClose, undefined);
  assert.equal(mossproutFtueStep('merge.resident_card')?.spotlight?.dismissOnGuideClose, undefined);
  assert.match(merge, /mergeFtueStepForBoard\(state, scriptedFtueStep\)/);
  assert.match(merge, /residentFtueActive = Boolean\(ftueStep\?\.id\.startsWith\('merge\.resident_'\)\)/);
  assert.match(overlay, /const presentationReady = currentLayout\?\.configKey === configKey[\s\S]*?currentLayout\.targetRevision === targetRevision/);
  assert.match(overlay, /spotlightReady = Boolean\(presentationReady/);
  assert.match(merge, /finishParcelFlight[\s\S]*?setFtueTargetRevision\(\(revision\) => revision \+ 1\)/);
  assert.match(art, /'mossprout:resident-card:sealed': RESIDENT_CARD_ART/);
  assert.match(board, /source=\{RESIDENT_CARD_ART\}/);
});

test('resident reveal celebration and dialogue are separate visual phases', () => {
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(merge, /celebrating \? <Animated\.View[\s\S]*?resident-celebration[\s\S]*?RotatingRadialSunburst[\s\S]*?CelebrationParticles/);
  assert.match(merge, /: <Animated\.View[\s\S]*?resident-dialogue[\s\S]*?residentSpeech/);
  assert.doesNotMatch(merge, /residentRevealCircle/);
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

test('Haven keeps one Grove compositor through the Egg to Companion handoff', () => {
  const tabLayout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const havenRoute = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');
  const todayRoute = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const mossproutOpening = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const companionStage = readFileSync('components/katchadeck/world/companion-cinematic-stage.tsx', 'utf8');
  const sheet = readFileSync('components/katchadeck/ui/katcha-sheet.tsx', 'utf8');
  const devTools = readFileSync('app/(tabs)/explore.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const policy = readFileSync('features/onboarding/ftue-navigation-policy.ts', 'utf8');
  assert.match(policy, /'egg\.opening'/);
  assert.match(policy, /'haven\.home_notice'/);
  assert.match(policy, /'grove\.egg_inspect'/);
  assert.match(tabLayout, /tabBar=\{\(\) => null\}/);
  assert.doesNotMatch(tabLayout, /MeadowTabBar|DayCaptureSession|ftueHidesBottomBar/);
  assert.match(havenRoute, /ftueStep\?\.id === 'grove\.egg_inspect'/);
  assert.match(havenRoute, /<MossproutEggFtueSurface/);
  assert.match(havenRoute, /if \(eggPresentationActive \|\| havenHostedCompanionActive\)/);
  assert.match(havenRoute, /<MossproutOpeningSurface/);
  assert.doesNotMatch(havenRoute, /HavenEggFtueSurface|from '\.\/today'/);
  assert.match(havenRoute, /reuseUnderlyingStage/);
  assert.doesNotMatch(havenRoute, /renderRegularStage/);
  assert.match(interaction, /background=\{props\.reuseUnderlyingStage \? undefined : props\.questionnaireBackground\}/);
  assert.match(interaction, /entranceMotion=\{props\.reuseUnderlyingStage \? 'fade' : 'sheet'\}/);
  assert.match(interaction, /stagePresentation=\{props\.reuseUnderlyingStage && !props\.renderRegularStage \? 'speech-only' : 'full'\}/);
  assert.match(sheet, /entranceMotion === 'fade'[\s\S]*?FadeIn\.duration\(220\)/);
  assert.match(companionStage, /entering=\{reduceMotion \? undefined : ZoomIn\.duration\(190\)/);
  assert.match(mossproutOpening, /<CompanionHomeEnvironmentStage/);
  assert.match(mossproutOpening, /backgroundKey=\{null\}[\s\S]*?layer="creature"/);
  assert.doesNotMatch(mossproutOpening, /environmentContent=\{\(/);
  assert.match(mossproutOpening, /actions=\{\[\]\}/);
  assert.match(mossproutOpening, /handleDiscoveryReveal\(FTUE_MOSSPROUT_CREATURE\)/);
  assert.match(mossproutOpening, /companionStageActive/);
  assert.match(mossproutOpening, /onboardingFocus\s/);
  assert.match(mossproutOpening, /sceneOnly=\{companionStageActive\}/);
  assert.match(mossproutOpening, /subjectHandoffProgress=\{subjectHandoff\}/);
  assert.match(mossproutOpening, /subjectHidden=\{subjectHandoffSettled\}/);
  assert.match(mossproutOpening, /companionStageActive && subjectHandoffSettled[\s\S]*?<CompanionHomeEnvironmentStage/);
  assert.match(mossproutOpening, /styles\.regularSubject[\s\S]*?translateY: -regularSubjectLift/);
  assert.match(mossproutOpening, /subjectHandoffFades=\{false\}/);
  assert.doesNotMatch(mossproutOpening, /regularSubjectReady|SUBJECT_READY_FALLBACK_MS|handleRegularSubjectReady/);
  assert.match(mossproutOpening, /regularSubjectLift = companionDestinationStageLift\(windowHeight, windowWidth\)/);
  assert.match(mossproutOpening, /subjectHandoffScale=\{subjectHandoffLayout\.outgoingEndScale\}[\s\S]*?subjectHandoffTranslateY=\{subjectHandoffLayout\.outgoingEndTranslateY\}/);
  assert.match(havenRoute, /onCompanionVisualReady=\{handleCompanionVisualReady\}[\s\S]*?companionActive && companionVisualReady/);
  assert.match(mossproutOpening, /sceneHandoffScale = regularStageLayout\.backgroundImageSize[\s\S]*?HOME_FTUE_CAMERA_SCALE/);
  assert.match(mossproutOpening, /sceneHandoffTranslateY = regularSceneCenterOffset[\s\S]*?openingSceneCenterOffset \* sceneHandoffScale/);
  assert.match(mossproutOpening, /sceneHandoffProgress=\{subjectHandoff\}[\s\S]*?sceneHandoffScale=\{sceneHandoffScale\}[\s\S]*?sceneHandoffTranslateY=\{sceneHandoffTranslateY\}/);
  assert.match(mossproutOpening, /regularSubject: \{ \.\.\.StyleSheet\.absoluteFillObject, zIndex: 41 \}/);
  assert.match(nurture, /!subjectHidden \? <Animated\.View[\s\S]*?subjectHandoffStyle/);
  assert.match(nurture, /!sceneOnly \? <View[\s\S]*?styles\.chrome/);
  assert.match(nurture, /const sceneLift = sceneHandoffProgress[\s\S]*?\? HOME_SCENE_Y_OFFSET[\s\S]*?: sceneOnly[\s\S]*?\? 0[\s\S]*?: onboardingFocus/);
  assert.match(nurture, /const sceneHandoffStyle = useAnimatedStyle[\s\S]*?translateY: sceneHandoffTranslateY \* progress[\s\S]*?scale: 1 \+ \(sceneHandoffScale - 1\) \* progress/);
  assert.match(nurture, /styles\.subjectHandoffPlane, subjectHandoffStyle[\s\S]*?styles\.eggStage[\s\S]*?projectedEggStageStyle/);
  assert.doesNotMatch(mossproutOpening, /restoreDiscoveryReveal/);
  assert.match(todayRoute, /<Redirect href="\/katchimeras"/);
  assert.deepEqual(activeFtueNavigationPolicy({ status: 'active', stepId: 'egg.opening' })?.resume, { kind: 'haven' });
  assert.deepEqual(activeFtueNavigationPolicy({ status: 'active', stepId: 'grove.egg_inspect' })?.resume, { kind: 'haven' });
  assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId: 'grove.egg_inspect' }), true);
  assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId: 'companion.first_meeting' }), true);
  assert.match(devTools, /Restart first-session onboarding · keep profile/);
  assert.match(devTools, /beginFirstSession\(\{ restart: true \}\)/);
  assert.match(devTools, /await resetTodayForDebug\(\);[\s\S]*?await resetKatchimeraProgressForDebug\(\{ resetAt \}\);[\s\S]*?beginFirstSession\(\{ restart: true \}\)/);
  assert.match(devTools, /restarts the new Mossprout flow in Haven/);
  assert.match(devTools, /router\.navigate\('\/\(tabs\)\/katchimeras'\)/);
  assert.doesNotMatch(todayRoute, /export function HavenEggFtueSurface/);
  assert.doesNotMatch(todayRoute, /originBackgroundKey=\{ftueOpeningOwnsHome \? 'mossprout'/);
  assert.doesNotMatch(todayRoute, /sceneId=\{ftueOpeningOwnsHome \? 'mossprout'/);
});

test('FTUE starts a relationship before the Garden, shows First Bloom, and continues through the resident lesson', () => {
  const route = readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  const today = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const companion = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const coachmark = readFileSync('components/katchadeck/onboarding/companion-ftue-coachmark.tsx', 'utf8');
  const kingdom = readFileSync('components/katchadeck/world/kingdom-companion-screen.tsx', 'utf8');
  const mossproutFtueStage = readFileSync('components/katchadeck/world/mossprout-ftue-story-stage.tsx', 'utf8');
  const mossproutStage = readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const journeyMilestone = readFileSync('components/katchadeck/world/katchimera-journey-status-plaque.tsx', 'utf8');
  const bondCelebration = readFileSync('components/katchadeck/world/companion-bond-level-up-celebration.tsx', 'utf8');
  const repository = readFileSync('utils/merge-world/repository.ts', 'utf8');
  const transition = readFileSync('features/navigation/game-screen-transition.tsx', 'utf8');
  const ftueRuntime = readFileSync('features/onboarding/ftue-runtime.ts', 'utf8');
  assert.match(merge, /ftueRun\.stepId !== 'companion\.chapter_zero_return'[\s\S]*?target: 'companion'[\s\S]*?ftue: 'chapter-zero-return'/);
  assert.match(companion, /actionId: 'companion\.complete_chapter_zero_return'[\s\S]*?nextStepId: 'haven\.first_bloom'/);
  assert.match(companion, /run\.stepId === 'companion\.nickname'[\s\S]*?saveMossproutPlayerNickname[\s\S]*?kind: 'friendship_started'[\s\S]*?actionId: 'companion\.save_nickname'/);
  assert.match(companion, /kind: 'friendship_started'[\s\S]*?queueCelebration: true/);
  assert.match(companion, /MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress/);
  assert.match(companion, /MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - companionBondProgress[\s\S]*?kind: 'check_in_completed'[\s\S]*?points/);
  assert.match(companion, /run\.stepId === 'companion\.bond_intro'[\s\S]*?actionId: 'companion\.acknowledge_friendship'/);
  assert.match(kingdom, /ftueDayOneActionActive[\s\S]*?receipt\.afterLevel > receipt\.beforeLevel[\s\S]*?variant: 'level_up'/);
  assert.match(kingdom, /setBondCelebration\(null\)[\s\S]*?onFtueJourneyDayComplete\?\.\(\)/);
  assert.match(mossproutFtueStage, /onFinished=\{\(\) => undefined\}/);
  assert.match(companion, /actionId: 'companion\.complete_day_one_action'[\s\S]*?nextRun\?\.status !== 'complete'[\s\S]*?seedStoredMossproutGardenAfterFtue/);
  assert.match(companion, /openFtueResidentParcel[\s\S]*?activateStoredResidentCardDiscovery[\s\S]*?router\.push/);
  assert.match(companion, /activateStoredResidentCardDiscovery\([\s\S]*?MOSSPROUT_FTUE_FIRST_RESIDENT_ID/);
  assert.match(companion, /beginResidentMergeHandoff\(\)[\s\S]*?await activateStoredResidentCardDiscovery/);
  assert.match(companion, /catch \(error\) \{[\s\S]*?cancelResidentMergeHandoff\(\)/);
  assert.match(companion, /openFtueResidentParcel[\s\S]*?transitionTo\(\{[\s\S]*?navigate: async \(\) => \{[\s\S]*?await activateStoredResidentCardDiscovery[\s\S]*?actionId: 'companion\.open_resident_parcel'[\s\S]*?nextStepId: 'merge\.resident_parcel'[\s\S]*?await flushFtuePersistence\(\)[\s\S]*?router\.push/);
  const transitionRequestIndex = companion.indexOf("announcement: 'Opening the veiled resident parcel'");
  const coveredWorkIndex = companion.indexOf('navigate: async () => {', transitionRequestIndex);
  const residentActivationIndex = companion.indexOf('await activateStoredResidentCardDiscovery');
  const residentSessionIndex = companion.lastIndexOf('beginResidentMergeHandoff()', residentActivationIndex);
  const residentOwnershipIndex = companion.indexOf("actionId: 'companion.open_resident_parcel'", residentActivationIndex);
  const residentPersistenceIndex = companion.indexOf('await flushFtuePersistence()', residentOwnershipIndex);
  const coveredNavigationIndex = companion.indexOf('router.push({', residentPersistenceIndex);
  assert.ok(transitionRequestIndex >= 0 && transitionRequestIndex < coveredWorkIndex);
  assert.ok(coveredWorkIndex < residentSessionIndex);
  assert.ok(residentSessionIndex >= 0 && residentSessionIndex < residentActivationIndex);
  assert.ok(residentActivationIndex < residentOwnershipIndex);
  assert.ok(residentOwnershipIndex < residentPersistenceIndex);
  assert.ok(residentPersistenceIndex < coveredNavigationIndex);
  assert.doesNotMatch(companion, /params: \{ creatureId, residentHandoff: '1' \}/);
  assert.match(merge, /ftueRun\.stepId === 'companion\.resident_parcel_ready'[\s\S]*?actionId: 'companion\.open_resident_parcel'[\s\S]*?nextStepId: ftueStep\.id/);
  assert.match(companion, /initialConversationDefinitionId=\{!residentStoryResumeActive[\s\S]*?navigationFtueRun\.stepId === 'companion\.resident_affinity'[\s\S]*?mossprout:game:form-finder/);
  assert.doesNotMatch(companion, /initialConversationDefinitionId=\{[^}]*companion\.resident_match_result/);
  assert.match(companion, /run\.stepId === 'companion\.resident_match_result'[\s\S]*?completeResidentResultExit\('mossprout:ftue:resident-match-result'\)/);
  assert.match(companion, /completeResidentResultExit[\s\S]*?await seedStoredMossproutGardenAfterFtue[\s\S]*?nextStepId: 'haven\.reveal'/);
  assert.match(companion, /ftueRun\?\.status !== 'complete'[\s\S]*?postFtueGardenRepairRef[\s\S]*?seedStoredMossproutGardenAfterFtue/);
  assert.match(companion, /const ftueResidentHandoffActive = Boolean\([\s\S]*?navigationFtueRun\.stepId !== 'companion\.resident_match_result'[\s\S]*?residentParcelReady/);
  assert.doesNotMatch(companion, /repair:mossprout-day-one-bond-action|repair:mossprout-bond-spotlight|repair:mossprout-resident-affinity/);
  assert.match(ftueRuntime, /input\.actionId === 'companion\.complete_day_one_action'[\s\S]*?completeDayOneLesson/);
  assert.doesNotMatch(companion, /complete_resident_affinity'[\s\S]{0,500}?router\.push/);
  assert.match(companion, /stepId !== 'companion\.bond_spotlight'[\s\S]*?actionId: 'companion\.acknowledge_bond'/);
  assert.match(companion, /await revealStoredHaven\(\)[\s\S]*?Showing the First Bloom[\s\S]*?router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/);
  assert.match(interaction, /Promise\.resolve\(onInitialConversationComplete\?\.\(\)\)[\s\S]*?\.then\(showFeastleStoryHome\)/);
  assert.match(interaction, /CompanionFtueCoachmark[\s\S]*?ftueBondSpotlightActive[\s\S]*?ftueDayOneActionActive/);
  assert.match(companion, /advanceFtueActionDurably\([\s\S]*?companion\.complete_chapter_zero_return[\s\S]*?router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/);
  assert.match(repository, /seedStoredMossproutGardenAfterFtue[\s\S]*?completeMossproutChapterZeroSlice[\s\S]*?reconcileCharacterActivity[\s\S]*?status: 'complete'/);
  assert.match(kingdom, /ftueDayOneActionActive && receipt\.kind === 'journey_day_completed'[\s\S]*?variant: 'journey_complete'/);
  assert.match(kingdom, /ftueDayOneActionActive[\s\S]*?onFtueJourneyDayComplete\?\.\(\)[\s\S]*?continueFtueAfter/);
  assert.match(kingdom, /autoContinue=\{!ftueDayOneActionActive\}[\s\S]*?Hear Mossprout\\'s story[\s\S]*?dismissible=\{!ftueDayOneActionActive\}[\s\S]*?onFtueJourneyDayComplete/);
  assert.match(bondCelebration, /onRequestClose=\{dismissible \? onContinue : \(\) => \{\}\}[\s\S]*?<GameSurface[\s\S]*?Journey Day \$\{journeyHandoff\.dayNumber\} timeline/);
  assert.match(companion, /scheduleMossproutJourneyDayReminder\(completedDayId\)/);
  assert.match(
    companion,
    /ftueRouteOrigin && navigationFtueRun\?\.status !== 'active'[\s\S]*?router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/,
  );
  assert.match(mossproutStage, /<KatchimeraJourneyStatusPlaque[\s\S]*?dayNumber=\{journeyDayNumber\}[\s\S]*?status=\{journey\.status === 'complete'/);
  assert.match(journeyMilestone, /Journey Day \{dayNumber\}[\s\S]*?complete \? 'Complete' : 'In progress'/);
  assert.match(mossproutStage, /relationshipProgressionRepository\.update\(reconcileMossproutDayOneChoices\)/);
  assert.match(mossproutStage, /dayOneChoiceActionIds[\s\S]*?includeActionIds: dayOneActionChoiceActive \? dayOneChoiceActionIds : undefined/);
  assert.match(interaction, /status === 'profile_available'[\s\S]*?requestStoryConversation\(definitionId\)/);
  assert.match(interaction, /residentStoryResumeActive=\{props\.ftueResidentStoryResume\}[\s\S]*?residentStoryResumeTitle/);
  assert.doesNotMatch(interaction, /A VEILED PARCEL IS WAITING/);
  assert.match(mossproutStage, /Coin-only requests remain in the Garden[\s\S]*?const presentedActionCandidates = actions/);
  assert.match(bondCelebration, /resolvedJourneyDayNumber = journeyDayNumber \?\? journeyHandoff\?\.dayNumber \?\? 1[\s\S]*?<CelebrationHeroNumber[\s\S]*?label="JOURNEY DAY"/);
  assert.doesNotMatch(bondCelebration, /journeyBondRatio|journeyProgressCard|receipt\.points|COMPANION_RELATIONSHIP_STAGES|journeyStageNode/);
  assert.match(bondCelebration, /accessibilityLabel=\{`Journey Day \$\{journeyHandoff\.dayNumber\} timeline`\}[\s\S]*?styles\.timelineLockedMarker/);
  assert.match(coachmark, /useEggAvatar\(\)[\s\S]*?<EggAvatar/);
  assert.match(coachmark, /styles\.speechTail[\s\S]*?styles\.guideAvatar[\s\S]*?<EggAvatar/);
  assert.doesNotMatch(coachmark, /avatarBadge(?:Background|Ring)?/);
  assert.ok(coachmark.indexOf('style={[styles.callout') < coachmark.indexOf('{showFinger ? ('), 'the companion finger must render above the unified Egg bubble');
  assert.match(coachmark, /roundedCutout[\s\S]*?boxShadow: `0 0 0 \$\{spotlightSpread\}px[\s\S]*?borderRadius: spotlightRadius/);
  assert.match(coachmark, /ftue-hand\.webp[\s\S]*?HAND_TIP_X[\s\S]*?HAND_TIP_Y[\s\S]*?<Image/);
  assert.match(coachmark, /showFinger = true[\s\S]*?\{showFinger \? \(/);
  assert.match(interaction, /emphasis: true, text: 'one card'[\s\S]*?showFinger=\{false\}/);
  assert.match(coachmark, /GUIDE_EXPRESSION_FACE_IDS[\s\S]*?Math\.random\(\)[\s\S]*?setGuideFaceId\(nextFace\)/);
  assert.match(coachmark, /useReducedMotion\(\)[\s\S]*?!reduceMotion[\s\S]*?withSequence\(/);
  assert.match(coachmark, /rotateZ: `\$\{avatarWobble\.value\}deg`/);
  assert.match(coachmark, /clearTimeout\(reactionTimer\)[\s\S]*?clearTimeout\(restoreTimer\)[\s\S]*?cancelAnimation\(avatarWobble\)/);
  assert.match(coachmark, /size=\{76\}/);
  assert.match(coachmark, /translateY: -2/);
  assert.match(coachmark, /callout: \{[\s\S]*?flexDirection: 'row'[\s\S]*?guideAvatar: \{ flexShrink: 0/);
  assert.doesNotMatch(coachmark, /styles\.(eyebrow|title|body)/);
  assert.match(interaction, /message=\{\[[\s\S]*?emphasis: true, text: 'Bond\.'[\s\S]*?emphasis: true, text: 'one card'/);
  assert.match(today, /resolveMossproutJourneyHandoff[\s\S]*?companionJourneyHook=\{mossproutJourneyHandoff\}[\s\S]*?onOpenCompanionJourney=\{openMossproutJourney\}/);
  assert.match(today, /handoff\?\.state === 'ready_to_begin' \? handoff : null/);
  assert.match(route, /ftueRun\?\.status === 'active'[\s\S]*?ftueRun\.stepId === 'companion\.chapter_zero_return'[\s\S]*?MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID/);
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

test('the Grove Egg inherits the authored camera retreat across its three feeds', () => {
  const grove = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  const openingScale = mossproutGroveEggCameraPinchTarget('egg.opening', 2)!;
  const contextScale = mossproutGroveEggCameraPinchTarget('egg.context', 2)!;
  const mindScale = mossproutGroveEggCameraPinchTarget('egg.mind', 2)!;
  const readyScale = mossproutGroveEggCameraPinchTarget('egg.ready', 2)!;
  const ratios = [openingScale / contextScale, contextScale / mindScale, mindScale / readyScale];

  assert.ok(ratios.every((ratio) => Math.abs(ratio - ratios[0]!) < 1e-9));
  assert.equal(mossproutGroveEggCameraPinchTarget('grove.egg_inspect', 2), 2);
  assert.equal(readyScale, 1);
  assert.equal(mossproutGroveEggCameraPinchTarget('companion.first_meeting', 2), null);
  assert.equal(mossproutGroveEggCameraPanTarget('egg.opening'), FTUE_OPENING_CAMERA_PAN_Y);
  assert.equal(mossproutGroveEggCameraPanTarget('egg.context'), FTUE_OPENING_CAMERA_PAN_Y * (2 / 3));
  assert.equal(mossproutGroveEggCameraPanTarget('egg.mind'), FTUE_OPENING_CAMERA_PAN_Y * (1 / 3));
  assert.equal(mossproutGroveEggCameraPanTarget('egg.ready'), 0);
  assert.match(grove, /useTodayEnvironmentMotion\(\{/);
  assert.match(grove, /scriptedPinchScale: groveCameraScale/);
  assert.match(grove, /<TodayEnvironmentMotionProvider motion=\{environmentMotion\}>/);
  assert.match(grove, /onboardingCameraPanY=\{mossproutGroveEggCameraPanTarget\(stepId\)\}/);
});

test('the Grove Egg traverses Today physical growth evenly across three feeds', () => {
  const grove = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  const sizes = [0, 1, 2, 3].map((answeredCount) => (
    eggScaleForEnergyRatio(mossproutGroveEggEnergyRatio(answeredCount))
  ));

  const expectedSizes = [0.5, 2 / 3, 5 / 6, 1];
  assert.ok(sizes.every((size, index) => Math.abs(size - expectedSizes[index]!) < 1e-12));
  assert.equal(mossproutGroveEggEnergyRatio(-1), 0);
  assert.equal(mossproutGroveEggEnergyRatio(4), 0.5);
  assert.match(grove, /const energyRatio = mossproutGroveEggEnergyRatio\(answeredCount\)/);
  assert.doesNotMatch(grove, /const ratios = \[0\.38, 0\.58, 0\.78, 1\]/);
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
  assert.match(home, /openingQuestionAwaitingAnswer = scriptedTextChoiceAction\?\.id === 'egg\.desired_feeling'[\s\S]*?&& !currentScriptedTextSelection/);
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
  assert.match(actions, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?label=\{action\.title\}[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
  assert.doesNotMatch(route, /Talk to Mossprout/);
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
  assert.match(home, /const visibleOptions = options\.slice\(0, 4\)/);
  assert.match(home, /ftueQuestionLayout && styles\.ftueQuestionAnchor/);
  assert.match(home, /illustrated && !ftueQuestionLayout/);
  assert.match(home, /showGlint=\{!ftueQuestionLayout\}/);
  assert.match(home, /style=\{ftueQuestionLayout \? styles\.ftueQuestionReward : styles\.inlineReward\}/);
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
  assert.match(home, /completionKey: ownedCompletionEvent\?\.id/);
  assert.match(home, /if \(!completionKey \|\| completedKeyRef\.current === completionKey\) return/);
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
  assert.match(home, /function InlineScriptedChoice[\s\S]*?<InlineCheckInPanel[\s\S]*?allowSkip=\{false\}/);
  assert.match(home, /disabled=\{interactionLocked \|\| !allowSkip\}/);
  assert.match(home, /\{allowSkip \? \([\s\S]*?accessibilityLabel=\{`Skip \$\{action\.title\} for today`\}/);
  assert.match(home, /numberOfLines=\{2\}[\s\S]*?inlineQuestionRequired/);
  assert.match(home, /illustratedCardContent:[^\n]*gap: 5[^\n]*paddingVertical: 7/);
  assert.match(home, /illustratedHeading:[^\n]*minHeight: 48/);
  assert.match(home, /illustratedChoice:[^\n]*minHeight: 70[^\n]*paddingTop: 2/);
  assert.match(home, /illustratedChoiceThreeColumn:[^\n]*minHeight: 66/);
});

test('FTUE copy uses the shared cozy-game type hierarchy and stays concise', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const guide = readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8');
  const actions = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  const conversation = readFileSync('constants/mossprout-ftue-conversations.ts', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const theme = readFileSync('constants/theme.ts', 'utf8');
  const eggSteps = MOSSPROUT_FTUE_SCRIPT.steps.filter((step) => step.id.startsWith('egg.'));
  assert.match(theme, /ftueHeroTitle:[\s\S]*?AppFontFamilies\.fredokaBold/);
  assert.match(theme, /ftueBody:[\s\S]*?AppFontFamilies\.manrope/);
  assert.match(theme, /ftuePanelTitle:[\s\S]*?AppFontFamilies\.fredokaBold/);
  assert.match(home, /import \{ FtueGuideCopy \} from '@\/components\/katchadeck\/onboarding\/ftue-guide-copy'/);
  assert.match(guide, /KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.match(home, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  assert.match(actions, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  assert.doesNotMatch(conversation, /prompt: `Mossprout remembers your answers/);
  assert.match(conversation, /id: 'remembered'[\s\S]*?prompt: opening/);
  assert.match(interaction, /session\.currentNodeId !== 'remembered'[\s\S]*?message: 'Mossprout remembers your answers'/);
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

test('Mossprout reveal name sits below the Egg stage and hatch has no redundant interaction dock', () => {
  const egg = readFileSync('components/katchadeck/home/today-kingdom-egg-hero.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const button = readFileSync('components/katchadeck/ui/katcha-button.tsx', 'utf8');
  assert.match(egg, /top: eggFrame\.top \+ eggFrame\.height \+ 8/);
  assert.match(egg, /discoveryName: \{ \.\.\.KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.doesNotMatch(egg, /Math\.min\(TODAY_KINGDOM_STAGE_HEIGHT - 36/);
  assert.doesNotMatch(route, /label="Talk to Mossprout"/);
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
  assert.match(idleSources, /'mossprout': require\('\.\.\/assets\/images\/katchimeras\/animations\/mossprout-idle\.webp'\)/);
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
  assert.match(route, /frozen: dailyHatchActive \|\| discoveryHatchInPlace/);
  assert.match(route, /const explorationBackgroundActive = isForming[\s\S]*?\|\| !dailyHatchActive/);
});
