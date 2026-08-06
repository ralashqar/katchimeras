import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  companionQuickGoalTemplateById,
  quickGoalTemplatesForFamily,
} from '@/constants/companion-quick-goals';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import {
  recordCompanionBondEvent,
  removeCompanionBondEvent,
} from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import {
  addCompanionQuickGoal,
  cadenceFromTemplate,
  completeCompanionQuickGoal,
  markQuickGoalCompletionJournaled,
  quickGoalsForDay,
  rollCompanionQuickGoalsToDay,
  skipCompanionQuickGoal,
  snoozeCompanionQuickGoal,
  undoCompanionQuickGoal,
  updateCompanionQuickGoal,
  type CompanionQuickGoalCadence,
  type CompanionQuickGoalCompletion,
  type CompanionQuickGoalStatus,
} from '@/utils/companion-quick-goals';
import {
  loadCompanionQuickGoalState,
  saveCompanionQuickGoalState,
  subscribeCompanionQuickGoalResets,
} from '@/utils/companion-quick-goal-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';

type UseCompanionQuickGoalsArgs = {
  dayId: string | null | undefined;
  availableFamilyIds: readonly KatchimeraFamilyId[];
  onBondChanged?: () => void;
};

export type CompanionQuickGoalCompletionReceipt = {
  bondAward: {
    creatureId: string;
    familyId: KatchimeraFamilyId;
    points: number;
  } | null;
  completion: CompanionQuickGoalCompletion | null;
  newlyCompleted: boolean;
};

export function useCompanionQuickGoals({
  dayId,
  availableFamilyIds,
  onBondChanged,
}: UseCompanionQuickGoalsArgs) {
  const [state, setState] = useState(() => {
    const loaded = loadCompanionQuickGoalState();
    if (!dayId) return loaded;
    const rolled = rollCompanionQuickGoalsToDay(loaded, dayId);
    if (rolled !== loaded) saveCompanionQuickGoalState(rolled);
    return rolled;
  });

  const refresh = useCallback(() => {
    const loaded = loadCompanionQuickGoalState();
    if (!dayId) {
      setState(loaded);
      return;
    }
    const rolled = rollCompanionQuickGoalsToDay(loaded, dayId);
    if (rolled !== loaded) saveCompanionQuickGoalState(rolled);
    setState(rolled);
  }, [dayId]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  useEffect(
    () => subscribeCompanionQuickGoalResets(refresh),
    [refresh]
  );

  useEffect(() => {
    if (!dayId) return;
    setState((current) => {
      const rolled = rollCompanionQuickGoalsToDay(current, dayId);
      if (rolled === current) return current;
      saveCompanionQuickGoalState(rolled);
      return rolled;
    });
  }, [dayId]);

  const availableFamilySet = useMemo(
    () => new Set(availableFamilyIds),
    [availableFamilyIds]
  );
  const goalsForToday = useMemo(
    () => dayId
      ? quickGoalsForDay(state, dayId).filter((item) => availableFamilySet.has(item.goal.familyId))
      : [],
    [availableFamilySet, dayId, state]
  );

  const commit = useCallback((next: typeof state) => {
    saveCompanionQuickGoalState(next);
    setState(next);
  }, []);

  const addTemplate = useCallback((templateId: string) => {
    if (!dayId) return { added: false, reason: 'missing_day' as const };
    const template = companionQuickGoalTemplateById.get(templateId);
    if (!template || !availableFamilySet.has(template.familyId)) {
      return { added: false, reason: 'invalid_template' as const };
    }
    const current = rollCompanionQuickGoalsToDay(state, dayId);
    const result = addCompanionQuickGoal(current, {
      familyId: template.familyId,
      templateId: template.id,
      title: template.title,
      cadence: cadenceFromTemplate(template, dayId),
    });
    if (!result.goal) return { added: false, reason: result.reason };
    commit(result.state);
    return { added: true, reason: null };
  }, [availableFamilySet, commit, dayId, state]);

  const addTemplates = useCallback((templateIds: readonly string[]) => {
    if (!dayId) return [];
    let next = rollCompanionQuickGoalsToDay(state, dayId);
    const addedTemplateIds: string[] = [];
    const startedAt = Date.now();
    for (const [index, templateId] of templateIds.entries()) {
      const template = companionQuickGoalTemplateById.get(templateId);
      if (!template || !availableFamilySet.has(template.familyId)) continue;
      const result = addCompanionQuickGoal(next, {
        familyId: template.familyId,
        templateId: template.id,
        title: template.title,
        cadence: cadenceFromTemplate(template, dayId),
      }, startedAt + index);
      if (!result.goal) continue;
      next = result.state;
      addedTemplateIds.push(template.id);
    }
    if (next !== state) commit(next);
    return addedTemplateIds;
  }, [availableFamilySet, commit, dayId, state]);

  const addCustom = useCallback((
    familyId: KatchimeraFamilyId,
    title: string,
    cadence: CompanionQuickGoalCadence
  ) => {
    if (!dayId) return { added: false, reason: 'missing_day' as const };
    if (!availableFamilySet.has(familyId)) return { added: false, reason: 'invalid_family' as const };
    const current = rollCompanionQuickGoalsToDay(state, dayId);
    const result = addCompanionQuickGoal(current, { familyId, title, cadence });
    if (!result.goal) return { added: false, reason: result.reason };
    commit(result.state);
    return { added: true, reason: null };
  }, [availableFamilySet, commit, dayId, state]);

  const editGoal = useCallback((
    goalId: string,
    updates: {
      title?: string;
      cadence?: CompanionQuickGoalCadence;
      status?: CompanionQuickGoalStatus;
    }
  ) => {
    const next = updateCompanionQuickGoal(state, goalId, updates);
    if (next !== state) commit(next);
  }, [commit, state]);

  const completeGoal = useCallback((goalId: string): CompanionQuickGoalCompletionReceipt => {
    if (!dayId) return { bondAward: null, completion: null, newlyCompleted: false };
    const result = completeCompanionQuickGoal(state, goalId, dayId);
    if (!result.completed || !result.completion) {
      return { bondAward: null, completion: result.completion, newlyCompleted: false };
    }
    commit(result.state);

    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const awarded = recordCompanionBondEvent(bondState, {
      id: `quick-goal-daily:${companionIdForFamily(result.completion.familyId)}:${result.completion.dayId}`,
      creatureId: companionIdForFamily(result.completion.familyId),
      kind: 'quick_goal_completed',
      occurredAt: result.completion.completedAt,
      dayId: result.completion.dayId,
    });
    if (awarded.awarded) saveCompanionBondState(awarded.state);
    onBondChanged?.();
    return {
      bondAward: awarded.awarded
        ? {
            creatureId: companionIdForFamily(result.completion.familyId),
            familyId: result.completion.familyId,
            points: awarded.points,
          }
        : null,
      completion: result.completion,
      newlyCompleted: true,
    };
  }, [commit, dayId, onBondChanged, state]);

  const undoGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = undoCompanionQuickGoal(state, goalId, dayId);
    if (!result.undone || !result.completion) return false;
    commit(result.state);

    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const anotherCompletionRemains = result.state.completions.some((completion) =>
      completion.familyId === result.completion!.familyId
      && completion.dayId === result.completion!.dayId
    );
    const removed = anotherCompletionRemains
      ? { state: bondState, removed: false, points: 0 }
      : removeCompanionBondEvent(
          bondState,
          `quick-goal-daily:${companionIdForFamily(result.completion.familyId)}:${result.completion.dayId}`
        );
    if (removed.removed) saveCompanionBondState(removed.state);
    onBondChanged?.();
    return true;
  }, [commit, dayId, onBondChanged, state]);

  const snoozeGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = snoozeCompanionQuickGoal(state, goalId, dayId);
    if (!result.snoozed) return false;
    commit(result.state);
    return true;
  }, [commit, dayId, state]);

  const skipGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = skipCompanionQuickGoal(state, goalId, dayId);
    if (!result.skipped) return false;
    commit(result.state);
    return true;
  }, [commit, dayId, state]);

  const markJournaled = useCallback((completionId: string) => {
    const next = markQuickGoalCompletionJournaled(state, completionId);
    if (next !== state) commit(next);
  }, [commit, state]);

  return {
    state,
    goalsForToday,
    templatesForFamily: quickGoalTemplatesForFamily,
    addTemplate,
    addTemplates,
    addCustom,
    editGoal,
    completeGoal,
    undoGoal,
    snoozeGoal,
    skipGoal,
    markJournaled,
    refresh,
  };
}
