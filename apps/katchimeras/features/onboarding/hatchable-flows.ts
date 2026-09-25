import type { ContentFlowNode } from '@/types/content-flow';
import type { WorldActionView } from '@/features/content-flow/story-world-operations';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe, worldActionScene } from '@/features/content-flow/story-world-operations';
import { mergeLessonRecipe } from '@/features/content-flow/merge-lesson-recipe';
import { hatchableStoryTarget } from '@/constants/hatchable-companions/registry';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from './opening-mist';
import { HATCHABLE_MISSION_PAID_EVENT, HATCHABLE_MISSION_PAY_NODE_ID } from '@/constants/glow-discovery-ids';

export { HATCHABLE_MISSION_PAID_EVENT, HATCHABLE_MISSION_PAY_NODE_ID };

/**
 * The three flows every hatchable companion runs, generated from its
 * definition so a new friend authors copy and ids, never nodes:
 *
 * - the discovery: an optional Garden lesson, the ticket paid at the tile's
 *   bubble, the mission board, the reveal (free, the ticket was the price),
 *   the Egg;
 * - day one: the first conversation's reflection and the parcel it hands over;
 * - the garden lesson: parcel, grow, serve, and the two closing scenes.
 *
 * Node ids are shared across companions (`gateway.pay`, `mission.clear`,
 * `parcel`, ...) because each companion has its own run; what differs is the
 * flow id, the run id, the copy and the migrations.
 */
export const MIST_CLOSE_UP = { zoom: 1.2, anchorY: 0.46, durationMs: 900 } as const;
export const HATCHABLE_MISSION_FOCUS_NODE_ID = 'mission.focus';
export const HATCHABLE_MISSION_CLEAR_NODE_ID = 'mission.clear';
export const HATCHABLE_MISSION_CLEARED_EVENT = 'glow.mission.cleared';
export const HATCHABLE_EGG_ENTERED_EVENT = 'glow.egg.entered';
export const HATCHABLE_DISCOVERY_TASK_CAPABILITY = 'glow.discovery.task';
/** The beats of a companion's garden lesson, in order; the events are `${eventPrefix}.${beat}`. */
export const HATCHABLE_LESSON_BEATS = ['parcel', 'grow', 'serve'] as const;
export const HATCHABLE_LESSON_FINALE_NODE_IDS: readonly string[] = ['closing', 'summary'];

export function createHatchableDiscoveryFlow(definition: HatchableCompanionDefinition, compile: typeof defineStory = defineStory) {
  const { discoveryFlow: flow } = definition;
  const target = hatchableStoryTarget(definition);
  // The campaign pivot: the Garden board and its lesson are gone. A friend's discovery begins at the ticket, on the
  // marker the player is already looking at; a save parked on a lesson node from before moves there.
  const lesson = null as typeof flow.gardenLesson | null;
  const removedLessonNodes = new Set(['gateway.focus', 'garden.open', 'lesson.single.prepare', 'gateway.ready', ...(flow.gardenLesson?.beats.map((beat) => beat.id) ?? [])]);
  const lessonMigrations = Object.fromEntries([...removedLessonNodes].map((id) => [id, HATCHABLE_MISSION_PAY_NODE_ID]));
  // A definition's own migrations that led to a lesson node lead to the ticket now.
  const ownMigrations = Object.fromEntries(Object.entries(flow.migrations ?? {}).map(([from, to]) => [from, removedLessonNodes.has(to) ? HATCHABLE_MISSION_PAY_NODE_ID : to]));
  return compile({
    id: flow.id, version: flow.version, entryNodeId: lesson ? 'gateway.focus' : HATCHABLE_MISSION_PAY_NODE_ID, metadata: { kind: 'story' },
    nodes: [
      ...(lesson ? [
        storyOperations.focusCamera({ id: 'gateway.focus', target, ...MIST_CLOSE_UP, next: 'garden.open' }),
        worldActionScene({ id: 'garden.open', actionId: 'open', next: 'lesson.single.prepare', view: { kind: 'garden', ...lesson.open } }),
        story.effect({ id: 'lesson.single.prepare', capability: lesson.prepareCapability, next: lesson.beats[0]!.id }),
        ...mergeLessonRecipe(lesson.beats, 'gateway.ready', lesson.lessonPrefix),
        worldActionScene({ id: 'gateway.ready', actionId: 'return', next: HATCHABLE_MISSION_PAY_NODE_ID, view: { kind: 'return', ...lesson.ready } }),
      ] : []),
      // The ticket: the bubble opens the purchase panel, the panel charges the tile's price, and the paid
      // event moves the story on. The board only ever opens on a paid ticket.
      story.task({ id: HATCHABLE_MISSION_PAY_NODE_ID, capability: HATCHABLE_DISCOVERY_TASK_CAPABILITY, surface: 'haven', taskId: HATCHABLE_MISSION_PAY_NODE_ID, requirements: [{ id: 'paid', event: { type: HATCHABLE_MISSION_PAID_EVENT } }], next: HATCHABLE_MISSION_FOCUS_NODE_ID }),
      // Paid: the opening's framing on this tile, the board beneath.
      storyOperations.focusCamera({ id: HATCHABLE_MISSION_FOCUS_NODE_ID, target, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900, next: HATCHABLE_MISSION_CLEAR_NODE_ID }),
      story.task({ id: HATCHABLE_MISSION_CLEAR_NODE_ID, capability: HATCHABLE_DISCOVERY_TASK_CAPABILITY, surface: 'haven', taskId: HATCHABLE_MISSION_CLEAR_NODE_ID, requirements: [{ id: 'cleared', event: { type: HATCHABLE_MISSION_CLEARED_EVENT } }], next: 'gateway.purchase.focus' }),
      // The reveal: the ticket was the price, so the world mutation charges nothing and shows no coins.
      ...upgradeWorldTargetRecipe({ id: 'gateway.purchase', target, toLevel: 1, economy: { mode: 'free', reason: 'The mist mission ticket was paid at the bubble.' }, cameraAlreadyFocused: true, presentation: { preset: definition.tile.revealPreset, reactionLine: '', showCoins: false }, next: flow.arrival === 'rescue' ? 'gateway.rescue' : 'gateway.egg' }),
      ...(flow.arrival === 'rescue' ? [
        // Cozy 4X: no Egg. The friend is rescued straight home (the same write as Steppling's), then welcomed.
        story.effect({ id: 'gateway.rescue', capability: 'haven.friend_joins', payload: { targetId: definition.tile.unlockId, companion: definition.companion }, next: 'gateway.joined' }),
        worldActionScene({ id: 'gateway.joined', actionId: 'done', next: 'complete', view: { kind: 'discovery', ...(flow.joined ?? flow.egg) } }),
      ] : [
        worldActionScene({ id: 'gateway.egg', actionId: 'done', next: 'egg.enter', view: { kind: 'discovery', ...flow.egg } }),
        story.task({ id: 'egg.enter', capability: HATCHABLE_DISCOVERY_TASK_CAPABILITY, surface: 'haven', taskId: 'egg.enter', requirements: [{ id: 'entered', event: { type: HATCHABLE_EGG_ENTERED_EVENT } }], next: 'complete' }),
      ]),
      story.complete(),
    ],
    migrations: { ...lessonMigrations, ...ownMigrations },
  });
}

export function createHatchableDayOneFlow(definition: HatchableCompanionDefinition, compile: typeof defineStory = defineStory) {
  const { dayOne } = definition;
  return compile({
    id: dayOne.flow.id, version: dayOne.flow.version, entryNodeId: 'reflection',
    metadata: { kind: 'journey_day', familyId: definition.companion, day: 1, title: dayOne.flow.title },
    migrations: dayOne.flow.migrations ?? {},
    nodes: [
      { id: 'reflection', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'reflection',
        payload: { text: dayOne.opening, options: dayOne.choices },
        actions: dayOne.choices.map(({ id, label }) => ({ id, next: `handoff.${id}`,
          set: { [dayOne.choiceVariable]: id, 'fact.reflection': `You chose “${label.replace(/^\S+\s+/, '')}”.` } })) },
      ...dayOne.choices.map(({ id }): ContentFlowNode => ({ id: `handoff.${id}`, kind: 'scene',
        capability: 'journey.reflection', surface: 'companion', sceneId: `handoff.${id}`,
        payload: { text: dayOne.handoffs[id], options: [{ id: 'garden', label: dayOne.handoffLabel }] },
        actions: [{ id: 'garden', next: 'parcel' }] })),
      story.effect({ id: 'parcel', capability: 'journey.grant_generator_parcel', payload: { generatorId: dayOne.parcel.generatorId, rewardId: dayOne.parcel.rewardId }, next: 'complete' }),
      story.complete(),
    ],
  });
}

export function createHatchableGardenLessonFlow(definition: HatchableCompanionDefinition, compile: typeof defineStory = defineStory) {
  const { lesson } = definition;
  return compile({
    id: lesson.flow.id, version: lesson.flow.version, entryNodeId: 'parcel', metadata: { kind: 'story' },
    migrations: lesson.flow.migrations ?? {},
    nodes: [
      ...HATCHABLE_LESSON_BEATS.map((id, index, ids) => story.task({
        id, capability: lesson.taskCapability, surface: 'merge', taskId: id,
        requirements: [{ id: 'done', event: { type: `${lesson.eventPrefix}.${id}` } }], next: ids[index + 1] ?? 'closing',
      })),
      { id: 'closing', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'closing',
        payload: { text: lesson.closing }, actions: [{ id: 'summary', next: 'summary' }] },
      { id: 'summary', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'summary',
        payload: { text: lesson.summary },
        actions: [{ id: 'finish', next: 'complete' }] },
      story.complete(),
    ],
  });
}

export type HatchableFlows = {
  discovery: ReturnType<typeof createHatchableDiscoveryFlow>;
  dayOne: ReturnType<typeof createHatchableDayOneFlow>;
  gardenLesson: ReturnType<typeof createHatchableGardenLessonFlow>;
};

const cache = new WeakMap<HatchableCompanionDefinition, HatchableFlows>();

/** A companion's three flows, built once per definition. */
export function hatchableFlows(definition: HatchableCompanionDefinition): HatchableFlows {
  let flows = cache.get(definition);
  if (!flows) {
    flows = { discovery: createHatchableDiscoveryFlow(definition), dayOne: createHatchableDayOneFlow(definition), gardenLesson: createHatchableGardenLessonFlow(definition) };
    cache.set(definition, flows);
  }
  return flows;
}

/** A scene node of a companion's discovery, with its world-action view and the action that leaves it. */
export function hatchableDiscoveryScene(definition: HatchableCompanionDefinition, nodeId: string) {
  const node = hatchableFlows(definition).discovery.nodes.find((candidate) => candidate.id === nodeId);
  return node?.kind === 'scene' ? { view: node.payload?.worldAction as WorldActionView, actionId: node.actions[0].id } : null;
}
