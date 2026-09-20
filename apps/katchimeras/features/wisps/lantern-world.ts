import { feastleReady } from '@/features/shared-adventure/runtime';
import { ORDINARY_PACK, WISP_LANTERN_ENABLED } from '@/constants/wisp-lantern';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';

export type LanternWorldProgress = {
  startedAt: number; clock: number; day: string; dailyOrders: number; dailyGranted: boolean;
  processedEvents: string[]; welcomeServed: string[];
  rewards: Record<string, { kind: 'wisp_pack'; packId: string; scope: 'local-lantern-v1'; grantedAt: number }>;
};
export const WELCOME_ORDER_IDS = ['lantern:welcome:plant', 'lantern:welcome:snacks'] as const;
export function lanternEligible(world: MergeWorldState) {
  return WISP_LANTERN_ENABLED && world.kingdomGoal?.introducedAt != null && feastleReady(world);
}
export function lanternDay(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function welcomeOrder(index: number, now: number): MergeOrder {
  return { id: WELCOME_ORDER_IDS[index], characterId: index === 0 ? 'mossprout' : 'feastle',
    title: index === 0 ? 'A little green welcome' : 'A supper for small visitors',
    description: 'Bring these to your friends to receive a Wisp Card Pack.',
    requirements: [{ definitionId: index === 0 ? 'nature:garden:3' : 'food:table:2', quantity: index === 0 ? 1 : 2 }],
    difficulty: 'small', purpose: 'normal', signature: false, storyArcId: 'wisp-lantern', storyTargetLevel: 1,
    reward: { coins: 0, mergeXp: 0, friendshipXp: 0, energy: 0 }, createdAt: now };
}
export function startLanternWorld(input: MergeWorldState, now: number): MergeWorldState {
  if (input.wispLanternProgress) return input;
  if (!lanternEligible(input)) throw new Error('Share Feastle’s first Snack before welcoming the Wisps.');
  const state = structuredClone(input);
  state.wispLanternProgress = { startedAt: now, clock: now, day: lanternDay(now), dailyOrders: 0, dailyGranted: false, processedEvents: [], welcomeServed: [], rewards: {} };
  state.activeOrders.push(welcomeOrder(0, now));
  return state;
}
/** Project only committed commands, inside the Merge snapshot transaction. */
export function projectLanternWorld(input: MergeWorldState, events: readonly GameplayEvent[]): MergeWorldState {
  if (!input.wispLanternProgress) return input;
  const state = structuredClone(input);
  const progress = state.wispLanternProgress!;
  for (const event of events) {
    if (event.kind !== 'order_completed' || event.historical || event.occurredAt < progress.startedAt || progress.processedEvents.includes(event.id)) continue;
    progress.processedEvents.push(event.id);
    progress.clock = Math.max(progress.clock, event.occurredAt);
    const orderId = event.context.targetId ?? '';
    const welcomeIndex = (WELCOME_ORDER_IDS as readonly string[]).indexOf(orderId);
    if (welcomeIndex >= 0 && !progress.welcomeServed.includes(orderId)) {
      progress.welcomeServed.push(orderId);
      progress.rewards[`lantern:reward:${orderId}`] = { kind: 'wisp_pack', packId: ORDINARY_PACK, scope: 'local-lantern-v1', grantedAt: progress.clock };
      if (welcomeIndex === 0 && !state.activeOrders.some(order => order.id === WELCOME_ORDER_IDS[1])) state.activeOrders.push(welcomeOrder(1, progress.clock));
    }
    if (event.context.tags?.includes('lantern-daily-order') !== true) continue;
    const day = lanternDay(progress.clock);
    if (day > progress.day) { progress.day = day; progress.dailyOrders = 0; progress.dailyGranted = false; }
    if (progress.dailyGranted) continue;
    progress.dailyOrders = Math.min(5, progress.dailyOrders + 1);
    if (progress.dailyOrders === 5) {
      progress.dailyGranted = true;
      progress.rewards[`lantern:daily:${progress.day}`] = { kind: 'wisp_pack', packId: ORDINARY_PACK, scope: 'local-lantern-v1', grantedAt: progress.clock };
    }
  }
  const nextWelcome = WELCOME_ORDER_IDS.findIndex(id => !progress.welcomeServed.includes(id));
  state.activeOrders = state.activeOrders.filter(order => !progress.welcomeServed.includes(order.id));
  if (nextWelcome >= 0 && !state.activeOrders.some(order => order.id === WELCOME_ORDER_IDS[nextWelcome])) state.activeOrders.push(welcomeOrder(nextWelcome, progress.clock));
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
