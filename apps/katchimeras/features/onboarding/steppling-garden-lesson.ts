import type { MergeWorldState, MergeOrder } from '@/types/merge-world';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import type { FtueStepDefinition, FtueTarget } from './ftue-types';
import { closestPairOnBoard } from '@/features/content-flow/merge-lesson-recipe';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { HATCHABLE_COMPANIONS, hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { HATCHABLE_LESSON_FINALE_NODE_IDS, hatchableFlows } from './hatchable-flows';

/**
 * A hatchable companion's garden lesson: their parcel opened on the Main
 * Board, the first piece grown from their spawner, the first request served.
 * The flow is generated from the definition (`hatchable-flows.ts`); the
 * checkpoint, drop rule and board guidance below read the same definition.
 * Steppling's names are kept for his saves and callers.
 */
export const STEPPLING_GARDEN_RUN_ID = STEPPLING_HATCHABLE.lesson.flow.runId;
export const STEPPLING_PARCEL_ID = STEPPLING_HATCHABLE.lesson.parcelArrivalId;
export const STEPPLING_SHOE_ORDER_ID = STEPPLING_HATCHABLE.lesson.order.id;
export const STEPPLING_GARDEN_CLOSING = STEPPLING_HATCHABLE.lesson.closing;
/**
 * Scene nodes after the merge tasks; the board is unlocked and the companion
 * surface owns the screen. The Kingdom goal that follows the summary is owned
 * by the Kingdom screen (`MergeWorldState.kingdomGoal`), not by this run.
 */
export const STEPPLING_FINALE_NODE_IDS: readonly string[] = HATCHABLE_LESSON_FINALE_NODE_IDS;

export const STEPPLING_GARDEN_FLOW = hatchableFlows(STEPPLING_HATCHABLE).gardenLesson;

/** A companion's lesson record: the new map first, Steppling's older field behind it. */
export function gardenLessonRecord(state: MergeWorldState, companion: HatchableCompanionDefinition['companion']) {
  return state.gardenLessons?.[companion] ?? (companion === 'steppling' ? state.stepplingGardenLesson : undefined);
}
/** Writes a companion's lesson record, mirroring Steppling's into the field older builds read. */
export function withGardenLessonRecord(state: MergeWorldState, companion: HatchableCompanionDefinition['companion'], record: { preparedAt: number; servedAt?: number } | undefined): MergeWorldState {
  const gardenLessons = { ...state.gardenLessons };
  if (record) gardenLessons[companion] = record; else delete gardenLessons[companion];
  return { ...state, gardenLessons, ...(companion === 'steppling' ? { stepplingGardenLesson: record } : {}) };
}
/** The lesson's request has been served, by any of the records that can say so. */
export function lessonOrderServed(state: MergeWorldState, definition: HatchableCompanionDefinition): boolean {
  return gardenLessonRecord(state, definition.companion)?.servedAt != null
    || state.externalRewardReceipts.some((receipt) => receipt.id === `merge-story-served:${definition.lesson.order.id}`)
    || Boolean(state.companionDiscovery.records.find((record) => record.characterId === definition.companion)?.firstOrderCompletedAt);
}
export function stepplingShoeServed(state: MergeWorldState): boolean {
  return lessonOrderServed(state, STEPPLING_HATCHABLE);
}
export function lessonOrder(definition: HatchableCompanionDefinition, now: number): MergeOrder {
  return { ...definition.lesson.order, createdAt: now };
}
/** Prepares a companion's lesson once: its record, and its request on the rail unless already served. */
export function prepareGardenLesson(state: MergeWorldState, definition: HatchableCompanionDefinition, now: number): MergeWorldState {
  if (gardenLessonRecord(state, definition.companion)) return state;
  const served = lessonOrderServed(state, definition);
  const order = lessonOrder(definition, now);
  const prepared = withGardenLessonRecord(state, definition.companion, { preparedAt: now });
  return { ...prepared, activeOrders: served || state.activeOrders.some((entry) => entry.id === order.id) ? state.activeOrders : [...state.activeOrders, order] };
}
export function prepareStepplingGarden(state: MergeWorldState, now: number): MergeWorldState {
  return prepareGardenLesson(state, STEPPLING_HATCHABLE, now);
}
/** The companion whose lesson is under way on this spawner: prepared, unserved, and this is their spawner. */
export function lessonOnGenerator(state: MergeWorldState, generatorId: string): HatchableCompanionDefinition | null {
  return HATCHABLE_COMPANIONS.find((definition) => definition.lesson.generatorId === generatorId && gardenLessonRecord(state, definition.companion) && !lessonOrderServed(state, definition)) ?? null;
}
/** The companion whose lesson request this is, if any. */
export function lessonForOrder(orderId: string, characterId: string): HatchableCompanionDefinition | null {
  const definition = hatchableByCompanion(characterId);
  return definition && definition.lesson.order.id === orderId ? definition : null;
}
/** Where the lesson stands, read from the board: parcel unopened, growing, or ready to serve. */
export function lessonCheckpoint(state: MergeWorldState, definition: HatchableCompanionDefinition): string {
  if (lessonOrderServed(state, definition)) return 'closing';
  if (!state.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === definition.lesson.generatorId)) return 'parcel';
  const items = state.board.filter((cell) => !cell.locked && cell.occupant?.kind === 'item').map((cell) => cell.occupant);
  if (items.some((item) => item?.kind === 'item' && item.definitionId === definition.lesson.growDefinitionId)) return 'serve';
  return 'grow';
}
export function stepplingGardenCheckpoint(state: MergeWorldState): string {
  return lessonCheckpoint(state, STEPPLING_HATCHABLE);
}
/** The lesson's first tier, and only that, until the grown piece is on the board: it is merged, never dropped. */
export function lessonDrop(state: MergeWorldState, generatorId: string): string | null {
  const definition = lessonOnGenerator(state, generatorId);
  return definition && lessonCheckpoint(state, definition) === 'grow' ? definition.lesson.dropDefinitionId : null;
}
export function stepplingGardenDrop(state: MergeWorldState, generatorId: string): string | null {
  return generatorId === STEPPLING_HATCHABLE.lesson.generatorId ? lessonDrop(state, generatorId) : null;
}
/** The board's guidance for a lesson node, from the definition's copy. */
export function lessonBoardStep(nodeId: string, state: MergeWorldState, definition: HatchableCompanionDefinition): FtueStepDefinition | null {
  if (nodeId === 'complete') return null;
  const { lesson } = definition;
  const base = { id: `${lesson.eventPrefix}.${nodeId}`, surface: 'merge' as const, actions: [] };
  if (HATCHABLE_LESSON_FINALE_NODE_IDS.includes(nodeId)) return { ...base, guide: lesson.copy.finale, interaction: { mode: 'blocked' } };
  if (nodeId === 'parcel' && !state.board.some((cell) => !cell.locked && !cell.mist && !cell.occupant)) {
    return { ...base, guide: lesson.copy.room };
  }
  if (nodeId === 'grow') {
    // Free: the Garden lesson just taught this shape. The finger only points after a pause, at the pair or the spawner.
    const pair = closestPairOnBoard(state.board);
    const cue: FtueStepDefinition['cue'] = pair
      ? { kind: 'drag', from: { kind: 'board_cell', cell: pair.from }, to: { kind: 'board_cell', cell: pair.to } }
      : { kind: 'tap', target: { kind: 'board_generator', generatorId: lesson.generatorId } };
    return { ...base, guide: lesson.copy.grow, cue, interaction: { mode: 'none' } };
  }
  if (nodeId === 'serve') return { ...base, guide: lesson.copy.serve,
    cue: { kind: 'tap', target: { kind: 'order_serve', orderId: lesson.order.id } }, spotlight: { targets: [{ kind: 'order_card', orderId: lesson.order.id }] },
    interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: lesson.order.id } } } };
  const target: FtueTarget = { kind: 'tray_parcel', arrivalId: lesson.parcelArrivalId };
  return { ...base, guide: lesson.copy.parcel,
    cue: { kind: 'tap', target }, spotlight: { targets: [target] }, interaction: { mode: 'exclusive', allowed: { kind: 'parcel_tap', target } } };
}
export function stepplingGardenBoardStep(nodeId: string, state: MergeWorldState): FtueStepDefinition | null {
  return lessonBoardStep(nodeId, state, STEPPLING_HATCHABLE);
}
