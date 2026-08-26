import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
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
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import {
  HOME_FTUE_CAMERA_SCALE,
  HOME_FTUE_CAMERA_Y_OFFSET,
  HOME_SCENE_Y_OFFSET,
} from '@/constants/home-loop-layout';
import { Lantern } from '@/constants/theme';
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

const ATTUNEMENT_ACTION_IDS = [
  'egg.desired_feeling',
  'egg.main_difficulty',
  'egg.support_style',
] as const;

const MOSSPROUT_ENVIRONMENT_KEY = todayKatchimeraExplorationBackgroundKeyForEnvironment('mossprout') ?? 'mossprout';
const MOSSPROUT_VISUAL = getCreatureVisual('mossprout', 'grown');

const SUBJECT_HANDOFF_DURATION_MS = 420;
export function MossproutEggFtueSurface({ companionStageActive = false, onCompanionVisualReady }: {
  companionStageActive?: boolean;
  onCompanionVisualReady?: () => void;
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
  } = useEggFeedController();

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
    });
    const settleTimer = setTimeout(() => setSubjectHandoffSettled(true), duration + 34);
    return () => clearTimeout(settleTimer);
  }, [companionStageActive, reduceMotion, subjectHandoff, subjectHandoffSettled]);

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
    // Reuse Today's authored Egg size curve: start at half physical size and
    // traverse its full growth range in three equal feed-driven steps.
    const energyRatio = mossproutGroveEggEnergyRatio(answeredCount);
    const stage = Math.min(6, Math.max(0, Math.round(energyRatio * 6))) as TodayGrowthSummary['stage'];
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

  const scriptedPanelAction = useMemo<RankedTodayCareAction | null>(() => day ? ({
    id: 'ftue:mossprout-attunement',
    instanceId: `${day.isoDate}:ftue:mossprout-attunement`,
    title: 'Attune the Egg',
    description: 'Choose the answer that feels closest.',
    icon: 'sparkles',
    artKey: 'reflection',
    category: 'memory',
    completionKey: 'ftue:mossprout-attunement',
    completionMode: 'artifact',
    destination: { kind: 'reflection', promptId: 'day_focus' },
    growthSource: 'reflection',
    growthReward: TODAY_GROWTH_REWARDS.reflection,
    priority: 100,
    eligibleTimeOfDay: ['morning', 'midday', 'afternoon', 'evening'],
    journalFocused: false,
    canReplaceSkipped: false,
    aiGenerated: false,
    source: 'system',
    completed: false,
    completedAt: null,
  }) : null, [day]);

  const handleScriptedAction = useCallback((action: FtueActionDefinition) => {
    if (actionBusy) return;
    if (action.handlerId === 'discovery_hatch') {
      if (ftueRun?.stepId !== 'egg.ready') return;
      const receipt = beginFtueAction('egg.hatch');
      if (!receipt || receipt.status !== 'pending') return;
      handleDiscoveryReveal(FTUE_MOSSPROUT_CREATURE);
      return;
    }
    if (action.id === 'grove.begin_attunement') {
      commitFtueAction({ actionId: action.id, evidenceRef: 'grove:mossprout:egg-close-up' });
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
    startEggFeed(from, {
      currencyFrom: currencyFrom ?? from,
      energyAmount: reward,
      energyOnly: true,
      imageSource: GAME_CURRENCY_ART.energy,
      label: option.label,
      tint: Lantern.ember300,
    }, () => {
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
      <View style={styles.root}>
        <CompanionHomeEnvironmentStage
          backgroundKey={MOSSPROUT_ENVIRONMENT_KEY}
          creature={MOSSPROUT_VISUAL.source}
          layer="background"
          name="Mossprout"
          visualKey="mossprout"
        />
        <ActivityIndicator color="#FFF3C0" size="small" style={styles.loading} />
      </View>
    );
  }

  const scriptedActions = step?.actions.filter((action) => (
    action.presentation === 'inline_choice'
    || action.presentation === 'cta_action'
    || action.presentation === 'acknowledgement'
  )) ?? [];

  return (
    <TodayEnvironmentMotionProvider motion={environmentMotion}>
    <ExplorationEnvironmentProgressionProvider stage={0}>
      <View style={styles.root}>
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
            eggShowFace={false}
            eggSkinId="moss"
            eggTargetRef={eggTargetRef}
            environmentGesture={inactiveGesture}
            feedbackKey={eggFeedKey}
            feedExpressionKey={eggFeedLaunchKey}
            growth={growth}
            hatchPresentation={isHatching ? hatchPresentation : null}
            microcopy={null}
            onboardingFocus
            onboardingGuide={companionStageActive ? null : step?.guide ?? null}
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
            subjectHidden={subjectHandoffSettled}
          />
        </View>
        {companionStageActive && subjectHandoffSettled ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.regularSubject, { transform: [{ translateY: -regularSubjectLift }] }]}>
            <CompanionHomeEnvironmentStage
              backgroundKey={null}
              creature={MOSSPROUT_VISUAL.source}
              layer="creature"
              name="Mossprout"
              visualKey="mossprout"
            />
          </Animated.View>
        ) : null}
        {!companionStageActive ? <EggFeedOverlay
          feed={eggFeed}
          onArrive={handleEggFeedArrive}
          onEnergyTokenArrive={handleEnergyTokenArrive}
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
});
