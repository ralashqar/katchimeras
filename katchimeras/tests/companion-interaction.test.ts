import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { HomeDayRecord } from '@/types/home';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import {
  buildCompanionQuestViewModel,
  companionQuestBackAction,
  companionQuestInlineNoteAction,
  companionQuestInlinePhotoAction,
  companionQuestPresentation,
  companionInteractionReducer,
  companionRouteBackAction,
  companionQuestSkipsPreview,
  companionQuestUsesFullBleed,
  companionViewportResetKey,
  createCompanionInteractionState,
  insightForArchetype,
} from '@/utils/companion-interaction';
import { prepareCompanionReflection } from '@/utils/companion-reflection';
import { commandToJournalRecord, submissionToJournalCommand } from '@/utils/journal-domain';
import { questCaptureBelongsTo } from '@/utils/quest-capture-session';
import { evidenceProvider, isLateNightHour, withCaptureTimeSignals } from '@/utils/signals/providers/evidence';

test('Today and companion goals share deliberate task-row interactions', () => {
  const row = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'goal-task-row.tsx'),
    'utf8',
  );
  const todayGoals = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'today-goals-experience.tsx'),
    'utf8',
  );
  const companionGoals = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'companion-quick-goals.tsx'),
    'utf8',
  );
  const todayScreen = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );
  const goalModal = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'quick-goal-action-modal.tsx'),
    'utf8',
  );
  const quickGoalHook = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-companion-quick-goals.ts'),
    'utf8',
  );

  assert.match(row, /ReanimatedSwipeable/);
  assert.match(row, /renderLeftActions/);
  assert.match(row, /onPress=\{handleComplete\}/);
  assert.match(row, /height: 48/);
  assert.match(row, /accessibilityActions/);
  assert.match(todayGoals, /<GoalTaskRow/);
  assert.match(todayGoals, /<CompanionBackAction/);
  assert.match(todayGoals, /KatchaDeckUI\.typography\.kingdomDisplay/);
  assert.match(companionGoals, /<GoalTaskRow/);
  assert.match(todayScreen, /<TodayGoalsExperience/);
  assert.match(todayScreen, /initialMode=\{quickGoalSheetMode\}/);
  assert.match(todayScreen, /!quickGoalsOpen/);
  assert.match(todayScreen, /isHatching \|\|[\s\S]*?quickGoalsOpen \|\|[\s\S]*?timelineDay\.kind/);
  assert.match(quickGoalHook, /CompanionQuickGoalCompletionReceipt/);
  assert.match(quickGoalHook, /bondAward: awarded\.awarded/);
  assert.doesNotMatch(goalModal, /Nicely done · \+5 bond/);
});

test('You questionnaires require answer confirmation and task consent', () => {
  const questionnaireScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-questionnaire-scene.tsx'),
    'utf8',
  );
  const cinematicStage = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-cinematic-stage.tsx'),
    'utf8',
  );
  const journey = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-journey-thread.tsx'),
    'utf8',
  );
  const checkIn = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-check-in.tsx'),
    'utf8',
  );
  const reflectionThread = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-reflection-thread.tsx'),
    'utf8',
  );
  const reflectionComposer = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-reflection-composer-modal.tsx'),
    'utf8',
  );
  const zodiac = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'zodiac-tile-sheet.tsx'),
    'utf8',
  );
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );

  assert.match(questionnaireScene, /options\?\.length && selectedId/);
  assert.doesNotMatch(questionnaireScene, /disabled=\{!selectedId\}/);
  assert.match(questionnaireScene, /onPress=\{confirmSelection\}/);
  assert.doesNotMatch(questionnaireScene, /setTimeout/);
  assert.match(questionnaireScene, /<CompanionCinematicStage/);
  assert.match(questionnaireScene, /bubbleVariant="questionnaire"/);
  assert.match(questionnaireScene, /environmentKey=\{environmentKey\}/);
  assert.match(questionnaireScene, /styles\.progressBlock/);
  assert.match(questionnaireScene, /companionQuestionnaireHeroSpacer\(height, speechBubbleHeight\)/);
  assert.match(questionnaireScene, /onSpeechBubbleHeightChange=\{setSpeechBubbleHeight\}/);
  assert.doesNotMatch(questionnaireScene, /styles\.creatureFrame|styles\.bubble,/);
  assert.match(cinematicStage, /speechBubbleQuestionnaire/);
  assert.match(cinematicStage, /minHeight: 146/);
  assert.match(cinematicStage, /questionTitleLong/);
  assert.match(cinematicStage, /onLayout=.*onSpeechBubbleHeightChange/);
  assert.match(cinematicStage, /function TypewriterText/);
  assert.match(cinematicStage, /requestAnimationFrame\(reveal\)/);
  assert.match(cinematicStage, /styles\.typewriterMeasure/);
  assert.match(cinematicStage, /reduceMotion \? characters\.length : 0/);
  assert.doesNotMatch(journey, /autoAddedResultRef/);
  assert.doesNotMatch(checkIn, /autoAddedCheckInRef/);
  assert.match(journey, /onDismissTasks/);
  assert.match(journey, /Add \$\{suggestedTasks\.length\} to Today/);
  assert.match(checkIn, /effectiveTaskStatus === 'pending'/);
  assert.match(checkIn, /<CompanionReflectionThread\s+autoOpen/);
  assert.match(checkIn, /onSaveNote\(checkIn, nextDraft\)/);
  assert.doesNotMatch(checkIn, /label="Save detail"/);
  assert.match(reflectionThread, /Type it or use your voice/);
  assert.match(reflectionThread, /<CompanionReflectionComposerModal/);
  assert.match(reflectionComposer, /<Modal/);
  assert.match(reflectionComposer, /useJournalVoiceDraft/);
  assert.match(reflectionComposer, /Tap the microphone to record/);
  assert.match(reflectionComposer, /keyboardVisible && styles\.keyboardFrameOpen/);
  assert.match(reflectionComposer, /!text\.trim\(\) && !voiceDraft\?\.audioUri/);
  assert.match(zodiac, /onSave=\{saveReflection\}/);
  assert.doesNotMatch(zodiac, /label="Save reflection"/);
  assert.match(interaction, /Your goals and next steps/);
  assert.match(interaction, /emphasized=\{Boolean\(activeJourneyFocus/);
  assert.match(interaction, /bubbleBody=\{idealSkinPreparing/);
  assert.match(interaction, /quickGoalPickerOpen \? 'Choose one for today, or make a small goal of your own\.' : destinationHeroBody/);
  assert.match(interaction, /bubbleVariant=\{quickGoalPickerOpen \? 'questionnaire' : 'default'\}/);
  assert.match(interaction, /showSpeechBubble/);
  assert.doesNotMatch(interaction, /styles\.youHeading|styles\.youIntro/);
  assert.match(interaction, /backgroundColor: KatchaUI\.companionPanel\.background/);
  assert.doesNotMatch(interaction, /talk about you/i);
  assert.doesNotMatch(journey, /Find a new focus/);
  assert.doesNotMatch(journey, /previous focus kept in history/);
});

test('bond rewards queue, fly into the creature, respect reduced motion, and gate level-up splashes', () => {
  const overlay = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'bond-reward-overlay.tsx'), 'utf8');
  const stage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-home-environment-stage.tsx'), 'utf8');
  const interaction = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');
  const levelUp = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-bond-level-up-celebration.tsx'), 'utf8');
  const kingdom = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'), 'utf8');

  assert.match(overlay, /Math\.min\(5/);
  assert.match(overlay, /onTokenArrive/);
  assert.match(overlay, /useReducedMotion/);
  assert.match(overlay, /Haptics\.impactAsync/);
  assert.match(stage, /rewardPulseKey/);
  assert.match(stage, /withSequence/);
  assert.match(interaction, /pendingBondCelebration/);
  assert.match(interaction, /2_800/);
  assert.match(levelUp, /Bond level up/);
  assert.match(levelUp, /RisingArrow/);
  assert.match(kingdom, /!bondLevelUp && !quests\.selectedPendingBondCelebration/);
});

test('every accepted conversation insight queues bond once per session, including updated insight slots', () => {
  const questHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  assert.match(questHook, /id: `insight-saved:\$\{selectedResident\.creature\.creatureId\}:\$\{selectedConversationSession\.id\}:\$\{node\.id\}`/);
  assert.match(questHook, /kind: 'insight_saved'/);
  assert.doesNotMatch(questHook, /if \(accept && isNewInsight/);
});

test('conversation outcomes stay visible and provisional answers remain editable', () => {
  const scene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-conversation-scene.tsx'),
    'utf8',
  );
  const stage = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-cinematic-stage.tsx'),
    'utf8',
  );
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const questHook = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'),
    'utf8',
  );
  assert.match(scene, /Change answer/);
  assert.match(scene, /<ConversationOutcomeCard/);
  assert.doesNotMatch(scene, /CONVERSATION TAKEAWAY|Finish this thought|reflection_reveal/);
  assert.doesNotMatch(scene, /Save this insight|Don’t save|Add to my insights|Keep it as a result only/);
  assert.match(scene, /AutomaticInsightTransition/);
  assert.match(scene, /onDecision\(true, node\)/);
  assert.match(scene, /onDecision\(true, summary\)/);
  assert.doesNotMatch(scene, /A SECONDARY THREAD|WHY THIS RESULT|REVIEW YOUR ANSWERS|Replay from the beginning/);
  assert.match(scene, /A QUEST PICKED FOR YOU/);
  assert.match(scene, /label="Take this quest"/);
  assert.doesNotMatch(scene, /There is no matching quest available right now/);
  assert.match(scene, /function GoalBundleProposal/);
  assert.match(scene, /accessibilityRole="checkbox"/);
  assert.match(scene, /BEST MATCH/);
  assert.match(scene, /Add \$\{selectedIds\.length\} goals/);
  assert.match(scene, /outcome\.items\?\.map/);
  assert.match(interaction, /destination === 'goals'/);
  assert.doesNotMatch(interaction, /destination === 'discovery'/);
  assert.match(questHook, /destinationLabel: 'View all goals'/);
  assert.match(questHook, /destinationLabel: 'View this quest'/);
  assert.match(questHook, /selectedConversationDefinition\.isOpener/);
  assert.match(questHook, /enteredNode\.fallbackNodeId/);
  assert.doesNotMatch(scene, /Show me the quests/);
  assert.match(stage, /<CelebrationParticles/);
  assert.match(interaction, /onOpenOutcomeDestination/);
  assert.doesNotMatch(interaction, /if \(accept\) selectExperienceDestination\('quest'\)/);
  assert.doesNotMatch(scene, /showConversationProgress && lastLabel/);
  assert.doesNotMatch(scene, /Choose quickly\. There is no wrong form\./);
  assert.match(scene, /\{showConversationProgress \? <>/);
  assert.doesNotMatch(scene, /session\.status === 'completed' \? 'KEEP TALKING'/);
});

test('companion insights stay scoped to the Katchimera being visited', () => {
  const thread = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-insight-thread.tsx'),
    'utf8',
  );
  const questHook = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'),
    'utf8',
  );
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  assert.match(questHook, /insightsForFamily\(companionContentState, selectedFamilyId\)/);
  assert.match(thread, /insights\.filter\(\(item\) => item\.familyId === currentFamilyId\)/);
  assert.doesNotMatch(thread, /accessibilityRole="tablist"|<FilterChip/);
  assert.doesNotMatch(interaction, /destination === 'insight' && props\.insights\.length === 0 && props\.insight\.action/);
});

test('Mossprout, Feastle, and Tasklet games use the full-bleed game shell', () => {
  assert.equal(companionQuestUsesFullBleed({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'merge', packId: 'feastle-kitchen' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'block_jam', packId: 'tasklet-desk' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'matching', packId: 'relicoon-gallery' } as InteractiveQuestExecution), false);
  assert.equal(companionQuestUsesFullBleed(null), false);
});

test('quest presentation keeps shell ownership and backdrop treatment together', () => {
  assert.deepEqual(
    companionQuestPresentation({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution),
    { backdrop: 'normal', layout: 'fullBleed', startsImmediately: true },
  );
  assert.deepEqual(
    companionQuestPresentation({ kind: 'block_blast', packId: 'cheerlet-party' } as InteractiveQuestExecution),
    { backdrop: 'strong', layout: 'standard', startsImmediately: true },
  );
  assert.deepEqual(
    companionQuestPresentation(null),
    { backdrop: 'normal', layout: 'standard', startsImmediately: false },
  );
});

test('interactive mini-games launch directly without duplicate preview screens', () => {
  assert.equal(companionQuestSkipsPreview({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview({ kind: 'matching', packId: 'relicoon-gallery' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview({ kind: 'merge', packId: 'feastle-kitchen' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview(null), false);
});

test('legacy mini-game back helper returns through the quest overview', () => {
  assert.equal(companionQuestBackAction({ activeAttemptId: 'attempt-1', experienceOpen: true }), 'confirm_attempt_exit');
  assert.equal(companionQuestBackAction({ activeAttemptId: null, experienceOpen: true }), 'return_to_do');
  assert.equal(companionQuestBackAction({ activeAttemptId: null, experienceOpen: false }), 'close_sheet');
});

function runtime(overrides: Partial<QuestRuntimeStatus> = {}): QuestRuntimeStatus {
  return {
    questId: 'quest-park', state: 'in_progress', complete: false, submissionMode: 'manual', readyToSubmit: false,
    progress: [], matchedEvidenceIds: [], possibleEvidenceIds: [], confidence: null, missingCapabilities: [],
    nextAction: 'take_photo', userMessage: 'Take a clear photo of a park.', debugReason: 'test', ...overrides,
  };
}

test('ordinary companion visits open on the dashboard route', () => {
  const initial = createCompanionInteractionState({});
  assert.deepEqual(initial.route, { kind: 'dashboard' });
  assert.equal(initial.destination, null);
  assert.equal(companionRouteBackAction(initial), 'close_experience');
});

test('the first-meeting introduction is a focused route that returns to the dashboard', () => {
  const initial = createCompanionInteractionState({});
  const introduction = companionInteractionReducer(initial, { type: 'open_introduction' });
  assert.deepEqual(introduction.route, { kind: 'introduction' });
  assert.equal(companionRouteBackAction(introduction), 'return_to_home');
  const home = companionInteractionReducer(introduction, { type: 'return_to_destination' });
  assert.deepEqual(home.route, { kind: 'dashboard' });
});

test('companion destinations clear focused review state and preserve direction', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'quest' });
  const reviewing = companionInteractionReducer(initial, { type: 'review_item', itemId: 'evidence-1' });
  const you = companionInteractionReducer(reviewing, { type: 'select_destination', destination: 'goals' });
  const insight = companionInteractionReducer(you, { type: 'select_destination', destination: 'insight' });
  const backToYou = companionInteractionReducer(insight, { type: 'select_destination', destination: 'goals' });
  assert.equal(you.destination, 'goals');
  assert.equal(you.reviewItemId, null);
  assert.equal(insight.direction, 1);
  assert.equal(backToYou.direction, -1);
});

test('achievements open as a companion destination instead of remounting a route', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'goals' });
  const achievements = companionInteractionReducer(initial, {
    type: 'select_destination',
    destination: 'achievements',
  });
  assert.deepEqual(achievements.route, { kind: 'destination', destination: 'achievements' });
  assert.equal(companionRouteBackAction(achievements), 'return_to_home');

  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const kingdom = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  assert.match(interaction, /selectDestination\('achievements'\)/);
  assert.match(interaction, /CompanionTrophyRoomScreen creatureId=\{props\.creatureId\} embedded/);
  assert.match(interaction, /route\.kind === 'visit'/);
  assert.match(interaction, /<CompanionVisitScene/);
  assert.doesNotMatch(kingdom, /pathname:\s*['"]\/katchimera\/\[creatureId\]\/achievements/);
});

test('focused companion routes unwind to their destination, then home, then Kingdom', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'goals' });
  const questionnaire = companionInteractionReducer(initial, {
    type: 'open_journey_questionnaire',
    sessionId: 'journey-1',
  });
  assert.equal(companionRouteBackAction(questionnaire), 'return_to_destination');

  const goals = companionInteractionReducer(questionnaire, { type: 'return_to_destination' });
  assert.deepEqual(goals.route, { kind: 'destination', destination: 'goals' });
  assert.equal(companionRouteBackAction(goals), 'return_to_home');

  const home = companionInteractionReducer(goals, { type: 'show_dashboard' });
  assert.deepEqual(home.route, { kind: 'dashboard' });
  assert.equal(companionRouteBackAction(home), 'close_experience');
});

test('the launch chat lobby nests conversations while Shared History returns to the dashboard', () => {
  const initial = createCompanionInteractionState({});
  const chat = companionInteractionReducer(initial, { type: 'show_chat_lobby' });
  assert.deepEqual(chat.route, { kind: 'chat_lobby' });
  assert.equal(companionRouteBackAction(chat), 'return_to_home');
  const conversation = companionInteractionReducer(chat, { type: 'show_conversation' });
  assert.deepEqual(conversation.route, { kind: 'conversation' });
  assert.equal(companionRouteBackAction(conversation), 'return_to_chat_lobby');
  assert.deepEqual(
    companionInteractionReducer(conversation, { type: 'show_chat_lobby' }).route,
    { kind: 'chat_lobby' },
  );

  const legacyVisit = companionInteractionReducer(initial, { type: 'show_visit' });
  assert.deepEqual(legacyVisit.route, { kind: 'visit' });
  assert.equal(companionRouteBackAction(legacyVisit), 'return_to_home');
  const history = companionInteractionReducer(initial, { type: 'open_shared_history' });
  assert.deepEqual(history.route, { kind: 'shared_history' });
  assert.equal(companionRouteBackAction(history), 'return_to_home');
  assert.deepEqual(companionInteractionReducer(history, { type: 'show_dashboard' }).route, { kind: 'dashboard' });

  const dashboard = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-dashboard.tsx'),
    'utf8',
  );
  assert.match(dashboard, />\s*Chat\s*</);
  assert.ok(
    dashboard.indexOf('onPress={onChat}') < dashboard.indexOf("ITEMS.map"),
    'Chat belongs above the dashboard destinations',
  );
  for (const destination of ['quest', 'goals', 'achievements', 'insight', 'skins']) {
    assert.match(dashboard, new RegExp(`destination: '${destination}'`));
  }

  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  assert.match(interaction, /const openChat = \(\) =>/);
  assert.match(interaction, /onChat=\{openChat\}/);
  assert.doesNotMatch(interaction, /autoIntroductionCreatureRef/);
});

test('ideal-skin onboarding gates launch companions and skin equipment opens a bespoke Plus offer', () => {
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const kingdom = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const questHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  const paywall = fs.readFileSync(path.join(process.cwd(), 'app', 'modal.tsx'), 'utf8');
  const profile = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'explore.tsx'), 'utf8');
  const companionRoute = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx'), 'utf8');

  assert.match(questHook, /selectedIdealSkinOnboardingRequired/);
  assert.match(questHook, /session\.currentNodeId !== selectedIdealSkinDefinition\.entryNodeId/);
  assert.match(interaction, /startConversation\(\{ definitionId: idealSkinDefinitionId \}\)/);
  assert.match(interaction, /if \(!hasActiveIdealSkinQuestionnaire\) \{\s*startConversation\(\{ definitionId: idealSkinDefinitionId \}\);/);
  assert.match(interaction, /if \(!hasActiveIdealSkinQuestionnaire \|\| route\.kind === 'conversation'\) return;\s*showConversation\(\);/);
  assert.doesNotMatch(interaction, /useLayoutEffect/);
  assert.match(interaction, /setInterval\(\(\) => \{\s*startConversation\(\{ definitionId: idealSkinDefinitionId \}\);\s*\}, 250\)/);
  assert.match(questHook, /const existingExplicitSession = input\.definitionId/);
  assert.match(questHook, /if \(existingExplicitSession\) return current/);
  assert.match(interaction, /idealSkinOnboardingRequired\s*\? props\.onClose/);
  assert.match(kingdom, /source: 'katchimera-skin'/);
  assert.match(kingdom, /economy\.snapshot\.activePlus \? applyWardrobeToKingdom/);
  assert.match(paywall, /Share every day card/);
  assert.match(paywall, /questionnaire match/);
  assert.match(paywall, /safeDismissModal/);
  assert.doesNotMatch(companionRoute, /if \(!isFocused\) return <View/);
  assert.match(interaction, /selectExperienceDestination\('insight'\)/);
  assert.match(profile, /Reset Katchimera skin questionnaires/);
  assert.match(profile, /resetDevSubscriptionSimulator\(\)/);
  assert.match(profile, /resetKatchimeraWardrobeForDebug\(\)/);
  assert.match(profile, /resetLaunchCompanionBondsForDebug\(\)/);
  assert.match(profile, /begin its questionnaire from question one/);
  assert.match(questHook, /today\?\.isoDate \?\? localDayId\(new Date\(occurredAt\)\)/);
  assert.doesNotMatch(questHook, /if \(!selectedFamilyId \|\| !today\?\.isoDate \|\| !isConversationV2Family\(selectedFamilyId\)\) return null/);
  assert.doesNotMatch(interaction, /label="Start questionnaire"/);
  assert.doesNotMatch(interaction, /The first question did not open automatically/);
  assert.match(interaction, /Preparing your first question…/);
  assert.match(interaction, /CompanionBackAction label="Kingdom" onPress=\{props\.onClose\}/);
  assert.match(interaction, /idealSkinOnboardingRequired \? null : \(route\.kind === 'visit'/);
  assert.match(questHook, /setCompanionContentState\(\(current\) => \{\s*const migrated = migrateCompanionIntroduction\(current/);
  assert.doesNotMatch(questHook, /setCompanionContentState\(visit\.state\)/);
});

test('active mini-games require confirmation and reset their instance on return', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'quest' });
  const preview = companionInteractionReducer(initial, { type: 'open_quest_experience' });
  assert.equal(companionRouteBackAction(preview), 'return_to_destination');

  const active = companionInteractionReducer(preview, {
    type: 'set_quest_attempt',
    attemptId: 'attempt-1',
  });
  assert.equal(companionRouteBackAction(active), 'confirm_attempt_exit');

  const returned = companionInteractionReducer(active, { type: 'return_to_destination' });
  assert.deepEqual(returned.route, { kind: 'destination', destination: 'quest' });
  assert.equal(returned.experienceInstance, 1);
});

test('goal picker returns to the dedicated goals destination', () => {
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const quickGoals = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'companion-quick-goals.tsx'),
    'utf8',
  );
  const goalComposer = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'quick-goal-composer-modal.tsx'),
    'utf8',
  );
  const goalActions = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'quick-goal-action-modal.tsx'),
    'utf8',
  );
  const goalCelebration = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'goal-completion-celebration.tsx'),
    'utf8',
  );
  const kingdomCompanion = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const initial = createCompanionInteractionState({ initialDestination: 'goals' });
  const picker = companionInteractionReducer(initial, { type: 'open_quick_goal_picker' });
  const returned = companionInteractionReducer(picker, { type: 'return_to_destination' });

  assert.deepEqual(returned.route, { kind: 'destination', destination: 'goals' });
  assert.match(interaction, /route\.kind === 'visit' \|\| route\.kind === 'conversation'\s*\? visitStageSpeech/);
  assert.match(interaction, /backLabel=\{quickGoalPickerOpen \? 'Goals'/);
  assert.match(interaction, /\) : !questionnaireExperience \? \(\s*<CompanionCinematicStage/);
  assert.match(interaction, /route\.kind === 'destination' \|\| route\.kind === 'dashboard' \|\| route\.kind === 'shared_history' \|\| quickGoalPickerOpen/);
  assert.match(quickGoals, /backgroundColor: KatchaUI\.companionPanel\.background/);
  assert.match(quickGoals, /styles\.scopedPresetRow/);
  assert.match(quickGoals, /<QuickGoalComposerModal/);
  assert.match(quickGoals, /<QuickGoalActionModal/);
  assert.match(quickGoals, /Skipped for today/);
  assert.match(quickGoals, /Marked incomplete/);
  assert.match(quickGoals, /Type it or use your voice/);
  assert.doesNotMatch(quickGoals, /Back to Goals/);
  assert.doesNotMatch(quickGoals, /QuickGoalCompletionPrompt|completionPrompt/);
  assert.doesNotMatch(interaction, /QuickGoalCompletionPrompt/);
  assert.match(interaction, /onSkipGoal=\{props\.onSkipQuickGoal\}/);
  assert.match(interaction, /onSnoozeGoal=\{props\.onSnoozeQuickGoal\}/);
  assert.match(kingdomCompanion, /onSkipQuickGoal=\{quickGoals\.skipGoal\}/);
  assert.match(kingdomCompanion, /onSnoozeQuickGoal=\{quickGoals\.snoozeGoal\}/);
  assert.match(goalActions, /onSkip/);
  assert.match(goalActions, /onSnooze/);
  assert.match(goalActions, /justCompleted/);
  assert.match(goalActions, /goalCardComplete/);
  assert.match(goalActions, /celebrateCreature\(\)/);
  assert.match(goalActions, /<GoalCompletionCelebration[\s\S]*embedded/);
  assert.match(goalActions, /creatureRotation\.value = withSequence/);
  assert.match(goalCelebration, /if \(embedded\) return celebration/);
  assert.match(goalComposer, /<Modal/);
  assert.match(goalComposer, /useJournalVoiceDraft/);
  assert.match(goalComposer, /Tap the microphone to record/);
  assert.match(goalComposer, /paddingTop: insets\.top \+ \(keyboardVisible \? 6 : 16\)/);
  assert.match(goalComposer, /keyboardWillShow/);
  assert.match(goalComposer, /keyboardVisible && styles\.keyboardFrameOpen/);
  assert.match(goalComposer, /keyboardVisible && styles\.contentKeyboard/);
  assert.match(goalComposer, /onSave\(trimmed, cadence\)/);
});

test('explicit launch intents can open a destination directly', () => {
  const quest = createCompanionInteractionState({ initialDestination: 'quest' });
  const skins = createCompanionInteractionState({ initialDestination: 'skins' });
  assert.deepEqual(quest.route, { kind: 'destination', destination: 'quest' });
  assert.deepEqual(skins.route, { kind: 'destination', destination: 'skins' });
});

test('companion viewport resets across destinations and content-shape transitions', () => {
  const base = {
    creatureId: 'companion:vesperitt',
    destination: 'quest' as const,
    questMode: 'offer' as const,
  };
  const quest = companionViewportResetKey(base);
  assert.notEqual(companionViewportResetKey({ ...base, destination: 'insight' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, questMode: 'active', activeQuestTitle: 'The small hours' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, journeyNodeId: 'understand-goal' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, activeAttemptId: 'attempt-1' }), quest);
  assert.equal(companionViewportResetKey({ ...base }), quest);
});

test('quest offer exposes one focused acceptance action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: null, offer: { id: 'quest-park', title: 'A green spot', hint: 'Take a photo of a park.' },
    runtime: null, questComplete: false, captureFeedback: null, items: [], criteria: [],
  });
  assert.equal(model.mode, 'offer');
  assert.equal(model.primaryAction?.kind, 'accept');
  assert.equal(model.primaryAction?.label, 'Accept quest');
});

test('blocked and active quests expose only the runtime recovery action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'A green spot', hint: 'Find a park.' }, offer: undefined,
    runtime: runtime({ state: 'blocked_permission', nextAction: 'enable_camera', userMessage: 'Camera access is needed.' }),
    questComplete: false, captureFeedback: null, items: [], criteria: [],
  });
  assert.equal(model.mode, 'blocked');
  assert.equal(model.primaryAction?.kind, 'quest_action');
  assert.equal(model.primaryAction?.label, 'Enable camera');
});

test('journal quests expose one inline structured journal action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: {
      title: 'Notice one living detail',
      hint: 'Share something specific you noticed outside.',
      semanticInput: true,
      assistedJournalInput: true,
      journalFallback: true,
    },
    offer: undefined,
    runtime: runtime({
      questId: 'quest-mossprout-living-detail',
      nextAction: 'add_note',
      userMessage: 'Add a note about what you noticed.',
    }),
    questComplete: false,
    captureFeedback: null,
    items: [],
    criteria: [{ label: 'Describe a real green-space moment', done: false }],
  });
  assert.equal(model.mode, 'active');
  assert.equal(model.journalFallback, true);
  assert.equal(model.assistedJournalInput, true);
  assert.equal(companionQuestInlineNoteAction(model)?.nextAction, 'add_note');

  const ordinary = { ...model, semanticInput: false, journalInput: false };
  assert.equal(companionQuestInlineNoteAction(ordinary), null);

  const legacyBlockedJournal = {
    ...model,
    mode: 'blocked' as const,
    runtimeState: 'impossible_today' as const,
  };
  assert.equal(companionQuestInlineNoteAction(legacyBlockedJournal)?.nextAction, 'add_note');
});

test('photo quests keep their camera action inside the quest card', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'Catch one city detail', hint: 'Photograph something you noticed in the city.' },
    offer: undefined,
    runtime: runtime({
      questId: 'quest-skylo-city-photo',
      nextAction: 'take_photo',
      userMessage: 'Take a photo that clearly shows the city detail.',
    }),
    questComplete: false,
    captureFeedback: null,
    items: [],
    criteria: [{ label: 'Photograph the city', done: false }],
  });
  assert.equal(model.mode, 'active');
  assert.equal(companionQuestInlinePhotoAction(model)?.nextAction, 'take_photo');

  const blocked = buildCompanionQuestViewModel({
    activeQuest: { title: 'Catch one city detail', hint: 'Photograph something you noticed in the city.' },
    offer: undefined,
    runtime: runtime({ state: 'blocked_permission', nextAction: 'enable_camera' }),
    questComplete: false,
    captureFeedback: null,
    items: [],
    criteria: [{ label: 'Photograph the city', done: false }],
  });
  assert.equal(companionQuestInlinePhotoAction(blocked)?.nextAction, 'enable_camera');

  const sheet = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const thread = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-quest-thread.tsx'),
    'utf8',
  );
  assert.match(sheet, /!inlineQuestPhotoAction/);
  assert.match(thread, /<PhotoCaptureAction/);
  assert.match(thread, /Photo needed/);
  assert.match(thread, /It will stay attached here while the quest checks the match/);
});

test('quest completion returns to a list with completed real-life and replayable mini-game states', () => {
  const questThread = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-quest-thread.tsx'),
    'utf8',
  );
  const companionScreen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const questHook = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'),
    'utf8',
  );
  assert.match(questThread, /Completed today/);
  assert.match(questThread, /Played today · Replayable/);
  assert.match(questThread, /Play again/);
  assert.match(companionScreen, /Back to quests/);
  assert.match(companionScreen, /finishQuestResultNotice/);
  assert.match(questHook, /selectedQuestItems\.find[\s\S]*\?\? captureSubmissionItem/);
});

test('possible evidence requires review before submission', () => {
  const item = {
    id: 'photo-1', kind: 'photo' as const, sourceType: 'photo', sourceId: 'photo-1', title: 'Park photo', subtitle: 'Today',
    icon: 'photo.fill' as const, accentColor: '#7DE8CD', matchStatus: 'possible' as const, qualityId: 'place.park',
  };
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'A green spot', hint: 'Find a park.' }, offer: undefined,
    runtime: runtime({ possibleEvidenceIds: ['photo-1'] }), questComplete: false, captureFeedback: null, items: [item], criteria: [],
  });
  assert.equal(model.mode, 'possible');
  assert.equal(model.primaryAction?.kind, 'review_match');
});

test('a submitted quest stays in its completed state even when its evidence is still runtime-ready', () => {
  const item = {
    id: 'note-1', kind: 'note' as const, sourceType: 'text_note', sourceId: 'note-1',
    title: 'Notice one living detail', subtitle: 'Checked on device · Added to this quest',
    icon: 'square.and.pencil' as const, accentColor: '#D2AE59', matchStatus: 'ready' as const,
  };
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'Notice one living detail', hint: 'Share what you noticed.' }, offer: undefined,
    runtime: runtime({ readyToSubmit: true, matchedEvidenceIds: ['note-1'] }),
    questComplete: true, captureFeedback: null, items: [item], criteria: [],
  });
  assert.equal(model.mode, 'complete');
  assert.equal(model.message, 'Your entry matched and has been submitted.');
  assert.equal(model.primaryAction, null);
  assert.deepEqual(model.evidence, [item]);
});

test('quest notes use the shared composer while guided entries retain the journal picker', () => {
  const screen = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const journal = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx'),
    'utf8',
  );
  assert.match(screen, /inputMode === 'guided'[\s\S]*setEmbeddedJournal/);
  assert.match(screen, /setQuestNoteCapture\(\{[\s\S]*\.\.\.review,[\s\S]*inputMode,[\s\S]*captureSourceId:/);
  assert.match(screen, /<CompanionReflectionComposerModal/);
  assert.match(screen, /initialVoiceRecording=\{questNoteCapture\.inputMode === 'voice'\}/);
  assert.match(screen, /requestedInputMode \?\? \(quests\.selectedFoundationAvailable \? 'note' : 'guided'\)/);
  assert.match(screen, /title="That doesn’t answer the quest yet"/);
  assert.match(screen, /captureSourceId: `\$\{review\.questRunId\}:\$\{inputMode\}:/);
  assert.match(screen, /entryVariant=\{embeddedJournal\.origin === 'quest' \? 'quest_focused' : 'standard'\}/);
  assert.match(journal, /questFocused \|\| initialNoteExpanded/);
  assert.match(journal, /autoFocus=\{questFocused\}/);
  assert.ok(
    journal.indexOf('{questFocused ? (') < journal.indexOf("{(contextOptionsOverride ?? choice.detailChoices"),
    'the focused quest note belongs above secondary journal details',
  );
});

test('quest capture feedback is visible only to the quest and creature that started it', () => {
  const feastleCapture = {
    questId: 'quest-photo-food',
    creatureId: 'feastle',
  };
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-photo-food', 'feastle'), true);
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-log-film', 'flickerbun'), false);
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-photo-food', 'flickerbun'), false);
});

test('late-night quest evidence is restricted to photos captured from 11pm through 4:59am', () => {
  const evidence = (observedAt: string) => withCaptureTimeSignals({
    id: `photo:${observedAt}`,
    sourceType: 'photo',
    sourceId: observedAt,
    observedAt,
    provider: 'appleVision',
    confidence: 0.9,
    signals: [],
  });
  assert.equal(isLateNightHour(23), true);
  assert.equal(isLateNightHour(0), true);
  assert.equal(isLateNightHour(4), true);
  assert.equal(isLateNightHour(5), false);
  assert.equal(isLateNightHour(22), false);
  assert.equal(evidence('2026-07-13T23:30:00').signals.some((signal) => signal.key === 'time.late_night'), true);
  assert.equal(evidence('2026-07-14T04:59:00').signals.some((signal) => signal.key === 'time.late_night'), true);
  assert.equal(evidence('2026-07-14T05:00:00').signals.some((signal) => signal.key === 'time.late_night'), false);
  assert.equal(evidence('2026-07-14T14:00:00').signals.some((signal) => signal.key === 'time.late_night'), false);
});

test('the evidence provider returns its capture-time-enriched photo candidates', () => {
  const photo = {
    id: 'photo:late', sourceType: 'photo' as const, sourceId: 'late',
    observedAt: '2026-07-13T23:30:00', provider: 'appleVision' as const,
    confidence: 0.9, signals: [],
  };
  const facts = evidenceProvider.resolve({ today: { evidence: [photo] } as unknown as HomeDayRecord });
  const candidates = facts['evidence.items'] ?? [];
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].signals.some((signal) => signal.key === 'time.late_night'), true);
});

test('insight actions are contextual and optional', () => {
  assert.equal(insightForArchetype({ archetype: 'food', text: 'A food pattern', count: 3 }).action?.intent.kind, 'journal_flow');
  assert.equal(insightForArchetype({ archetype: 'places', text: 'A place pattern', count: 2 }).action?.intent.kind, 'places');
  assert.equal(insightForArchetype({ archetype: 'unknown', text: 'A quiet observation' }).action, null);
});

test('companion reflection saves directly to the canonical journal with a stable origin', () => {
  const origin = { kind: 'companion_reflection' as const, creatureId: 'mossprout', promptId: 'reflection:park', promptText: 'What pulls you back?' };
  const prepared = prepareCompanionReflection({
    creatureId: 'mossprout',
    dayId: '2026-07-13',
    draft: {
      kind: 'text',
      text: '  The quiet path by the pond.  ',
      promptId: origin.promptId,
      promptText: origin.promptText,
    },
  });
  assert.ok(prepared);
  assert.equal(prepared.sourceId, 'companion-reflection:mossprout:2026-07-13');
  assert.equal(prepared.submission.flowId, 'general');
  assert.equal(prepared.submission.categoryId, 'other');
  const command = submissionToJournalCommand(prepared.submission, new Date('2026-07-13T12:00:00.000Z'));
  const record = command ? commandToJournalRecord(command, new Date('2026-07-13T12:00:00.000Z')) : null;
  assert.deepEqual(record?.source.kind === 'text_note' ? record.source.origin : null, origin);
  assert.equal(record?.note, 'The quiet path by the pond.');
  assert.equal(record?.note?.includes(origin.promptText), false);
});

test('blank text without a voice recording cannot create a reflection', () => {
  assert.equal(prepareCompanionReflection({
    creatureId: 'mossprout',
    dayId: '2026-07-13',
    draft: {
      kind: 'text',
      text: '   ',
      promptId: 'reflection:park',
      promptText: 'What stayed with you?',
    },
  }), null);
});
