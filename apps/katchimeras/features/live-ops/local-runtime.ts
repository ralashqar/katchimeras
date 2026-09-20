import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { lanternPackDefinition } from '@/constants/wisp-lantern';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { HarmonyState, LiveEventDefinition } from '@/types/live-ops';
import { emptyLocalLiveOps, type LocalEventCommand, type LocalEventRun } from '@/types/local-live-ops';
import type { MergeWorldState } from '@/types/merge-world';
import { harmonyDefinition } from './local-catalog';
import { emptyEventProgress, eventPhase, scoreGameplayEvent } from './rules';

export const localOrderId = (event: string, node: string) => `local-event:${event}:${node}`;
export function localEventLock(world: MergeWorldState, harmony: HarmonyState, definition: LiveEventDefinition): string | null {
  if (definition.requiresRestoredGarden && !(world.haven.tileStages.mossprout! >= 1)) return 'Restore Mossprout’s garden to discover returning Mist.';
  const threshold = definition.encounters?.length ? Math.max(definition.minHarmony, harmonyDefinition().incursionThreshold) : definition.minHarmony;
  if (harmony.points < threshold) return `Bring back more of the world: ${harmony.points}/${threshold} Harmony.`;
  return null;
}
function grantKeepsake(world: MergeWorldState, run: LocalEventRun, id: string, now: number) {
  const definition = run.definition.keepsakes?.find(k => k.id === id);
  if (!definition) throw new Error('This keepsake is missing from the installed event.');
  world.localLiveOps!.keepsakes[id] ??= { definition, earnedAt: now };
}

/** Projects only joined local events. The caller commits the world and journal together. */
export function projectLocalEvents(source: MergeWorldState, events: readonly GameplayEvent[], now: number): MergeWorldState {
  if (!source.localLiveOps) return source;
  const world = structuredClone(source);
  const local = world.localLiveOps!;
  local.clock = Math.max(local.clock, now);
  local.scoredActionIds ??= {};
  for (const [id, deadline] of Object.entries(local.scoredActionIds)) if (deadline <= local.clock) delete local.scoredActionIds[id];
  const fresh: GameplayEvent[] = [];
  for (const event of events) {
    if (event.historical || Object.hasOwn(local.scoredActionIds, event.id)) continue;
    const eligible = Object.values(local.runs).filter(run => event.occurredAt >= run.joinedAt && local.clock < Date.parse(run.definition.claimEndsAt) && eventPhase(run.definition, event.occurredAt) === 'active' && run.definition.rules.some(rule => rule.kind === event.kind));
    if (!eligible.length) continue;
    Object.defineProperty(local.scoredActionIds, event.id, { value: Math.max(...eligible.map(run => Date.parse(run.definition.claimEndsAt))), enumerable: true, configurable: true });
    fresh.push(event);
  }
  for (const run of Object.values(local.runs)) {
    for (const event of fresh) {
      if (event.occurredAt < run.joinedAt || local.clock >= Date.parse(run.definition.claimEndsAt)) continue;
      run.progress = scoreGameplayEvent(run.progress, run.definition, event);
    }
    for (const node of run.definition.encounters ?? []) {
      const state = run.nodes[node.id];
      if (state?.phase === 'order' && world.externalRewardReceipts.some(r => r.id === `merge-story-served:${localOrderId(run.definition.id, node.id)}`)) {
        state.phase = 'board';
        state.board = createMissionState({ items: missionWindow(3).cellIndices.slice(0, 8).map(cell => ({ cell, definitionId: node.seedItemId })), echoes: [], veiled: [] }, node.companionId ?? 'mossprout', now);
      }
    }
    if (eventPhase(run.definition, local.clock) !== 'active') {
      world.activeOrders = world.activeOrders.filter(order => order.storyArcId !== `local-event:${run.definition.id}`);
    }
  }
  return world;
}

/** Pure local commands. No network, premium currency or server receipt enters here. */
export function reduceLocalEvent(source: MergeWorldState, command: LocalEventCommand, harmony: HarmonyState, catalog: readonly LiveEventDefinition[], now: number): { world: MergeWorldState; events: GameplayEvent[] } {
  let world = structuredClone(source);
  world.localLiveOps ??= emptyLocalLiveOps();
  const local = world.localLiveOps;
  now = Math.max(now, local.clock);
  local.clock = now;
  const events: GameplayEvent[] = [];
  if (command.type === 'equip') {
    if (command.keepsakeId && !local.keepsakes[command.keepsakeId]) throw new Error('Earn this keepsake first.');
    local.equipped = command.keepsakeId;
  } else if ('eventId' in command) {
    let run = local.runs[command.eventId];
    if (command.type === 'join') {
      if (!run) {
        const definition = catalog.find(e => e.id === command.eventId && e.authority === 'local');
        if (!definition || eventPhase(definition, now) !== 'active') throw new Error('This event is not open.');
        const reason = localEventLock(world, harmony, definition);
        if (reason) throw new Error(reason);
        run = local.runs[definition.id] = { definition: structuredClone(definition), joinedAt: now, progress: emptyEventProgress(definition), nodes: {}, claims: {} };
      }
    } else {
      if (!run || run.definition.authority !== 'local') throw new Error('Join this local event first.');
      const phase = eventPhase(run.definition, now);
      if (command.type === 'claim') {
        const tier = run.definition.tiers.find(t => t.id === command.tierId);
        if (!tier) throw new Error('Unknown reward.');
        if (run.claims[tier.id] === undefined) {
          if (!['active', 'claim'].includes(phase) || run.progress.points < tier.points) throw new Error('This reward is not available.');
          for (const [itemIndex, item] of tier.free.items.entries()) {
            if (item.kind === 'glow') world.coins += item.amount;
            else if (item.kind === 'cosmetic') grantKeepsake(world, run, item.id, now);
            else if (item.kind === 'wisp_pack' && item.scope === 'local-lantern-v1') {
              if (!world.wispLanternProgress) throw new Error('Welcome the Wisps at the Lantern before collecting this pouch.');
              world.wispLanternProgress.rewards[`lantern:event:${run.definition.id}:${tier.id}:${itemIndex}`] = { ...item, definitionVersion: lanternPackDefinition(item.packId).version, scope: 'local-lantern-v1', grantedAt: now };
            }
            else throw new Error('This reward requires a different claim service.');
          }
          run.claims[tier.id] = now;
        }
      } else {
        if (phase !== 'active') throw new Error('This event has finished. Your garden and keepsakes are safe.');
        const nodes = run.definition.encounters ?? [];
        const index = nodes.findIndex(n => n.id === command.nodeId);
        const definition = nodes[index];
        if (!definition || nodes.slice(0, index).some(n => run.nodes[n.id]?.phase !== 'complete')) throw new Error('Finish the earlier encounter first.');
        let node = run.nodes[definition.id];
        if (command.type === 'begin' && !node) {
          node = run.nodes[definition.id] = { phase: 'order', merges: 0 };
          world.activeOrders.push({ id: localOrderId(run.definition.id, definition.id), characterId: definition.companionId ?? 'mossprout', title: definition.title, description: 'Supplies for the returning Mist', difficulty: 'small', requirements: structuredClone([...definition.requirements]), reward: { coins: 0, mergeXp: 0, friendshipXp: 0, energy: 0 }, createdAt: now, signature: false, purpose: 'normal', storyArcId: `local-event:${run.definition.id}`, storyTargetLevel: 1, expiresAt: Date.parse(run.definition.endsAt) });
        } else if (command.type === 'move' && node?.phase === 'board' && node.board) {
          const cells = missionWindow(3).cellIndices;
          if (!cells.includes(command.from) || !cells.includes(command.to)) throw new Error('Move within this encounter board.');
          const result = reduceMergeWorld(node.board, { type: 'move', from: command.from, to: command.to, now });
          if (result.changed) {
            node.board = result.state;
            if (result.mergedCell != null) {
              node.merges++;
              const item = result.state.board[result.mergedCell]?.occupant;
              if (item?.kind === 'item') events.push({ version: 1, id: `local-merge:${world.createdAt}:${run.definition.id}:${definition.id}:${node.merges}`, kind: 'merge', source: 'mission', sourceRevision: world.revision + 1, contentRevision: 0, occurredAt: now, quantity: 1, context: { itemId: item.definitionId, itemTier: MERGE_ITEMS_BY_ID.get(item.definitionId)?.tier, companionId: definition.companionId ?? 'mossprout', regionId: definition.hexId, tags: definition.tags ?? [] } });
            }
            if (node.merges >= definition.merges) node.phase = 'resolution';
          }
        } else if (command.type === 'resolve' && node?.phase === 'resolution') {
          node.phase = 'complete'; node.completedAt = now; delete node.board;
          events.push({ version: 1, id: `local-incursion:${world.createdAt}:${run.definition.id}:${definition.id}`, kind: 'incursion_completed', source: 'mission', sourceRevision: world.revision + 1, contentRevision: 0, occurredAt: now, quantity: 1, context: { targetId: `${run.definition.id}:${definition.id}`, regionId: definition.hexId, companionId: definition.companionId ?? 'mossprout', tags: definition.tags ?? [] } });
          if (nodes.every(n => run.nodes[n.id]?.phase === 'complete')) {
            run.completedAt = now;
            if (run.definition.completionKeepsakeId) grantKeepsake(world, run, run.definition.completionKeepsakeId, now);
          }
        }
      }
    }
  }
  if (command.type !== 'refresh' && command.type !== 'move') local.recentActivity = [...(local.recentActivity ?? []), { kind: command.type, at: now, ...('eventId' in command ? { eventId: command.eventId } : {}), ...('nodeId' in command ? { nodeId: command.nodeId } : {}), ...('tierId' in command ? { tierId: command.tierId } : {}) }].slice(-200);
  world = projectLocalEvents(world, events, now);
  world.revision = source.revision + 1;
  world.updatedAt = now;
  return { world, events };
}
