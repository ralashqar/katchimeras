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
  const awardGoalCreation = useCallback((familyId: KatchimeraFamilyId) => {
    if (!dayId) return;
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const creatureId = companionIdForFamily(familyId);
    const result = recordCompanionBondEvent(bondState, {
      id: `goal-created-daily:${creatureId}:${dayId}`,
      creatureId,
      kind: 'goal_created',
      occurredAt: Date.now(),
      dayId,
    }, { queueCelebration: true });
    if (result.awarded) saveCompanionBondState(result.state);
    onBondChanged?.();
  }, [dayId, onBondChanged]);

  const addTemplate = useCallback((templateId: string) => {
    if (!dayId) return { added: false, reason: 'missing_day' as const };
    const template = companionQuickGoalTemplateById.get(templateId);
    if (!template || !availableFamilySet.has(template.familyId)) {
      return { added: false, reason: 'invalid_template' as const };
    }
    const current = rollCompanionQuickGoalsToDay(loadCompanionQuickGoalState(), dayId);
    const result = addCompanionQuickGoal(current, {
      familyId: template.familyId,
      templateId: template.id,
      title: template.title,
      cadence: cadenceFromTemplate(template, dayId),
    });
    if (!result.goal) return { added: false, reason: result.reason };
    commit(result.state);
    awardGoalCreation(template.familyId);
    return { added: true, reason: null };
  }, [availableFamilySet, awardGoalCreation, commit, dayId]);

  const addTemplates = useCallback((templateIds: readonly string[]) => {
    if (!dayId) return [];
    let next = rollCompanionQuickGoalsToDay(loadCompanionQuickGoalState(), dayId);
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
    const awardedFamilies = new Set(addedTemplateIds.map((id) => companionQuickGoalTemplateById.get(id)?.familyId).filter((id): id is KatchimeraFamilyId => Boolean(id)));
    awardedFamilies.forEach(awardGoalCreation);
    return addedTemplateIds;
  }, [availableFamilySet, awardGoalCreation, commit, dayId, state]);

  const addCustom = useCallback((
    familyId: KatchimeraFamilyId,
    title: string,
    cadence: CompanionQuickGoalCadence
  ) => {
    if (!dayId) return { added: false, reason: 'missing_day' as const };
    if (!availableFamilySet.has(familyId)) return { added: false, reason: 'invalid_family' as const };
    const current = rollCompanionQuickGoalsToDay(loadCompanionQuickGoalState(), dayId);
    const result = addCompanionQuickGoal(current, { familyId, title, cadence });
    if (!result.goal) return { added: false, reason: result.reason };
    commit(result.state);
    awardGoalCreation(familyId);
    return { added: true, reason: null };
  }, [availableFamilySet, awardGoalCreation, commit, dayId]);

  const editGoal = useCallback((
    goalId: string,
    updates: {
      title?: string;
      cadence?: CompanionQuickGoalCadence;
      status?: CompanionQuickGoalStatus;
    }
  ) => {
    const next = updateCompanionQuickGoal(loadCompanionQuickGoalState(), goalId, updates);
    if (next !== state) commit(next);
  }, [commit, state]);

  const completeGoal = useCallback((goalId: string): CompanionQuickGoalCompletionReceipt => {
    if (!dayId) return { bondAward: null, completion: null, newlyCompleted: false };
    const result = completeCompanionQuickGoal(loadCompanionQuickGoalState(), goalId, dayId);
    if (!result.completed || !result.completion) {
      return { bondAward: null, completion: result.completion, newlyCompleted: false };
    }
    commit(result.state);

    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const awarded = recordCompanionBondEvent(bondState, {
      id: `quick-goal:${companionIdForFamily(result.completion.familyId)}:${goalId}:${result.completion.dayId}`,
      creatureId: companionIdForFamily(result.completion.familyId),
      kind: 'quick_goal_completed',
      occurredAt: result.completion.completedAt,
      dayId: result.completion.dayId,
    }, { queueCelebration: true });
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
  }, [commit, dayId, onBondChanged]);

  const undoGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = undoCompanionQuickGoal(loadCompanionQuickGoalState(), goalId, dayId);
    if (!result.undone || !result.completion) return false;
    commit(result.state);

    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const removed = removeCompanionBondEvent(
      bondState,
      `quick-goal:${companionIdForFamily(result.completion.familyId)}:${goalId}:${result.completion.dayId}`
    );
    if (removed.removed) saveCompanionBondState(removed.state);
    onBondChanged?.();
    return true;
  }, [commit, dayId, onBondChanged]);

  const snoozeGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = snoozeCompanionQuickGoal(loadCompanionQuickGoalState(), goalId, dayId);
    if (!result.snoozed) return false;
    commit(result.state);
    return true;
  }, [commit, dayId]);

  const skipGoal = useCallback((goalId: string) => {
    if (!dayId) return false;
    const result = skipCompanionQuickGoal(loadCompanionQuickGoalState(), goalId, dayId);
    if (!result.skipped) return false;
    commit(result.state);
    return true;
  }, [commit, dayId]);

  const markJournaled = useCallback((completionId: string) => {
    const next = markQuickGoalCompletionJournaled(loadCompanionQuickGoalState(), completionId);
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
