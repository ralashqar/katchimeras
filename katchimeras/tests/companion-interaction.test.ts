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
  companionInitialConversationCompletionReady,
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
  assert.match(todayScreen, /const flowBusy =[\s\S]*?isHatching \|\|[\s\S]*?quickGoalsOpen \|\|/);
  assert.match(quickGoalHook, /CompanionQuickGoalCompletionReceipt/);
  assert.match(quickGoalHook, /bondAward: awarded\.awarded/);
  assert.doesNotMatch(goalModal, /Nicely done · \+5 bond/);
});

test('You questionnaires advance on selection while consequential tasks retain consent', () => {
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
  assert.match(questionnaireScene, /onSelect\(option\)/);
  assert.doesNotMatch(questionnaireScene, /confirmSelection|selectionFooter/);
  assert.doesNotMatch(questionnaireScene, /setTimeout/);
  assert.match(questionnaireScene, /<CompanionCinematicStage/);
  assert.match(questionnaireScene, /bubbleVariant="questionnaire"/);
  assert.match(questionnaireScene, /environmentKey=\{environmentKey\}/);
  assert.match(questionnaireScene, /styles\.progressBlock/);
  assert.match(questionnaireScene, /companionQuestionnaireHeroSpacer\(height, speechBubbleHeight\)/);
  assert.match(questionnaireScene, /onSpeechBubbleHeightChange=\{setSpeechBubbleHeight\}/);
  assert.doesNotMatch(questionnaireScene, /styles\.creatureFrame|styles\.bubble,/);
  assert.match(cinematicStage, /speechBubbleQuestionnaire/);
  assert.match(cinematicStage, /numberOfLines=\{4\}/);
  assert.doesNotMatch(cinematicStage, /adjustsFontSizeToFit=\{Boolean\(numberOfLines\)\}/);
  assert.doesNotMatch(cinematicStage, /questionTitleLong/);
  assert.match(cinematicStage, /setFittedFontScale/);
  assert.match(cinematicStage, /onLayout=.*onSpeechBubbleHeightChange/);
  assert.match(cinematicStage, /function TypewriterText/);
  assert.match(cinematicStage, /requestAnimationFrame\(reveal\)/);
  assert.match(cinematicStage, /styles\.typewriterMeasure/);
  assert.match(cinematicStage, /reduceMotion \? characters\.length : 0/);
  assert.match(cinematicStage, /const renderedSpeech = incomingSpeechPresent[\s\S]*?: retainedSpeech/);
  assert.match(cinematicStage, /callers[\s\S]*?hide the bubble explicitly with showSpeechBubble/);
  assert.match(cinematicStage, /key=\{questionnaireBubble \? 'questionnaire-speech' : 'destination-speech'\}[\s\S]*?layout=\{speechBubbleLayout\}/);
  assert.match(cinematicStage, /LinearTransition\.duration\(190\)\.easing\(Easing\.out\(Easing\.cubic\)\)/);
  assert.match(cinematicStage, /const visibleCount = revealState\.text === text/);
  assert.doesNotMatch(cinematicStage, /setMeasuredLineCount\(null\)/);
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
  assert.match(interaction, /bubbleBody=\{mossproutFtueSpeechTitle[\s\S]*?: idealSkinPreparing/);
  assert.match(interaction, /quickGoalPickerOpen \? 'Choose one for today, or make a small goal of your own\.' : destinationHeroBody/);
  assert.match(interaction, /bubbleVariant=\{quickGoalPickerOpen && !mossproutFtueSpeechTitle \? 'questionnaire' : 'default'\}/);
  assert.match(interaction, /showSpeechBubble/);
  assert.doesNotMatch(interaction, /styles\.youHeading|styles\.youIntro/);
  assert.match(interaction, /backgroundColor: KatchaUI\.companionPanel\.background/);
  assert.doesNotMatch(interaction, /talk about you/i);
  assert.doesNotMatch(journey, /Find a new focus/);
  assert.doesNotMatch(journey, /previous focus kept in history/);
});

test('bond rewards fly into the top-bar Bond icon while preserving the creature reaction and Journey celebration', () => {
  const overlay = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'bond-reward-overlay.tsx'), 'utf8');
  const stage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-home-environment-stage.tsx'), 'utf8');
  const header = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-page-header.tsx'), 'utf8');
  const rewardMotion = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'reward-arrival-motion.ts'), 'utf8');
  const tokenFlight = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'reward-token-flight.tsx'), 'utf8');
  const interaction = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');
  const levelUp = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-bond-level-up-celebration.tsx'), 'utf8');
  const kingdom = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'), 'utf8');
  const devTools = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'explore.tsx'), 'utf8');

  assert.match(overlay, /Math\.min\(REWARD_TOKEN_MAX_COUNT/);
  assert.match(overlay, /<RewardTokenFlight[\s\S]*?tokenSize=\{46\}[\s\S]*?zIndex=\{10_002 \+ index\}/);
  assert.match(overlay, /overlay: \{ zIndex: 10_000 \}/);
  assert.doesNotMatch(overlay, /rewardLabel|\+\{points\} Bond|FadeIn|FadeOut/);
  assert.doesNotMatch(overlay, /styles\.token|boxShadow/);
  assert.match(overlay, /onTokenArrive/);
  assert.match(overlay, /useReducedMotion/);
  assert.match(overlay, /Haptics\.impactAsync/);
  assert.match(overlay, /useDisposableTimers\('bond-reward-flight'\)/);
  assert.match(stage, /rewardPulseKey/);
  assert.match(stage, /runRewardArrivalMotion/);
  assert.match(header, /bondIconTargetRef/);
  assert.match(header, /bondRewardPulseKey/);
  assert.match(header, /runRewardIconArrivalPulse\(medallionScale, reduceMotion\)/);
  assert.match(header, /runRewardIconArrivalPulse\(medallionGlow, reduceMotion\)/);
  assert.match(header, /scale: 1 \+ medallionScale\.value \* 0\.23/);
  assert.match(header, /styles\.medallionGlow/);
  assert.match(rewardMotion, /runRewardIconArrivalPulse[\s\S]*?duration: reduceMotion \? 45 : 85[\s\S]*?duration: reduceMotion \? 90 : 170/);
  assert.match(tokenFlight, /REWARD_TOKEN_RISE_MS = 140[\s\S]*?REWARD_TOKEN_HOVER_MS = 150[\s\S]*?REWARD_TOKEN_FLIGHT_MS = 380[\s\S]*?REWARD_TOKEN_STAGGER_MS = 65/);
  assert.match(tokenFlight, /riseProgress\.value = withTiming[\s\S]*?hoverPhase\.value[\s\S]*?flightProgress\.value = withDelay/);
  assert.match(tokenFlight, /Every token rises together and hovers[\s\S]*?Only the flights into the destination are staggered/);
  assert.match(interaction, /pendingBondCelebration/);
  assert.match(interaction, /const bondRewardTargetRef = useRef/);
  assert.match(interaction, /const targetView = bondRewardTargetRef\.current/);
  assert.match(interaction, /bondIconTargetRef=\{bondRewardTargetRef\}/);
  assert.match(interaction, /bondRewardPulseKey=\{rewardPulseKey\}/);
  assert.doesNotMatch(interaction, /creatureRewardTargetRef/);
  assert.match(interaction, /2_800/);
  assert.match(levelUp, /Bond level up/);
  assert.match(levelUp, /Journey complete/);
  assert.match(levelUp, /variant === 'journey_complete'/);
  assert.match(levelUp, /setTimeout\(onContinue/);
  assert.match(levelUp, /screenReaderEnabled \? 'Return to story' : 'Return now'/);
  assert.match(levelUp, /RisingArrow/);
  assert.match(levelUp, /journeyComplete[\s\S]*?styles\.journeyScrollContent/);
  assert.match(levelUp, /width \* 0\.68[\s\S]*?compactHeight \? 0\.27 : 0\.3[\s\S]*?270/);
  assert.match(levelUp, /<CelebrationParticles[\s\S]*?styles\.journeyConfetti[\s\S]*?tint="#82B94D"/);
  assert.match(levelUp, /journeyConfetti: \{ top: '52%', zIndex: 1 \}[\s\S]*?heroCreature: \{ zIndex: 2 \}/);
  assert.match(levelUp, /const resolvedJourneyDayNumber = journeyDayNumber \?\? journeyHandoff\?\.dayNumber \?\? 1/);
  assert.match(levelUp, /FadeInUp\.duration\(340\)\.delay\(130\)[\s\S]*?<CelebrationHeroNumber[\s\S]*?Journey Day \$\{resolvedJourneyDayNumber\} complete[\s\S]*?label="JOURNEY DAY"[\s\S]*?value=\{resolvedJourneyDayNumber\}/);
  assert.match(kingdom, /mossproutJourneyDayNumberForCompletionEvent[\s\S]*?journeyDayNumber=\{bondCelebration\.journeyDayNumber\}/);
  assert.doesNotMatch(levelUp, /receipt\.points|journeyBondTarget|journeyBondRatio|journeyProgressCard|journeyProgressTrack|journeyRewardNumber|COMPANION_RELATIONSHIP_STAGES|journeyStageNode|journeyStageConnector|journeyRelationship/);
  assert.match(levelUp, /<KatchaButton[\s\S]*?fullWidth[\s\S]*?glow[\s\S]*?labelStyle=\{KatchaDeckUI\.typography\.ftuePanelTitle\}/);
  assert.doesNotMatch(levelUp, /journeyContinueButton/);
  assert.doesNotMatch(levelUp, /Friendship grows across real days/);
  assert.match(kingdom, /receipt\.kind === 'journey_day_completed'/);
  assert.match(kingdom, /variant: 'journey_complete'/);
  assert.match(kingdom, /ftueDayOneActionActive && receipt\.kind === 'journey_day_completed'[\s\S]*?variant: 'journey_complete'/);
  assert.match(kingdom, /autoContinue=\{!ftueDayOneActionActive\}[\s\S]*?Hear Mossprout\\'s story/);
  assert.match(kingdom, /!bondCelebration && !quests\.selectedPendingBondCelebration/);
  assert.match(devTools, /Preview Journey Day 1 splash[\s\S]*?journeySplashPreview/);
  assert.match(devTools, /DEV_JOURNEY_DAY_ONE_RECEIPT[\s\S]*?variant="journey_complete"/);
});

test('legacy Merge return remains safe while Mossprout opens its character-owned Garden', () => {
  const merge = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-world-screen.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx'), 'utf8');
  const interaction = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');

  assert.match(merge, /storyNavigationPendingRef/);
  assert.match(merge, /source: 'merge-world'/);
  assert.match(route, /source === 'merge-world' \? transitionTo\(\{/);
  assert.match(route, /navigate: \(\) => router\.dismissTo\('\/\(tabs\)\/katchimeras'\)/);
  assert.match(route, /onOpenMerge=\{familyId === 'mossprout'/);
  assert.match(route, /pathname: '\/katchimera\/\[creatureId\]\/activity'/);
  assert.doesNotMatch(route, /onOpenMerge=.*pathname: '\/games'/);
  assert.match(interaction, /if \(!props\.active \|\| !receipt \|\| bondReward\) return/);
  assert.match(interaction, /if \(props\.active !== false\) return/);
});

test('every accepted conversation insight queues bond once per session, including updated insight slots', () => {
  const questHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  assert.match(questHook, /id: `insight-saved:\$\{selectedResident\.creature\.creatureId\}:\$\{selectedConversationSession\.id\}:\$\{node\.id\}`/);
  assert.match(questHook, /kind: 'insight_saved'/);
  assert.doesNotMatch(questHook, /if \(accept && isNewInsight/);
});

test('conversation replies, memories, and outcomes advance without redundant confirmation', () => {
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
  const flow = fs.readFileSync(
    path.join(process.cwd(), 'features', 'companion', 'use-companion-conversation-flow.ts'),
    'utf8',
  );
  assert.doesNotMatch(scene, /Change answer|Yes, remember this/);
  assert.match(scene, /<ConversationOutcomeCard/);
  assert.match(scene, /useCompanionAdaptivePanel/);
  assert.match(scene, /onContentSizeChange=\{\(_, contentHeight\) => adaptivePanel\.onContentHeightChange\(contentHeight\)\}/);
  assert.match(scene, /nestedScrollEnabled/);
  assert.doesNotMatch(scene, /minHeight: height/);
  assert.doesNotMatch(scene, /CONVERSATION TAKEAWAY|Finish this thought|reflection_reveal/);
  assert.doesNotMatch(scene, /Save this insight|Don’t save|Add to my insights|Keep it as a result only/);
  assert.match(scene, /AutomaticInsightTransition/);
  assert.match(flow, /onCommitInsight\(node\)/);
  assert.match(flow, /onCommitMemory\(node\.summary\.replace/);
  assert.match(flow, /useLayoutEffect\(\(\) => \{[\s\S]*?session\.pendingReply === undefined[\s\S]*?onContinue\(\)/);
  assert.match(flow, /conversationReplyDelayMs/);
  assert.match(flow, /skipCompletedTransition/);
  assert.match(flow, /screenReaderEnabled/);
  assert.match(flow, /const key = `\$\{session\.id\}:end`;[\s\S]*?const timer = setTimeout\(\(\) => \{[\s\S]*?automatedRef\.current\.add\(key\);[\s\S]*?onContinue\(\);/);
  assert.match(flow, /const key = `\$\{session\.id\}:complete`;[\s\S]*?const timer = setTimeout\(\(\) => \{[\s\S]*?automatedRef\.current\.add\(key\);[\s\S]*?onComplete\(\);/);
  assert.doesNotMatch(flow, /automatedRef\.current\.add\(key\);\s*const timer = setTimeout\((?:onContinue|onComplete)/);
  assert.doesNotMatch(scene, /Undo saved insight|Saved .* returning to your story/);
  assert.doesNotMatch(scene, /is following your answer|Tap to move on sooner|Double-tap for the next line/);
  assert.match(scene, /<PrimaryAction label="Continue" onPress=\{onAdvance\}/);
  assert.match(stage, /Shows the full message/);
  assert.match(stage, /revealAll=\{revealAllSpeech\}/);
  assert.doesNotMatch(scene, /A SECONDARY THREAD|WHY THIS RESULT|REVIEW YOUR ANSWERS|Replay from the beginning/);
  assert.match(scene, /A SMALL INVITATION/);
  assert.match(scene, /label="Take this quest"/);
  assert.doesNotMatch(scene, /There is no matching quest available right now/);
  assert.match(scene, /function GoalBundleProposal/);
  assert.match(scene, /accessibilityRole="checkbox"/);
  assert.match(scene, /TRY THIS FIRST/);
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

test('FTUE companion launch starts on conversation without a dashboard frame', () => {
  const state = createCompanionInteractionState({ initialConversation: true });
  assert.equal(state.route.kind, 'conversation');
  assert.equal(state.destination, null);

  const interaction = fs.readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  assert.match(interaction, /initialConversationContentReady = !props\.initialConversationDefinitionId[\s\S]*?conversationSession\?\.definitionId === props\.initialConversationDefinitionId[\s\S]*?conversationDefinition\?\.id === props\.initialConversationDefinitionId/);
  assert.match(interaction, /useLayoutEffect\(\(\) => \{[\s\S]*?routedInitialConversationRef\.current = definitionId;[\s\S]*?route\.kind !== 'conversation'\) showConversation\(\)/);
  assert.match(interaction, /initialConversationHandoffPending \? null : route\.kind === 'chat_lobby'/);
  assert.match(interaction, /showSpeechBubble=\{!initialConversationHandoffPending/);
  assert.match(interaction, /data: initialConversationContentReady[\s\S]*?layout: transitionBackgroundReady && transitionCreatureReady && initialConversationContentReady/);
});

test('FTUE waits for the player to dismiss a completed conversation result', () => {
  const definitionId = 'mossprout:ftue:chapter-zero-return';
  const completed = {
    definitionId,
    status: 'completed' as const,
  };
  assert.equal(companionInitialConversationCompletionReady({
    ...completed,
    outcomePresentation: {
      id: 'outcome:quiet-clearing',
      kind: 'insight' as const,
      eyebrow: 'YOUR NATURE RESULT',
      title: 'A Quiet Clearing',
      message: 'The garden can become somewhere the volume comes down.',
      celebrate: true,
      createdAt: 1,
    },
  }, definitionId), false);
  assert.equal(companionInitialConversationCompletionReady(completed, definitionId), true);
  assert.equal(companionInitialConversationCompletionReady(completed, 'another-conversation'), false);

  const interaction = fs.readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  assert.match(interaction, /!conversationFlow\.requiresManualAdvance[\s\S]*?conversationFlow\.advance/);
  assert.match(interaction, /companionInitialConversationCompletionReady\(session, definitionId\)/);
  assert.match(interaction, /conversationSession\.outcomePresentation[\s\S]*?initialConversationObservedActiveRef\.current = true/);
});

test('a completed FTUE return cannot replay after an ordinary Garden visit', () => {
  const route = fs.readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  const interaction = fs.readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  const provider = fs.readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');

  assert.match(route, /ftue === 'chapter-zero-return'[\s\S]*?ftueRun\?\.status === 'active'[\s\S]*?ftueRun\.stepId === 'companion\.chapter_zero_return'[\s\S]*?MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID/);
  assert.match(interaction, /conversationSession\.status === 'completed'[\s\S]*?A restored completed session still needs to run the completion effect[\s\S]*?return;[\s\S]*?requestStoryConversation/);
  assert.doesNotMatch(interaction, /conversationSession\.status === 'completed'[\s\S]{0,600}?completedInitialConversationRef\.current = props\.conversationSession\.id/);
  assert.match(provider, /servedOrder\?\.storyArcId !== 'mossprout:casual-garden'[\s\S]*?recordKatchimeraActionCompletion/);
  assert.match(provider, /slotId: 'garden'[\s\S]*?kind: 'garden_request'[\s\S]*?subtitle: 'Garden request complete'/);
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

test('Mossprout nature direction is a standalone focused route that backs directly home', () => {
  const initial = createCompanionInteractionState({});
  const questionnaire = companionInteractionReducer(initial, {
    type: 'open_focus_questionnaire',
    sessionId: 'nature-direction-1',
  });

  assert.deepEqual(questionnaire.route, {
    kind: 'focus_questionnaire',
    sessionId: 'nature-direction-1',
  });
  assert.equal(questionnaire.destination, null);
  assert.equal(companionRouteBackAction(questionnaire), 'return_to_home');
  assert.deepEqual(
    companionInteractionReducer(questionnaire, { type: 'return_to_destination' }).route,
    { kind: 'dashboard' },
  );
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
  assert.match(dashboard, /styles\.actionTray/);
  assert.match(dashboard, /styles\.dock/);
  assert.match(dashboard, /activityLabel = 'Merge'/);
  assert.match(dashboard, /label=\{activityLabel\}/);
  assert.match(dashboard, /label="Journal"/);
  assert.match(dashboard, /label="Collection"/);
  assert.match(dashboard, /onPress=\{\(\) => press\(onChat\)\}/);
  for (const destination of ['quest', 'goals']) assert.match(dashboard, new RegExp(`destination: '${destination}'`));
  for (const destination of ['achievements', 'insight', 'skins']) assert.match(dashboard, new RegExp(`onSelect\\('${destination}'\\)`));

  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  assert.match(interaction, /const openChat = \(\) =>/);
  assert.match(interaction, /getCreatureVisual\(props\.visualKey, 'grown'\)/);
  assert.match(interaction, /onChat=\{props\.familyId === 'mossprout' \? undefined : openChat\}/);
  assert.match(interaction, /\n\s+lifted\s*\n/);
  assert.doesNotMatch(interaction, /enterFromLifted/);
  assert.doesNotMatch(interaction, /autoIntroductionCreatureRef/);
});

test('companion scene panels share one palette, stay anchored, and bound speech copy', () => {
  const worldPath = path.join(process.cwd(), 'components', 'katchadeck', 'world');
  const cinematic = fs.readFileSync(path.join(worldPath, 'companion-cinematic-stage.tsx'), 'utf8');
  const chat = fs.readFileSync(path.join(worldPath, 'companion-chat-lobby.tsx'), 'utf8');
  const visit = fs.readFileSync(path.join(worldPath, 'companion-visit-scene.tsx'), 'utf8');
  const questionnaire = fs.readFileSync(path.join(worldPath, 'companion-questionnaire-scene.tsx'), 'utf8');
  const conversation = fs.readFileSync(path.join(worldPath, 'companion-conversation-scene.tsx'), 'utf8');
  const story = fs.readFileSync(path.join(worldPath, 'feastle-story-stage.tsx'), 'utf8');
  const interaction = fs.readFileSync(path.join(worldPath, 'companion-interaction-sheet.tsx'), 'utf8');
  const cinematicPan = fs.readFileSync(path.join(worldPath, 'use-companion-environment-pan.ts'), 'utf8');

  assert.match(cinematic, /availableBubbleWidth/);
  assert.match(cinematic, /const incomingSpeechTitle = normalizeCompanionSpeechText\(title\)[\s\S]*?const speechTitle = renderedSpeech\.title/);
  assert.match(cinematic, /const speechBubbleVisible = showSpeechBubble && \(hasSpeechTitle \|\| hasSpeechBody\)/);
  assert.match(cinematic, /\{speechBubbleVisible \? \(/);
  assert.match(cinematic, /entering=\{reduceMotion \? undefined : ZoomIn\.duration\(190\)/);
  assert.match(cinematic, /exiting=\{reduceMotion \? undefined : ZoomOut\.duration\(140\)/);
  assert.match(cinematic, /if \(!speechBubbleVisible\) onSpeechBubbleHeightChange\?\.\(0\)/);
  assert.doesNotMatch(cinematic, /\{showSpeechBubble \? \(/);
  assert.match(cinematic, /questionnaireBubble && styles\.questionTitle,[\s\S]*?numberOfLines=\{4\}[\s\S]*?minimumFontScale=\{0\.48\}/);
  assert.match(cinematic, /fontSize: 22,[\s\S]*?lineHeight: 25/);
  assert.doesNotMatch(cinematic, /questionnaireBubble && title\.length/);
  assert.doesNotMatch(cinematic, /styles\.title(?:Compact|Medium|Long)/);
  assert.match(cinematic, /setFitWidth\(\(current\) => current === nextWidth \? current : nextWidth\)/);
  assert.match(cinematic, /numberOfLines && fitWidth > 0/);
  assert.match(cinematic, /activeFitRef\.current\.width !== fitWidth[\s\S]*?activeFitRef\.current\.scale !== measurementScale/);
  assert.match(cinematic, /const lineCount = event\.nativeEvent\.lines\.length/);
  assert.match(cinematic, /lineCount <= numberOfLines/);
  assert.match(cinematic, /measurementScale === 1/);
  assert.match(cinematic, /overflowingScale - measurementScale <= 0\.002/);
  assert.match(cinematic, /\(measurementScale \+ overflowingScale\) \/ 2/);
  assert.match(cinematic, /\(fittingScale \+ measurementScale\) \/ 2/);
  assert.match(cinematic, /lineHeight: baseLineHeight \* fittedFontScale/);
  assert.match(cinematic, /setFitComplete\(true\)/);
  assert.match(cinematic, /height: fittedLineHeight \* Math\.min\(numberOfLines/);
  assert.match(cinematic, /onLayout=\{\(event\) => \{[\s\S]*?style=\{styles\.typewriterLayout\}>[\s\S]*?styles\.typewriterMeasure[\s\S]*?<View style=\{\[styles\.typewriterFrame, fittedFrameStyle\]\}>/);
  assert.match(cinematic, /numberOfLines=\{fitComplete \? numberOfLines : undefined\}/);
  assert.doesNotMatch(cinematic, /typewriterFitting|Boolean\(numberOfLines\) && !fitComplete/);
  assert.doesNotMatch(cinematic, /fitFallbackActive/);
  assert.match(cinematic, /typewriterFrame: \{ overflow: 'hidden'/);
  assert.match(cinematic, /typewriterMeasure: \{[\s\S]*?color: 'transparent'/);
  assert.doesNotMatch(cinematic, /typewriterMeasure: \{[^}]*opacity: 0/);
  assert.match(cinematic, /typewriterMeasure: \{[\s\S]*?left: 0,[\s\S]*?position: 'absolute',[\s\S]*?top: 0/);
  assert.doesNotMatch(cinematic, /adjustsFontSizeToFit=\{Boolean\(numberOfLines && needsFontScale\)\}/);
  assert.match(cinematic, /minimumFontScale=\{0\.48\}/);
  for (const panel of [chat, visit, questionnaire, conversation, story]) {
    assert.match(panel, /KatchaUI\.companionScenePanel\.background/);
  }
  for (const panel of [chat, visit, conversation]) {
    assert.match(panel, /nestedScrollEnabled/);
  }
  for (const panel of [chat, visit]) {
    assert.match(panel, /height: Math\.min\(440, Math\.max\(220, height \* 0\.46\)\)/);
  }
  assert.match(conversation, /height: adaptivePanel\.panelHeight/);
  assert.match(conversation, /activeGameQuestion\?\.id \?\? 'no-question'/);
  assert.match(conversation, /key=\{panelContentKey\}/);
  assert.match(conversation, /LinearTransition\.duration\(COMPANION_PANEL_LAYOUT_DURATION_MS\)/);
  assert.match(conversation, /useCompanionAdaptivePanel/);
  assert.match(conversation, /onContentSizeChange=\{\(_, contentHeight\) => adaptivePanel\.onContentHeightChange\(contentHeight\)\}/);
  assert.match(conversation, /const shortPanelBottomLift = adaptivePanel\.scrollable/);
  assert.match(conversation, /paddingBottom: 20/);
  assert.match(interaction, /<GestureDetector gesture=\{environmentPan\.gesture\}>/);
  assert.match(interaction, /sceneTranslateX=\{environmentPan\.translateX\}/);
  assert.match(cinematicPan, /resolveTodayExplorationDragTranslation/);
  assert.match(cinematicPan, /overscrollResistance: 0/);
  assert.match(cinematicPan, /onFinalize\(\(\) =>/);
  assert.match(cinematicPan, /withSpring\(0, spring\)/);
  assert.match(cinematic, /width: bubbleWidth, zIndex: 4 \}, subjectPanStyle/);
});

test('Mossprout owns a compact Journey action stack without redundant headings or clipped swipe motion', () => {
  const worldPath = path.join(process.cwd(), 'components', 'katchadeck', 'world');
  const mossprout = fs.readFileSync(path.join(worldPath, 'mossprout-story-stage.tsx'), 'utf8');
  const interaction = fs.readFileSync(path.join(worldPath, 'companion-interaction-sheet.tsx'), 'utf8');
  const dashboard = fs.readFileSync(path.join(worldPath, 'companion-dashboard.tsx'), 'utf8');
  const sharedRows = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'day-action-row.tsx'), 'utf8');
  const sharedGoalRow = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'day-action-goal-row.tsx'), 'utf8');
  const today = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'), 'utf8');

  assert.match(mossprout, /resolveMossproutDayActions/);
  assert.match(mossprout, /const MAX_VISIBLE_ACTIONS = 3/);
  assert.match(mossprout, /dayOneChoiceActionIds[\s\S]*?includeActionIds: dayOneActionChoiceActive \? dayOneChoiceActionIds : undefined/);
  assert.match(mossprout, /boardSnapshot\.slots\.map\(\(slot\) =>/);
  assert.doesNotMatch(mossprout, /presentationGap/);
  assert.match(mossprout, /presentationController\.revealingSlotId === slot\.slotId/);
  assert.match(mossprout, /key=\{presentedActionKey\}/);
  assert.match(mossprout, /createActionBoardSnapshot/);
  assert.match(mossprout, /mossproutActiveConversationAction\(conversationSession\)/);
  assert.match(mossprout, /activeConversationAction[\s\S]*?visible = visible\.map/);
  assert.match(mossprout, /useActionPresentationController/);
  assert.match(mossprout, /presentationOverlay/);
  assert.match(mossprout, /<DayActionGoalRow/);
  assert.match(mossprout, /<QuickGoalActionModal/);
  assert.match(mossprout, /setSelfCompletingGoalAction\(presentedAction\)/);
  assert.match(mossprout, /recordHandledKatchimeraActionCompletion/);
  assert.match(sharedRows, /animateLayout \? LinearTransition/);
  assert.ok((sharedRows.match(/SlideInLeft\.delay\(entryDelayMs\)/g) ?? []).length >= 2);
  assert.doesNotMatch(sharedRows, /FadeInUp\.delay\(entryDelayMs\)/);
  assert.match(sharedRows, /if \(!start\) return/);
  assert.match(mossprout, /<DayActionReplacementSlot/);
  assert.match(sharedRows, /pendingRevealRef\.current = true/);
  assert.match(sharedRows, /if \(revealing && !pendingRevealRef\.current\)[\s\S]*?translateX\.value = reduceMotion \? 0 : -windowWidth/);
  assert.match(mossprout, /setLocalReplacementTransition\(\{ phase: 'concealed', slotId \}\)/);
  assert.match(mossprout, /requestAnimationFrame\(\(\) => \{[\s\S]*?commitReplacement\?\.\(\)[\s\S]*?phase: 'revealing'/);
  assert.match(mossprout, /hiddenPresentationSlot = localReplacementTransition\?\.phase === 'concealed'/);
  assert.doesNotMatch(sharedRows, /\.withCallback\(/);
  assert.match(interaction, /const entranceTimer = setTimeout\([\s\S]*?setMossproutHubEntranceSettled\(true\)/);
  assert.doesNotMatch(interaction, /enteringBase\.withCallback/);
  assert.doesNotMatch(interaction, /runOnJS\(markMossproutHubEntranceSettled\)/);
  assert.match(sharedRows, /export const DAY_ACTION_MOTION/);
  assert.match(sharedGoalRow, /GoalCompletionCelebration/);
  assert.match(sharedGoalRow, /artRotation\.value = withSequence/);
  assert.match(sharedGoalRow, /rowX\.value = withDelay/);
  assert.match(today, /<DayActionGoalRow/);
  assert.match(today, /<DayActionSwipeShell/);
  assert.doesNotMatch(today, /function TodayCareGoalRow|function CareSwipeShell/);
  assert.doesNotMatch(mossprout, /Today with Mossprout|active.*slots/);
  assert.match(interaction, /outcomeRequiresManualAdvance: props\.familyId === 'mossprout'/);
  assert.match(interaction, /conversations=\{props\.mossproutActionCandidates\}/);
  assert.doesNotMatch(interaction, /outcomeAutoAdvanceMs: props\.familyId === 'mossprout'/);
  assert.match(interaction, /if \(props\.familyId !== 'mossprout'\) selectExperienceDestination\('insight'\)/);
  assert.match(mossprout, /<DayActionCardSurface/);
  assert.match(mossprout, /<DayActionActiveRow/);
  assert.match(mossprout, /<DayActionCompletedRow/);
  assert.match(sharedRows, /rowX\.value = withDelay/);
  assert.doesNotMatch(sharedRows, /HORIZONTAL_MOTION_GUTTER/);
  assert.match(sharedRows, /marginHorizontal: -windowWidth/);
  assert.match(sharedRows, /paddingHorizontal: windowWidth/);
  assert.match(sharedRows, /skipFramePositionStyle = useMemo\(\(\) => \(\{ left: windowWidth \}\)/);
  assert.match(sharedRows, /skipFrame: \{[^}]*borderRadius: 20[^}]*overflow: 'hidden'/);
  assert.match(interaction, /fullWidth=\{mossproutActionDashboard\}/);
  assert.match(interaction, /mossproutActionScrollContent: \{ flexGrow: 1, overflow: 'hidden', paddingHorizontal: KatchaUI\.layout\.phoneGutter \+ 4 \}/);
  assert.match(mossprout, /const ACTION_STACK_HEIGHT = 212/);
  assert.match(mossprout, /actionSlot: \{[^}]*height: ACTION_STACK_HEIGHT[^}]*justifyContent: 'flex-end'/);
  assert.match(mossprout, /const ACTION_TRAY_HEIGHT = 284/);
  assert.match(mossprout, /height: ACTION_TRAY_HEIGHT/);
  assert.match(mossprout, /height: ACTION_STACK_HEIGHT/);
  assert.match(mossprout, /overflow: 'visible'/);
  assert.match(interaction, /showNameplate=\{route\.kind === 'dashboard' && props\.familyId !== 'mossprout'\}/);
  assert.doesNotMatch(interaction, /mossproutJourneyDayStatus|mossproutNameplate/);
  assert.doesNotMatch(mossprout, /label="Talk"|onTalk/);
  assert.match(interaction, /onChat=\{props\.familyId === 'mossprout' \? undefined : openChat\}/);
  assert.match(dashboard, /onChat \? <Pressable/);
});

test('completed action rows preserve their outro while Bond reward renders update the parent', () => {
  const sharedRows = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'day-action-row.tsx'),
    'utf8'
  );

  assert.match(sharedRows, /const onFinishedRef = useRef\(onFinished\)/);
  assert.match(sharedRows, /const onRewardRequestRef = useRef\(onRewardRequest\)/);
  assert.match(sharedRows, /runOnJS\(notifyFinished\)\(\)/);
  assert.match(sharedRows, /const request = onRewardRequestRef\.current/);
  assert.match(sharedRows, /claimRewardAnimation\(rewardAnimationId\)/);
  assert.match(sharedRows, /Persisted-receipt flows omit rewardAnimationId/);
  const mossprout = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-story-stage.tsx'),
    'utf8'
  );
  const quests = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  const completion = fs.readFileSync(path.join(process.cwd(), 'game', 'katchimeras', 'action-completion.ts'), 'utf8');
  const actionRuntime = fs.readFileSync(path.join(process.cwd(), 'game', 'katchimeras', 'action-runtime.ts'), 'utf8');
  assert.doesNotMatch(mossprout, /rewardAnimationId=/);
  assert.match(quests, /const completedNow = nextSession\.status === 'completed'[\s\S]*?settleMossproutConversationCompletion\(nextSession, selectedConversationDefinition\)/);
  assert.match(quests, /settleMossproutConversationCompletion\(dismissedSelectedSession, selectedConversationDefinition\)/);
  assert.match(completion, /commitActionCompletion\(progressed, actionCommandFromOrigin\(origin, completedAt\)\)/);
  assert.match(completion, /recordCompanionBondEvent\([\s\S]*?queueCelebration: false/);
  assert.match(actionRuntime, /rewardReceipt: completion\.rewardReceipt/);
  assert.match(mossprout, /presentationAction\.rewardReceipt/);
  assert.doesNotMatch(sharedRows, /\[chargeGlow, onFinished,/);
});

test('Mossprout normal actions survive the FTUE encounter handoff', () => {
  const quests = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'),
    'utf8',
  );

  const candidateStart = quests.indexOf('const selectedMossproutActionCandidates');
  const starterStart = quests.indexOf('const selectedConversationStarters', candidateStart);
  assert.ok(candidateStart >= 0 && starterStart > candidateStart);
  const candidateSource = quests.slice(candidateStart, starterStart);

  assert.match(candidateSource, /selectedFamilyId !== 'mossprout' \|\| !today\?\.isoDate/);
  assert.doesNotMatch(candidateSource, /!selectedEncounterId/);
  assert.match(candidateSource, /mossprout-actions:\$\{selectedResident\?\.creature\.creatureId \?\? 'mossprout'\}:\$\{today\.isoDate\}/);
  assert.ok((candidateSource.match(/allowCooldownFallback: true/g) ?? []).length >= 2);
});

test('Mossprout nature direction keeps its legacy content inside the modern shell and returns home from Done', () => {
  const quests = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  const homeModel = fs.readFileSync(
    path.join(process.cwd(), 'game', 'katchimeras', 'mossprout-home.ts'),
    'utf8',
  );
  const stage = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-story-stage.tsx'),
    'utf8',
  );
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const journeyThread = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-journey-thread.tsx'),
    'utf8',
  );
  const questionnaireScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-questionnaire-scene.tsx'),
    'utf8',
  );
  const conversationScene = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-conversation-scene.tsx'),
    'utf8',
  );
  const choiceList = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-choice-list.tsx'),
    'utf8',
  );
  const adaptivePanel = fs.readFileSync(
    path.join(process.cwd(), 'hooks', 'use-companion-adaptive-panel.ts'),
    'utf8',
  );
  const journeyDefinitions = fs.readFileSync(
    path.join(process.cwd(), 'constants', 'companion-journeys.ts'),
    'utf8',
  );

  assert.match(homeModel, /goal \? \{ kind: 'focus_questionnaire' \}/);
  assert.match(stage, /action\.destination\.kind === 'focus_questionnaire'[\s\S]*?onOpenFocusDirection\(mossproutActionOrigin\(action, dayId, journey\)\)/);
  assert.match(interaction, /presentation=\{props\.familyId === 'mossprout' \? 'conversation' : 'immersive'\}/);
  assert.match(interaction, /onDone=\{\(\) => \{[\s\S]*?onCompleteJourneyQuestionnaire\(journeyQuestionnaireSessionId\)[\s\S]*?experience\.showHome\(\)/);
  assert.match(quests, /const completeSelectedJourneyQuestionnaire = useCallback[\s\S]*?completeMossproutFocusAction/);
  const answerStart = quests.indexOf('const answerSelectedJourneyConversation');
  const completionStart = quests.indexOf('const completeSelectedJourneyQuestionnaire', answerStart);
  assert.ok(answerStart >= 0 && completionStart > answerStart);
  assert.doesNotMatch(quests.slice(answerStart, completionStart), /completeMossproutFocusAction|completeMossproutJourneyGoalPlan/);
  assert.match(interaction, /const openJourneyFocus = \(actionOrigin\?: KatchimeraActionOrigin\) =>[\s\S]*?onStartJourneyConversation\(undefined, actionOrigin\)[\s\S]*?experience\.openFocusQuestionnaire/);
  assert.match(questionnaireScene, /presentation\?: 'immersive' \| 'conversation'/);
  assert.match(questionnaireScene, /conversationPanel/);
  assert.match(questionnaireScene, /useCompanionAdaptivePanel/);
  assert.match(questionnaireScene, /LinearTransition\.duration\(COMPANION_PANEL_LAYOUT_DURATION_MS\)/);
  assert.match(questionnaireScene, /adaptivePanel\.onContentHeightChange\(contentHeight\)/);
  assert.match(questionnaireScene, /paddingBottom: conversationPresentation \? insets\.bottom \+ 16 : 0/);
  assert.match(questionnaireScene, /<CompanionChoiceList/);
  assert.match(conversationScene, /<CompanionChoiceList/);
  assert.doesNotMatch(conversationScene, /useGrid|optionColumns|width: useGrid/);
  assert.match(choiceList, /companionChoiceColumnCount\(width, options\.length\) === 2/);
  assert.match(choiceList, /width: useGrid \? '48%' : '100%'/);
  assert.match(choiceList, /presentation === 'responsive-grid'/);
  assert.match(adaptivePanel, /const availableHeight = viewportHeight[\s\S]*?const panelHeight = Math\.min/);
  assert.match(adaptivePanel, /viewportWidth >= 360 && optionCount >= 4 \? 2 : 1/);
  assert.match(adaptivePanel, /COMPANION_PANEL_LAYOUT_DURATION_MS = 220/);
  assert.match(journeyThread, /label="Done"/);
  assert.match(journeyThread, /choicePresentation=\{presentation === 'conversation' \? 'single-column' : 'responsive-grid'\}/);
  assert.match(journeyThread, /helperText=\{presentation === 'conversation' \? undefined : node\.helperText\}/);
  assert.match(journeyThread, /icon: presentation === 'conversation'[\s\S]*?\? undefined/);
  assert.doesNotMatch(journeyThread, /label=\{added \|\| alreadyAdded \? 'View tasks'/);
  assert.match(journeyDefinitions, /What are you hoping to find outside\?/);
  assert.match(journeyDefinitions, /Where could that happen without a special trip\?/);
  assert.match(journeyDefinitions, /Which sounds doable this week\?/);
});

test('a failed Mossprout Journey start never falls through to the first Merge board', () => {
  const stage = fs.readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  assert.match(stage, /const startedJourney = mossproutJourneyForDay\(started, dayId\);[\s\S]*?if \(!startedJourney\) return;/);
  assert.match(stage, /const opening = startedJourney\.openingConversationId;[\s\S]*?if \(opening\) onOpenConversation\(opening, origin\);/);
  assert.doesNotMatch(stage, /else onOpenMerge\('mossprout:chapter-0:first-sprout'\)/);
});

test('a completed Mossprout opening cannot replay from the Journey card', () => {
  const stage = fs.readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const questHook = fs.readFileSync('hooks/use-kingdom-quests.ts', 'utf8');
  assert.match(stage, /conversationSession\?\.definitionId === journey\.openingConversationId[\s\S]*?conversationSession\.status === 'completed'/);
  assert.match(stage, /completeMossproutJourneyConversation\([\s\S]*?repairedJourney\?\.status === 'activity_available'/);
  assert.match(stage, /return onOpenMerge\(journeyGardenRequest\?\.id \?\? repairedJourney\.activity\?\.mergeOrderId\)/);
  assert.match(questHook, /definition\.repeatPolicy === 'once_ever'[\s\S]*?session\.status === 'completed'[\s\S]*?return current/);
});

test('active Journey presentation hides optional cards and Merge tray entries', () => {
  const stage = fs.readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const journeyPanel = fs.readFileSync('components/katchadeck/world/mossprout-journey-request-panel.tsx', 'utf8');
  const merge = fs.readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  const route = fs.readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  const routeScreen = fs.readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  const kingdom = fs.readFileSync('components/katchadeck/world/kingdom-companion-screen.tsx', 'utf8');
  const questHook = fs.readFileSync('hooks/use-kingdom-quests.ts', 'utf8');
  assert.match(stage, /const journeyExclusive = Boolean\(journey && journey\.status !== 'complete'\)/);
  assert.match(stage, /if \(journeyExclusive\) return resolvedVisibleActions/);
  assert.match(stage, /relationships\.actionPresentations/);
  assert.match(stage, /actionPresentationAsDayAction/);
  assert.match(stage, /const journeyMergeActive = journey\?\.status === 'activity_available' \|\| journey\?\.status === 'activity_in_progress'/);
  assert.match(stage, /journeyEpisode\.mergeOrders\.map/);
  assert.match(stage, /journeyMergeActive && journeyEpisode && !residentStoryResumeActive \? <View[\s\S]*?<MossproutJourneyRequestPanel/);
  assert.match(stage, /animateEntrance=\{false\}/);
  assert.match(stage, /standalone/);
  assert.match(stage, /const JOURNEY_REQUEST_TRAY_HEIGHT = 348/);
  assert.match(stage, /journeyMergeActive && !residentStoryResumeActive[\s\S]*?styles\.journeyRequestStage/);
  assert.match(stage, /journeyRequestPanel:[\s\S]*?flex: 1/);
  assert.match(stage, /journey && !storyComplete && !journeyMergeActive/);
  assert.match(journeyPanel, /COMPANION_MERGE_REQUEST_PALETTE/);
  assert.match(journeyPanel, /standalone && styles\.standalone/);
  assert.match(journeyPanel, /backgroundColor: KatchaUI\.companionScenePanel\.background/);
  assert.doesNotMatch(journeyPanel, /TODAY’S JOURNEY/);
  assert.match(stage, /journey\.status === 'activity_available' \? 'Go to the Garden' : 'Continue in the Garden'/);
  assert.match(stage, /served: servedOrderIds\.has\(order\.id\)/);
  assert.match(merge, /mossproutJourneyExclusive[\s\S]*?state\.activeOrders\.filter\(\(order\) => journeyOrderIds\.has\(order\.id\)\)/);
  assert.match(merge, /mossproutJourneyExclusive[\s\S]*?journeyReturnReady \? \[mossproutReturnEntry\] : \[\]/);
  assert.match(merge, /!chapterZeroActive && !mossproutJourneyExclusive && pendingParcel/);
  assert.match(merge, /beginMossproutJourneyReturn\(current, mossproutJourneyDayId\)/);
  assert.match(merge, /params: \{ creatureId: `companion:\$\{characterId\}`, source: 'merge-world', story: 'return' \}/);
  assert.match(route, /source === 'merge-world' && story === 'return'/);
  assert.match(route, /journey\.familyId === 'mossprout' && journey\.status === 'resolution_ready'/);
  assert.match(route, /journeyReturnConversationDefinitionId=\{journeyReturnConversationDefinitionId\}/);
  assert.match(routeScreen, /initialConversationDefinitionId=\{journeyReturnConversationDefinitionId\}/);
  assert.match(kingdom, /initialConversationDefinitionId=\{ftueConversationDefinitionId \?\? initialConversationDefinitionId\}/);
  assert.match(questHook, /mossproutJourneyRuntimeDayId\(relationships, dayId, isJourneyQuickModeEnabled\(\)\)/);
  assert.match(stage, /mossproutActionOrigin\(action, dayId, journey\)/);
  assert.match(questHook, /selectedFamilyId === 'mossprout'[\s\S]*?mossproutConversationCompletionDayId\(calendarConversationDayId\)/);
});

test('Journey narrative replies and task bridge wait for the player', () => {
  const scene = fs.readFileSync('components/katchadeck/world/companion-conversation-scene.tsx', 'utf8');
  const journeyPanel = fs.readFileSync('components/katchadeck/world/mossprout-journey-request-panel.tsx', 'utf8');
  const flow = fs.readFileSync('features/companion/use-companion-conversation-flow.ts', 'utf8');
  const interaction = fs.readFileSync('components/katchadeck/world/companion-interaction-sheet.tsx', 'utf8');
  assert.match(scene, /session\.pendingReply !== undefined\) return session\.pendingReply/);
  assert.match(scene, /journeyNarrative \? 'Continue the story'/);
  assert.match(scene, /journeyTaskHandoff \? 'Your Garden request is ready' : 'Finish today’s Journey'/);
  assert.match(flow, /if \(journeyNarrative\) return;[\s\S]*?onContinue\(\)/);
  assert.match(flow, /journeyNarrativeAdvanceReady/);
  assert.match(flow, /screenReaderEnabled \|\| journeyNarrativeAdvanceReady/);
  assert.match(scene, /journeyTaskHandoff \? 'Go to the Garden' : 'Finish Journey'/);
  assert.match(scene, /<MossproutJourneyRequestPanel/);
  assert.match(scene, /journeyRequestHandoffVisible \? undefined : LinearTransition/);
  assert.doesNotMatch(scene, /journeyRequestHandoffVisible && \{ flexGrow: 1, justifyContent: 'center' \}/);
  assert.match(scene, /journeyRequestHandoffVisible \? 'journey-handoff' : 'standard'/);
  assert.match(scene, /<MossproutJourneyRequestPanel[\s\S]*?animateEntrance=\{false\}/);
  assert.match(journeyPanel, /eyebrow = 'GARDEN REQUESTS'[\s\S]*?<CompanionMergeRequestTray[\s\S]*?eyebrow=\{eyebrow\}/);
  assert.match(interaction, /journeyOpeningEpisode\?\.mergeOrders\.map/);
  assert.match(interaction, /journeyTaskRequests=\{journeyTaskRequests\}/);
  assert.match(interaction, /journeyTaskTitle=\{journeyOpeningEpisode\?\.title\}/);
  assert.doesNotMatch(interaction, /completeMossproutJourneyConversation\(/);
  assert.match(interaction, /const relationships = relationshipProgressionRepository\.load\(\)/);
  assert.match(interaction, /initialConversationDefinitionRef\.current !== definitionId[\s\S]*?initialConversationObservedActiveRef\.current = false/);
  assert.match(interaction, /if \(initialConversationObservedActiveRef\.current\) return;[\s\S]*?requestStoryConversation\(definitionId\)/);
  assert.match(interaction, /if \(episode && journey && orderId && openConversationMerge\)/);
  assert.doesNotMatch(interaction, /if \(props\.ftueNavigationLocked && episode && journey && orderId && openConversationMerge\)/);
  assert.match(interaction, /startMossproutJourneyActivity\(current, journey\.dayId\)[\s\S]*?openConversationMerge\(orderId, 'mossprout'\)/);
  assert.match(interaction, /openConversationMerge\(orderId, 'mossprout'\)/);
  assert.match(interaction, /onComplete: completeConversation/);
  assert.match(interaction, /skipCompletedTransition: props\.familyId === 'mossprout' && Boolean\(props\.ftueNavigationLocked\)/);
  assert.match(flow, /if \(journeyNarrative && !skipCompletedTransition\) \{[\s\S]*?onContinue\(\);[\s\S]*?onComplete\(\);/);
  const questHook = fs.readFileSync('hooks/use-kingdom-quests.ts', 'utf8');
  const completion = fs.readFileSync('game/katchimeras/action-completion.ts', 'utf8');
  assert.match(questHook, /settleMossproutConversationCompletion\(nextSession, selectedConversationDefinition\)/);
  assert.match(completion, /\[\.\.\.current\.journeyDays\]\.reverse\(\)\.find/);
  const mergeScreen = fs.readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(mergeScreen, /onPress=\{\(\) => ftueExclusive \? handleBlockedFtueInteraction\(\) : creatureId \? router\.back\(\)/);
  const provider = fs.readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  assert.match(provider, /dropDefinitionIds: mossproutCampaignOrderDrops\(journeyEpisode\)/);
});

test('Mossprout home reads Garden orders with or without the retained Merge provider', () => {
  const stage = fs.readFileSync('components/katchadeck/world/mossprout-story-stage.tsx', 'utf8');
  const provider = fs.readFileSync('features/merge-world/merge-world-provider.tsx', 'utf8');
  assert.match(stage, /useOptionalMergeWorldState/);
  assert.match(stage, /loadMergeWorldState\(\)/);
  assert.match(stage, /subscribeMergeWorldSnapshots\(adopt\)/);
  assert.match(stage, /nextState\.revision > current\.revision/);
  assert.doesNotMatch(stage, /useMergeWorldState\(\)/);
  assert.match(provider, /export function useOptionalMergeWorldState\(\)/);
});

test('Mossprout routes nature cards directly into their focused activity', () => {
  const worldPath = path.join(process.cwd(), 'components', 'katchadeck', 'world');
  const mossprout = fs.readFileSync(path.join(worldPath, 'mossprout-story-stage.tsx'), 'utf8');
  const homeModel = fs.readFileSync(path.join(process.cwd(), 'game', 'katchimeras', 'mossprout-home.ts'), 'utf8');
  const interaction = fs.readFileSync(path.join(worldPath, 'companion-interaction-sheet.tsx'), 'utf8');
  const conversations = fs.readFileSync(path.join(process.cwd(), 'constants', 'mossprout-story-conversations.ts'), 'utf8');
  const questHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  const today = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'), 'utf8');

  assert.match(homeModel, /quest-mossprout-green-photo/);
  assert.match(homeModel, /quest-mossprout-nature-note/);
  assert.match(homeModel, /kind: 'garden_request'/);
  assert.match(homeModel, /reward: \{ kind: 'coins'/);
  assert.match(mossprout, /PersistentMergeItemArt/);
  assert.match(mossprout, /journeyGardenRequest/);
  assert.match(mossprout, /visibleDefinitions\.map/);
  assert.match(homeModel, /expandRequirementDefinitionIds\(liveRequest\.requirements\)/);
  assert.doesNotMatch(mossprout, /subtitle=\{action\.subtitle/);
  assert.doesNotMatch(mossprout, /eyebrow=\{action\.progressLabel/);
  assert.match(interaction, /const alreadyActive = props\.activeQuest\?\.questId === questId;/);
  assert.match(interaction, /if \(!alreadyActive && !props\.onAccept\(questId\)\) return false;/);
  assert.match(interaction, /onRun=\{\(offerId\) =>/);
  assert.match(interaction, /destination === 'quest' && directQuestOrigin/);
  assert.match(interaction, /conversations=\{props\.mossproutActionCandidates\}/);
  assert.match(interaction, /offers=\{props\.actionOffers\}/);
  assert.match(conversations, /\.\.\.mossproutNatureQuestions/);
  assert.match(conversations, /\.\.\.mossproutPlanningConversations/);
  assert.match(questHook, /label: question\.actionTitle \?\? question\.title/);
  assert.doesNotMatch(questHook, /label: 'Mossprout has a question'/);
  assert.match(homeModel, /MOSSPROUT_DAILY_FIELD_NOTE_ACTION_ID/);
  assert.match(questHook, /selectedActionOffers:/);
  assert.match(today, /<DayActionCardSurface/);
});

test('form questionnaires gate launch companions while Katchimera Cards remain collection-only', () => {
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const kingdom = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'kingdom-companion-screen.tsx'),
    'utf8',
  );
  const questHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-kingdom-quests.ts'), 'utf8');
  const cards = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-skins-thread.tsx'), 'utf8');
  const cardHook = fs.readFileSync(path.join(process.cwd(), 'hooks', 'use-katchimera-cards.ts'), 'utf8');
  const profile = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'explore.tsx'), 'utf8');
  const progressReset = fs.readFileSync(path.join(process.cwd(), 'utils', 'reset-katchimera-progress-for-debug.ts'), 'utf8');
  const companionRoute = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'katchimera-companion-route-screen.tsx'), 'utf8');

  assert.match(questHook, /selectedIdealSkinOnboardingRequired/);
  assert.match(questHook, /session\.currentNodeId !== selectedIdealSkinDefinition\.entryNodeId/);
  assert.match(interaction, /startConversation\(\{ definitionId: idealSkinDefinitionId \}\)/);
  assert.match(interaction, /if \(!hasActiveIdealSkinQuestionnaire\) \{\s*startConversation\(\{ definitionId: idealSkinDefinitionId \}\);/);
  assert.match(interaction, /if \(!hasActiveIdealSkinQuestionnaire \|\| route\.kind === 'conversation'\) return;\s*showConversation\(\);/);
  assert.doesNotMatch(interaction, /useLayoutEffect/);
  assert.match(interaction, /setInterval\(\(\) => \{\s*startConversation\(\{ definitionId: idealSkinDefinitionId \}\);\s*\}, 250\)/);
  assert.match(questHook, /const existingExplicitSession = input\.definitionId/);
  assert.match(questHook, /if \(existingExplicitSession\) \{[\s\S]*?actionOrigin: input\.actionOrigin/);
  assert.match(interaction, /idealSkinOnboardingRequired\s*\? props\.onClose/);
  assert.match(kingdom, /const presentationKingdom = kingdom/);
  assert.doesNotMatch(kingdom, /economy\.snapshot\.activePlus \? applyWardrobeToKingdom/);
  assert.match(cards, /Each resident has one card/);
  assert.match(cards, /A new visitor will bring the first card during an early Journey Day/);
  assert.match(cards, /KatchimeraCardDeckCarousel/);
  assert.match(cardHook, /card\.owned && card\.id !== familyId/);
  assert.match(companionRoute, /if \(!isFocused \|\| !discovery\.ready\) return <View style=\{styles\.inactiveScreen\} \/>;/);
  assert.match(interaction, /if \(!props\.active \|\| !idealSkinOnboardingRequired/);
  assert.match(interaction, /selectExperienceDestination\('insight'\)/);
  assert.match(profile, /Reset Katchimeras progress/);
  assert.match(profile, /resetKatchimeraProgressForDebug\(\{ resetAt, resetDevAccess: true \}\)/);
  assert.match(progressReset, /resetDevSubscriptionSimulator\(\)/);
  assert.match(progressReset, /resetKatchimeraWardrobeForDebug\(\)/);
  assert.match(progressReset, /resetAllKatchimeraContentForDebug\(\)/);
  assert.match(progressReset, /resetAllKatchimeraBondsForDebug\(resetAt\)/);
  assert.match(progressReset, /resetCompanionQuestsForDebug\(\)/);
  assert.match(progressReset, /resetCompanionJourneysForDebug\(\)/);
  assert.match(progressReset, /resetCompanionDiscoveryForDebug\(\)/);
  assert.match(progressReset, /resetAllCompanionQuickGoalsForDebug\(\)/);
  assert.match(progressReset, /resetCompanionAchievementsForDebug\(\)/);
  assert.match(progressReset, /await resetMergeWorldStateForDebug\(resetAt\)/);
  assert.match(profile, /questionnaires and Friendship now begin from question one and level one/);
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

test('Feastle begins with authored choices before the first Merge order', () => {
  const interaction = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');
  const stage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'feastle-story-stage.tsx'), 'utf8');
  const conversation = fs.readFileSync(path.join(process.cwd(), 'constants', 'feastle-friendship-conversations.ts'), 'utf8');
  assert.match(interaction, /const beginFeastleIntroduction = useCallback/);
  assert.match(interaction, /pendingStoryConversationRef\.current = null;\s*openedStoryConversationRef\.current = null;\s*requestStoryConversation\(FEASTLE_FIRST_MEETING_DEFINITION_ID\)/);
  assert.match(interaction, /onBeginIntroduction=\{beginFeastleIntroduction\}/);
  assert.match(stage, /if \(needsBeginning\) onBeginIntroduction\(\)/);
  assert.doesNotMatch(stage, /if \(needsBeginning\) beginFeastleStory\(\)/);
  assert.match(conversation, /id: FEASTLE_FIRST_MEETING_DEFINITION_ID/);
  assert.match(conversation, /I brought a basket and one runaway spoon/);
  assert.match(conversation, /how would you like me beside you/);
  assert.doesNotMatch(conversation, /What kind of companion should Feastle be/);
  assert.match(interaction, /completedFeastleIntroductionRef/);
  assert.match(interaction, /beginFeastleStory\(\);\s*showFeastleStoryHome\(\)/);
  assert.match(interaction, /pendingStoryConversationRef/);
  assert.match(interaction, /openedStoryConversationRef/);
  assert.match(interaction, /props\.conversationSession\.status === 'active'/);
  assert.match(interaction, /openedStoryConversationRef\.current !== definitionId/);
  assert.match(interaction, /openedStoryConversationRef\.current = definitionId;\s*showConversation\(\)/);
  assert.match(interaction, /openedStoryConversationRef\.current === story\.pendingConversationId/);
  assert.match(interaction, /\{props\.name\} is finding the next page/);
  assert.doesNotMatch(interaction, /startConversation\(\{ definitionId: story\.pendingConversationId \}\);\s*showConversation\(\)/);
});

test('reward splash namespaces sibling keys independently from the reward receipt', () => {
  const splash = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'ui', 'reward-splash.tsx'), 'utf8');
  assert.match(splash, /key=\{`reward-particles:\$\{item\.id\}`\}/);
  assert.match(splash, /key=\{`reward-foreground:\$\{item\.id\}`\}/);
  assert.doesNotMatch(splash, /key=\{item\.id\}/);
  assert.doesNotMatch(splash, /<ScrollView/);
  assert.match(splash, /function BreathingRewardHero/);
  assert.match(splash, /withRepeat\(withTiming\(1\.055/);
  assert.match(splash, /function RewardConfettiPiece/);
  assert.match(splash, /withRepeat\(withSequence/);
});

test('Feastle story scenes advance contextually without a completion menu', () => {
  const interaction = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'), 'utf8');
  const scene = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-conversation-scene.tsx'), 'utf8');
  const stage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'feastle-story-stage.tsx'), 'utf8');
  const journeyStage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'journey-cohort-story-stage.tsx'), 'utf8');
  const requestTray = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-merge-request-tray.tsx'), 'utf8');
  const mergeOrderRail = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'games', 'merge-order-rail.tsx'), 'utf8');
  assert.match(interaction, /const feastleStoryFlow = Boolean/);
  assert.match(interaction, /\^feastle:friendship:\[234\]\$/);
  assert.match(interaction, /storyFinale=\{feastleStoryFinale\}/);
  assert.match(interaction, /storyFlow=\{feastleStoryFlow\}/);
  assert.match(interaction, /onStoryComplete=\{experience\.showHome\}/);
  assert.match(scene, /storyFlow && !storyFinale \? 'Opening the next chapter…'/);
  assert.doesNotMatch(scene, /StoryConversationContinuation/);
  assert.match(interaction, /onComplete: completeConversation/);
  assert.match(stage, /FEASTLE_STORY_REQUESTS\[story\.targetLevel\]/);
  assert.match(stage, /CompanionMergeRequestTray/);
  assert.match(requestTray, /PersistentMergeItemArt/);
  assert.match(requestTray, /\n\s+horizontal\n/);
  assert.match(requestTray, /styles\.rail/);
  assert.doesNotMatch(requestTray, /flexWrap: 'wrap'/);
  assert.match(requestTray, /MERGE_WORLD_UI_ART\.readyTick/);
  assert.match(mergeOrderRail, /MERGE_WORLD_UI_ART\.readyTick/);
  assert.match(journeyStage, /servedOrderIds\.includes/);
  assert.doesNotMatch(journeyStage, /\.slice\(0, 3\)/);
  assert.doesNotMatch(requestTray, /\{request\.description\}/);
  assert.match(stage, /Open all orders/);
  assert.match(stage, /\{!complete \? <Pressable/);
  assert.match(stage, />More with Feastle</);
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

  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  assert.match(interaction, /route\.kind === 'dashboard'[\s\S]*?scrollToEnd\(\{ animated: false \}\)/);
  assert.match(interaction, /onContentSizeChange=\{activeAttemptId \|\| \(route\.kind === 'dashboard' && !mossproutActionDashboard\) \? resetViewport : undefined\}/);
  assert.match(interaction, /bounces=\{!activeAttemptId && !mossproutActionDashboard\}/);
  assert.match(interaction, /overScrollMode=\{activeAttemptId \|\| mossproutActionDashboard \? 'never' : 'auto'\}/);
  assert.match(interaction, /scrollEnabled=\{!activeAttemptId && !questionnaireExperience && !mossproutActionDashboard\}/);
  assert.match(interaction, /mossproutActionDashboard && styles\.mossproutActionStageSpacer/);
  assert.match(interaction, /mossproutActionStageSpacer: \{ flex: 1, minHeight: 0 \}/);
});

test('quest offers open directly without a separate acceptance action', () => {
  const choices = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-quest-thread.tsx'),
    'utf8',
  );
  const interaction = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'world', 'companion-interaction-sheet.tsx'),
    'utf8',
  );
  const model = buildCompanionQuestViewModel({
    activeQuest: null, offer: { id: 'quest-park', title: 'A green spot', hint: 'Take a photo of a park.' },
    runtime: null, questComplete: false, captureFeedback: null, items: [], criteria: [],
  });
  assert.equal(model.mode, 'offer');
  assert.equal(model.primaryAction, undefined);
  assert.match(choices, /accessibilityRole="button"/);
  assert.match(choices, /onRun\(offer\.id\)/);
  assert.doesNotMatch(choices, /accessibilityRole="radio"|Accept \$\{offer\.title\}|>Accept</);
  assert.doesNotMatch(interaction, /Accept selected quest/);
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
  assert.match(questThread, /available to run again/);
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

test('journal flows reveal Merge Energy after capture without advertising a zero reward', () => {
  const today = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );
  const guided = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'guided-capture-sheet.tsx'),
    'utf8',
  );
  assert.match(today, /if \(journalMergeReward\.totalEnergy <= 0\) return undefined/);
  assert.match(today, /title: 'Capture this'/);
  assert.match(today, /Mossprout can remember it without turning it into game fuel/);
  assert.match(today, /const mergeEnergyAmount = !guidedCapture\.committed[\s\S]*guidedCapture\.handoff[\s\S]*journalMergeReward\?\.dailyJournalEnergy \?\? 0/);
  assert.match(today, /launchJournalRewardFromBottomAfterDismiss\(\{[\s\S]*mergeEnergyAmount: guidedCapture\.mergeEnergyAmount \?\? 0/);
  assert.match(today, /feastleJournalReward\.target === 'tomorrow' \? 'Tomorrow’s' : 'Today’s'/);
  assert.doesNotMatch(guided, /\+0/);
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

test('Mossprout action cards render semantic raster art while garden orders keep merge item art', () => {
  const stage = fs.readFileSync(path.join(process.cwd(), 'components', 'katchadeck', 'world', 'mossprout-story-stage.tsx'), 'utf8');
  assert.match(stage, /katchimeraActionArt\(action\.artKey\)/);
  assert.match(stage, /if \(!definitions\.length && art\)/);
  assert.match(stage, /if \(definitions\.length === 1\).*PersistentMergeItemArt/);

  const iconDirectory = path.join(process.cwd(), 'assets', 'images', 'katchimeras', 'action-icons', 'mossprout');
  const files = fs.readdirSync(iconDirectory).filter((file) => file.endsWith('.png'));
  assert.equal(files.length, 15);
  for (const file of files) {
    const png = fs.readFileSync(path.join(iconDirectory, file));
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', file);
    assert.equal(png.readUInt32BE(16), 256, `${file} width`);
    assert.equal(png.readUInt32BE(20), 256, `${file} height`);
    assert.equal(png[25], 6, `${file} must retain RGBA transparency`);
  }
});

test('Katchimera Bond currency uses its bespoke artwork in chips, meters, summaries, and flight tokens', () => {
  const root = process.cwd();
  const currency = fs.readFileSync(path.join(root, 'constants', 'game-currency-art.ts'), 'utf8');
  const actionCard = fs.readFileSync(path.join(root, 'components', 'katchadeck', 'ui', 'day-action-card.tsx'), 'utf8');
  const mossprout = fs.readFileSync(path.join(root, 'components', 'katchadeck', 'world', 'mossprout-story-stage.tsx'), 'utf8');
  const flight = fs.readFileSync(path.join(root, 'components', 'katchadeck', 'goals', 'bond-reward-overlay.tsx'), 'utf8');
  const bondSurfaces = [
    'companion-bond-meter.tsx',
    'companion-bond-level-up-celebration.tsx',
    'companion-quest-thread.tsx',
    'katchimera-page-header.tsx',
    'companion-visit-scene.tsx',
    'feastle-story-stage.tsx',
    'baristabbit-story-stage.tsx',
    'journey-cohort-story-stage.tsx',
  ].map((file) => fs.readFileSync(path.join(root, 'components', 'katchadeck', 'world', file), 'utf8'));

  assert.match(currency, /bond: require\('\.\.\/assets\/images\/katchimeras\/merge-world\/ui\/bond\.webp'\)/);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'images', 'katchimeras', 'merge-world', 'ui', 'bond.webp')), true);
  assert.match(actionCard, /reward\.kind === 'bond' \? GAME_CURRENCY_ART\.bond/);
  assert.match(mossprout, /reward\.kind === 'bond' \? GAME_CURRENCY_ART\.bond/);
  assert.match(flight, /<BondIconArt size=\{42\}/);
  assert.doesNotMatch(flight, /rewardLabel|\+\{points\} Bond/);
  assert.doesNotMatch(flight, /heart\.fill/);
  for (const surface of bondSurfaces) assert.match(surface, /BondIconArt/);
});
