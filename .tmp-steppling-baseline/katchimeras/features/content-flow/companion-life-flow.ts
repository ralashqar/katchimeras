import { LIFE_HABITS, type LifeCompanionFamily } from '@/constants/companion-life-content';
import type { ContentFlowNode } from '@/types/content-flow';

export type LifeChoice = readonly [id: string, label: string, reply: string, next?: string];
export function lifeQuestion(id: string, text: string, choices: readonly LifeChoice[], next: string): ContentFlowNode[] {
  return [
    { id, kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: id,
      payload: { text, choices: choices.map(([key, label]) => [key, label]), options: choices.map(([key, label]) => ({ id: key, label })) },
      actions: choices.map(([key, label]) => ({ id: key, next: `${id}.reply.${key}`, set: { [`fact.${id}`]: `You chose “${label}”.`, [id]: key } })) },
    ...choices.map(([key, , reply, target]): ContentFlowNode => ({ id: `${id}.reply.${key}`, kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: `${id}.reply.${key}`,
      payload: { text: reply, choices: [['continue', 'Continue']] }, actions: [{ id: 'continue', next: target ?? next }] })),
  ];
}

export function lifeHabitOfferNodes(familyId: LifeCompanionFamily, next: string, allowPause = false): ContentFlowNode[] {
  const habits = LIFE_HABITS.filter((habit) => habit.familyId === familyId);
  return [
    { id: 'habit.picker', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'habit.picker',
      payload: { text: 'What would feel doable each day?', choices: [...habits.map((habit) => [habit.id, habit.title]), ['skip', 'Not now']] },
      actions: [...habits.map((habit) => ({ id: habit.id, next: `habit.${habit.id}` })), { id: 'skip', next }] },
    ...habits.flatMap((habit): ContentFlowNode[] => [
      { id: `habit.${habit.id}`, kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: `habit.${habit.id}`,
        payload: { text: `${habit.title}\n\nAppears each day. You can skip, change, or pause it. If you already chose a story habit, this replaces it.`, choices: [['add', 'Use this daily habit'], ['choose', 'Choose another'], ['skip', 'Keep things as they are']] },
        actions: [{ id: 'add', next: `habit.accept.${habit.id}` }, { id: 'choose', next: 'habit.picker' }, { id: 'skip', next }] },
      { id: `habit.accept.${habit.id}`, kind: 'effect', capability: 'companion.life.habit', effectType: 'companion.life.habit', effectId: `habit:${habit.id}`, payload: { familyId, habitId: habit.id }, next: 'habit.added' },
    ]),
    { id: 'habit.added', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'habit.added',
      payload: { text: 'I’ll keep it nearby. You can tell me how it went whenever you like.', choices: [['continue', 'Continue']] }, actions: [{ id: 'continue', next }] },
    ...(allowPause ? [{ id: 'habit.pause', kind: 'effect' as const, capability: 'companion.life.habit', effectType: 'companion.life.habit', effectId: 'habit:pause', payload: { familyId, pause: true }, next }] : []),
  ];
}
