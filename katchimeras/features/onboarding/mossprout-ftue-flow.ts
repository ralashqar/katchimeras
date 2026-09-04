import type { ContentFlowAction, ContentFlowNode, ContentFlowRequirement, ContentFlowSurface } from '@/types/content-flow';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { defineStoryVariants } from '@/features/content-flow/story-variant-registry';
import { storyOperations, upgradeWorldTargetRecipe } from '@/features/content-flow/story-world-operations';
import { MOSSPROUT_FTUE_REST_MS } from '@/game/katchimeras/relationship-progression';

const scene = (id: string, surface: ContentFlowSurface, actions: readonly ContentFlowAction[]): ContentFlowNode => ({
  id,
  kind: 'scene',
  capability: 'legacy.ftue.scene',
  surface,
  sceneId: `ftue:${id}`,
  payload: { legacyFtueStepId: id },
  actions,
});

const task = (
  id: string,
  surface: ContentFlowSurface,
  requirement: ContentFlowRequirement,
): ContentFlowNode => ({
  id,
  kind: 'task',
  capability: 'legacy.ftue.task',
  surface,
  taskId: `ftue:${id}`,
  payload: { legacyFtueStepId: id },
  mode: 'any',
  requirements: [requirement],
  next: requirement.next!,
});

const ftueEvent = (type: string, where?: ContentFlowRequirement['event']['where']) => ({
  type: `ftue.${type}`,
  where,
});

const MOSSPROUT_GARDEN_FOCUS_TARGET = {
  kind: 'haven_structure',
  structureId: 'mossprout-hex-garden',
} as const;

// Every authored visit to the Garden uses this composition. Keeping it beside
// the content-flow nodes prevents legacy scene metadata and atomic world
// operations from competing for the camera.
const MOSSPROUT_GARDEN_FOCUS_CAMERA = {
  zoom: 1.28,
  anchorY: 0.55,
  durationMs: 900,
} as const;

/**
 * The shipping first-session graph, authored as a Content Flow manifest.
 *
 * `legacyFtueStepId` is a temporary view-model bridge for the existing FTUE
 * React surfaces. Content Flow owns the durable graph mirror, effect receipts
 * and validation while those surfaces are migrated node-by-node.
 */
export const MOSSPROUT_FTUE_FLOW = defineStory({
  id: 'mossprout-first-session',
  // Independent from the legacy FTUE schema version. Bumping this lets v39
  // journal runs migrate onto the direct manifest without mutating a release.
  version: 47,
  entryNodeId: 'world.egg_intro',
  metadata: {
    kind: 'ftue' as const,
    authoring: 'content-flow',
    projection: 'legacy-ftue-view-model',
    variantId: 'first-bloom',
  },
  nodes: [
    scene('world.egg_intro', 'haven', [{ id: 'world.inspect_mossprout_egg', next: 'egg.opening' }]),
    scene('egg.opening', 'haven', [{ id: 'egg.day_texture', next: 'egg.context' }]),
    scene('egg.context', 'haven', [{ id: 'egg.desired_help', next: 'egg.ready' }]),
    scene('egg.ready', 'haven', [{ id: 'egg.hatch', next: 'companion.first_meeting' }]),
    scene('companion.first_meeting', 'haven', [{ id: 'companion.complete_first_meeting', next: 'effect.relationship.complete_day_one_lesson' }]),
    story.effect({
      id: 'effect.relationship.complete_day_one_lesson',
      capability: 'relationship.complete_day_one_lesson',
      next: 'effect.haven.grant_first_memory',
    }),
    story.effect({
      id: 'effect.haven.grant_first_memory',
      capability: 'haven.grant_first_memory',
      next: 'companion.garden_intro',
    }),
    scene('companion.garden_intro', 'companion', [{ id: 'companion.continue_to_planting', next: 'garden.first-visit.focus' }]),
    storyOperations.focusCamera({
      id: 'garden.first-visit.focus',
      target: MOSSPROUT_GARDEN_FOCUS_TARGET,
      next: 'world.garden_arrival',
      ...MOSSPROUT_GARDEN_FOCUS_CAMERA,
    }),
    scene('world.garden_arrival', 'haven', [{ id: 'world.plant_first_seed', next: 'effect.haven.place_first_memory' }]),
    story.effect({
      id: 'effect.haven.place_first_memory',
      capability: 'haven.place_first_memory',
      next: 'world.seed_planted',
    }),
    scene('world.seed_planted', 'haven', [{ id: 'world.acknowledge_seed_dormant', next: 'merge.seed_drag' }]),
    task('merge.seed_drag', 'merge', {
      id: 'merge.create_sprout',
      event: ftueEvent('merge_completed', { resultDefinitionId: 'nature:garden:2' }),
      next: 'merge.second_seed_drag',
    }),
    task('merge.second_seed_drag', 'merge', {
      id: 'merge.create_second_sprout',
      event: ftueEvent('merge_completed', { resultDefinitionId: 'nature:garden:2' }),
      next: 'merge.first_bloom',
    }),
    task('merge.first_bloom', 'merge', {
      id: 'merge.create_first_bloom',
      event: ftueEvent('merge_completed', { resultDefinitionId: 'nature:garden:3' }),
      next: 'merge.serve_sprout',
    }),
    task('merge.serve_sprout', 'merge', {
      id: 'merge.serve_sprout',
      event: ftueEvent('order_served', { orderId: 'mossprout:chapter-0:first-sprout' }),
      next: 'garden.first-bloom-offer.focus',
    }),
    storyOperations.focusCamera({
      id: 'garden.first-bloom-offer.focus',
      target: MOSSPROUT_GARDEN_FOCUS_TARGET,
      next: 'world.first_bloom_restore',
      ...MOSSPROUT_GARDEN_FOCUS_CAMERA,
    }),
    scene('world.first_bloom_restore', 'haven', [{ id: 'world.restore_with_first_bloom', next: 'garden.first-bloom.focus' }]),
    ...upgradeWorldTargetRecipe({
      id: 'garden.first-bloom',
      target: { kind: 'haven_tile', familyId: 'mossprout' },
      focusTarget: MOSSPROUT_GARDEN_FOCUS_TARGET,
      toLevel: 1,
      economy: { mode: 'normal' },
      camera: MOSSPROUT_GARDEN_FOCUS_CAMERA,
      cameraAlreadyFocused: true,
      presentation: { preset: 'growth', reactionLine: '', showCoins: true },
      next: 'effect.haven.grow_first_memory',
    }),
    story.effect({
      id: 'effect.haven.grow_first_memory',
      capability: 'haven.grow_first_memory',
      next: 'world.first_seed_grew',
    }),
    scene('world.first_seed_grew', 'haven', [{ id: 'world.acknowledge_first_seed_growth', next: 'effect.relationship.first_bloom_bond' }]),
    story.effect({
      id: 'effect.relationship.first_bloom_bond',
      capability: 'relationship.first_bloom_bond',
      next: 'companion.water_together',
    }),
    scene('companion.water_together', 'companion', [{ id: 'companion.choose_water_together', next: 'companion.first_rest' }]),
    scene('companion.first_rest', 'companion', [{ id: 'companion.begin_rest', next: 'effect.relationship.begin_meditation' }]),
    story.effect({
      id: 'effect.relationship.begin_meditation',
      capability: 'relationship.begin_meditation',
      payload: { familyId: 'mossprout', durationMs: MOSSPROUT_FTUE_REST_MS, reason: 'journey_rest' },
      next: 'companion.meditating',
    }),
    scene('companion.meditating', 'companion', [{ id: 'companion.tend_garden', next: 'effect.haven.start_glow_discovery' }]),
    story.effect({ id: 'effect.haven.start_glow_discovery', capability: 'haven.start_glow_discovery', next: 'complete' }),
    story.complete(),
  ],
  migrations: {
    'effect.haven.prepare_merge_handoff': 'effect.haven.start_glow_discovery',
    'merge.handoff.spawn': 'effect.haven.start_glow_discovery',
    'merge.handoff.merge': 'effect.haven.start_glow_discovery',
    'world.complete': 'companion.meditating',
    'haven.first_bloom': 'world.first_bloom_restore',
    'effect.haven.seed_first_memory': 'effect.haven.grant_first_memory',
    'companion.day_one_action': 'effect.relationship.complete_day_one_lesson',
    'companion.bond_spotlight': 'companion.garden_intro',
    'companion.order_preview': 'companion.garden_intro',
    'world.garden_handoff': 'world.seed_planted',
    'companion.chapter_zero_return': 'companion.water_together',
    'companion.water_response': 'companion.first_rest',
    'companion.first_insight': 'companion.first_rest',
  },
});

/** Add experimental manifests here; each variant must use a distinct version. */
export const MOSSPROUT_FTUE_VARIANTS = defineStoryVariants({
  id: 'mossprout-ftue',
  defaultVariantId: 'first-bloom',
  variants: [{ id: 'first-bloom', label: 'First Bloom', definition: MOSSPROUT_FTUE_FLOW }],
});
