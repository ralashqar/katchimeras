import { useEffect, useMemo, useState } from 'react';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowCommand, ContentFlowRun } from '@/types/content-flow';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { HATCHABLE_COMPANIONS, hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { hatchableGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { hatchableEggProgress } from './steppling-egg-policy';
import { glowDiscoveryLessonReady } from './glow-discovery-flow';
import { HATCHABLE_EGG_ENTERED_EVENT, HATCHABLE_LESSON_FINALE_NODE_IDS, HATCHABLE_MISSION_CLEAR_NODE_ID, HATCHABLE_MISSION_CLEARED_EVENT, hatchableFlows } from './hatchable-flows';
import { lessonCheckpoint } from './steppling-garden-lesson';

/**
 * The runtime every hatchable companion shares: their discovery run (the
 * misted tile, the mission, the paid reveal, the Egg), their garden lesson run,
 * and the events the screens record into them. Everything is keyed by the
 * companion's definition; nothing here names a friend.
 */

// ---------------------------------------------------------------- the discovery

const pendingStarts = new Map<MergeCharacterId, Promise<ContentFlowRun | null>>();

/** Starts the discovery once, or recovers a saved one; nothing to do once the friend is home. */
export function startHatchableDiscovery(definition: HatchableCompanionDefinition) {
  const { companion } = definition;
  let pending = pendingStarts.get(companion);
  if (!pending) {
    pending = (async () => {
      const flow = hatchableFlows(definition).discovery;
      const world = await loadMergeWorldState();
      const existing = await loadContentFlowRun(definition.discoveryFlow.runId);
      if (existing) {
        const recovered = await reduceContentFlowRunAtomically({ runId: existing.runId, reduce: (run) => migrateHatchableEggHandoff(definition, run, world) });
        if (recovered.run?.status === 'completed') return recovered.run;
        return dispatchContentFlowCommand(existing.runId, { type: 'retry' });
      }
      if (world.companionDiscovery.records.some((record) => record.characterId === companion)) return null;
      return startContentFlow(flow, { runId: definition.discoveryFlow.runId });
    })().finally(() => { pendingStarts.delete(companion); });
    pendingStarts.set(companion, pending);
  }
  return pending;
}

export async function submitHatchableAction(definition: HatchableCompanionDefinition, actionId: string) {
  return dispatchContentFlowCommand(definition.discoveryFlow.runId, { type: 'submit_scene', actionId });
}

/** Recover the discovery's garden lesson from domain facts after a process kill between board persistence and event delivery. */
export async function reconcileHatchableLesson(definition: HatchableCompanionDefinition, world: MergeWorldState) {
  const lesson = definition.discoveryFlow.gardenLesson;
  if (!lesson) return;
  const run = await loadContentFlowRun(definition.discoveryFlow.runId);
  if (!run || run.status !== 'active' || !world.glowDiscoveryLesson) return;
  if (!glowDiscoveryLessonReady(run.nodeId, world)) return;
  // A journaled event id is never reduced twice, so a node the run revisits
  // (migration, rewind) would otherwise sit at its evidence forever while the
  // Basket keeps spawning. Scope the id to this visit; the interpreter ignores
  // events for a node that is no longer waiting, so replays stay harmless.
  await dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:${run.nodeId}:domain-complete:${run.revision}`, type: `${lesson.lessonPrefix}.${run.nodeId}`, runId: run.runId, nodeId: run.nodeId, payload: {}, occurredAt: Date.now(),
  } });
}

/** An accepted reveal from an old save still needs to deliver the encounter. */
export function migrateHatchableEggHandoff(definition: HatchableCompanionDefinition, run: ContentFlowRun, world: MergeWorldState): ContentFlowRun {
  if (run.definitionVersion >= 5 || run.status !== 'completed') return run;
  if (hatchableEggProgress(world, definition) || world.companionDiscovery.records.some((record) => record.characterId === definition.companion) || hatchableGatewayState(world, definition) !== 'egg') return run;
  return { ...run, definitionVersion: hatchableFlows(definition).discovery.version, status: 'active', completedAt: null, nodeId: 'egg.enter', phase: 'entering', error: null, updatedAt: Date.now() };
}

export async function recoverHatchableEggHandoff(definition: HatchableCompanionDefinition, world: MergeWorldState) {
  const result = await reduceContentFlowRunAtomically({ runId: definition.discoveryFlow.runId, reduce: (run) => migrateHatchableEggHandoff(definition, run, world) });
  if (result.run?.nodeId === 'egg.enter' && result.run.status !== 'completed') {
    await dispatchContentFlowCommand(definition.discoveryFlow.runId, { type: 'retry' });
    if (hatchableEggProgress(world, definition)?.hatchedAt || world.companionDiscovery.records.some((record) => record.characterId === definition.companion)) await acknowledgeHatchableEggEntry(definition);
  }
}

/**
 * The mission board filled its bar: the story moves on to the paid reveal.
 * Recorded when the final item strikes the tile, or on resume if the saved
 * board already shows the bar full. The event id is scoped to the visit, so
 * a replay on a later revisit is not ignored as a duplicate.
 */
export async function completeHatchableMission(definition: HatchableCompanionDefinition) {
  const run = await loadContentFlowRun(definition.discoveryFlow.runId);
  if (!run || run.nodeId !== HATCHABLE_MISSION_CLEAR_NODE_ID || run.status !== 'active') return run;
  return dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:${HATCHABLE_MISSION_CLEAR_NODE_ID}:cleared:${run.revision}`, type: HATCHABLE_MISSION_CLEARED_EVENT, runId: run.runId, nodeId: HATCHABLE_MISSION_CLEAR_NODE_ID, payload: {}, occurredAt: Date.now(),
  } });
}

export async function acknowledgeHatchableEggEntry(definition: HatchableCompanionDefinition) {
  const run = await loadContentFlowRun(definition.discoveryFlow.runId);
  if (!run || run.nodeId !== 'egg.enter' || run.status === 'completed') return;
  const next = await dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:egg.enter:ready`, type: HATCHABLE_EGG_ENTERED_EVENT, runId: run.runId, nodeId: 'egg.enter', payload: {}, occurredAt: Date.now(),
  } });
  if (next?.status !== 'completed') throw new Error('Could not save the egg handoff');
}

const upgradeQueues = new Map<MergeCharacterId, Promise<unknown>>();
/**
 * The bubble must advance the saved story, never start an ordinary purchase.
 * Opening it lands on the mission board; there is no confirm step any more
 * (the mission is the price), so `confirm` only ever repairs an old save.
 */
export function advanceHatchableUpgrade(definition: HatchableCompanionDefinition, action: 'open' | 'confirm'): Promise<ContentFlowRun> {
  const runId = definition.discoveryFlow.runId;
  const queue = upgradeQueues.get(definition.companion) ?? Promise.resolve();
  const operation = queue.then(async () => {
    let run = await loadContentFlowRun(runId);
    if (!run) throw new Error('The mist story could not load. Please try again.');
    const dispatch = async (command: ContentFlowCommand) => {
      const next = await dispatchContentFlowCommand(runId, command);
      if (!next || next.status === 'failed_recoverable') throw new Error(next?.error ?? 'The mist upgrade paused. Please try again.');
      if (command.type === 'submit_scene' && next.nodeId === run!.nodeId) throw new Error('The upgrade did not advance. Please try again.');
      run = next;
    };
    if (run.status === 'failed_recoverable' || run.nodeId === 'gateway.return') await dispatch({ type: 'retry' });
    if (run.nodeId === 'gateway.ready') await dispatch({ type: 'submit_scene', actionId: 'return' });
    if (run.nodeId === 'gateway.offer') await dispatch({ type: 'submit_scene', actionId: 'open_upgrade' });
    void action;
    if (run.nodeId !== 'mission.focus' && run.nodeId !== HATCHABLE_MISSION_CLEAR_NODE_ID && !run.nodeId.startsWith('gateway.purchase.')
      && !['gateway.egg', 'egg.enter', 'complete'].includes(run.nodeId)) {
      throw new Error('Finish the Garden request before clearing this mist.');
    }
    return run;
  });
  upgradeQueues.set(definition.companion, operation.catch(() => undefined));
  return operation;
}

/** Repair only an already purchased clearing; never buy automatically. The
 * existing unlock makes the original receipt-backed effect charge zero again. */
export async function recoverPaidHatchableUpgrade(definition: HatchableCompanionDefinition, world: MergeWorldState) {
  if (!world.worldUnlocks?.[definition.tile.unlockId]) return null;
  const run = await loadContentFlowRun(definition.discoveryFlow.runId);
  if (!run || run.status === 'completed' || !['gateway.ready', 'gateway.return', 'gateway.offer'].includes(run.nodeId)) return null;
  return advanceHatchableUpgrade(definition, 'confirm');
}

// ---------------------------------------------------------------- the garden lesson

function registerGardenLessonFlow(definition: HatchableCompanionDefinition) {
  registerContentFlowDefinition(hatchableFlows(definition).gardenLesson);
}

/**
 * A save can hold a node this version no longer authors — an interim build put
 * the Kingdom goal inside this run. The director only migrates such a node on
 * its next command, and no surface can be drawn for an unknown node, so nothing
 * would ever dispatch: the lesson would stay active forever and keep the
 * Kingdom's camera locked. Repair it on read instead, at the authored fallback.
 */
async function repairUnknownLessonNode(definition: HatchableCompanionDefinition, run: ContentFlowRun | null) {
  const flow = hatchableFlows(definition).gardenLesson;
  const nodeIds = new Set(flow.nodes.map((node) => node.id));
  if (!run || run.status === 'completed' || nodeIds.has(run.nodeId)) return run;
  const migrations: Readonly<Record<string, string>> = flow.migrations ?? {};
  const nodeId = migrations[run.nodeId] ?? 'closing';
  const repaired = await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => (
    current.status === 'completed' || nodeIds.has(current.nodeId) ? current : {
      ...current, definitionVersion: flow.version, nodeId, phase: 'awaiting_input' as const,
      status: 'active' as const, error: null, updatedAt: Date.now(), revision: current.revision + 1,
    }) });
  return repaired.run ?? run;
}

export async function readGardenLessonRun(definition: HatchableCompanionDefinition) {
  return await repairUnknownLessonNode(definition, await loadContentFlowRun(definition.lesson.flow.runId));
}

const lessonStarts = new Map<MergeCharacterId, Promise<ContentFlowRun>>();
export function ensureGardenLesson(definition: HatchableCompanionDefinition) {
  let starting = lessonStarts.get(definition.companion);
  if (!starting) {
    starting = (async () => {
      registerGardenLessonFlow(definition);
      return await readGardenLessonRun(definition) ?? await startContentFlow(hatchableFlows(definition).gardenLesson, { runId: definition.lesson.flow.runId });
    })().finally(() => { lessonStarts.delete(definition.companion); });
    lessonStarts.set(definition.companion, starting);
  }
  return starting;
}

export async function reconcileGardenLesson(definition: HatchableCompanionDefinition, state: MergeWorldState) {
  const run = await readGardenLessonRun(definition);
  if (!run || run.status === 'completed' || HATCHABLE_LESSON_FINALE_NODE_IDS.includes(run.nodeId)) return;
  const nodeId = lessonCheckpoint(state, definition);
  if (nodeId === run.nodeId) return;
  await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' || HATCHABLE_LESSON_FINALE_NODE_IDS.includes(current.nodeId)
    || Number(current.variables.boardRevision ?? -1) > state.revision ? current : {
    ...current, nodeId, variables: { ...current.variables, boardRevision: state.revision }, phase: nodeId === 'closing' ? 'awaiting_input' : 'awaiting_event', updatedAt: Date.now(), revision: current.revision + 1,
  } });
}

export function advanceGardenFinale(definition: HatchableCompanionDefinition, actionId: 'summary' | 'finish') {
  registerGardenLessonFlow(definition);
  return dispatchContentFlowCommand(definition.lesson.flow.runId, { type: 'submit_scene', actionId });
}

// ---------------------------------------------------------------- every companion's runs, and which one is live

export type HatchableRuns = {
  ready: boolean;
  discovery: Partial<Record<MergeCharacterId, ContentFlowRun | null>>;
  lessons: Partial<Record<MergeCharacterId, ContentFlowRun | null>>;
};

const EMPTY_RUNS: HatchableRuns = { ready: false, discovery: {}, lessons: {} };

/**
 * Every hatchable companion's discovery and garden-lesson runs, refreshed on
 * every journal write. One subscription for the whole registry, so screens
 * never call a hook per companion.
 */
export function useHatchableRuns(): HatchableRuns {
  const [runs, setRuns] = useState<HatchableRuns>(EMPTY_RUNS);
  useEffect(() => {
    HATCHABLE_COMPANIONS.forEach(registerGardenLessonFlow);
    let live = true; let revision = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const request = ++revision;
      void Promise.all(HATCHABLE_COMPANIONS.map(async (definition) => [definition.companion, await loadContentFlowRun(definition.discoveryFlow.runId), await readGardenLessonRun(definition)] as const))
        .then((entries) => {
          if (!live || request !== revision) return;
          setRuns({
            ready: true,
            discovery: Object.fromEntries(entries.map(([companion, discovery]) => [companion, discovery])),
            lessons: Object.fromEntries(entries.map(([companion, , lesson]) => [companion, lesson])),
          });
        })
        .catch(() => { if (live && request === revision) retry = setTimeout(refresh, 1000); });
    };
    refresh();
    const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { live = false; clearTimeout(retry); unsubscribe(); };
  }, []);
  return runs;
}

const active = (run: ContentFlowRun | null | undefined) => Boolean(run && run.status !== 'completed');

/**
 * The companion whose discovery is the Kingdom's business right now: the one
 * with a live discovery run, else the first not yet home, else the first
 * authored. The garden lesson is chosen the same way, from lesson runs.
 */
export function activeHatchableFor(world: MergeWorldState | null, runs: HatchableRuns): { discovery: HatchableCompanionDefinition; lesson: HatchableCompanionDefinition } {
  const first = HATCHABLE_COMPANIONS[0]!;
  // A live run first; then a friend whose tile is cleared but who has not hatched (their run completes at the
  // Egg's entry, before the questions and the hatch); then the first friend still under the Mist.
  const discovery = HATCHABLE_COMPANIONS.find((definition) => active(runs.discovery[definition.companion]))
    ?? (world ? HATCHABLE_COMPANIONS.find((definition) => hatchableGatewayState(world, definition) === 'egg') : undefined)
    ?? (world ? HATCHABLE_COMPANIONS.find((definition) => hatchableGatewayState(world, definition) !== 'open') : undefined)
    ?? first;
  const lesson = HATCHABLE_COMPANIONS.find((definition) => active(runs.lessons[definition.companion])) ?? discovery;
  return { discovery, lesson };
}

/** A lesson's live state for one companion, from the shared runs. */
export function gardenLessonFor(runs: HatchableRuns, definition: HatchableCompanionDefinition) {
  const run = runs.lessons[definition.companion] ?? null;
  return { run, ready: runs.ready, active: active(run) };
}

/** The runs and the live companion in one hook, for screens that need both. */
export function useActiveHatchable(world: MergeWorldState | null) {
  const runs = useHatchableRuns();
  return useMemo(() => {
    const { discovery, lesson } = activeHatchableFor(world, runs);
    return {
      runs, discovery, lesson,
      discoveryRun: runs.discovery[discovery.companion] ?? null,
      gardenLesson: gardenLessonFor(runs, lesson),
    };
  }, [runs, world]);
}

export const hatchableForCompanion = (companion: string) => hatchableByCompanion(companion);
