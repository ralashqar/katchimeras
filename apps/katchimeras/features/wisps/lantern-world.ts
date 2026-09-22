import { feastleReady } from '@/features/shared-adventure/runtime';
import { ORDINARY_PACK, RARE_PACK, WISP_LANTERN_ENABLED, lanternPackDefinition } from '@/constants/wisp-lantern';
import { LANTERN_LEVELS, LANTERN_RECURRING_ORDERS, lanternLevel, type LanternLevel } from '@/constants/wisp-lantern-levels';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { MergeWorldState } from '@/types/merge-world';

export type LanternWorldProgress = {
  startedAt: number; clock: number; day: string; dailyOrders: number; dailyGranted: boolean;
  processedEvents: string[]; welcomeServed: string[];
  level?: LanternLevel; upgradeClaims?: number[]; lifetimeOrders?: number; recurringOrders?: number; recurringGranted?: number;
  rewards: Record<string, { kind: 'wisp_pack'; packId: string; definitionVersion?: number; scope: 'local-lantern-v1'; grantedAt: number }>;
};
/** The Lantern's welcome requests from before the pivot: kept so a save still on them is read, never published again. */
export const WELCOME_ORDER_IDS = ['lantern:welcome:plant', 'lantern:welcome:snacks'] as const;
/** Mist clears that welcome the Lantern: each pays a pack. */
export const WELCOME_CLEARS = 2;
export function lanternEligible(world: MergeWorldState) {
  return WISP_LANTERN_ENABLED && world.kingdomGoal?.introducedAt != null && feastleReady(world);
}
export function lanternDay(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function startLanternWorld(input: MergeWorldState, now: number): MergeWorldState {
  if (input.wispLanternProgress) return input;
  if (!lanternEligible(input)) throw new Error('Share Feastle’s first Snack before welcoming the Wisps.');
  const state = structuredClone(input);
  // The campaign pivot: the Lantern asks the Main Board for nothing; its first two Mist clears are its welcome.
  state.wispLanternProgress = { startedAt: now, clock: now, day: lanternDay(now), dailyOrders: 0, dailyGranted: false, processedEvents: [], welcomeServed: [], rewards: {}, level: 1, upgradeClaims: [], lifetimeOrders: 0, recurringOrders: 0, recurringGranted: 0 };
  return state;
}
/** Project only committed commands, inside the Merge snapshot transaction. */
export function projectLanternWorld(input: MergeWorldState, events: readonly GameplayEvent[]): MergeWorldState {
  if (!input.wispLanternProgress) return input;
  const state = structuredClone(input);
  const progress = state.wispLanternProgress!;
  // Pin legacy rewards before they are transferred to inventory.
  for (const reward of Object.values(progress.rewards)) reward.definitionVersion ??= 1;
  for (const event of events) {
    // The campaign pivot: the Lantern listens to Mist clears. The first two clears are its welcome; every clear after
    // counts toward its levels, its bonus packs and the day's pack. (Field names are the save's: they counted orders before.)
    if (event.kind !== 'encounter_cleared' || event.historical || event.occurredAt < progress.startedAt || progress.processedEvents.includes(event.id)) continue;
    progress.processedEvents.push(event.id);
    progress.clock = Math.max(progress.clock, event.occurredAt);
    const missionId = event.context.targetId ?? '';
    if (progress.welcomeServed.length < WELCOME_CLEARS && !progress.welcomeServed.includes(missionId)) {
      progress.welcomeServed.push(missionId);
      progress.rewards[`lantern:reward:${missionId}`] = { kind: 'wisp_pack', packId: ORDINARY_PACK, definitionVersion: lanternPackDefinition(ORDINARY_PACK).version, scope: 'local-lantern-v1', grantedAt: progress.clock };
      continue;
    }
    progress.lifetimeOrders = (progress.lifetimeOrders ?? 0) + 1;
    if (lanternLevel(progress.level) >= 2) {
      progress.recurringOrders = (progress.recurringOrders ?? 0) + 1;
      if (progress.recurringOrders >= LANTERN_RECURRING_ORDERS) {
        progress.recurringOrders -= LANTERN_RECURRING_ORDERS;
        progress.recurringGranted = (progress.recurringGranted ?? 0) + 1;
        const packId = progress.level === 3 ? RARE_PACK : ORDINARY_PACK;
        progress.rewards[`lantern:recurring:${progress.recurringGranted}`] = { kind: 'wisp_pack', packId, definitionVersion: lanternPackDefinition(packId).version, scope: 'local-lantern-v1', grantedAt: progress.clock };
      }
    }
    const day = lanternDay(progress.clock);
    if (day > progress.day) { progress.day = day; progress.dailyOrders = 0; progress.dailyGranted = false; }
    if (progress.dailyGranted) continue;
    progress.dailyOrders = Math.min(5, progress.dailyOrders + 1);
    if (progress.dailyOrders === 5) {
      progress.dailyGranted = true;
      progress.rewards[`lantern:daily:${progress.day}`] = { kind: 'wisp_pack', packId: ORDINARY_PACK, definitionVersion: lanternPackDefinition(ORDINARY_PACK).version, scope: 'local-lantern-v1', grantedAt: progress.clock };
    }
  }
  // Welcome requests from before the pivot are taken off the Main Board.
  state.activeOrders = state.activeOrders.filter(order => !(WELCOME_ORDER_IDS as readonly string[]).includes(order.id));
  return state;
}

export function canUpgradeLantern(progress: LanternWorldProgress | undefined) {
  const level = lanternLevel(progress?.level);
  if (!progress || level === 3) return false;
  const next = LANTERN_LEVELS[level];
  return progress.welcomeServed.length >= WELCOME_CLEARS && (progress.lifetimeOrders ?? 0) >= next.orders;
}
export function upgradeLanternWorld(input: MergeWorldState, targetLevel: LanternLevel): MergeWorldState {
  const current = lanternLevel(input.wispLanternProgress?.level);
  if (targetLevel <= current) return input;
  if (targetLevel !== current + 1 || !canUpgradeLantern(input.wispLanternProgress)) throw new Error('Complete the Lantern milestones first.');
  const state = structuredClone(input);
  state.wispLanternProgress!.level = targetLevel;
  state.wispLanternProgress!.upgradeClaims = [...(state.wispLanternProgress!.upgradeClaims ?? []), targetLevel];
  return state;
}

/** Placement is a world transaction; displaced plants retain every milestone. */
export function placeLanternWorld(input: MergeWorldState, now: number): MergeWorldState {
  if (input.wispLanternPlacement) return input;
  if (!lanternEligible(input)) throw new Error('Share Feastle’s first Snack and meet Heartwood first.');
  const state = structuredClone(input);
  for (const plant of state.haven.plantableMemories) {
    if (plant.status === 'planted' && plant.slotId === 'front-right') {
      plant.plantedAt ??= plant.earnedAt;
      plant.status = 'earned'; plant.slotId = null;
    }
  }
  state.wispLanternPlacement = { slotId: 'front-right', plantedAt: now };
  return state;
}
