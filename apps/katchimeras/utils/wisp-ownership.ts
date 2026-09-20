import { WISPS_BY_ID } from '@/constants/wisps';
import type { WispCollectionState, WispGrantSource, WispId } from '@/types/wisp';

/** Read-only union. Legacy aggregate snapshots cannot prove copies are disjoint. */
export function wispOwnershipState(local: WispCollectionState, grants: readonly {
  collectibleType: string; collectibleId: string; quantity: number; source: string; grantedAt: number | string;
}[]): WispCollectionState {
  const inventory = { ...local.inventory };
  const unlocked = { ...local.unlocked };
  const server = new Map<WispId, { quantity: number; sources: WispGrantSource[]; at: number }>();
  for (const grant of grants) {
    const id = grant.collectibleId as WispId;
    if (grant.collectibleType !== 'wisp' || !WISPS_BY_ID.has(id) || grant.quantity <= 0) continue;
    const prior = server.get(id);
    const parsedAt = typeof grant.grantedAt === 'string' ? Date.parse(grant.grantedAt) : grant.grantedAt;
    const at = Number.isFinite(parsedAt) ? parsedAt : 0;
    server.set(id, { quantity: (prior?.quantity ?? 0) + grant.quantity, sources: [...new Set([...(prior?.sources ?? []), grant.source as WispGrantSource])], at: Math.min(prior?.at ?? at, at) });
  }
  for (const [id, grant] of server) {
    const prior = inventory[id];
    inventory[id] = { wispId: id, quantity: Math.max(prior?.quantity ?? 0, grant.quantity),
      firstGrantedAt: Math.min(prior?.firstGrantedAt ?? grant.at, grant.at), sources: [...new Set([...(prior?.sources ?? []), ...grant.sources])], giftableQuantity: prior?.giftableQuantity ?? 0 };
    unlocked[id] ??= { wispId: id, unlockedAt: grant.at, sourceDayId: null, seenReveal: true };
  }
  return { ...local, inventory, unlocked };
}
