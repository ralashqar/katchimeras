import type { WispId } from './wisp';
export type WispEconomyScope = 'local-lantern-v1' | 'verified';
export type WispPackDefinition = {
  id: string; version: number; collectionId: string; scope: WispEconomyScope;
  slots: number; pool: readonly { id: WispId; weight: number }[];
  distinct: boolean; guaranteeAfterDryPacks: number | null;
};
export type WispPackOutcome = { id: WispId; discovered: boolean; echoes: number };
export type WispPackInstance = {
  id: string; definitionId: string; definitionVersion: number; scope: WispEconomyScope;
  seed: number; grantedAt: number; openedAt?: number; outcomes?: WispPackOutcome[]; revealed: number; focusedCardIndex?: number;
};
export type WispLanternState = {
  version: 1; scope: 'local-lantern-v1'; unlockedAt: number | null; introducedAt: number | null;
  packs: Record<string, WispPackInstance>; echoes: number; dryPacks: number;
  receipts: string[]; residents: WispId[]; cosmetics: string[]; claims: string[];
  duplicateExplained: boolean;
};
export type WispLanternCommand =
  | { type: 'unlock' } | { type: 'complete_intro' }
  | { type: 'grant_pack'; receiptId: string; definitionId: string; seed: number }
  | { type: 'open_pack'; packId: string }
  | { type: 'focus_pack_card'; packId: string; index: number }
  | { type: 'acknowledge_reveal'; packId: string; revealed: number }
  | { type: 'exchange'; receiptId: string; wispId?: WispId; cosmeticId?: 'lantern-trail' }
  | { type: 'claim_collection' } | { type: 'residents'; ids: WispId[] } | { type: 'explain_duplicate' };
/** Verified implementations resolve remotely; editable pilot saves are never purchase authority. */
export interface WispPackAuthority { scope: WispEconomyScope; openPack(packId: string): Promise<WispPackInstance> }
