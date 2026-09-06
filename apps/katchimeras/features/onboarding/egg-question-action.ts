import type { RankedTodayCareAction } from '@/utils/today-care';

/** Care-action adapter for the shared Egg question widget. */
export function eggQuestionAction(id: string, title: string, growthReward: number, dayId: string): RankedTodayCareAction {
  return {
    id, instanceId: `${dayId}:${id}`, title,
    description: 'Choose the answer that feels closest.', icon: 'sparkles',
    artKey: 'reflection', category: 'memory', completionKey: id,
    completionMode: 'artifact', destination: { kind: 'reflection', promptId: 'day_focus' },
    growthSource: 'reflection', growthReward, priority: 100,
    eligibleTimeOfDay: ['morning', 'midday', 'afternoon', 'evening'],
    journalFocused: false, canReplaceSkipped: false, aiGenerated: false,
    source: 'system', completed: false, completedAt: null,
  };
}
