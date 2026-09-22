export type LanternLevel = 1 | 2 | 3;
/** Mist clears between bonus packs (the name is the save's; it counted Garden orders before the pivot). */
export const LANTERN_RECURRING_ORDERS = 10;
export const LANTERN_LEVELS = [
  { level: 1, name: 'First Light', orders: 0, residents: 3, benefit: 'A daily pack and three resident Wisps.' },
  { level: 2, name: 'Gathering', orders: 8, residents: 4, benefit: 'A bonus pack every 10 Mist clears. Room for four Wisps.' },
  { level: 3, name: 'Brighter Light', orders: 30, residents: 5, benefit: 'Every bonus pack guarantees a Rare or better. Room for five Wisps.' },
] as const;
export function lanternLevel(value: unknown): LanternLevel { return value === 2 || value === 3 ? value : 1; }
export function lanternResidentCapacity(value: unknown) { return LANTERN_LEVELS[lanternLevel(value) - 1].residents; }
