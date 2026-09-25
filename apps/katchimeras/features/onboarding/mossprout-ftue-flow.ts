import type { ContentFlowAction, ContentFlowNode, ContentFlowRequirement, ContentFlowSurface } from '@/types/content-flow';
import { defineStory, story } from '@/features/content-flow/story-manifest';
import { defineStoryVariants } from '@/features/content-flow/story-variant-registry';
import { storyOperations } from '@/features/content-flow/story-world-operations';
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
  // v57: the Last Clearing (`docs/cozy-4x-ftue-the-last-clearing.md`), the cozy 4X first session. The game is not
  // launched, so there is no migration of meaning: every retired beat simply ends an old run.
  // v58: step 3, the Heart Tree woken and the Sanctuary founded after the Mist pulls back.
  // v59: step 4, the frontier pull-out, the Lost Trail's tracks and its mission card.
  // v60: step 5, the Lost Trail's three battles, Steppling's rescue and joining, and home.
  version: 60,
  entryNodeId: 'world.mist_open',
  metadata: {
    kind: 'ftue' as const,
    authoring: 'content-flow',
    projection: 'legacy-ftue-view-model',
    variantId: 'last-clearing',
  },
  nodes: [
    // The cold open: black, the lore, the sink through the Mist to the last lit clearing.
    scene('world.mist_open', 'haven', [{ id: 'world.look_closer', next: 'world.guardian' }]),
    // The guardian: Mossprout meets the Wayfinder.
    scene('world.guardian', 'haven', [{ id: 'world.meet_guardian', next: 'world.mist_clear' }]),
    // "They found us": the first battle.
    task('world.mist_clear', 'haven', { id: 'world.clear_mist', event: ftueEvent('battle_won'), count: 1, next: 'world.mist_lift' }),
    // The Mist pulls back from the clearing.
    scene('world.mist_lift', 'haven', [{ id: 'world.mist_lifted', next: 'effect.haven.opening_glow' }]),
    // The light that drove the wisps off stays with you: it will wake the Heart Tree.
    story.effect({ id: 'effect.haven.opening_glow', capability: 'haven.opening_glow', next: 'world.heart_tree' }),
    // The Heart Tree: the camera pushes in, and the first light wakes it.
    scene('world.heart_tree', 'haven', [{ id: 'world.restore_heart_tree', next: 'effect.haven.restore_heart_tree' }]),
    story.effect({ id: 'effect.haven.restore_heart_tree', capability: 'haven.restore_heart_tree', next: 'world.sanctuary_founded' }),
    // SANCTUARY FOUNDED.
    scene('world.sanctuary_founded', 'haven', [{ id: 'world.found_sanctuary', next: 'world.frontier' }]),
    // THE FIRST GROVE: the pull-out over the Mist to the Hollow Tree.
    scene('world.frontier', 'haven', [{ id: 'world.see_frontier', next: 'world.lost_tracks' }]),
    // The tracks into the Mist, and someone still in there.
    scene('world.lost_tracks', 'haven', [{ id: 'world.follow_tracks', next: 'world.lost_trail_mission' }]),
    // FOLLOW THE LOST TRAIL (its levels are step 5).
    scene('world.lost_trail_mission', 'haven', [{ id: 'world.accept_lost_trail', next: 'world.trail_stone_1' }]),
    // The Lost Trail: three battles docked under the trail, the last a rescue.
    task('world.trail_stone_1', 'haven', { id: 'world.clear_trail_1', event: ftueEvent('battle_won'), count: 1, next: 'world.trail_stone_2' }),
    task('world.trail_stone_2', 'haven', { id: 'world.clear_trail_2', event: ftueEvent('battle_won'), count: 1, next: 'world.trail_stone_3' }),
    task('world.trail_stone_3', 'haven', { id: 'world.clear_trail_3', event: ftueEvent('battle_won'), count: 1, next: 'world.steppling_rescued' }),
    // The Mist bursts off the trail; Steppling is free.
    scene('world.steppling_rescued', 'haven', [{ id: 'world.free_steppling', next: 'world.steppling_meets' }]),
    // Steppling home in the Sanctuary, the reveal, and his first words.
    scene('world.steppling_meets', 'haven', [{ id: 'world.meet_steppling', next: 'effect.haven.steppling_joins' }]),
    story.effect({ id: 'effect.haven.steppling_joins', capability: 'haven.steppling_joins', next: 'world.steppling_joined' }),
    // STEPPLING HAS JOINED YOUR SANCTUARY.
    scene('world.steppling_joined', 'haven', [{ id: 'world.welcome_steppling', next: 'world.home' }]),
    // Home: the first session ends.
    scene('world.home', 'haven', [{ id: 'world.come_home', next: 'complete' }]),
    story.complete(),
  ],
  migrations: Object.fromEntries([
    'world.egg_intro', 'egg.opening', 'egg.context', 'egg.ready', 'companion.first_meeting',
    'effect.relationship.complete_day_one_lesson', 'effect.haven.grant_first_memory', 'garden.first-visit.focus',
    'world.garden_arrival', 'effect.haven.place_first_memory', 'world.first_seed_grew', 'effect.relationship.first_bloom_bond',
    'companion.first_rest', 'effect.relationship.begin_meditation', 'companion.meditating', 'effect.haven.start_glow_discovery',
    'egg.wisps', 'egg.listening', 'merge.seed_drag', 'merge.second_seed_drag', 'merge.first_bloom', 'merge.serve_sprout',
    'world.seed_planted', 'garden.first-bloom-offer.focus', 'world.first_bloom_offer', 'world.first_bloom_restore',
    'garden.first-bloom.focus', 'garden.first-bloom.commit', 'garden.first-bloom.reveal', 'effect.haven.grow_first_memory',
    'effect.haven.prepare_merge_handoff', 'merge.handoff.spawn', 'merge.handoff.merge', 'world.complete', 'haven.first_bloom',
    'effect.haven.seed_first_memory', 'companion.day_one_action', 'companion.bond_spotlight', 'companion.order_preview',
    'world.garden_handoff', 'companion.chapter_zero_return', 'companion.garden_intro', 'companion.water_together',
    'companion.first_grow', 'companion.first_notice', 'companion.notice_bond_spotlight', 'companion.water_response', 'companion.first_insight',
  ].map((id) => [id, 'complete'])),
});

/** Add experimental manifests here; each variant must use a distinct version. */
export const MOSSPROUT_FTUE_VARIANTS = defineStoryVariants({
  id: 'mossprout-ftue',
  defaultVariantId: 'last-clearing',
  variants: [{ id: 'last-clearing', label: 'The Last Clearing', definition: MOSSPROUT_FTUE_FLOW }],
});
