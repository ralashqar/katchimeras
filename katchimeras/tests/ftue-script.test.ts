import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FTUE_ACTION_CATALOG, FTUE_HANDLER_REGISTRY } from '@/features/onboarding/ftue-action-registry';
import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, validateMossproutFtueScript } from '@/features/onboarding/mossprout-ftue-script';

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
  const migration = readFileSync('supabase/migrations/20260813215553_register_mossprout_ftue_v5.sql', 'utf8');
  for (const item of FTUE_ACTION_CATALOG.filter((entry) => entry.backendEvent)) {
    assert.match(migration, new RegExp(`'${item.stepId}',\\s*'${item.actionId}'`));
  }
  assert.doesNotMatch(migration, /option_id|option_label|answer_text/);
});

test('Chapter 0 exposes one one-merge order and then completes', () => {
  assert.equal(mossproutFtueAction('merge.first', 'merge.serve_sprout')?.nextStepId, 'chapter.complete');
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.some((step) => step.id === 'merge.flower'), false);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.steps.some((step) => step.id === 'merge.final'), false);
});

test('an active FTUE keeps the bottom bar and profile-preserving reset reachable', () => {
  const tabLayout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  const devTools = readFileSync('app/(tabs)/explore.tsx', 'utf8');
  assert.match(tabLayout, /tabBar=\{\(props\) => <MeadowTabBar \{\.\.\.props\} \/>\}/);
  assert.doesNotMatch(tabLayout, /ftueLocked\s*\?\s*null/);
  assert.match(devTools, /Restart first-session onboarding · keep profile/);
  assert.match(devTools, /beginFirstSession\(\{ restart: true \}\)/);
});

test('scripted Egg faces use the stable image transition instead of animated-style cleanup', () => {
  const artwork = readFileSync('components/katchadeck/egg-avatar/egg-avatar-artwork.tsx', 'utf8');
  assert.match(artwork, /transition=\{faceTransitionDuration\}/);
  assert.doesNotMatch(artwork, /useAnimatedStyle|useSharedValue/);
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

test('the first FTUE feeling beat uses the real Home mood action', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const route = readFileSync('app/(tabs)/today.tsx', 'utf8');
  assert.match(home, /scriptedMoodAction && scriptedPanelCareAction/);
  assert.match(home, /<InlineMood/);
  assert.match(home, /candidate\.domainChoiceId === selection\.id/);
  assert.match(route, /scriptedPanelCareAction=\{ftuePanelCareAction\}/);
});

test('later FTUE choice beats specialize the same inline check-in panel lifecycle', () => {
  const home = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  assert.match(home, /function InlineScriptedChoice/);
  assert.match(home, /<InlineCheckInPanel[\s\S]*?textChoices/);
  assert.match(home, /textChoices \? styles\.textChoiceGrid/);
  assert.match(home, /setScriptedTextCompletion/);
  assert.match(home, /key=\{scriptedTextChoiceAction\.id\}/);
  assert.match(home, /scriptedRowActions = scriptedActions\.filter\(\(action\) => action\.presentation !== 'inline_choice'\)/);
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
  assert.match(home, /textChoice:[^\n]*minHeight: 34[^\n]*paddingVertical: 5/);
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
  assert.match(egg, /expressionSequence=\{discoveryHatch/);
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
