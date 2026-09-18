import type { HatchableMissionSeed } from '@/types/hatchable-companion';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';

export type SignalPromise = 'welcome' | 'rest' | 'company';
export type HeartwoodPresentation = 'introduction' | 'signal' | 'recap';
export type AdventureBeatId = 'wish' | 'trail' | 'hearth' | 'welcome' | 'post' | 'answer';
export type SharedAdventureDefinition = {
  id: string; title: string; destination: string;
  beats: readonly { id: AdventureBeatId; title: string; speaker: string; lines: readonly string[] }[];
};
export type LanternRouteDefinition = {
  id: string; title: string; companion: string; required: number; seed: HatchableMissionSeed;
  finalItem: string; reward: number;
};
export type LanternRun = {
  id: string; routeId: string; board: MergeWorldState; merges: number; startedAt: number;
  completedAt?: number; reward?: number;
};
export type SharedAdventureProgress = {
  gardenBedsVersion?: 1 | 2;
  gardenSupply?: import('./heartwood-progression').GardenSupply;
  version: 1; clock: number; acknowledged: Partial<Record<AdventureBeatId, number>>;
  promise?: SignalPromise; postBuiltAt?: number; completedAt?: number;
  presentations?: Partial<Record<HeartwoodPresentation, number>>;
  run?: LanternRun; nextRun: number; routeFirsts: Record<string, number>;
  rewardDays: Record<string, string>; pathfinderAt?: number;
  activity: { at: number; kind: string; target: string }[];
};
export type AdventureCommand =
  | { type: 'place_heartwood'; category: import('@/types/merge-world').MossproutMemoryPlantId; slotId: import('@/types/merge-world').MossproutGardenPlantSlotId; expectedOccupantId: string | null }
  | { type: 'tend_heartwood'; category: import('@/types/merge-world').MossproutMemoryPlantId; expectedGrowth: number; slotId?: import('@/types/merge-world').MossproutGardenPlantSlotId }
  | { type: 'sync_heartwood' }
  | { type: 'collect_garden_supply' }
  | { type: 'presented'; scene: HeartwoodPresentation }
  | { type: 'acknowledge'; beatId: AdventureBeatId; promise?: SignalPromise }
  | { type: 'start_route'; routeId: string }
  | { type: 'move'; runId: string; from: number; to: number }
  | { type: 'finish_route'; runId: string }
  | { type: 'diagnostic'; kind: 'view' | 'dismiss' | 'error'; target: string };
export type AdventureNext = { kind: 'scene' | 'garden' | 'feastle' | 'mission' | 'routes'; title: string; beatId?: AdventureBeatId };
export type AdventureOrder = Omit<MergeOrder, 'createdAt'>;
