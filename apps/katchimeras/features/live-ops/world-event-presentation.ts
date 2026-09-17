import { gameNow } from '@/utils/game-clock';
import type { ConversationDefinition } from '@/types/companion-conversation';
import type { HarmonyState, LiveEventDefinition } from '@/types/live-ops';
import type { LocalEventRun } from '@/types/local-live-ops';
import type { MergeWorldState } from '@/types/merge-world';
import { localEventLock } from './local-runtime';
import { eventPhase } from './rules';

/** Read pinned definitions first: installed updates cannot rewrite an ongoing adventure. */
export function worldEventActions(world: MergeWorldState, harmony: HarmonyState, catalog: readonly LiveEventDefinition[], now = gameNow()) {
  const runs = world.localLiveOps?.runs ?? {};
  const definitions = new Map([...catalog, ...Object.values(runs).map(run => run.definition)].map(definition => [definition.id, definition]));
  return [...definitions.values()].flatMap(event => {
    const run = runs[event.id];
    if (eventPhase(event, Math.max(now, world.localLiveOps?.clock ?? 0)) !== 'active' || (!run && localEventLock(world, harmony, event))) return [];
    const encounter = event.encounters?.find(node => run?.nodes[node.id]?.phase !== 'complete');
    if (!encounter) return [];
    if (encounter.companionId && encounter.companionId !== 'mossprout' && !world.companionDiscovery.records.some(record => record.characterId === encounter.companionId)) return [];
    const state = run?.nodes[encounter.id] as LocalEventRun['nodes'][string] | undefined;
    return [{ event, encounter, state, phase: state?.phase ?? 'opening' as const }];
  });
}
export type WorldEventAction = ReturnType<typeof worldEventActions>[number];
export type WorldEventSelection = { eventId: string; nodeId: string; kind: 'opening' | 'board' | 'resolution' };

/** Contextual conversations use the normal hosted character renderer, never the random chat pool. */
export function worldEventConversation(action: WorldEventAction, phase: 'opening' | 'resolution'): ConversationDefinition {
  return {
    id: `world-event:${action.event.id}:${action.event.version}:${action.encounter.id}:${phase}`,
    version: action.event.version, familyId: action.encounter.companionId ?? 'mossprout', title: action.encounter.title,
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 0, contextualOnly: true,
    tags: ['required-narrative-overlay', 'live-event'],
    format: 'narrative', purpose: 'journey', repeatPolicy: 'once_ever', entryNodeId: 'story',
    nodes: [{ id: 'story', kind: 'choice', interactionKind: 'navigation', prompt: phase === 'opening' ? action.encounter.opening : action.encounter.resolution,
      options: [{ id: 'continue', label: phase === 'opening' ? 'Let’s help' : 'A little more light', reply: '', nextNodeId: 'end' }] },
      { id: 'end', kind: 'end', message: phase === 'opening' ? 'We can make what we need in the garden.' : 'Thank you for helping our home.' }],
  };
}
