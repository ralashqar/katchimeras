import type { MergeWorldState } from '@/types/merge-world';

export type MergeWorldPendingPersistence = {
  state: MergeWorldState;
  receiptIds: Set<string>;
  coalescedCommands: number;
};

/** Keeps only the newest snapshot while preserving every outbox receipt delta. */
export function mergeWorldPendingPersistence(
  current: MergeWorldPendingPersistence | null,
  state: MergeWorldState,
  receiptIds: readonly string[],
): MergeWorldPendingPersistence {
  const ids = new Set(current?.receiptIds ?? []);
  receiptIds.forEach((id) => ids.add(id));
  return {
    state: current && current.state.revision > state.revision ? current.state : state,
    receiptIds: ids,
    coalescedCommands: (current?.coalescedCommands ?? 0) + 1,
  };
}
