import { MOSSPROUT_RESIDENT_IDS, mossproutResidentById } from '@/constants/mossprout-residents';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeOrder } from '@/types/merge-world';

export const RESIDENT_CARD_DEFINITION_ID = 'mossprout:resident-card:sealed';
export const LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID = 'mossprout:resident-card:key';
/** @deprecated Use RESIDENT_CARD_DEFINITION_ID. Kept as a source-compatible alias while older tests/content migrate. */
export const RESIDENT_CARD_KEY_DEFINITION_ID = RESIDENT_CARD_DEFINITION_ID;
export const RETIRED_RESIDENT_NODE_ROOT_GATE_IDS = new Set([
  'root:day-5-first-return', 'root:day-7-two-shores', 'root:memory-first', 'root:friendship-4',
  'root:memory-two-days', 'root:focus-first', 'root:nursery-key', 'root:memory-three-days',
]);

export type ResidentCardNodeDefinition = {
  residentId: KatchimeraSkinId;
  gateId: string;
  cell: number;
};

export const MOSSPROUT_RESIDENT_CARD_NODES: readonly ResidentCardNodeDefinition[] = [
  { residentId: 'petalimp', gateId: 'mossprout:resident-card:petalimp', cell: 0 },
  { residentId: 'fernip', gateId: 'mossprout:resident-card:fernip', cell: 1 },
  { residentId: 'blossle', gateId: 'mossprout:resident-card:blossle', cell: 5 },
  { residentId: 'amberleaf', gateId: 'mossprout:resident-card:amberleaf', cell: 6 },
  { residentId: 'drizzlet', gateId: 'mossprout:resident-card:drizzlet', cell: 7 },
  { residentId: 'mistle', gateId: 'mossprout:resident-card:mistle', cell: 8 },
  { residentId: 'driftkin', gateId: 'mossprout:resident-card:driftkin', cell: 12 },
  { residentId: 'tempesto', gateId: 'mossprout:resident-card:tempesto', cell: 13 },
] as const;

export const MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT = new Map(MOSSPROUT_RESIDENT_CARD_NODES.map((node) => [node.residentId, node]));
export const MOSSPROUT_RESIDENT_CARD_NODE_BY_GATE = new Map(MOSSPROUT_RESIDENT_CARD_NODES.map((node) => [node.gateId, node]));

export function nextUnearnedMossproutResident(earnedIds: readonly KatchimeraSkinId[], preferredId?: KatchimeraSkinId | null): KatchimeraSkinId | null {
  const earned = new Set(earnedIds);
  if (preferredId && preferredId !== 'mossprout' && !earned.has(preferredId) && MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.has(preferredId)) return preferredId;
  return MOSSPROUT_RESIDENT_CARD_NODES.find((node) => !earned.has(node.residentId))?.residentId ?? null;
}

export function residentDiscoveryOrders(discoveryId: string, residentId: KatchimeraSkinId, now: number): [MergeOrder, MergeOrder] {
  const resident = mossproutResidentById.get(residentId) ?? mossproutResidentById.get('mossprout')!;
  const theme = resident.requestThemes[0] ?? 'garden';
  const chain = theme === 'waterside' ? 'nature:waterside' : theme === 'keepsake' ? 'nature:keepsake' : 'nature:garden';
  const copy = resident.requestCopy;
  return [0, 1].map((index): MergeOrder => ({
    id: `${discoveryId}:order:${index + 1}`,
    characterId: 'mossprout',
    recipientSkinId: residentId,
    title: copy[index]?.title ?? `A request from ${residentId}`,
    description: copy[index]?.description ?? 'Bring one small thing for the garden.',
    difficulty: 'small',
    requirements: [{ definitionId: `${chain}:${index + 2}`, quantity: 1 }],
    reward: { coins: 15 + index * 5, mergeXp: 4, friendshipXp: 4, energy: 0 },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: discoveryId,
    storyBeatId: discoveryId,
    storyStep: index + 1,
    storyStepCount: 2,
  })) as [MergeOrder, MergeOrder];
}

export const MOSSPROUT_DISCOVERABLE_RESIDENT_IDS = MOSSPROUT_RESIDENT_IDS.filter((id) => id !== 'mossprout');
