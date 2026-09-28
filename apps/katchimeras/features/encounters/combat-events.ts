import { combatBossSpec, combatLessonSpec } from '@/constants/combat-campaign';
import { islandLevel } from '@/constants/island-campaigns/island-levels';
import { hashSeed } from '@/features/encounter/seed';
import type { MergeWorldState } from '@/types/merge-world';

export const combatDayId = (now: number | Date = Date.now()) => new Date(now).toISOString().slice(0, 10);
/** Monday UTC is the identity, so rotation and rewards are stable across local time zones. */
export function combatWeekId(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export function dailyCombatMission(day: string, slot: number) {
  const index = 3 + hashSeed(`expedition-v2:${day}:${slot}`) % 21;
  const spec = combatLessonSpec(index, [3, 5, 7][slot] ?? 3);
  spec.difficulty = (['calm', 'thick', 'dark'] as const)[slot] ?? 'calm';
  const mission = islandLevel('daily', `${day}:${slot}`, spec);
  return { ...mission, title: ['Morning expedition', 'Deep expedition', 'Dark expedition'][slot] ?? spec.title };
}
export function weeklyCombatMissions(day: string, world: Pick<MergeWorldState, 'frontierSurges'>) {
  if (world.frontierSurges?.firstHeldAt == null) return [];
  const week = combatWeekId(day);
  const boss = Math.floor(Date.parse(`${week}T00:00:00Z`) / 604800000) % 3;
  return [0, 1, 2].map((difficulty) => {
    const spec = combatBossSpec(boss, difficulty);
    const mission = islandLevel('weekly', `${week}:${difficulty}`, spec);
    return { ...mission, title: `${spec.title} · ${['Calm', 'Fierce', 'Heroic'][difficulty]}` };
  });
}
