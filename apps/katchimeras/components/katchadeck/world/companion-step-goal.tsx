import { resolveContentLine } from '@/utils/content-predicate';
import type { ContentLine } from '@/types/content-predicate';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { Meadow } from '@/constants/meadow-theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useCompanionSteps } from '@/hooks/use-companion-steps';
import type { GestureType } from 'react-native-gesture-handler';
import { DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import { DAY_ACTION_MOTION, type DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import type { CompanionStepGoalConfig } from '@/types/companion-daily';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { claimStepMilestone, nextStepMilestone } from '@/utils/companion-step-milestones';
import { localDayId } from '@/utils/world-identity';

/**
 * A friend's daily step goal, from their daily config: the day's next
 * milestone with the pedometer's count against it, claimed with a tap once
 * reached, the Bond flying to the meter. Nothing here knows which friend it
 * is drawing; the milestones and the lines are theirs.
 */
export function CompanionStepGoal({ companion, config, onReaction, onBondRewardRequest, externalGesture, disabled = false }: {
  companion: string; config: CompanionStepGoalConfig;
  onReaction?: (text: string | null) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void, receipt?: CompanionBondAwardReceipt) => void;
  externalGesture?: GestureType;
  disabled?: boolean;
}) {
  const { dayId, steps, refresh: syncSteps } = useCompanionSteps();
  const [bond, setBond] = useState(loadCompanionBondState);
  const relationships = useRelationshipProgression();
  const [completing, setCompleting] = useState<{ dayId: string; steps: number; bond: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const claimedSteps = useRef<number | null>(null);
  useEffect(() => subscribeCompanionBondState(() => setBond(loadCompanionBondState())), []);
  const goal = completing ?? nextStepMilestone(companion, config.milestones, bond, dayId);
  const ready = Boolean(goal && steps >= goal.steps);
  // A presentation in flight for this friend keeps the step goal from claiming over it.
  const presenting = relationships.actionPresentations.some((item) => item.status !== 'dismissed'
    && relationships.actionCompletions.some((completion) => completion.id === item.completionId && completion.familyId === companion));
  if (!goal) return null;
  return <DayActionGoalRow key={`${completing?.dayId ?? dayId}:${goal.steps}:${attempt}`} animateLayout entryDelayMs={DAY_ACTION_MOTION.entryBaseDelayMs} externalGesture={externalGesture}
    label={`Walk ${goal.steps.toLocaleString()} steps today`} title={`Walk ${goal.steps.toLocaleString()} steps`}
    subtitle={ready ? `${goal.steps.toLocaleString()} steps reached · tap to celebrate` : `${steps.toLocaleString()} / ${goal.steps.toLocaleString()} steps today`}
    progress={<View accessibilityRole="progressbar" accessibilityLabel="Daily step progress" accessibilityValue={{ min: 0, max: goal.steps, now: Math.min(steps, goal.steps) }} style={{ paddingTop: 5 }}>
      <ProgressBar current={steps} total={goal.steps} color={Meadow.leaf} trackColor="rgba(101,139,81,0.18)" minimumPercent={0} />
    </View>}
    artwork={<Image source={katchimeraActionArt('today:movement')} contentFit="contain" transition={0} style={{ width: 48, height: 48 }} />}
    reward={<DayActionRewardChip reward={{ kind: 'bond', amount: goal.bond }} />}
    accessibilityHint={ready ? 'Tap to claim your step reward.' : 'Hear how many steps remain and refresh your pedometer.'}
    hideCompletionControl highlighted={ready} completeOnPress={ready} disabled={disabled || Boolean(completing) || presenting} onOpen={() => {
      onReaction?.(stepLine(config.lines.remaining, Math.max(0, goal.steps - steps)));
      void syncSteps();
    }}
    onBeginCompletion={() => setCompleting({ ...goal, dayId })}
    onCompletionRequest={(source, onArrive, onFailed) => {
      try {
        const claimedDay = completing?.dayId ?? dayId;
        const result = claimedDay === localDayId() ? claimStepMilestone(companion, config.milestones, loadCompanionBondState(), claimedDay, goal.steps, steps) : null;
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
        onReaction?.(stepLine(config.lines.claimed, claimedSteps.current));
        claimedSteps.current = null;
      }
      setBond(loadCompanionBondState()); setCompleting(null); setAttempt((value) => value + 1);
    }}
  />;
}

/** A step line from its count: `{{steps}}` and `{{steps|plural:step,steps}}`. */
function stepLine(line: ContentLine<number>, steps: number): string {
  return resolveContentLine(line, steps, () => ({ steps }));
}
