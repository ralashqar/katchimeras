import type { WispPackInstance, WispPackOutcome } from '@/types/wisp-lantern';
export type WispPackCard = Omit<WispPackOutcome, 'id'> & { id: string; wispId: WispPackOutcome['id']; slot: number };
/** Card identity belongs to the slot, not the species: duplicates remain separate cards. */
export function wispPackCards(pack: WispPackInstance): WispPackCard[] {
  return (pack.outcomes ?? []).map((outcome, slot) => ({ ...outcome, id: `${pack.id}:card:${slot}`, wispId: outcome.id, slot }));
}
export function wispPackFocus(pack: WispPackInstance) {
  return Math.max(0, Math.min((pack.outcomes?.length ?? 1) - 1, pack.focusedCardIndex ?? pack.revealed));
}
