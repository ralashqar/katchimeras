import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

export function mergeCommandEvents(before: MergeWorldState, command: MergeWorldCommand, result: MergeWorldCommandResult, contentRevision: number): GameplayEvent[] {
  if (!result.changed) return [];
  const base = { version: 1 as const, source: 'merge-world' as const, sourceRevision: result.state.revision, occurredAt: Math.max(command.now, before.localLiveOps?.clock ?? 0), contentRevision, quantity: 1 };
  const id = `world:${before.createdAt}:${result.state.revision}:${'boardId' in command ? command.boardId ?? 'mossprout' : 'mossprout'}`;
  const events: GameplayEvent[] = [];
  const boardId = 'boardId' in command ? command.boardId ?? 'mossprout' : 'mossprout';
  const regionId = boardId === 'mossprout' ? 'mossprout-grove' : `${boardId}-home`;
  if (command.type === 'move' && result.mergedCell != null) {
    const board = boardId === 'mossprout' ? result.state.board : result.state.haven.residentMergeBoards[boardId]?.board;
    const item = board?.[result.mergedCell]?.occupant;
    if (item?.kind === 'item') events.push({ ...base, id: `${id}:merge`, kind: 'merge', context: { itemId: item.definitionId, itemTier: MERGE_ITEMS_BY_ID.get(item.definitionId)?.tier, companionId: boardId, regionId } });
  }
  if (command.type === 'serveOrder' && result.servedOrderId) {
    const order = before.activeOrders.find((entry) => entry.id === result.servedOrderId);
    events.push({ ...base, id: `${id}:order:${result.servedOrderId}`, kind: 'order_completed', context: { targetId: result.servedOrderId, companionId: order?.characterId, regionId,
      tags: order && boardId === 'mossprout' && (!order.storyArcId || order.storyArcId === 'mossprout:casual-garden') && order.purpose === 'normal' && !order.id.includes('tutorial') && !order.id.includes('chapter-0') ? ['lantern-daily-order'] : [],
    } });
  }
  if (command.type === 'completeEncounter' && result.encounterCleared) {
    const cleared = result.encounterCleared;
    events.push({ ...base, id: `${id}:encounter:${cleared.missionId}`, kind: 'encounter_cleared', context: { targetId: cleared.missionId, companionId: cleared.katchimeraId, regionId: cleared.campaignId ?? regionId, level: cleared.grade === 'perfect' ? 2 : cleared.grade === 'bright' ? 1 : 0,
      tags: [cleared.firstClear ? 'first-clear' : 'replay', ...(cleared.missionId.startsWith('daily:') ? ['daily-mist'] : [])] } });
  }
  return events;
}

/** Durable milestone facts also cover writes made by story effects outside the board provider. */
export function worldMilestoneEvents(world: MergeWorldState, contentRevision: number, historical = false): GameplayEvent[] {
  const events: GameplayEvent[] = [];
  const add = (kind: GameplayEvent['kind'], targetId: string, level?: number, companionId?: string) => events.push({
    version: 1, id: `milestone:${world.createdAt}:${kind}:${targetId}:${level ?? 0}`, kind, source: 'merge-world',
    sourceRevision: world.revision, occurredAt: world.updatedAt, contentRevision, quantity: 1,
    context: { targetId, level, companionId, regionId: 'mossprout-grove' }, historical,
  });
  if (world.sharedAdventure?.postBuiltAt) add('structure_upgraded', 'lantern-post', 1);
  for (const [id, unlock] of Object.entries(world.worldUnlocks ?? {})) {
    if (unlock.hatchedAt != null) add('friend_rescued', unlock.destination, undefined, unlock.destination);
    if (unlock.unlockedAt) add('mist_cleared', id);
  }
  for (const record of world.residentCardDiscovery?.records ?? []) {
    if (record.status === 'card_earned') add('friend_rescued', record.residentId, undefined, record.residentId);
  }
  for (const id of world.mossproutResidentSkinIds ?? []) add('friend_rescued', id, undefined, id);
  for (const [id, reveal] of Object.entries(world.haven?.mossproutNatureIslandReveals ?? {})) if (reveal) add('mist_cleared', id);
  for (const [id, level] of Object.entries(world.haven?.mossproutNatureIslands ?? {})) {
    for (let n = 1; n <= level; n++) add(n === 1 ? 'hex_restored' : 'structure_upgraded', id, n);
  }
  for (const [id, stage] of Object.entries(world.haven?.tileStages ?? {})) {
    for (let n = 1; n <= (stage ?? 0); n++) add(n === 1 ? 'hex_restored' : 'structure_upgraded', `home:${id}`, n);
  }
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

export function newWorldMilestones(before: MergeWorldState | null, after: MergeWorldState, contentRevision: number): GameplayEvent[] {
  const previous = new Set(before ? worldMilestoneEvents(before, contentRevision).map((event) => event.id) : []);
  return worldMilestoneEvents(after, contentRevision, !before).filter((event) => !previous.has(event.id));
}
