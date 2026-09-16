import type { MergeWorldState } from '@/types/merge-world';
import type { GameplayEvent } from '@/types/gameplay-event';

export type MergeWorldPendingPersistence = {
  state: MergeWorldState;
  receiptIds: Set<string>;
  coalescedCommands: number;
  gameplayEvents: GameplayEvent[];
};

/** Keeps only the newest snapshot while preserving every outbox receipt delta. */
export function mergeWorldPendingPersistence(
  current: MergeWorldPendingPersistence | null,
  state: MergeWorldState,
  receiptIds: readonly string[],
  gameplayEvents: readonly GameplayEvent[] = [],
): MergeWorldPendingPersistence {
  const ids = new Set(current?.receiptIds ?? []);
  receiptIds.forEach((id) => ids.add(id));
  return {
    state: current && current.state.revision > state.revision ? current.state : state,
    receiptIds: ids,
    coalescedCommands: (current?.coalescedCommands ?? 0) + 1,
    gameplayEvents: [...new Map([...(current?.gameplayEvents ?? []), ...gameplayEvents].map((event) => [event.id, event])).values()],
  };
}
