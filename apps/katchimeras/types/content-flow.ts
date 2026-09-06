export * from '@incubator/story/types';
import type { MossproutGardenPlantSlotId } from '@/types/merge-world';
declare module '@incubator/story/types' {
  interface StoryTypeRegistry {
    surface: 'today' | 'hatch' | 'companion' | 'merge' | 'haven' | 'collection' | 'none';
    route: 'today' | 'companion' | 'merge' | 'haven' | 'collection';
  }
}
/** Stable semantic targets shared by camera, spotlight, interaction and presentation operations. */
export type StoryTarget =
  | { kind: 'haven_world' }
  | { kind: 'haven_home' }
  | { kind: 'haven_tile'; familyId: string }
  | { kind: 'haven_resident'; familyId: string }
  | { kind: 'haven_structure'; structureId: string }
  | { kind: 'haven_garden_plot'; slotId: MossproutGardenPlantSlotId }
  | { kind: 'haven_nature_island'; islandId: string }
  | { kind: 'merge_cell'; cell: number }
  | { kind: 'merge_item'; instanceId: string }
  | { kind: 'merge_generator'; generatorId: string }
  | { kind: 'merge_order'; orderId: string }
  | { kind: 'ui_control'; controlId: string };

export type StoryUpgradeEconomyPolicy =
  | { mode: 'normal' }
  | { mode: 'free'; reason: string }
  | { mode: 'grant'; amount: number; reason: string };

export type StoryCameraPresentationPayload = {
  operation: 'focus' | 'fit' | 'preserve' | 'restore';
  target?: StoryTarget;
  targets?: readonly StoryTarget[];
  snapshotId?: string;
  zoom?: number;
  anchorY?: number;
  padding?: number;
  durationMs?: number;
  lockInput?: boolean;
  /** Keep the currently rendered world mounted until the next upgrade
   * presentation takes ownership. Used to bridge an atomic persistence
   * commit without exposing its new art for one frame. */
  holdWorldState?: boolean;
};

export type StoryWorldUpgradeEffectPayload = {
  target: Extract<StoryTarget, { kind: 'haven_tile' | 'haven_nature_island' | 'haven_structure' }>;
  toLevel: number;
  economy: StoryUpgradeEconomyPolicy;
};

export type StoryWorldUpgradePresentationPayload = {
  sourceEffectNodeId: string;
  sourceEffectId: string;
  /** The world object the reveal is drawn over. This may differ from the
   * durable mutation target when a structure represents that upgrade. */
  target: Extract<StoryTarget, { kind: 'haven_tile' | 'haven_structure' | 'haven_nature_island' }>;
  preset: string;
  reactionLine?: string;
  showCoins?: boolean;
};
