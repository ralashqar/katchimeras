import type { ClassifiedMemory, StoredHomeDayRecord } from '@/types/home';

export type ContextualPromptSuggestion = {
  id: string;
  title: string;
  actionId: 'photo' | 'note' | 'place' | 'movement';
  sourceMemoryId: string;
  score: number;
};

const GRAPH_TITLES: Record<string, string> = {
  'animal-relationship': 'Is this a pet?',
  'people-relationship': 'Who was this moment about?',
  'food-context': 'What was the food part?',
  'media-context': 'What was this?',
};

const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;

export function planContextualPrompts(
  day: Pick<StoredHomeDayRecord, 'classifiedMemories'>,
  now = new Date()
): ContextualPromptSuggestion[] {
  return (day.classifiedMemories ?? [])
    .filter((memory) => shouldOffer(memory, now))
    .map((memory) => ({
      id: `clarify:${memory.id}`,
      title: promptTitle(memory),
      actionId: actionFor(memory),
      sourceMemoryId: memory.id,
      score: promptScore(memory),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 2);
}

function promptTitle(memory: ClassifiedMemory): string {
  if (memory.promptState.graphId === 'people-relationship') {
    const subject = memory.facets.find((facet) => facet.key === 'person_subject')?.value;
    if (subject === 'baby') return 'Who is this little one to you?';
    if (subject === 'child') return 'Who is this child to you?';
    if (subject === 'person') return 'Who is this person to you?';
    if (subject === 'group') return 'Who were you with?';
  }
  return GRAPH_TITLES[memory.promptState.graphId ?? ''] ?? 'Add a little context?';
}

function shouldOffer(memory: ClassifiedMemory, now: Date): boolean {
  if (!memory.promptState.graphId || memory.promptState.status === 'answered' || memory.promptState.status === 'not_needed') {
    return false;
  }
  if (memory.promptState.status !== 'dismissed') return true;
  const dismissedAt = Date.parse(memory.promptState.dismissedAt ?? '');
  return Number.isFinite(dismissedAt) && now.getTime() - dismissedAt >= DISMISS_COOLDOWN_MS;
}

function actionFor(memory: ClassifiedMemory): ContextualPromptSuggestion['actionId'] {
  if (memory.sourceType === 'place') return 'place';
  if (memory.sourceType === 'movement') return 'movement';
  if (memory.sourceType === 'text_note' || memory.sourceType === 'voice_note') return 'note';
  return 'photo';
}

function promptScore(memory: ClassifiedMemory): number {
  const bestAssignment = memory.assignments.reduce((score, assignment) => Math.max(score, assignment.score), 0);
  const confidenceGap = 1 - bestAssignment;
  const downstreamValue = memory.assignments.some((assignment) => assignment.role === 'primary') ? 0.2 : 0.35;
  const sensitive = memory.facets.some((facet) => facet.sensitive && !facet.confirmed) ? 0.15 : 0;
  const novelty = memory.confirmations.length === 0 ? 0.15 : 0;
  return Math.round((confidenceGap + downstreamValue + sensitive + novelty) * 100) / 100;
}
