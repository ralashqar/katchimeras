import { acknowledgeKatchimeraActionCompletion, mossproutJourneyRuntimeDayId, mossproutDailyActionDeck, recordHandledKatchimeraActionCompletion } from '@/game/katchimeras/relationship-progression';
import { useEffect, useState, useRef } from 'react';
import { Image } from 'expo-image';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { localDayId } from '@/utils/world-identity';
import { DayActionRewardChip } from '@/components/katchadeck/ui/day-action-card';
import { DayActionGoalRow } from '@/components/katchadeck/ui/day-action-goal-row';
import type { DayActionSourceRect } from '@/components/katchadeck/ui/day-action-row';
import { katchimeraActionArt } from '@/constants/katchimera-action-art';
import { COMPANION_BOND_REWARDS } from '@/utils/companion-bond';
import { useCompanionCalendarDay } from '@/hooks/use-companion-calendar-day';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { addCompanionQuickGoal, updateCompanionQuickGoal } from '@/utils/companion-quick-goals';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { settleCompanionWaterBreak } from '@/game/katchimeras/companion-journey-cycle';

const families = ['mossprout'] as const;
type WaterActionProps = {
  enteringEnabled?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onBondRewardRequest?: (source: DayActionSourceRect, onArrive: () => void) => void;
  onError: (message: string) => void;
};
const countKey = (dayId: string) => `companion:water-count:${dayId}`;
function savedCount(dayId: string) {
  const count = getStoredJson<number>(countKey(dayId), 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}
export function MossproutWaterAction(props: WaterActionProps) {
  const dayId = useCompanionCalendarDay();
  return <WaterDayAction key={dayId} {...props} dayId={dayId} />;
}
function WaterDayAction({ onBondRewardRequest, onError, dayId, enteringEnabled = true, disabled = false, onBusyChange }: WaterActionProps & { dayId: string }) {
  const goals = useCompanionQuickGoals({ dayId, availableFamilyIds: families });
  const goal = goals.state.goals.find((item) => item.templateId === 'mossprout:drink-water' && item.status !== 'archived');
  const completion = goals.state.completions.find((item) => item.goalId === goal?.id && item.dayId === dayId);
  // Freeze the visible count until the outgoing row and reward flight finish.
  const [count, setCount] = useState(() => Math.max(savedCount(dayId), completion ? 1 : 0));
  const initialCount = useRef(count);
  useEffect(() => {
    if (!completion) return;
    relationshipProgressionRepository.update((state) => settleCompanionWaterBreak(state, completion.goalId, completion.id, completion.completedAt));
  }, [completion]);
  const art = <Image source={katchimeraActionArt('today:reflection')} contentFit="contain" style={{ width: 48, height: 48 }} />;
  return <DayActionGoalRow disabled={disabled} onBeginCompletion={() => onBusyChange?.(true)} enteringEnabled={enteringEnabled || count !== initialCount.current} animateLayout entryDelayMs={0} key={`${dayId}:${count}`} label="Log a glass of water" title="Log a glass of water"
      subtitle={count ? `${count} ${count === 1 ? 'glass' : 'glasses'} logged today` : 'Tap after you’ve had some water'} artwork={art}
      reward={count === 0 ? <DayActionRewardChip reward={{ kind: 'bond', amount: COMPANION_BOND_REWARDS.quick_goal_completed }} /> : undefined}
      completeOnPress hideCompletionControl onOpen={(finish) => finish()}
      onCompletionRequest={(source, onArrive, onFailed) => {
        try {
          if (dayId !== localDayId()) { onFailed(); onBusyChange?.(false); return; }
          let id = goal?.id;
          if (!id) {
            const result = addCompanionQuickGoal(loadCompanionQuickGoalState(), { familyId: 'mossprout', templateId: 'mossprout:drink-water', title: 'Drink a glass of water', cadence: { kind: 'daily' } });
            if (!result.goal) throw new Error('Water habit unavailable');
            saveCompanionQuickGoalState(result.state); id = result.goal.id;
          }
          if (goal && goal.status !== 'active') saveCompanionQuickGoalState(updateCompanionQuickGoal(loadCompanionQuickGoalState(), goal.id, { status: 'active', cadence: { kind: 'daily' } }));
          const result = goals.completeGoal(id);
          if (!result.completion) throw new Error('Water break could not be saved');
          relationshipProgressionRepository.update((state) => {
            state = settleCompanionWaterBreak(state, id!, result.completion!.id, result.completion!.completedAt);
            const actionDay = mossproutJourneyRuntimeDayId(state, dayId);
            const actionId = `mossprout:goal:${id}`;
            const existing = state.actionCompletions.find((item) => item.dayId === actionDay && item.actionId === actionId);
            if (existing) return acknowledgeKatchimeraActionCompletion(state, existing.id, result.completion!.completedAt);
            const sequence = mossproutDailyActionDeck(state, actionDay).slotSequences.together;
            return recordHandledKatchimeraActionCompletion(state, { dayId: actionDay, familyId: 'mossprout', actionId,
              instanceId: `${actionDay}:together:${sequence}:${actionId}`, slotId: 'together', sequence, kind: 'goal_checkoff',
              title: 'Take a water break', subtitle: 'A little care for you', icon: 'heart.fill', artworkDefinitionIds: [],
              reward: { kind: 'bond', amount: COMPANION_BOND_REWARDS.quick_goal_completed }, completedAt: result.completion!.completedAt });
          });
          setStoredJson(countKey(dayId), Math.max(savedCount(dayId), count + 1));
          if (source && result.bondAward && onBondRewardRequest) onBondRewardRequest(source, onArrive); else onArrive();
        } catch { onFailed(); onBusyChange?.(false); onError('Your water break could not be saved. Shall we try again?'); }
      }} onFinished={() => { setCount(savedCount(dayId)); goals.refresh(); onBusyChange?.(false); }} />;
}
