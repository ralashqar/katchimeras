import type { ConversationDefinition, ConversationSession } from '@/types/companion-conversation';
import type { ContentFlowRun } from '@/types/content-flow';
import { rememberCompanionMoment, acceptDailyStoryHabit, loadCompanionLife } from './companion-life-storage';
import { loadOnboardingProfile } from './onboarding-state';
import { mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { MOSSPROUT_DAY_OPTIONS, MOSSPROUT_HELP_OPTIONS } from '@/features/onboarding/mossprout-ftue-copy';
import { selectedStoryHabit } from './companion-life';
import { loadCompanionQuickGoalState } from './companion-quick-goal-storage';

export const MOSSPROUT_LIFE_ENTRY = 'mossprout:ftue';
export const MOSSPROUT_POND_ENTRY = 'quiet-patch:pond-knock';

export function lifeConversationEntryId(definitionId: string) {
  if (definitionId.startsWith('mossprout:ftue:first-meeting')) return MOSSPROUT_LIFE_ENTRY;
  if (definitionId.includes('quiet-patch:pond-knock')) return MOSSPROUT_POND_ENTRY;
  if (definitionId === 'steppling:journey:day-one') return 'steppling:journey:day-1';
  return null;
}

export function recordLifeConversation(session: ConversationSession, definition: ConversationDefinition) {
  const id = lifeConversationEntryId(definition.id);
  if (!id || session.preview || !session.turns.length) return;
  const familyId = definition.familyId;
  if (familyId !== 'mossprout' && familyId !== 'steppling') return;
  const facts: Record<string, string> = {};
  for (const turn of session.turns) {
    const node = definition.nodes.find((item) => item.id === turn.nodeId);
    if (node?.kind !== 'choice' || node.options.length < 2 || node.id === 'hello' || node.id.startsWith('habit.')) continue;
    const option = node.options.find((item) => item.id === turn.optionId);
    if (option) facts[`${definition.id}:${node.id}`] = `${node.prompt} You chose “${option.label}”.`;
  }
  const profile = loadOnboardingProfile();
  const seed = mossproutFirstSeedForIntent(profile.mossproutAnswers.growthIntentId);
  if (id === MOSSPROUT_LIFE_ENTRY) {
    const feeling = MOSSPROUT_DAY_OPTIONS.find((item) => item.id === profile.mossproutAnswers.dayTextureId);
    const help = MOSSPROUT_HELP_OPTIONS.find((item) => item.id === profile.mossproutAnswers.growthIntentId?.replace('desired-help:', ''));
    facts.beginning = [feeling ? `You described today as “${feeling.label}”.` : '', help ? `You wanted “${help.label}”.` : ''].filter(Boolean).join(' ');
    facts.seed = seed.message;
  }
  rememberCompanionMoment({ id, familyId, title: id === MOSSPROUT_LIFE_ENTRY ? seed.name : id === MOSSPROUT_POND_ENTRY ? 'The Pond Knocked Twice' : definition.title,
    kind: 'conversation', createdAt: session.createdAt, updatedAt: session.updatedAt, facts,
    ...(id === MOSSPROUT_LIFE_ENTRY ? { seedId: seed.id } : {}), goalId: loadCompanionLife().entries.find((entry) => entry.id === id)?.goalId ?? selectedStoryHabit(loadCompanionQuickGoalState(), familyId)?.id });
  if (definition.id === 'steppling:journey:day-one' && definition.version >= 2) {
    for (const turn of session.turns) {
      if (turn.nodeId.startsWith('habit.steppling:') && turn.optionId === 'add') {
        const habitId = turn.nodeId.slice('habit.'.length);
        acceptDailyStoryHabit('steppling', habitId, id, `steppling-day-one:habit:${habitId}`);
      }
    }
  }

}

export function recordLifeFlow(run: ContentFlowRun) {
  if (run.definitionVersion < 2 || !(run.definitionId.startsWith('steppling:journey:') || run.definitionId === 'steppling-day-one')) return;
  const id = run.definitionId === 'steppling-day-one' ? 'steppling:journey:day-1' : run.definitionId;
  const facts = Object.fromEntries(Object.entries(run.variables).filter(([key, value]) => key.startsWith('fact.') && typeof value === 'string')) as Record<string, string>;
  rememberCompanionMoment({ id, familyId: 'steppling', title: String(run.variables.journalTitle ?? (id.endsWith('day-1') ? 'A little way together' : 'The Path Outside')),
    kind: id.endsWith('day-6') ? 'chapter' : 'conversation', facts, createdAt: run.createdAt, updatedAt: run.updatedAt,
    goalId: loadCompanionLife().entries.find((entry) => entry.id === id)?.goalId ?? selectedStoryHabit(loadCompanionQuickGoalState(), 'steppling')?.id });
}
