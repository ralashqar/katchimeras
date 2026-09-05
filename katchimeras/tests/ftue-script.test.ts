import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
} from '@/features/onboarding/mossprout-ftue-script';
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

test('hero copy fits three lines without captions and Haven spotlight retries native layout', () => {
  const copy = readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8');
  assert.equal(copy.match(/numberOfLines=\{hero \? 3 : 2\}/g)?.length, 2);
  assert.equal(copy.match(/adjustsFontSizeToFit=\{hero\}/g)?.length, 2);
  assert.match(copy, /!hero && guide.body/);
  const overlay = readFileSync('components/katchadeck/onboarding/haven-ftue-overlay.tsx', 'utf8');
  assert.match(overlay, /requestAnimationFrame\(\(\) => \{ void measureTargets\(\); \}\)/);
  assert.match(overlay, /cancelAnimationFrame\(retryFrame\)/);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.doesNotMatch(screen, /cameraSettleRevisionRef.current \+= 1/);
});

test('planted Seed highlights top copy and the tray/button cluster as two separate openings', () => {
  const step = mossproutFtueStep('world.seed_planted')!;
  assert.deepEqual(step.cue, { kind: 'tap', target: { kind: 'haven_garden_button', characterId: 'mossprout' } });
  assert.deepEqual(step.spotlight?.targets, [{ kind: 'haven_guide' }, { kind: 'haven_garden_cluster', characterId: 'mossprout' }, { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: 'back-centre' }]);
  assert.deepEqual(step.spotlight?.targetGroups, [[0, 2], [1]]);
  assert.equal(step.spotlight?.grouping, 'individual');
  const holes = [{ x: 20, y: 30, width: 280, height: 130 }, { x: 180, y: 480, width: 160, height: 240 }];
  const mask = roundedMultiCutoutSegments(holes, 16, { width: 360, height: 780 });
  const dimmed = (x: number, y: number) => mask.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  assert.equal(dimmed(150, 90), false);
  assert.equal(dimmed(260, 600), false);
  assert.equal(dimmed(180, 300), true);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const tray = screen.slice(screen.indexOf("{ftueStepId === 'world.seed_planted' && !firstSeedPlacementFailed ? ("), screen.indexOf(") : ftueStepId === 'world.garden_handoff'"));
  assert.match(tray, /FrozenMergeOrderTrayCard entry=\{gardenHandoffOrder\}/);
  assert.doesNotMatch(readFileSync('components/katchadeck/games/merge-order-rail.tsx', 'utf8'), /CHAIR_ART|chairArt|order-chair/);
  assert.doesNotMatch(tray, /gardenRequestBubble/);
  assert.match(screen, /ref=\{setGardenClusterNode\}/);
});

test('all opening answers are inclusive, stable, and produce the correct personal Seed', () => {
  assert.deepEqual(MOSSPROUT_HELP_OPTIONS.map((option) => mossproutFirstSeedForIntent(option.id).id), ['momentum', 'stillness', 'curiosity']);
  for (const option of MOSSPROUT_HELP_OPTIONS) {
    assert.deepEqual(mossproutFirstSeedForIntent(option.id), mossproutFirstSeedForIntent(`desired-help:${option.id}`));
    assert.ok(mossproutSeedIntroduction(option.id).length < 85);
  }
  for (const option of MOSSPROUT_DAY_OPTIONS) {
    assert.ok(mossproutFtueConversationDefinitions.some((definition) => definition.id === `mossprout:ftue:first-meeting:${option.id}`));
  }
  assert.deepEqual(MOSSPROUT_WATER_OPTIONS.map((option) => option.id), ['could_use_water', 'already_good', 'dont_start']);
  assert.equal(mossproutFtueAction('companion.water_together', 'companion.choose_water_together')?.nextStepId, 'companion.first_rest');
  assert.equal(mossproutFtueStep('companion.first_rest')?.actions.length, 1);
});

test('v43 migration moves removed checkpoints forward without restarting completed players', () => {
  const checkpoints = {
    'companion.day_one_action': 'companion.garden_intro',
    'companion.bond_spotlight': 'companion.garden_intro',
    'companion.order_preview': 'companion.garden_intro',
    'world.garden_handoff': 'world.seed_planted',
    'companion.chapter_zero_return': 'companion.water_together',
    'companion.water_response': 'companion.first_rest',
    'companion.first_insight': 'companion.first_rest',
  };
  for (const [stepId, expected] of Object.entries(checkpoints)) {
    assert.equal(streamlinedFtueStep({ status: 'active', stepId }), expected);
    assert.equal(streamlinedFtueStep({ status: 'complete', stepId }), 'complete');
  }
  assert.equal(streamlinedFtueStep({ status: 'active', stepId: 'merge.first_bloom' }), 'merge.first_bloom');
  assert.equal(mossproutFtueAction('companion.garden_intro', 'companion.continue_to_planting')?.nextStepId, 'world.garden_arrival');
  assert.ok(mossproutFtueAction('companion.garden_intro', 'companion.acknowledge_garden_intro'), 'old offline receipts remain allowlisted');
});

test('old Basket checkpoints migrate to the meditation bridge without locking Back', () => {
  assert.equal(mossproutFtueStep('merge.handoff.spawn'), null);
  assert.equal(mossproutFtueStep('merge.handoff.merge'), null);
  for (const stepId of ['merge.handoff.spawn', 'merge.handoff.merge']) {
    assert.equal(ftueLocksSurfaceNavigation({ status: 'active', stepId }, 'merge'), false);
    assert.equal(streamlinedFtueStep({ status: 'active', stepId }), 'companion.meditating');
  }
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(merge, /beforeRemove[\s\S]*?completeFtueRun\(\)/);
  const provider = readFileSync('features/content-flow/content-flow-provider.tsx', 'utf8');
  assert.match(provider, /status === 'complete'\) await dismissFtueContentFlow[\s\S]*?await resumeActiveContentFlows/);
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
  assert.match(exitHandler, /run\?\.status === 'active' && run\.stepId === 'companion\.meditating'[\s\S]*?completeFtueRun\(\)[\s\S]*?setInteractionExitNonce/);
  assert.match(exitHandler, /else if \(ftueStepId && run\?\.status !== 'complete'\) return/);
  assert.match(exitHandler, /ftueStepId && ftueStepId !== 'companion\.meditating'[\s\S]*?hardwareBackPress[\s\S]*?requestResidentInteractionExit\(\)/);
  assert.match(route, /onCloseCompanion=\{\(\) => \{[\s\S]*?run\.stepId === 'companion\.meditating'[\s\S]*?completeFtueRun\(\)/);
  assert.match(route, /if \(run\.stepId === 'companion\.meditating'\)[\s\S]*?commitFtueAction\([\s\S]*?completeFtueRun\(\)[\s\S]*?onHostedClose\?\.\(\)/);
});

test('Mossprout FTUE script has valid transitions and registered handlers', () => {
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'world.egg_intro');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.terminalStepId, 'complete');
  assert.equal(mossproutFtueStep('world.egg_intro')?.actions[0]?.nextStepId, 'egg.opening');
  assert.equal(mossproutFtueStep('grove.egg_inspect'), null);
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
  }
});

test('the Egg asks two meaningful real-life questions before Hatch', () => {
  const step = mossproutFtueStep('egg.opening');
  assert.equal(step?.actions.length, 1);
  assert.equal(step?.actions[0]?.handlerId, 'player_profile');
  assert.equal(step?.actions[0]?.options?.length, 3);
  assert.equal(mossproutFtueAction('egg.opening', 'egg.day_texture')?.nextStepId, 'egg.context');
  assert.equal(step?.actions[0]?.title, 'How has today felt?');
  assert.deepEqual(step?.actions[0]?.options?.map((option) => option.label), [
    'Pretty good',
    'A lot going on',
    'Taking it as it comes',
  ]);
  const desiredHelp = mossproutFtueStep('egg.context')?.actions[0];
  assert.equal(desiredHelp?.id, 'egg.desired_help');
  assert.equal(desiredHelp?.options?.length, 3);
  assert.deepEqual(desiredHelp?.options?.map((option) => option.label), [
    'A little progress',
    'A little calm',
    'I’m not sure yet',
  ]);
  assert.equal(desiredHelp?.nextStepId, 'egg.ready');
  const eggSequenceStepIds = ['world.egg_intro', 'egg.opening', 'egg.context', 'egg.ready'];
  assert.equal(eggSequenceStepIds.every((stepId) => mossproutFtueStep(stepId)?.guide.body === ''), true);
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
  assert.equal(selection?.prompt.prompt, 'What would help most right now?');
  assert.equal(selection?.answer.label, 'Making a little progress');
  assert.equal(mossproutBondShareSelection('desired-help:energy')?.answer.label, 'Getting some energy back');
  assert.equal(mossproutBondShareSelection('desired-help:good_day')?.answer.label, 'Just having a good day');
  assert.equal(mossproutBondShareSelection('desired-help:not-an-answer'), null);
});

test('the Bond choice leads directly into a concise Garden restoration story', () => {
  assert.deepEqual(MOSSPROUT_GARDEN_INTRO_BEATS.map((beat) => beat.line), [
    'This Seed came from what you shared.',
  ]);
  assert.equal(mossproutGardenIntroBeat(0).actionLabel, 'Continue');
  assert.equal(mossproutGardenIntroBeat(99).actionLabel, 'Continue');

  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const stage = readFileSync('components/katchadeck/world/mossprout-ftue-story-stage.tsx', 'utf8');
  const orders = readFileSync('utils/merge-world/chapter-zero-policy.ts', 'utf8');
  assert.match(interaction, /ftueProfileStep === 'garden_intro'[\s\S]*?mossproutSeedIntroduction/);
  assert.doesNotMatch(interaction, /ftueGardenStoryBeatIndex/);
  assert.match(interaction, /ftueProfileStep === 'garden_intro'[\s\S]*?props\.onFtueOpenMerge/);
  assert.match(stage, /gardenStoryActionLabel[\s\S]*?<PrimaryAction icon=\{gardenStoryActionIcon\} label=\{gardenStoryActionLabel\}/);
  assert.match(orders, /title: 'The First Bloom'[\s\S]*?description: 'Merge two Sprouts to grow a Plant for the Garden\.'/);
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
  assert.equal(serveStep?.edges?.[0]?.nextStepId, 'world.first_bloom_restore');
  assert.equal(mossproutFtueAction('world.first_bloom_restore', 'world.restore_with_first_bloom')?.nextStepId, 'world.first_bloom_restore');
  assert.equal(mossproutFtueAction('world.first_bloom_restore', 'world.complete_first_bloom_restore')?.nextStepId, 'world.first_seed_grew');
  assert.equal(mossproutFtueAction('world.first_seed_grew', 'world.acknowledge_first_seed_growth')?.nextStepId, 'companion.water_together');
  assert.equal(mossproutFtueAction('companion.chapter_zero_return', 'companion.complete_chapter_zero_return')?.nextStepId, 'companion.water_together');
  assert.equal(mossproutFtueAction('companion.bond_intro', 'companion.acknowledge_friendship')?.nextStepId, 'companion.bond_spotlight');
  assert.equal(mossproutFtueAction('companion.bond_spotlight', 'companion.acknowledge_bond')?.nextStepId, 'companion.garden_intro');
  assert.equal(mossproutFtueAction('companion.day_one_action', 'companion.choose_growth_intent')?.options?.length, 3);
  assert.equal(mossproutFtueAction('companion.day_one_action', 'companion.complete_day_one_action')?.nextStepId, 'companion.bond_spotlight');
  assert.equal(mossproutFtueAction('companion.resident_affinity', 'companion.complete_resident_affinity')?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueAction('companion.resident_parcel_ready', 'companion.open_resident_parcel')?.nextStepId, 'merge.resident_parcel');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_dialogue')?.edges?.[0]?.nextStepId, 'merge.resident_seed_spawn');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_seed_spawn')?.edges?.[0]?.nextStepId, 'merge.resident_seed_echo');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_seed_echo')?.edges?.[0]?.nextStepId, 'merge.resident_sprout_echo');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_sprout_echo')?.edges?.[0]?.nextStepId, 'merge.resident_orders');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_orders')?.edges?.[0]?.requiredCount, undefined);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_orders')?.interaction?.mode, 'exclusive');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === 'merge.resident_card_reward')?.edges?.[0]?.nextStepId, 'companion.resident_match_result');
  assert.equal(mossproutFtueStep('haven.first_bloom'), null);
  assert.equal(mossproutFtueAction('companion.resident_match_result', 'companion.ack_resident_match_result')?.nextStepId, 'companion.meditating');
  assert.equal(mossproutFtueStep('world.complete'), null);
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

test('Mossprout remembers the day, reflects it back, then offers one narrative Garden objective', () => {
  const firstMeetings = mossproutFtueConversationDefinitions.filter((definition) => definition.id.startsWith('mossprout:ftue:first-meeting:'));
  assert.ok(firstMeetings.every((definition) => definition.version === 9));
  for (const definition of firstMeetings) {
    const hello = definition.nodes.find((node) => node.id === 'hello');
    assert.equal(hello?.kind, 'choice');
    if (hello?.kind === 'choice') assert.equal(hello.options.length, 3);
    assert.equal(definition.nodes.some((node) => node.id === 'stuck'), false);
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
  assert.match(interaction, /mossproutSeedIntroduction/);
  assert.match(interaction, /Let\\'s make this little corner welcoming again/);
  assert.match(interaction, /bubbleBody=\{companionSpeechTitle[\s\S]*?\? undefined/);
  assert.match(interaction, /bubbleVariant=\{quickGoalPickerOpen && !companionSpeechTitle \? 'questionnaire' : 'default'\}/);
  assert.match(mossproutStage, /<Modal/);
  assert.match(mossproutStage, /DayActionCardSurface/);
  assert.match(mossproutStage, /DayActionCompletedRow/);
  assert.match(mossproutStage, /title="Introduce yourself"/);
  assert.match(mossproutStage, /INTRODUCTION_REWARD/);
  assert.match(mossproutStage, /mode === 'intro_action'[\s\S]*?style=\{styles\.plainActionStage\}/);
  assert.match(mossproutStage, /plainActionStage: \{ gap: 7 \}/);
  assert.match(mossproutStage, /mode === 'bond_choice'[\s\S]*?MOSSPROUT_BOND_SHARE_PROMPTS\[0\]\.options\.map/);
  assert.match(mossproutStage, /mode === 'garden_intro'[\s\S]*?<DayActionCardSurface[\s\S]*?eyebrow="YOUR MEMORY SEED"/);
  assert.doesNotMatch(mossproutStage, /seedName:|seedDescription:|seedEyebrow:/);
  assert.match(mossproutStage, /onContinue\?\.\(`\$\{MOSSPROUT_BOND_SHARE_PROMPTS\[0\]\.id\}:\$\{option\.id\}`\)/);
  assert.match(bondShare, /What would help most right now\?/);
  assert.match(bondShare, /Making a little progress[\s\S]*?Finding a little calm[\s\S]*?Feeling more like myself/);
  assert.match(bondShare, /Give me one small thing to try[\s\S]*?Help me think it through[\s\S]*?Give me a push[\s\S]*?Mostly just keep me company/);
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
  const playSurface = merge.indexOf('<MergePlaySurface', invariant);
  assert.ok(invariant >= 0 && playSurface > invariant);
  assert.doesNotMatch(merge.slice(invariant, playSurface), /chapterGuide|ftueStep\.guide|KatchaInlineNotice|ThemedText/);
  assert.doesNotMatch(merge, /const chapterGuide|const legacyChapterGuide/);
  assert.match(merge, /Future guidance belongs in an absolute world-space[\s\S]*?tray, counter, and board retain identical frames/);
});

test('Merge FTUE spotlight uses a lifecycle-safe native rounded cutout', () => {
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  const havenOverlay = readFileSync('components/katchadeck/onboarding/haven-ftue-overlay.tsx', 'utf8');
  const kingdomScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const merge = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(overlay, /StyleSheet\.absoluteFillObject/);
  assert.match(overlay, /pointerEvents="none"/);
  assert.match(overlay, /<SpotlightDimMask/);
  assert.match(overlay, /<NativeMultiSpotlightDimMask/);
  assert.match(overlay, /roundedMultiCutoutSegments\(frames, radius, screen\)/);
  assert.match(overlay, /Math\.hypot\(screen\.width, screen\.height\)/);
  assert.match(overlay, /borderRadius: slot\.corner\.value/);
  assert.match(readFileSync('features/onboarding/spotlight-geometry.ts', 'utf8'), /const stepsPerCorner = 12/);
  assert.match(overlay, /nativeSpotlightRing: \{[\s\S]*?borderCurve: 'continuous'/);
  assert.match(overlay, /boxShadow: `0 0 0 \$\{spreadRadius\}px \$\{color\}`/);
  assert.doesNotMatch(overlay, /SpotlightCornerFillers|spotlightCornerFiller/);
  assert.match(overlay, /<NativeSpotlightRing slot=\{slot0\}/);
  assert.doesNotMatch(overlay, /@shopify\/react-native-skia|<Canvas|usePathValue|BlurMask/);
  assert.match(havenOverlay, /cornerRadius = Math\.min\(radius, focus\.width \/ 2, focus\.height \/ 2\)/);
  assert.match(havenOverlay, /Math\.hypot\(screen\.width, screen\.height\)/);
  assert.match(havenOverlay, /boxShadow: `0 0 0 \$\{spreadRadius\}px rgba\(11,9,24,\$\{opacity\}\)`/);
  assert.match(havenOverlay, /dimMask: \{[\s\S]*?borderCurve: 'continuous'/);
  assert.match(havenOverlay, /const cueFrame = cue\?\.kind === 'tap'[\s\S]*?<Finger focus=\{layout\.cueFocus \?\? layout\.focus\}/);
  assert.match(havenOverlay, /target\.kind === 'haven_guide'\) return 'haven-guide'/);
  assert.match(kingdomScreen, /collapsable=\{false\}[\s\S]*?ref=\{setHavenGuideNode\}[\s\S]*?<FtueGuideCopy/);
  assert.doesNotMatch(havenOverlay, /const dim =|\[dim,/);
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
  assert.match(mergeScreen, /ftueActive = ftueRun\?\.status === 'active'[\s\S]*?disabled=\{ftueActive && !handoffActive\}/);
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
  const roster = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');

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
  assert.match(companion, /openFtueGarden = useCallback\(async \(\) => \{[\s\S]*?installMossproutOnboardingMergeWorld[\s\S]*?advanceFtueActionDurably[\s\S]*?result\.run\?\.stepId !== 'world\.garden_arrival'[\s\S]*?flushFtuePersistence/);
  assert.doesNotMatch(companion, /Could not prepare Mossprout Garden handoff'[\s\S]{0,120}?throw error/);
  assert.match(roster, /openFtueGarden = useCallback\(async \(\) => \{[\s\S]*?transitionTo\(\{[\s\S]*?target: 'merge'[\s\S]*?advanceFtueActionDurably[\s\S]*?result\.step\?\.surface !== 'merge'[\s\S]*?router\.push/);
  assert.doesNotMatch(roster, /continueFirstBloomToResident|haven\.continue_to_resident/);
  assert.match(companion, /run\?\.stepId === 'companion\.chapter_zero_return'[\s\S]*?nextStepId: 'companion\.water_together'/);
  assert.match(companion, /activeFtueConversationDefinitionId = navigationFtueRun\?\.status === 'active'[\s\S]*?companion\.first_meeting[\s\S]*?companion\.chapter_zero_return[\s\S]*?ftueConversationDefinitionId[\s\S]*?: undefined/);
  assert.match(companion, /ftueConversationDefinitionId=\{activeFtueConversationDefinitionId\}/);
  assert.match(companion, /onFtueConversationComplete=\{activeFtueConversationDefinitionId \|\| residentFtueGraphActive/);
  assert.match(haven, /companionActive && companionVisualReady[\s\S]*?<KatchimeraCompanionRouteScreen/);
  assert.doesNotMatch(reconciler, /hatch\.talk_to_mossprout|run\.stepId === 'hatch\.reveal'/);
  assert.match(companion, /ftueCompanionSurfaceOwned = Boolean\([\s\S]*?mossproutFtueStep\(navigationFtueRun\.stepId\)\?\.surface === 'companion'/);
  assert.match(interaction, /!showMossproutDashboard[\s\S]*?!props\.ftueCompanionSurfaceOwned \|\| residentFtueDashboard/);
  assert.match(interaction, /residentParcelHandoffActive=\{residentParcelGardenPanelActive\}/);
  assert.match(interaction, /residentResultFtueDashboard = props\.familyId === 'mossprout'[\s\S]*?props\.ftueResidentMatchResultActive/);
  assert.match(interaction, /dashboardRouteActive = route\.kind === 'dashboard'[\s\S]*?residentResultFtueDashboard/);
  assert.match(interaction, /!residentFtueDashboard && !residentResultFtueDashboard[\s\S]*?showFeastleStoryHome\(\)/);
  assert.match(companion, /run\?\.stepId === 'companion\.first_rest'[\s\S]*?beginKatchimeraMeditation\([\s\S]*?MOSSPROUT_FTUE_REST_MS,[\s\S]*?sourceId[\s\S]*?actionId: 'companion\.begin_rest'/);
  assert.match(companion, /run\.stepId === 'companion\.meditating'[\s\S]*?actionId: 'companion\.tend_garden'[\s\S]*?if \(hostedInHaven\) onHostedClose\?\.\(\)/);
  assert.match(roster, /stepId === 'companion\.meditating'[\s\S]*?completeFtueRun\(\)/);
});

test('meditation stays inside companion interaction with compact action-card UI', () => {
  const haven = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');
  const havenWorld = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const companion = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const meditationStage = readFileSync('components/katchadeck/world/companion-meditation-stage.tsx', 'utf8');
  const cinematicStage = readFileSync('components/katchadeck/world/companion-cinematic-stage.tsx', 'utf8');
  const homeStage = readFileSync('components/katchadeck/world/companion-home-environment-stage.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const creatureArt = readFileSync('utils/creature-art.ts', 'utf8');

  assert.match(haven, /meditationFtue = ftueRun\?\.status === 'active' && ftueRun\.stepId === 'companion\.meditating'[\s\S]*?!meditationFtue/);
  assert.match(havenWorld, /havenOpeningActive && ftueStep && !activeInteractionResidentId/);
  assert.match(havenWorld, /setHostedInteractionRequest\(interactionRequest\);[\s\S]*?if \(interactionCreatureIdRef\.current !== interactionRequest\.creatureId\) \{[\s\S]*?setInteractionCameraReady\(false\)/);
  assert.match(havenWorld, /else if \(ftueStepId && run\?\.status !== 'complete'\) return;[\s\S]*?setInteractionExiting\(true\)/);
  assert.match(companion, /ftueRun\.stepId === 'companion\.meditating'[\s\S]*?\? 'meditating'/);
  assert.match(interaction, /companionInteractionAvailability\(relationships, props\.familyId, meditationNow\)/);
  assert.match(interaction, /meditationDashboardActive && meditation \? \([\s\S]*?styles\.meditationWorldTimer[\s\S]*?<CompanionMeditationStage/);
  assert.match(interaction, /initialConversationHandoffPending \? null : route\.kind === 'chat_lobby'[\s\S]*?&& !meditation/);
  assert.match(interaction, /\(route\.kind === 'destination' \|\| dashboardRouteActive[\s\S]*?&& !questGameVisible && !questionnaireExperience \? \([\s\S]*?<CompanionDestinationHeader/);
  assert.match(interaction, /meditationDashboardActive = Boolean\(!quickGoalPickerOpen && !unifiedJourneyActive && meditation && route\.kind !== 'conversation'/);
  assert.match(interaction, /companionSpeechTitle = dashboardRouteActive && actionNarration \? actionNarration : dashboardRouteActive && !quickGoalPickerOpen && unifiedJourneyActive && journeyNarration \? journeyNarration : meditationDashboardActive \? MOSSPROUT_FTUE_COPY\.meditation/);
  assert.match(interaction, /meditating=\{Boolean\(meditation\)\}/);
  assert.match(cinematicStage, /meditating=\{meditating\}/);
  assert.match(homeStage, /withTiming\(meditating \? 1 : 0,[\s\S]*?duration: 520/);
  assert.match(homeStage, /<RotatingRadialSunburst[\s\S]*?<Image[\s\S]*?source=\{meditationCreature\}/);
  assert.match(havenWorld, /activeKatchimeraMeditation\(relationships, 'mossprout'\)/);
  assert.match(havenWorld, /mossproutMeditating=\{mossproutMeditating\}/);
  assert.match(canvas, /<ResidentCreature[\s\S]*?meditating=\{tile\.companion\.familyId === 'mossprout' && mossproutMeditating\}/);
  assert.match(canvas, /residentMeditationAura[\s\S]*?<RotatingRadialSunburst[\s\S]*?source=\{meditationSource\}/);
  assert.match(canvas, /meditationProgress\.value = reduceMotion[\s\S]*?withTiming\(meditating \? 1 : 0/);
  assert.match(canvas, /<RotatingRadialSunburst[\s\S]*?source=\{meditationSource\}/);
  assert.match(creatureArt, /mossprout-meditating\.png/);
  assert.equal(existsSync('assets/images/katchimeras/cutouts/mossprout-meditating.png'), true);
  assert.match(meditationStage, /formatMeditationCountdown/);
  assert.match(meditationStage, /meditationProgress/);
  assert.match(interaction, /styles\.meditationActionsOverlay[\s\S]*?<MossproutStoryStage[\s\S]*?meditationMode/);
  assert.match(interaction, /meditationActionsOverlay: \{ position: 'absolute', zIndex: 25 \}/);
  assert.match(interaction, /bottom: Math\.max\(8, insets\.bottom \+ 4\)/);
  assert.match(interaction, /scrollEnabled=\{!\(dashboardRouteActive && unifiedJourneyActive\) && !activeAttemptId && !questionnaireExperience && !meditationDashboardActive/);
  assert.doesNotMatch(interaction, /meditationActionStack/);
  assert.match(interaction, /meditationTimerScreenTop = Math\.max\(390, Math\.min\(510, viewportHeight \* 0\.58\)\)/);
  assert.match(interaction, /meditationTimerSurfaceTop = Math\.max\([\s\S]*?meditationTimerScreenTop - \(insets\.top \+ 58 \+ KatchaUI\.spacing\.xs\)/);
  assert.match(interaction, /meditationWorldTimer[\s\S]*?top: meditationTimerSurfaceTop/);
  assert.doesNotMatch(interaction, /meditationStageSpacer/);
  assert.match(readFileSync('features/onboarding/mossprout-ftue-script.ts', 'utf8'), /const mossproutMeditationCamera[\s\S]*?anchorY: 0\.46[\s\S]*?id: 'companion\.meditating'[\s\S]*?camera: mossproutMeditationCamera/);
  assert.match(meditationStage, /<DayActionCardSurface[\s\S]*?artwork=\{<DayActionIcon icon="moon.fill" \/>\}[\s\S]*?title=\{title \?\? 'Next Journey in'\}/);
  assert.doesNotMatch(meditationStage, /While .* reflects|Small moments grow Bond|messagePanel|OUR NEXT JOURNEY/);
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
  const havenWorld = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
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
  assert.match(merge, /announcement: 'Returning to Mossprout'[\s\S]*?target: 'katchimeras'[\s\S]*?navigate: async \(\) => \{[\s\S]*?ackResidentCardReveal[\s\S]*?Promise\.all\(\[flushMergeWorld\(\), flushFtuePersistence\(\)\]\)[\s\S]*?router\.back\(\)/);
  assert.match(merge, /markResidentMergePresented\(\)/);
  assert.match(merge, /ackResidentCardReveal[\s\S]*?finishResidentMergeSession\(\)[\s\S]*?router\.back\(\)/);
  assert.match(navigationSession, /'idle'[\s\S]*?'handoff'[\s\S]*?'merge_presented'[\s\S]*?'recovery_pending'[\s\S]*?'paused'/);
  assert.match(companion, /residentStoryResumeActive[\s\S]*?initialConversationDefinitionId=\{!residentStoryResumeActive/);
  assert.doesNotMatch(interaction, /A VEILED PARCEL IS WAITING|Return to the exact resident step you left/);
  assert.match(interaction, /residentFtueDashboard = props\.familyId === 'mossprout'[\s\S]*?props\.ftueResidentHandoffActive[\s\S]*?dashboardRouteActive = route\.kind === 'dashboard'[\s\S]*?residentFtueDashboard[\s\S]*?props\.ftueCompanionSurfaceOwned/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?pendingStoryConversationRef\.current = null[\s\S]*?openedStoryConversationRef\.current = null[\s\S]*?showFeastleStoryHome\(\)/);
  assert.match(interaction, /onCompletedExit=\{exitCompletedConversation\}/);
  assert.match(conversationScene, /session\.status === 'completed'[\s\S]*?<ConversationCompletion[\s\S]*?Closest match found[\s\S]*?onContinue=\{onCompletedExit\}/);
  assert.match(interaction, /companionInitialConversationCompletionReady[\s\S]*?if \(props\.ftueResidentMatchResultActive\) return/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?mossprout:game:form-finder[\s\S]*?onInitialConversationComplete/);
  assert.match(companion, /completeResidentResultExit[\s\S]*?authoredTerminalExit[\s\S]*?ownedKatchimeraCards[\s\S]*?resident_discovery[\s\S]*?nextStepId: 'companion\.meditating'/);
  assert.match(companion, /authoredTerminalExit = run\.stepId === 'companion\.resident_match_result'[\s\S]*?if \(!authoredTerminalExit && !residentRecoveryExit\) return false/);
  assert.match(companion, /actionId: 'companion\.ack_resident_match_result'[\s\S]*?nextStepId: 'companion\.meditating'[\s\S]*?flushFtuePersistence\(\)/);
  assert.match(companion, /if \(hostedInHaven && onHostedFtueComplete\) onHostedFtueComplete\(\);[\s\S]*?else router\.dismissTo/);
  assert.match(havenWorld, /onHostedFtueComplete=\{closeResidentInteraction\}/);
  assert.match(interaction, /completedInitialConversationRef = useRef[\s\S]*?completedConversationExitRef = useRef/);
  assert.match(interaction, /exitCompletedConversation[\s\S]*?completedConversationExitRef\.current === completedConversationSessionId/);
  assert.doesNotMatch(conversationScene, /Returning to \$\{name\}/);
  assert.match(conversationFlow, /session\.status === 'completed'[\s\S]*?if \(directResidentParcelHandoff\) return;[\s\S]*?onComplete/);
  assert.match(interaction, /\(route\.kind === 'visit' \|\| route\.kind === 'conversation'\) && !residentFtueDashboard/);
  assert.match(interaction, /if \(!props\.active \|\| \(!residentFtueDashboard && !residentResultFtueDashboard\)\) return;[\s\S]*?showFeastleStoryHome\(\)/);
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
  assert.match(interaction, /showSpeechBubble=\{!initialConversationHandoffPending && \(Boolean\(companionSpeechTitle\) \|\| !residentParcelGardenPanelActive\)\}/);
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
  assert.match(overlay, /spotlightReady = Boolean\(spotlight && currentLayout\?\.spotlightFrames.length\)/);
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

test('Haven keeps one world-map compositor through the Egg to Companion handoff', () => {
  const tabLayout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const havenRoute = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');
  const todayRoute = readFileSync('app/(tabs)/today.tsx', 'utf8');
  const mossproutOpening = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  const kingdomCanvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const kingdomCamera = readFileSync('components/katchadeck/world/use-kingdom-hex-camera.ts', 'utf8');
  const kingdomScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const companionStage = readFileSync('components/katchadeck/world/companion-cinematic-stage.tsx', 'utf8');
  const sheet = readFileSync('components/katchadeck/ui/katcha-sheet.tsx', 'utf8');
  const devTools = readFileSync('app/(tabs)/explore.tsx', 'utf8');
  const interaction = readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const kingdomCompanionScreen = readFileSync('components/katchadeck/world/kingdom-companion-screen.tsx', 'utf8');
  const pageHeader = readFileSync('components/katchadeck/world/katchimera-page-header.tsx', 'utf8');
  const policy = readFileSync('features/onboarding/ftue-navigation-policy.ts', 'utf8');
  assert.match(policy, /'egg\.opening'/);
  assert.match(policy, /'world\.egg_intro'/);
  assert.doesNotMatch(policy, /'grove\.egg_inspect'/);
  assert.match(tabLayout, /tabBar=\{\(\) => null\}/);
  assert.doesNotMatch(tabLayout, /MeadowTabBar|DayCaptureSession|ftueHidesBottomBar/);
  assert.match(havenRoute, /<MossproutEggFtueSurface/);
  assert.match(havenRoute, /worldInteractionActive = eggPresentationActive \|\| havenHostedCompanionActive/);
  assert.match(havenRoute, /havenHostedCompanionActive = mossproutFtueUsesHostedCompanionStage\(ftueStep\?\.id\)/);
  assert.match(kingdomScreen, /if \(mossproutFtueUsesHostedCompanionStage\(ftueStep\?\.id\)\)[\s\S]*?onInteractionRequestConsumed\?\.\(\)/);
  assert.equal(mossproutFtueUsesHostedCompanionStage('companion.first_meeting'), true);
  assert.equal(mossproutFtueUsesHostedCompanionStage('companion.chapter_zero_return'), true);
  assert.equal(mossproutFtueUsesHostedCompanionStage('world.garden_arrival'), false);
  assert.match(havenRoute, /ftueStep\?\.id === 'companion\.chapter_zero_return'[\s\S]*?MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID/);
  assert.doesNotMatch(havenRoute, /FadeIn|FadeOut|cinematicLayer/);
  assert.match(havenRoute, /worldHosted/);
  assert.match(havenRoute, /<MossproutOpeningSurface/);
  assert.doesNotMatch(havenRoute, /HavenEggFtueSurface|from '\.\/today'/);
  assert.match(havenRoute, /reuseUnderlyingStage/);
  assert.doesNotMatch(havenRoute, /renderRegularStage/);
  assert.match(interaction, /background=\{props\.reuseUnderlyingStage \? undefined : props\.questionnaireBackground\}/);
  assert.match(interaction, /entranceMotion=\{props\.reuseUnderlyingStage \? 'fade' : 'sheet'\}/);
  assert.match(interaction, /stagePresentation=\{props\.reuseUnderlyingStage && !props\.renderRegularStage \? 'speech-only' : 'full'\}/);
  assert.match(kingdomCompanionScreen, /pageHeaderChromeMode = reuseUnderlyingStage \? 'hosted' : 'standard'/);
  assert.match(kingdomCompanionScreen, /<KatchimeraPageHeaderChromeProvider mode=\{pageHeaderChromeMode\}>/);
  assert.match(pageHeader, /chromeMode === 'hidden'[\s\S]*?chromeMode === 'hosted' && !bondProgress/);
  assert.match(pageHeader, /chromeMode === 'standard' \? <View style=\{styles\.backSlot\}/);
  assert.match(pageHeader, /chromeMode === 'standard' \? <View style=\{styles\.currencySlot\}/);
  assert.match(sheet, /entranceMotion === 'fade'[\s\S]*?FadeIn\.duration\(220\)/);
  assert.match(companionStage, /entering=\{reduceMotion \? undefined : ZoomIn\.duration\(190\)/);
  assert.match(mossproutOpening, /<CompanionHomeEnvironmentStage/);
  assert.match(mossproutOpening, /backgroundKey=\{null\}[\s\S]*?layer="creature"/);
  assert.match(mossproutOpening, /environmentContent=\{worldHosted \? <View \/> : undefined\}/);
  assert.match(mossproutOpening, /transparentBackground=\{worldHosted\}/);
  assert.match(mossproutOpening, /actions=\{\[\]\}/);
  assert.match(mossproutOpening, /handleDiscoveryReveal\(FTUE_MOSSPROUT_CREATURE\)/);
  assert.match(mossproutOpening, /companionStageActive/);
  assert.match(mossproutOpening, /onboardingFocus\s/);
  assert.match(mossproutOpening, /sceneOnly=\{companionStageActive\}/);
  assert.match(mossproutOpening, /subjectHandoffProgress=\{subjectHandoff\}/);
  assert.match(mossproutOpening, /useEggFeedController\(worldHosted \? worldEggTargetRef : undefined\)/);
  assert.match(mossproutOpening, /subjectHidden=\{worldHosted \|\| subjectHandoffSettled\}/);
  assert.match(mossproutOpening, /onWorldSubjectPresentationChange\?\.\(worldSubjectPresentation\)/);
  assert.match(havenRoute, /worldEggTargetRef=\{worldEggTargetRef\}/);
  assert.match(havenRoute, /worldSubjectPresentation=\{worldSubjectPresentation\}/);
  assert.match(kingdomCanvas, /<RevealedCompanionEgg[\s\S]*?presentation=\{worldSubjectPresentation\}[\s\S]*?targetRef=\{worldEggTargetRef\}/);
  assert.equal(MOSSPROUT_WORLD_EGG_ENTRY_ZOOM, 1.35);
  assert.match(kingdomScreen, /initialFtueCameraScale = ftueStepId === 'world\.egg_intro'[\s\S]*?tutorialCamera\.target\.kind === 'haven_resident'[\s\S]*?tutorialCamera\.zoom \?\? MOSSPROUT_WORLD_EGG_REST_ZOOM/);
  assert.match(kingdomScreen, /initialTutorialCameraScale=\{initialFtueCameraScale\}/);
  assert.match(kingdomCanvas, /initialTutorialFocus = useMemo[\s\S]*?sharedResidentCenterY\(residentAnchor\.y, eggGrowthScale\)[\s\S]*?initialFocus: initialTutorialFocus/);
  assert.match(kingdomCanvas, /durationMs: tutorialCamera\.durationMs[\s\S]*?initialScale: initialTutorialCameraScale[\s\S]*?scale: tutorialCamera\.zoom \?\? initialTutorialCameraScale/);
  assert.match(kingdomCanvas, /target\.kind !== 'haven_tile' && target\.kind !== 'haven_resident'/);
  assert.match(kingdomCanvas, /target\.kind === 'haven_resident'[\s\S]*?mossproutDialogueSubjectCenterY\(residentAnchor\.y\)/);
  assert.match(kingdomCanvas, /appliedTutorialCameraRef = useRef\(initialTutorialFocus \? tutorialCameraKey : 'none'\)/);
  assert.doesNotMatch(kingdomCanvas, /cameraRestoreNonce|cameraRestoreArmedRef/);
  assert.match(kingdomCanvas, /applicationKey = tutorialCameraKey/);
  assert.match(kingdomCamera, /if \(!resumeNeededRef.current\) return[\s\S]*?completeCameraMove\(move.id\)/);
  assert.match(kingdomCanvas, /durationMs = tutorialCamera\.durationMs/);
  assert.match(kingdomCamera, /initialFocus[\s\S]*?kingdomCameraSnapshotForTarget\([\s\S]*?initialFocus\.x, y: initialFocus\.y[\s\S]*?y: initialFocus\.screenY/);
  assert.match(kingdomCamera, /startsWithMotion[\s\S]*?commitSnapshot\(home\.tx, home\.ty, home\.scale, startsWithMotion\)[\s\S]*?animateTo\([\s\S]*?initialFocus\.scale[\s\S]*?initialFocus\.durationMs/);
  assert.match(kingdomScreen, /'world\.egg_intro': 4_100/);
  assert.doesNotMatch(kingdomScreen, /'grove\.egg_inspect': 1_650/);
  assert.match(mossproutOpening, /scriptedActions = stepId === 'world\.egg_intro'[\s\S]*?\? \[\][\s\S]*?: step\?\.actions\.filter/);
  assert.match(mossproutOpening, /companionStageActive \|\| \(worldHosted && stepId === 'world\.egg_intro'\)[\s\S]*?\? null/);
  assert.match(kingdomScreen, /ftueEggFeedingCloseupActive = ftueStepId === 'world\.egg_intro'[\s\S]*?Boolean\(ftueStepId\?\.startsWith\('egg\.'\)\)/);
  assert.match(kingdomScreen, /gardenWorldGuidanceActive[\s\S]*?top: insets\.top \+ 18/);
  assert.match(kingdomScreen, /gardenWorldBottomCtaActive = \(ftueStepId === 'world\.seed_planted' && firstSeedPlacementFailed\)[\s\S]*?ftueStepId === 'world\.first_seed_grew'/);
  assert.doesNotMatch(kingdomScreen, /gardenWorldBottomCtaActive = ftueStepId === 'world\.garden_arrival'/);
  assert.match(kingdomScreen, /ftueStepId === 'world\.seed_planted' && !firstSeedPlanted[\s\S]*?onFtueInspectRef\.current\?\.\(\)/);
  assert.equal(mossproutFtueStep('world.seed_planted')?.autoAdvanceMs, undefined);
  assert.doesNotMatch(kingdomScreen, /\? 'Plant Seed'[\s\S]*?: ftueStep\.actions/);
  assert.match(kingdomScreen, /gardenWorldBottomCtaActive[\s\S]*?bottom: Math\.max\(insets\.bottom, 12\) \+ 22[\s\S]*?justifyContent: 'space-between'[\s\S]*?top: insets\.top \+ 18/);
  assert.match(kingdomScreen, /function FtueOpeningFade\(\)[\s\S]*?opacity\.value = withDelay\([\s\S]*?duration: reduceMotion \? 140 : 1_350/);
  assert.match(kingdomScreen, /ftueStepId === 'world\.egg_intro' \? <FtueOpeningFade/);
  assert.match(nurture, /<EggHeroGuide guide=\{onboardingGuide\} topInset=\{topInset\} topHudVisible=\{onboardingTopHudVisible\}/);
  assert.match(readFileSync('components/katchadeck/onboarding/ftue-guide-copy.tsx', 'utf8'), /top: topInset \+ \(topHudVisible \? 82 : 22\)/);
  assert.match(kingdomScreen, /!upgradePresentation && \(!ftueStepId \|\| ftueStepId === 'companion\.meditating'\)/);
  assert.match(kingdomScreen, /onPress=\{stepplingEncounter.open \? stepplingEncounter.close : interactionCreatureId \? requestResidentInteractionExit : onBackToHavenSelector\}/);
  assert.doesNotMatch(kingdomScreen, /cameraFallbackTimer/);
  assert.match(kingdomScreen, /onResidentFocusComplete=\{completeResidentFocus\}/);
  assert.match(kingdomScreen, /onCameraMotionChange=\{handleCameraMotionChange\}/);
  assert.match(kingdomScreen, /ftueCameraSettled && !upgradePresentation[\s\S]*?<HavenFtueOverlay/);
  assert.match(kingdomCamera, /Camera limits describe valid destinations and gesture bounds/);
  assert.match(kingdomCamera, /previousGeometry\.sceneWidth === nextGeometry\.sceneWidth[\s\S]*?return;/);
  assert.match(kingdomCamera, /const animateToSnapshot = useCallback[\s\S]*?clampCameraTranslation\(snapshot, cameraViewport, cameraScene, nextScale\)[\s\S]*?withTiming\(nextScale, timing/);
  assert.match(kingdomCanvas, /interactionOriginSnapshotRef\.current \?\?= readLiveCameraSnapshot\(\)[\s\S]*?if \(origin\) \{[\s\S]*?animateToCameraSnapshot\(origin, durationMs, onComplete\)[\s\S]*?focusInteractionTile\(frame,/);
  assert.match(kingdomCanvas, /const durationMs = tutorialCamera\.durationMs/);
  assert.doesNotMatch(kingdomCanvas, /cameraRestoreNonce > 0 \? 0 : tutorialCamera\.durationMs/);
  assert.match(kingdomCamera, /Camera limits describe valid destinations and gesture bounds[\s\S]*?previousGeometry\.viewportHeight === nextGeometry\.viewportHeight[\s\S]*?return;/);
  assert.doesNotMatch(kingdomCamera, /previousGeometry\.maximumScale === nextGeometry\.maximumScale/);
  assert.match(kingdomCamera, /const getSnapshot = useCallback[\s\S]*?scale: scale\.value[\s\S]*?tx: tx\.value[\s\S]*?ty: ty\.value/);
  assert.match(kingdomCanvas, /REGULAR_RESIDENT_INTERACTION_SCREEN_ANCHOR_Y = SHARED_RESIDENT_SCREEN_ANCHOR_Y/);
  assert.match(kingdomCanvas, /residentInteractionScreenAnchorY = interactionResidentAnchorY \?\? \(tutorialCamera\?\.kind === 'focus_target'[\s\S]*?tutorialCamera\.anchorY \?\? MOSSPROUT_DIALOGUE_SCREEN_ANCHOR_Y[\s\S]*?: REGULAR_RESIDENT_INTERACTION_SCREEN_ANCHOR_Y\)/);
  assert.match(kingdomCanvas, /initialInteractionFocus = useMemo[\s\S]*?residentCreatureFrame\(residentAnchor\.x, residentAnchor\.y, creatureWorldSize, isMossprout\)[\s\S]*?screenY: viewport\.height \* residentInteractionScreenAnchorY[\s\S]*?initialTutorialFocus \?\? initialInteractionFocus/);
  assert.match(kingdomCanvas, /handledInteractionExitNonceRef[\s\S]*?layer\?\.interactionFrame[\s\S]*?focusInteractionTile\(frame,/);
  assert.match(kingdomCanvas, /allowDownscaling=\{false\}[\s\S]*?resolution="high"[\s\S]*?showFace/);
  assert.match(kingdomCanvas, /faceId=\{\(presentation\?\.growthStage \?\? 0\) > 0 \? 'curious' : 'sleepy'\}/);
  assert.match(kingdomCanvas, /WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE = 2\.7/);
  assert.match(kingdomCanvas, /growthProgress = fullSize \? 1 : presentation\?\.growthProgress \?\? 0/);
  assert.match(kingdomCanvas, /eggVisualGrowthForEnergyRatio\(growthProgress\)/);
  assert.match(kingdomCanvas, /hatchShake\.value \* 7/);
  assert.match(kingdomCanvas, /rotateZ: `\$\{shake \* 2\.8\}deg`/);
  assert.match(kingdomCanvas, /<WorldEggRadiance[\s\S]*?<WorldEggRippleField/);
  assert.match(mossproutOpening, /readyToHatch: growth\.isReady && !isHatching/);
  assert.match(kingdomCanvas, /showReadyEffects \? <>[\s\S]*?<RotatingRadialSunburst[\s\S]*?<WorldEggRippleField primary=\{readyRipple\}/);
  assert.match(kingdomCanvas, /Preserve the original 3\.06-second readiness reminder[\s\S]*?readyShake\.value = withRepeat[\s\S]*?readyRipple\.value = withRepeat/);
  assert.match(kingdomCanvas, /feedbackShake\.value \+ readyShake\.value \+ hatchShake\.value \* 2/);
  assert.match(kingdomCanvas, /triggerFeedArrivalFeedback[\s\S]*?runRewardArrivalMotion\(feedbackPulse, feedbackShake, reduceMotion\)[\s\S]*?radianceFlare\.value = withSequence[\s\S]*?rippleEcho\.value = withDelay/);
  assert.match(kingdomCanvas, /cameraScale=\{camera\.scaleValue\}/);
  assert.match(kingdomCanvas, /cameraTranslateX=\{camera\.translationXValue\}[\s\S]*?cameraTranslateY=\{camera\.translationYValue\}/);
  assert.match(kingdomCanvas, /worldFtueProjectedSubject[\s\S]*?projectionStyle/);
  assert.doesNotMatch(kingdomCanvas, /<TileFocusTransform[\s\S]{0,260}<RevealedCompanionEgg/);
  assert.match(kingdomCanvas, /subjectCenterY = residentAnchor[\s\S]*?sharedResidentCenterY\(residentAnchor\.y, eggGrowthScale\)/);
  assert.match(kingdomCanvas, /<CreatureAnimatedArt[\s\S]*?visualKey=\{presentation\?\.hatchFamilyId \?\? 'mossprout'\}/);
  assert.match(kingdomCanvas, /stableWorldPresentation = usesSharedResidentStage\(tile\.companion\.familyId\)[\s\S]*?animated=\{stableWorldPresentation \|\| interactionResidentId/);
  assert.match(kingdomCanvas, /const width = stableWorldPresentation \? WORLD_FTUE_EGG_WIDTH : worldSize[\s\S]*?const height = stableWorldPresentation \? WORLD_FTUE_EGG_HEIGHT : worldSize/);
  assert.match(kingdomCanvas, /top: stableWorldPresentation[\s\S]*?y - MOSSPROUT_WORLD_BASELINE_LIFT - height/);
  assert.match(kingdomCanvas, /focusedInteractionResidentRef[\s\S]*?residentCreatureFrame\(residentAnchor\.x, residentAnchor\.y, creatureWorldSize, isMossprout\)[\s\S]*?anchorY: residentInteractionScreenAnchorY/);
  assert.match(kingdomCanvas, /WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE = 2\.7/);
  assert.match(kingdomCanvas, /function GardenOrderShortcut[\s\S]*?gardenOrderRequestBubble[\s\S]*?<PersistentMergeItemArt/);
  assert.doesNotMatch(kingdomCanvas, /We’ll build this order/);
  assert.match(kingdomCanvas, /tile\.companion\.creature\.creatureId === interactionResidentId\) continue/);
  assert.match(kingdomCanvas, /if \(onSelectResident\) \{[\s\S]*?onSelectResident\(creature\.creatureId, creature\.name\);[\s\S]*?return;[\s\S]*?onFocus\(x, y, \{ id: tile\.id \}\)/);
  assert.match(kingdomCanvas, /<ProjectedResidentCreature[\s\S]*?cameraScale=\{camera\.scaleValue\}[\s\S]*?rewardPulseKey=\{interactionRewardPulseKey\}/);
  assert.match(kingdomCanvas, /<ProjectedResidentCreature[\s\S]*?cameraMoving=\{camera\.isMoving\}/);
  assert.match(kingdomCanvas, /ProjectedResidentCreature[\s\S]*?runRewardArrivalMotion\(rewardPulse, rewardShake, reduceMotion\)[\s\S]*?rewardShake\.value \* 5\.5[\s\S]*?rewardPulse\.value \* 0\.055/);
  assert.match(kingdomCanvas, /renderToHardwareTextureAndroid=\{false\}[\s\S]*?shouldRasterizeIOS=\{false\}[\s\S]*?worldInteractionCreatureNativeSurface/);
  assert.match(kingdomCanvas, /allowDownscaling=\{false\}[\s\S]*?fallbackSource=\{source \?\? resolveCreatureArtSource\(creature\.visualKey\)\}/);
  assert.match(kingdomCanvas, /fallbackSource=\{source \?\? resolveCreatureArtSource\(creature\.visualKey\)\}[\s\S]*?forceStatic=\{cameraMoving\}/);
  assert.match(kingdomCanvas, /styles\.worldFtueCreatureFrame[\s\S]*?creatureStyle/);
  assert.match(kingdomCanvas, /worldFtueCreatureFrame: \{[\s\S]*?transformOrigin: 'center bottom'/);
  assert.match(kingdomCanvas, /presentation\?\.hatchPresentation \? <>[\s\S]*?worldFtueHatchRing[\s\S]*?worldFtueHatchRing[\s\S]*?<\/>(?:\s*): null/);
  assert.match(kingdomCanvas, /styles\.worldFtueCreatureFrame[\s\S]*?presentation\?\.hatchPresentation \? <>[\s\S]*?<RotatingRadialSunburst[\s\S]*?WORLD_FTUE_SOFT_GLOW[\s\S]*?worldFtueHatchGlow/);
  assert.match(kingdomCanvas, /WORLD_FTUE_REWARD_GLOW_SIZE = WORLD_FTUE_EGG_WIDTH \* 0\.84/);
  assert.match(kingdomCanvas, /WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE = 2\.7[\s\S]*?creatureNativeSurfaceStyle[\s\S]*?WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE/);
  assert.match(kingdomCanvas, /renderToHardwareTextureAndroid=\{false\}[\s\S]*?shouldRasterizeIOS=\{false\}[\s\S]*?styles\.worldFtueCreatureNativeSurface/);
  assert.match(kingdomCanvas, /WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE = 2[\s\S]*?hatchPulseRingSize/);
  assert.match(kingdomCanvas, /worldFtueRewardGlow[\s\S]*?borderWidth: 2 \* WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE[\s\S]*?creatureRewardGlowSize/);
  assert.match(kingdomCanvas, /accessibilityLabel=\{`\$\{presentation\?\.hatchFamilyId === 'steppling' \? 'Steppling' : 'Mossprout'\} animated`\}[\s\S]*?allowDownscaling=\{false\}/);
  assert.match(mossproutOpening, /handleFtueEnergyTokenArrive[\s\S]*?index === count - 1[\s\S]*?pulseEgg\(\)/);
  assert.match(mossproutOpening, /onEnergyTokenArrive=\{handleFtueEnergyTokenArrive\}/);
  assert.match(mossproutOpening, /companionStageActive && subjectHandoffSettled[\s\S]*?<CompanionHomeEnvironmentStage/);
  assert.match(mossproutOpening, /styles\.regularSubject[\s\S]*?translateY: -regularSubjectLift \+ subjectHandoffLayout\.interactionCreatureDrop/);
  assert.match(mossproutOpening, /subjectHandoffFades=\{false\}/);
  assert.match(mossproutOpening, /withTiming\(1,[\s\S]*?if \(finished\) runOnJS\(completeSubjectHandoff\)\(\)/);
  assert.doesNotMatch(mossproutOpening, /settleTimer|setTimeout\(\(\) => setSubjectHandoffSettled/);
  assert.doesNotMatch(mossproutOpening, /regularSubjectReady|SUBJECT_READY_FALLBACK_MS|handleRegularSubjectReady/);
  assert.match(mossproutOpening, /regularSubjectLift = companionDestinationStageLift\(windowHeight, windowWidth\)/);
  assert.match(mossproutOpening, /subjectHandoffScale=\{subjectHandoffLayout\.outgoingEndScale\}[\s\S]*?subjectHandoffTranslateY=\{subjectHandoffLayout\.outgoingEndTranslateY\}/);
  assert.match(havenRoute, /onCompanionVisualReady=\{handleCompanionVisualReady\}[\s\S]*?companionActive && companionVisualReady/);
  assert.match(havenRoute, /handleCreatureRewardPulse[\s\S]*?rewardPulseKey=\{rewardPulseKey\}[\s\S]*?onVisibleCreatureRewardPulse=\{handleCreatureRewardPulse\}/);
  assert.match(interaction, /onTokenArrive=\{\(amount\) => \{[\s\S]*?setRewardPulseKey[\s\S]*?props\.onVisibleCreatureRewardPulse\?\.\(\)/);
  assert.match(mossproutOpening, /layer="creature"[\s\S]*?rewardPulseKey=\{rewardPulseKey\}/);
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
  assert.deepEqual(activeFtueNavigationPolicy({ status: 'active', stepId: 'world.egg_intro' })?.resume, { kind: 'haven' });
  assert.equal(activeFtueNavigationPolicy({ status: 'active', stepId: 'grove.egg_inspect' }), null);
  assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId: 'grove.egg_inspect' }), false);
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
  const contentFlow = readFileSync('features/content-flow/content-flow-bootstrap.ts', 'utf8');
  assert.match(merge, /ftueActive = ftueRun\?\.status === 'active'/);
  assert.match(merge, /leading=\{<KatchimeraBackButton[\s\S]*?disabled=\{ftueActive && !handoffActive\}/);
  assert.match(merge, /trailing=\{<View collapsable=\{false\} ref=\{coinHudPillRef\}>[\s\S]*?<MergeCoinHud[\s\S]*?hudRef=\{coinHudRef\}/);
  assert.match(merge, /<GameCurrencyHud[\s\S]*?targetRef: hudRef/);
  assert.match(merge, /measureViewInWindow\(coinArtRef\)[\s\S]*?!coinRect[\s\S]*?return false/);
  assert.match(merge, /ftueRun\.stepId !== 'companion\.chapter_zero_return'[\s\S]*?target: 'companion'[\s\S]*?ftue: 'chapter-zero-return'/);
  assert.match(companion, /actionId: 'companion\.complete_chapter_zero_return'[\s\S]*?nextStepId: 'companion\.water_together'/);
  assert.match(companion, /run\.stepId === 'companion\.nickname'[\s\S]*?saveMossproutPlayerNickname[\s\S]*?kind: 'friendship_started'[\s\S]*?actionId: 'companion\.save_nickname'/);
  assert.match(companion, /kind: 'friendship_started'[\s\S]*?queueCelebration: true/);
  assert.match(companion, /MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress/);
  assert.match(companion, /companion\.choose_support_style[\s\S]*?kind: 'check_in_completed'[\s\S]*?points/);
  assert.match(contentFlow, /relationship\.first_bloom_bond[\s\S]*?MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - companionBondProgress/);
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
  assert.match(companion, /completeResidentResultExit[\s\S]*?await seedStoredMossproutGardenAfterFtue[\s\S]*?nextStepId: 'companion\.meditating'/);
  assert.match(companion, /ftueRun\?\.status !== 'complete'[\s\S]*?postFtueGardenRepairRef[\s\S]*?seedStoredMossproutGardenAfterFtue/);
  assert.match(companion, /const ftueResidentHandoffActive = Boolean\([\s\S]*?navigationFtueRun\.stepId !== 'companion\.resident_match_result'[\s\S]*?residentParcelReady/);
  assert.doesNotMatch(companion, /repair:mossprout-day-one-bond-action|repair:mossprout-bond-spotlight|repair:mossprout-resident-affinity/);
  assert.match(ftueRuntime, /input\.actionId === 'companion\.complete_day_one_action'[\s\S]*?completeDayOneLesson/);
  assert.doesNotMatch(companion, /complete_resident_affinity'[\s\S]{0,500}?router\.push/);
  assert.match(companion, /stepId !== 'companion\.bond_spotlight'[\s\S]*?actionId: 'companion\.acknowledge_bond'/);
  assert.match(companion, /actionId: 'companion\.complete_chapter_zero_return'[\s\S]*?nextStepId: 'companion\.water_together'[\s\S]*?await flushFtuePersistence\(\)/);
  assert.doesNotMatch(companion, /Showing the First Bloom/);
  assert.doesNotMatch(companion, /revealStoredHaven/);
  assert.match(interaction, /Promise\.resolve\(onInitialConversationComplete\?\.\(\)\)[\s\S]*?\.then\(showFeastleStoryHome\)/);
  assert.match(interaction, /CompanionFtueCoachmark[\s\S]*?ftueBondSpotlightActive[\s\S]*?ftueDayOneActionActive/);
  assert.doesNotMatch(companion, /companion\.complete_chapter_zero_return[\s\S]{0,800}?router\.dismissTo/);
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
  assert.match(transition, /commitPhase\('covered'\)[\s\S]*?current\.onCovered\?\.\(\)[\s\S]*?current\.navigate\(\)[\s\S]*?commitPhase\('waiting_ready'\)/);
  assert.match(companion, /const sourceCovered = new Promise<void>[\s\S]*?onCovered: \(\) => releaseSource\?\.\(\)[\s\S]*?navigate: async \(\) => \{[\s\S]*?await sourceCovered/);
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
  const camera = readFileSync('components/katchadeck/world/use-kingdom-hex-camera.ts', 'utf8');
  const openingScale = mossproutGroveEggCameraPinchTarget('egg.opening', 2)!;
  const contextScale = mossproutGroveEggCameraPinchTarget('egg.context', 2)!;
  const mindScale = mossproutGroveEggCameraPinchTarget('egg.mind', 2)!;
  const readyScale = mossproutGroveEggCameraPinchTarget('egg.ready', 2)!;
  const ratios = [openingScale / contextScale, contextScale / mindScale, mindScale / readyScale];

  assert.ok(ratios.every((ratio) => Math.abs(ratio - ratios[0]!) < 1e-9));
  assert.equal(mossproutGroveEggCameraPinchTarget('grove.egg_inspect', 2), null);
  assert.equal(readyScale, 1);
  assert.equal(mossproutGroveEggCameraPinchTarget('companion.first_meeting', 2), null);
  const worldZooms = ['egg.opening', 'egg.context', 'egg.mind', 'egg.ready'].map((stepId) => {
    const directive = MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === stepId)?.camera;
    return directive?.kind === 'focus_target' ? directive.zoom ?? 0 : 0;
  });
  assert.ok(worldZooms.every((zoom, index) => index === 0 || zoom < worldZooms[index - 1]!));
  assert.equal(worldZooms[0], MOSSPROUT_WORLD_EGG_CLOSE_ZOOM);
  assert.equal(worldZooms.at(-1), MOSSPROUT_WORLD_EGG_REST_ZOOM);
  const worldRatios = [worldZooms[0]! / worldZooms[1]!, worldZooms[1]! / worldZooms[2]!, worldZooms[2]! / worldZooms[3]!];
  assert.ok(worldRatios.every((ratio) => Math.abs(ratio - worldRatios[0]!) < 1e-9));
  assert.equal(mossproutWorldEggZoom('egg.ready'), MOSSPROUT_WORLD_EGG_REST_ZOOM);
  assert.match(camera, /options\?\.zoom == null[\s\S]*?Math\.min\(maxScale, Math\.max\(minScale, options\.zoom\)\)/);
  assert.doesNotMatch(camera, /Math\.max\(scale\.value, options\?\.zoom/);
  assert.equal(mossproutGroveEggCameraPanTarget('egg.opening'), FTUE_OPENING_CAMERA_PAN_Y);
  assert.equal(mossproutGroveEggCameraPanTarget('egg.context'), FTUE_OPENING_CAMERA_PAN_Y * (2 / 3));
  assert.equal(mossproutGroveEggCameraPanTarget('egg.mind'), FTUE_OPENING_CAMERA_PAN_Y * (1 / 3));
  assert.equal(mossproutGroveEggCameraPanTarget('egg.ready'), 0);
  assert.match(grove, /useTodayEnvironmentMotion\(\{/);
  assert.match(grove, /scriptedPinchScale: groveCameraScale/);
  assert.match(grove, /<TodayEnvironmentMotionProvider motion=\{environmentMotion\}>/);
  assert.match(grove, /onboardingCameraPanY=\{mossproutGroveEggCameraPanTarget\(stepId\)\}/);
});

test('the Grove Egg grows from a larger start across both meaningful feeds', () => {
  const grove = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  const sizes = [0, 1, 2].map((answeredCount) => (
    eggScaleForEnergyRatio(mossproutGroveEggEnergyRatio(answeredCount))
  ));

  const expectedSizes = [0.6, 0.8, 1];
  assert.ok(sizes.every((size, index) => Math.abs(size - expectedSizes[index]!) < 1e-12));
  assert.equal(mossproutGroveEggEnergyRatio(-1), 0.1);
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
  assert.match(actions, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?label=\{action\.title\}[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
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
  assert.match(home, /const visibleOptions = options\.slice\(0, 4\)/);
  assert.match(home, /ftueQuestionLayout && styles\.ftueQuestionAnchor/);
  assert.match(home, /illustrated && !ftueQuestionLayout/);
  assert.match(home, /showGlint=\{!ftueQuestionLayout\}/);
  assert.match(home, /style=\{ftueQuestionLayout \? styles\.ftueQuestionReward : styles\.inlineReward\}/);
  assert.match(home, /setIllustratedGridWidth\(\(current\) => current === measuredWidth \? current : measuredWidth\)/);
  assert.match(home, /setScriptedTextCompletion/);
  assert.match(home, /key=\{scriptedTextChoiceAction\.id\}/);
  assert.match(home, /scriptedRowActions = scriptedActions\.filter\(\(action\) => action\.presentation !== 'inline_choice' && action\.presentation !== 'route_action'\)/);
  assert.match(home, /fullRowIllustratedChoices=\{action\.id\.startsWith\('egg\.'\)\}/);
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
  assert.match(home, /import \{ EggHeroGuide, FtueGuideCopy \} from '@\/components\/katchadeck\/onboarding\/ftue-guide-copy'/);
  assert.match(guide, /KatchaDeckUI\.typography\.ftueHeroTitle/);
  assert.match(home, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  assert.match(actions, /KatchaDeckUI\.typography\.ftuePanelTitle/);
  assert.doesNotMatch(conversation, /prompt: `Mossprout remembers your answers/);
  assert.match(conversation, /prompt: `\$\{opening\}[\s\S]*?I’m Mossprout/);
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
