import type { TodayExplorationBackgroundKey } from '@/constants/today-exploration-background-keys.gen';

export type SceneVariantId = TodayExplorationBackgroundKey;

export type SceneDefinition = {
  id: SceneVariantId;
  name: string;
  description: string;
  family: 'meadow' | 'home' | 'city' | 'woodland' | 'night' | 'weather';
  themeTags: string[];
};

export type SceneUnlockRecord = {
  sceneId: SceneVariantId;
  unlockedAt: number;
  sourceDayId: string | null;
  seenReveal: boolean;
};

export type SceneCollectionState = {
  version: 2;
  equippedSceneId: SceneVariantId;
  unlocked: Partial<Record<SceneVariantId, SceneUnlockRecord>>;
  appliedReceiptIds: string[];
};
