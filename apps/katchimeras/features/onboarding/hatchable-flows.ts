import type { ContentFlowNode } from '@/types/content-flow';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { storyOperations, upgradeWorldTargetRecipe, worldActionScene } from '@/features/content-flow/story-world-operations';
import { mergeLessonRecipe } from '@/features/content-flow/merge-lesson-recipe';
import { hatchableStoryTarget } from '@/constants/hatchable-companions/registry';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from './opening-mist';

/**
 * The three flows every hatchable companion runs, generated from its
 * definition so a new friend authors copy and ids, never nodes:
 *
 * - the discovery: the misted tile's bubble, an optional Garden lesson, the
 *   mission board, the paid reveal, the Egg;
 * - day one: the first conversation's reflection and the parcel it hands over;
 * - the garden lesson: parcel, grow, serve, and the two closing scenes.
 *
 * Node ids are shared across companions (`gateway.offer`, `mission.clear`,
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

export function createHatchableDiscoveryFlow(definition: HatchableCompanionDefinition) {
  const { discoveryFlow: flow } = definition;
  const target = hatchableStoryTarget(definition);
  const lesson = flow.gardenLesson;
  const afterFocus = lesson ? 'garden.open' : 'gateway.offer';
  return defineStory({
    id: flow.id, version: flow.version, entryNodeId: 'gateway.focus', metadata: { kind: 'story' },
    nodes: [
      storyOperations.focusCamera({ id: 'gateway.focus', target, ...MIST_CLOSE_UP, next: afterFocus }),
      ...(lesson ? [
        worldActionScene({ id: 'garden.open', actionId: 'open', next: 'lesson.single.prepare', view: { kind: 'garden', ...lesson.open } }),
        story.effect({ id: 'lesson.single.prepare', capability: lesson.prepareCapability, next: lesson.beats[0]!.id }),
        ...mergeLessonRecipe(lesson.beats, 'gateway.ready', lesson.lessonPrefix),
        worldActionScene({ id: 'gateway.ready', actionId: 'return', next: 'gateway.offer', view: { kind: 'return', ...lesson.ready } }),
      ] : []),
      // Returning to the world exposes the upgrade immediately. Camera framing
      // stays at the existing close-up and must never gate this actionable checkpoint.
      worldActionScene({ id: 'gateway.offer', actionId: 'open_upgrade', next: HATCHABLE_MISSION_FOCUS_NODE_ID, view: { kind: 'purchase', ...flow.offer } }),
      // The bubble opens the mission, not a purchase sheet: the opening's framing on this tile, the board beneath.
      storyOperations.focusCamera({ id: HATCHABLE_MISSION_FOCUS_NODE_ID, target, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900, next: HATCHABLE_MISSION_CLEAR_NODE_ID }),
      story.task({ id: HATCHABLE_MISSION_CLEAR_NODE_ID, capability: HATCHABLE_DISCOVERY_TASK_CAPABILITY, surface: 'haven', taskId: HATCHABLE_MISSION_CLEAR_NODE_ID, requirements: [{ id: 'cleared', event: { type: HATCHABLE_MISSION_CLEARED_EVENT } }], next: 'gateway.purchase.focus' }),
      ...upgradeWorldTargetRecipe({ id: 'gateway.purchase', target, toLevel: 1, economy: { mode: 'normal' }, cameraAlreadyFocused: true, presentation: { preset: definition.tile.revealPreset, reactionLine: '', showCoins: true }, next: 'gateway.egg' }),
      worldActionScene({ id: 'gateway.egg', actionId: 'done', next: 'egg.enter', view: { kind: 'discovery', ...flow.egg } }),
      story.task({ id: 'egg.enter', capability: HATCHABLE_DISCOVERY_TASK_CAPABILITY, surface: 'haven', taskId: 'egg.enter', requirements: [{ id: 'entered', event: { type: HATCHABLE_EGG_ENTERED_EVENT } }], next: 'complete' }),
      story.complete(),
    ],
    migrations: flow.migrations ?? {},
  });
}

export function createHatchableDayOneFlow(definition: HatchableCompanionDefinition) {
  const { dayOne } = definition;
  return defineStory({
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

export function createHatchableGardenLessonFlow(definition: HatchableCompanionDefinition) {
  const { lesson } = definition;
  return defineStory({
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
