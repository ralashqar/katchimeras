/**
 * Public surface of the puzzle engine.
 *
 * Nothing in here imports React or react-native. The race feature must never
 * import this — only `features/match` is allowed to know about both.
 */

export * from './types';
export * from './board';
export * from './shapes';
export * from './slot-types';
export * from './slot-drop';
export * from './slot-grade';
export { pickDiverseShapes, toPieces } from './tray';
export { dealBeat, flankForBeat, slotShapePoolFor } from './slot-deal';
export {
  DEFAULT_LADDER,
  DRIFT_AT_COMBO,
  DRIFT_FLOOR,
  DRIFT_FULL_COMBO,
  maxSlotsOf,
  planBeat,
  rampAt,
  tierFor,
  zonesFor,
  type BeatPlan,
  type BeatTier,
  type Progression,
  type TurnSpec,
  type VarietyRamp,
} from './progression';
export {
  defineVariety,
  hasVariety,
  varietyData,
  type VarietyDef,
  type VarietyRequest,
  type VarietySpec,
} from '../variety/contract';
export { VARIETY_IDS, isVarietyId, type VarietyId } from '../variety/registry';
export {
  beatDeadlineMs,
  beatTargetCells,
  createSlotRun,
  slotReducer,
  type SlotRunOptions,
} from './slot-reducer';
