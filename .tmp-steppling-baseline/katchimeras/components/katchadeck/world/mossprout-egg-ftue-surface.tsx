import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { eggQuestionAction } from '@/features/onboarding/egg-question-action';
import { eggBondFeedPayload } from '@/features/today/egg-bond-feed';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { ExplorationEnvironmentProgressionProvider } from '@/components/katchadeck/home/exploration-environment-progression-context';
import {
  TodayEnvironmentMotionProvider,
  useTodayEnvironmentMotion,
} from '@/components/katchadeck/home/today-environment-motion';
import { TodayNurtureExperience } from '@/components/katchadeck/home/today-nurture-experience';
import {
  HOME_FTUE_CAMERA_SCALE,
  HOME_FTUE_CAMERA_Y_OFFSET,
  HOME_SCENE_Y_OFFSET,
} from '@/constants/home-loop-layout';
import todayScene from '@/data/today-scene.json';
import {
  mossproutGroveEggCameraDuration,
  mossproutGroveEggCameraPanTarget,
  mossproutGroveEggCameraPinchTarget,
  mossproutGroveEggEnergyRatio,
} from '@/features/onboarding/ftue-home-camera';
import { beginFtueAction, commitFtueAction, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { FTUE_MOSSPROUT_CREATURE } from '@/features/onboarding/mossprout-ftue-creature';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { recordMossproutOnboardingAnswer } from '@/features/onboarding/mossprout-profile';
import { useTodayHatchRevealController } from '@/features/today/use-today-hatch-reveal-controller';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import { getCreatureVisual } from '@/game/days';
import { useAllDays } from '@/hooks/use-all-days';
import type { FtueActionDefinition, FtueChoiceOption } from '@/features/onboarding/ftue-types';
import type { RankedTodayCareAction } from '@/utils/today-care';
import {
  companionDestinationStageLift,
  companionFtueSubjectHandoffLayout,
  companionHomeStageLayout,
} from '@/utils/companion-home-layout';
import { todayGrowthSummary, TODAY_GROWTH_REWARDS, type TodayGrowthSummary } from '@/utils/today-growth';
import { todayKatchimeraExplorationBackgroundKeyForEnvironment } from '@/utils/today-exploration-backgrounds';

import { CompanionHomeEnvironmentStage } from './companion-home-environment-stage';
import type { WorldFtueSubjectPresentation } from './world-ftue-subject-presentation';

const ATTUNEMENT_ACTION_IDS = [
  'egg.day_texture',
  'egg.desired_help',
] as const;

const MOSSPROUT_ENVIRONMENT_KEY = todayKatchimeraExplorationBackgroundKeyForEnvironment('mossprout') ?? 'mossprout';
const MOSSPROUT_VISUAL = getCreatureVisual('mossprout', 'grown');

const SUBJECT_HANDOFF_DURATION_MS = 420;
export function MossproutEggFtueSurface({ companionStageActive = false, onCompanionVisualReady, onWorldSubjectPresentationChange, rewardPulseKey = 0, worldEggTargetRef, worldHosted = false }: {
  companionStageActive?: boolean;
  onCompanionVisualReady?: () => void;
  onWorldSubjectPresentationChange?: (presentation: WorldFtueSubjectPresentation | null) => void;
  rewardPulseKey?: number;
  worldEggTargetRef?: RefObject<ViewType | null>;
  worldHosted?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const ftueRun = useFtueRun();
  const { days } = useAllDays({ refreshOnFocus: false });
  const storedDay = useMemo(() => days.find((day) => day.isToday) ?? days.at(-1) ?? null, [days]);
  const day = useMemo(() => storedDay ? { ...storedDay, canHatch: false } : null, [storedDay]);
  const step = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const stepId = step?.id ?? null;
  const [actionBusy, setActionBusy] = useState(false);
  // A direct relaunch into Companion has no live hatch subject to preserve.
  // Start settled in that case. A live Egg -> Companion transition moves the
  // retained hatch subject to the exact Grove frame, then exchanges renderer
  // ownership in one commit so two animated Mossprouts never overlap.
  const [subjectHandoffSettled, setSubjectHandoffSettled] = useState(companionStageActive);
  const subjectHandoff = useSharedValue(companionStageActive ? 1 : 0);
  const sceneTranslateX = useSharedValue(0);
  const inactiveGesture = useMemo(() => Gesture.Tap().enabled(false), []);
  const groveCameraScale = mossproutGroveEggCameraPinchTarget(
    stepId,
    todayScene.homeEnvironment.motion.maxPinchScale,
  );
  const regularStageLayout = companionHomeStageLayout(windowWidth, windowHeight, 'mossprout');
  const regularSubjectLift = companionDestinationStageLift(windowHeight, windowWidth);
  const subjectHandoffLayout = companionFtueSubjectHandoffLayout(
    windowWidth,
    windowHeight,
    'mossprout',
  );
  const baseSceneSize = Math.max(windowHeight, windowWidth);
  const sceneHandoffScale = regularStageLayout.backgroundImageSize
    / baseSceneSize
    / HOME_FTUE_CAMERA_SCALE;
  const openingSceneCenterOffset = HOME_SCENE_Y_OFFSET * HOME_FTUE_CAMERA_SCALE
    + HOME_FTUE_CAMERA_Y_OFFSET;
  const regularSceneCenterOffset = regularStageLayout.translateY - regularSubjectLift;
  const sceneHandoffTranslateY = regularSceneCenterOffset
    - openingSceneCenterOffset * sceneHandoffScale;
  const { environmentMotion } = useTodayEnvironmentMotion({
    enabled: true,
    hoverEnabled: false,
    maxPinchScale: todayScene.homeEnvironment.motion.maxPinchScale,
    scriptedPinchDurationMs: mossproutGroveEggCameraDuration(stepId),
    scriptedPinchScale: groveCameraScale,
  });
  const {
    eggFeed,
    eggFeedKey,
    eggFeedLaunchKey,
    eggTargetRef,
    startEggFeed,
    handleEggFeedArrive,
    handleEnergyTokenArrive,
    handleMergeEnergyTokenArrive,
    pulseEgg,
  } = useEggFeedController(worldHosted ? worldEggTargetRef : undefined);
  const handleFtueEnergyTokenArrive = useCallback((amount: number, index: number, count: number) => {
    handleEnergyTokenArrive(amount, index, count);
    // Drive the retained world-map Egg from the actual final token landing.
    // This is the same feedbackKey path used by the original screen-space Egg,
    // without depending on a later global-store publication after the FTUE
    // step has already committed.
    if (worldHosted && index === count - 1) pulseEgg();
  }, [handleEnergyTokenArrive, pulseEgg, worldHosted]);
  const completeSubjectHandoff = useCallback(() => {
    setSubjectHandoffSettled(true);
  }, []);

  useEffect(() => {
    cancelAnimation(subjectHandoff);
    if (!companionStageActive) {
      subjectHandoff.value = 0;
      setSubjectHandoffSettled(false);
      return;
    }
    if (subjectHandoff.value >= 1 && subjectHandoffSettled) return;
    setSubjectHandoffSettled(false);
    const duration = reduceMotion ? 80 : SUBJECT_HANDOFF_DURATION_MS;
    subjectHandoff.value = withTiming(1, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      // Renderer ownership must follow the UI-thread terminal frame. A JS
      // timeout can beat a delayed animation under load and expose a small
      // near-final-to-final position snap.
      if (finished) runOnJS(completeSubjectHandoff)();
    });
    return () => cancelAnimation(subjectHandoff);
  }, [companionStageActive, completeSubjectHandoff, reduceMotion, subjectHandoff, subjectHandoffSettled]);

  useEffect(() => {
    if (companionStageActive && subjectHandoffSettled) onCompanionVisualReady?.();
  }, [companionStageActive, onCompanionVisualReady, subjectHandoffSettled]);

  const completeDiscoveryHatch = useCallback(() => {
    commitFtueAction({ actionId: 'egg.hatch', evidenceRef: 'discovery-hatch:mossprout-grove' });
  }, []);
  const {
    isHatching,
    presentation: hatchPresentation,
    handleDiscoveryReveal,
    handleHatchSubjectError,
    handleHatchSubjectReady,
  } = useTodayHatchRevealController({
    selectedDay: day,
    triggerHatchIfReady: async () => ({ status: 'not_ready' }),
    allowDailyHatch: false,
    onDiscoveryAnimationComplete: completeDiscoveryHatch,
  });

  const answeredCount = ATTUNEMENT_ACTION_IDS.filter((actionId) => Boolean(ftueRun?.answers[actionId])).length;
  const growth = useMemo<TodayGrowthSummary | null>(() => {
    if (!day) return null;
    const base = todayGrowthSummary(day, 0);
    // Reuse Today's authored Egg size curve with a dedicated two-answer FTUE
    // mapping, so both answers produce a visible step before Hatch.
    const energyRatio = mossproutGroveEggEnergyRatio(answeredCount);
    const stage = Math.min(2, Math.max(0, answeredCount)) as TodayGrowthSummary['stage'];
    return {
      ...base,
      activeEnergy: Math.round(base.energyTarget * energyRatio),
      energyRatio,
      progress: energyRatio * 100,
      stage,
      isActivated: true,
      isReady: step?.id === 'egg.ready',
    };
  }, [answeredCount, day, step?.id]);

  const worldSubjectPresentation = useMemo<WorldFtueSubjectPresentation | null>(() => (
    worldHosted && growth ? {
      companionVisible: companionStageActive,
      feedbackKey: eggFeedKey,
      feedExpressionKey: eggFeedLaunchKey,
      growthProgress: growth.energyRatio,
      growthStage: growth.stage,
      hatchPresentation: isHatching ? hatchPresentation : null,
      onHatchAssetsError: handleHatchSubjectError,
      onHatchAssetsReady: handleHatchSubjectReady,
      // Match the original Egg hero: its readiness rays and reminder pulse
      // yield to the dedicated crack/reveal effects as soon as Hatch begins.
      readyToHatch: growth.isReady && !isHatching,
      rewardPulseKey,
    } : null
  ), [
    companionStageActive,
    eggFeedKey,
    eggFeedLaunchKey,
    growth,
    handleHatchSubjectError,
    handleHatchSubjectReady,
    hatchPresentation,
    isHatching,
    rewardPulseKey,
    worldHosted,
  ]);
  useEffect(() => {
    onWorldSubjectPresentationChange?.(worldSubjectPresentation);
  }, [onWorldSubjectPresentationChange, worldSubjectPresentation]);
  useEffect(() => () => onWorldSubjectPresentationChange?.(null), [onWorldSubjectPresentationChange]);

  const scriptedPanelAction = useMemo<RankedTodayCareAction | null>(() => day ? eggQuestionAction(
    'ftue:mossprout-attunement', 'Attune the Egg', TODAY_GROWTH_REWARDS.reflection, day.isoDate,
  ) : null, [day]);

  const handleScriptedAction = useCallback((action: FtueActionDefinition) => {
    if (actionBusy) return;
    if (action.handlerId === 'discovery_hatch') {
      if (ftueRun?.stepId !== 'egg.ready') return;
      const receipt = beginFtueAction('egg.hatch');
      if (!receipt || receipt.status !== 'pending') return;
      handleDiscoveryReveal(FTUE_MOSSPROUT_CREATURE);
      return;
    }
  }, [actionBusy, ftueRun?.stepId, handleDiscoveryReveal]);

  const handleScriptedChoice = useCallback((
    action: FtueActionDefinition,
    option: FtueChoiceOption,
    from: { x: number; y: number; w: number; h: number },
    currencyFrom?: { x: number; y: number; w: number; h: number },
  ) => {
    if (actionBusy || !action.promptKind || !action.growthSource) return;
    const receipt = beginFtueAction(action.id);
    if (!receipt || receipt.status !== 'pending') return;
    setActionBusy(true);
    const reward = action.growthReward ?? TODAY_GROWTH_REWARDS.reflection;
    startEggFeed(from, eggBondFeedPayload(reward, currencyFrom ?? from, option.label), () => {
      recordMossproutOnboardingAnswer(action.id, option.id);
      commitFtueAction({
        actionId: action.id,
        optionId: option.id,
        optionLabel: option.label,
        evidenceRef: `attunement:${action.id}:${option.id}`,
        nextStepId: option.nextStepId,
      });
      setActionBusy(false);
    });
  }, [actionBusy, startEggFeed]);

  if (!day || !growth) {
    return (
      <View style={[styles.root, worldHosted && styles.worldHostedRoot]}>
        {!worldHosted ? <CompanionHomeEnvironmentStage
          backgroundKey={MOSSPROUT_ENVIRONMENT_KEY}
          creature={MOSSPROUT_VISUAL.source}
          layer="background"
          name="Mossprout"
          visualKey="mossprout"
        /> : null}
        <ActivityIndicator color="#FFF3C0" size="small" style={styles.loading} />
      </View>
    );
  }

  // The opening world message is a timed camera beat, not an interactive
  // action. Its acknowledgement exists only so the FTUE runtime can commit the
  // automatic handoff after the camera settles.
  const scriptedActions = stepId === 'world.egg_intro'
    ? []
    : step?.actions.filter((action) => (
      action.presentation === 'inline_choice'
      || action.presentation === 'cta_action'
      || action.presentation === 'acknowledgement'
    )) ?? [];

  return (
    <TodayEnvironmentMotionProvider motion={environmentMotion}>
    <ExplorationEnvironmentProgressionProvider stage={0}>
      <View style={[styles.root, worldHosted && styles.worldHostedRoot]}>
        <View style={styles.eggStage}>
          <TodayNurtureExperience
            actionListHidden={isHatching || companionStageActive}
            actionListLocked={actionBusy}
            actionTransitionActive={actionBusy}
            actions={[]}
            bottomInset={insets.bottom}
            careSwipeExternalGesture={inactiveGesture}
            completionEvent={null}
            day={day}
            eggShowFace
            eggSkinId="moss"
            eggTargetRef={eggTargetRef}
            environmentGesture={inactiveGesture}
            environmentContent={worldHosted ? <View /> : undefined}
            feedbackKey={eggFeedKey}
            feedExpressionKey={eggFeedLaunchKey}
            growth={growth}
            hatchPresentation={isHatching ? hatchPresentation : null}
            microcopy={null}
            onboardingFocus
            onboardingGuide={
              companionStageActive || (worldHosted && stepId === 'world.egg_intro')
                ? null
                : step?.guide ?? null
            }
            onboardingCameraDurationMs={mossproutGroveEggCameraDuration(stepId)}
            onboardingCameraPanY={mossproutGroveEggCameraPanTarget(stepId)}
            onboardingUiVisible={!companionStageActive}
            onAddJournal={() => {}}
            onAddPhoto={() => {}}
            onAddTextNote={() => {}}
            onCareNotToday={() => {}}
            onCareStart={() => {}}
            onChooseMood={() => {}}
            onChooseSleep={() => {}}
            onCompleteQuickGoal={() => ({ bondAward: null, completion: null, newlyCompleted: false })}
            onCompletionAnimationEnd={(_eventId, handoff) => handoff?.()}
            onHatchAssetsError={handleHatchSubjectError}
            onHatchAssetsReady={handleHatchSubjectReady}
            onOpenQuickGoal={() => {}}
            onReveal={() => {}}
            onRewardFlight={(_from, _action, onArrive) => onArrive()}
            onScriptedAction={handleScriptedAction}
            onScriptedChoice={handleScriptedChoice}
            onSelectDay={() => {}}
            onYesterdayStepEnergyPanelFinished={() => {}}
            sceneEnvironmentStage={0}
            sceneHandoffProgress={subjectHandoff}
            sceneHandoffScale={sceneHandoffScale}
            sceneHandoffTranslateY={sceneHandoffTranslateY}
            sceneId="mossprout"
            sceneOnly={companionStageActive}
            sceneTranslateX={sceneTranslateX}
            scriptedActions={scriptedActions}
            scriptedPanelCareAction={scriptedPanelAction}
            timelineDays={[day]}
            topInset={insets.top}
            subjectHandoffProgress={subjectHandoff}
            subjectHandoffFades={false}
            subjectHandoffScale={subjectHandoffLayout.outgoingEndScale}
            subjectHandoffTranslateY={subjectHandoffLayout.outgoingEndTranslateY}
            subjectHidden={worldHosted || subjectHandoffSettled}
            transparentBackground={worldHosted}
          />
        </View>
        {!worldHosted && companionStageActive && subjectHandoffSettled ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.regularSubject, {
              transform: [{
                translateY: -regularSubjectLift + subjectHandoffLayout.interactionCreatureDrop,
              }],
            }]}>
            <CompanionHomeEnvironmentStage
              backgroundKey={null}
              creature={MOSSPROUT_VISUAL.source}
              layer="creature"
              name="Mossprout"
              rewardPulseKey={rewardPulseKey}
              visualKey="mossprout"
            />
          </Animated.View>
        ) : null}
        {!companionStageActive ? <EggFeedOverlay
          feed={eggFeed}
          onArrive={handleEggFeedArrive}
          onEnergyTokenArrive={handleFtueEnergyTokenArrive}
          onMergeEnergyTokenArrive={handleMergeEnergyTokenArrive}
        /> : null}
      </View>
    </ExplorationEnvironmentProgressionProvider>
    </TodayEnvironmentMotionProvider>
  );
}

const styles = StyleSheet.create({
  eggStage: { ...StyleSheet.absoluteFillObject },
  loading: { left: 0, position: 'absolute', right: 0, top: '48%' },
  // TodayNurtureExperience owns zIndex 40. The replacement creature must sit
  // above that persistent background after the hatch subject is retired.
  regularSubject: { ...StyleSheet.absoluteFillObject, zIndex: 41 },
  root: { backgroundColor: '#7DB8DD', flex: 1 },
  worldHostedRoot: { backgroundColor: 'transparent' },
});
