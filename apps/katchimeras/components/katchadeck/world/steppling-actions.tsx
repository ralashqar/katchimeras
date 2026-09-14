import { CompanionGardenAction } from './companion-garden-action';
import { CompanionDailyQuestionSlot } from '@/components/katchadeck/world/companion-daily-question';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { Meadow } from '@/constants/meadow-theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useCompanionSteps } from '@/hooks/use-companion-steps';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionCardSurface, DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import { DayActionActiveRow, DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { STEPPLING_SCENARIO_POLLS } from '@/constants/steppling-scenario-polls';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { claimStepplingMilestone, nextStepplingMilestone } from '@/utils/steppling-activities';
import { localDayId } from '@/utils/world-identity';
import { type CompanionMergeRequest } from './companion-merge-request-tray';

/** Steppling's daily question is one of his scenario polls, served by the shared question slot. */
const QUESTION_SUBTITLE = 'One quick scene. The village answers too.';

/**
 * Steppling's daily cards: his step goal (his alone, until a journey chapter
 * carries it), the garden request, and the day's question from the shared
 * daily tech. A note from him takes the question's place while it lasts.
 */
export function StepplingActions({ onReaction, onOpenConversation, requests, onOpenMerge, onSubmenuChange, onStory, storyLabel, onBondRewardRequest, externalGesture, active = true }: {
  onReaction?: (text: string) => void;
  onOpenConversation?: (definitionId: string, origin: KatchimeraActionOrigin) => void;
  requests: readonly CompanionMergeRequest[]; onOpenMerge: (id?: string) => void;
  onSubmenuChange?: (open: boolean) => void; onStory?: () => void; storyLabel?: string;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
  /** Whether the cards are on screen (not behind a conversation): reward presentations wait otherwise. */
  active?: boolean;
}) {
  const { dayId, steps, refresh: syncSteps } = useCompanionSteps();
  const [bond, setBond] = useState(loadCompanionBondState);
  const relationships = useRelationshipProgression();
  const [completing, setCompleting] = useState<{ dayId: string; steps: number; bond: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const claimedSteps = useRef<number | null>(null);
  useEffect(() => subscribeCompanionBondState(() => setBond(loadCompanionBondState())), []);
  const goal = completing ?? nextStepplingMilestone(bond, dayId);
  const ready = Boolean(goal && steps >= goal.steps);
  // A presentation in flight for Steppling keeps the step goal from claiming over it.
  const presenting = relationships.actionPresentations.some((item) => item.status !== 'dismissed'
    && relationships.actionCompletions.some((completion) => completion.id === item.completionId && completion.familyId === 'steppling'));
  const art = (kind: 'movement' | 'quest' | 'reflection') => <Image source={katchimeraActionArt(`today:${kind}`)} contentFit="contain" transition={0} style={{ width: 48, height: 48 }} />;
  const note = onStory ? <DayActionActiveRow animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs + 2 * DAY_ACTION_MOTION.entryStaggerMs} disabled={Boolean(completing)} externalGesture={externalGesture} label={storyLabel ?? 'A note from Steppling'}>
    <Pressable accessibilityRole="button" accessibilityLabel={storyLabel ?? 'A note from Steppling'} disabled={Boolean(completing)} onPress={onStory}><DayActionCardSurface artwork={art('reflection')} title={storyLabel ?? 'A note from Steppling'} /></Pressable>
  </DayActionActiveRow> : undefined;
  return <CompanionGardenAction familyId="steppling" onOpenMerge={onOpenMerge} storyRequests={requests} onSubmenuChange={onSubmenuChange}>
    {(gardenCard) => <View style={{ gap: 7 }}>
    {goal ? <DayActionGoalRow key={`${completing?.dayId ?? dayId}:${goal.steps}:${attempt}`} animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs} externalGesture={externalGesture}
      label={`Walk ${goal.steps.toLocaleString()} steps today`} title={`Walk ${goal.steps.toLocaleString()} steps`}
      subtitle={ready ? `${goal.steps.toLocaleString()} steps reached · tap to celebrate` : `${steps.toLocaleString()} / ${goal.steps.toLocaleString()} steps today`}
      progress={<View accessibilityRole="progressbar" accessibilityLabel="Daily step progress" accessibilityValue={{ min: 0, max: goal.steps, now: Math.min(steps, goal.steps) }} style={{ paddingTop: 5 }}>
        <ProgressBar current={steps} total={goal.steps} color={Meadow.leaf} trackColor="rgba(101,139,81,0.18)" minimumPercent={0} />
      </View>}
      artwork={art('movement')} reward={<DayActionRewardChip reward={{ kind: 'bond', amount: goal.bond }} />}
      accessibilityHint={ready ? "Tap to claim your step reward." : "Hear how many steps remain and refresh your pedometer."}
      hideCompletionControl highlighted={ready} completeOnPress={ready} disabled={Boolean(completing) || presenting} onOpen={() => {
        const remaining = Math.max(0, goal.steps - steps);
        onReaction?.(`Not quite yet—${remaining.toLocaleString()} more ${remaining === 1 ? "step" : "steps"} to this little milestone. We can take them at your pace.`);
        void syncSteps();
      }}
      onBeginCompletion={() => setCompleting({ ...goal, dayId })}
      onCompletionRequest={(source, onArrive, onFailed) => {
        try {
          const claimedDay = completing?.dayId ?? dayId;
          const result = claimedDay === localDayId() ? claimStepplingMilestone(loadCompanionBondState(), claimedDay, goal.steps, steps) : null;
          if (result?.awarded) {
            saveCompanionBondState(result.state);
            claimedSteps.current = goal.steps;
            if (source && onBondRewardRequest && result.receipt) onBondRewardRequest(source, onArrive, result.receipt);
            else onArrive();
          } else { setCompleting(null); onFailed(); }
        } catch { onReaction?.('Your reward could not be saved. Please try again.'); setCompleting(null); onFailed(); }
      }}
      onFinished={() => {
        if (claimedSteps.current != null) {
          onReaction?.(`${claimedSteps.current.toLocaleString()} steps! Look how far those little moments carried us. I’m glad we’re finding our rhythm together.`);
          claimedSteps.current = null;
        }
        setBond(loadCompanionBondState()); setCompleting(null); setAttempt((value) => value + 1);
      }}
    /> : null}
    {gardenCard}
    <CompanionDailyQuestionSlot companion="steppling" polls={STEPPLING_SCENARIO_POLLS} subtitle={QUESTION_SUBTITLE} disabled={Boolean(completing)} active={active}
      onOpenConversation={onOpenConversation} onBondRewardRequest={onBondRewardRequest} externalGesture={externalGesture} override={note} />
  </View>}
  </CompanionGardenAction>;
}
