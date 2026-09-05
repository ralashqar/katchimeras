import { DEFAULT_SCENE_ID, normalizeSceneVariantId, resolveSceneVariantId } from '@/constants/scenes';
import type { SceneCollectionState, SceneVariantId } from '@/types/scene';

export const EMPTY_SCENE_STATE: SceneCollectionState = {
  version: 2,
  equippedSceneId: DEFAULT_SCENE_ID,
  unlocked: {
    [DEFAULT_SCENE_ID]: {
      sceneId: DEFAULT_SCENE_ID,
      unlockedAt: 0,
      sourceDayId: null,
      seenReveal: true,
    },
  },
  appliedReceiptIds: [],
};

export function normalizeSceneState(value: unknown): SceneCollectionState {
  if (!value || typeof value !== 'object') return EMPTY_SCENE_STATE;
  const candidate = value as Partial<SceneCollectionState>;
  const unlocked: SceneCollectionState['unlocked'] = { ...EMPTY_SCENE_STATE.unlocked };
  for (const [id, record] of Object.entries(candidate.unlocked ?? {})) {
    const migratedId = resolveSceneVariantId(id);
    if (!migratedId || !record) continue;
    unlocked[migratedId] = {
      sceneId: migratedId,
      unlockedAt: Number.isFinite(record.unlockedAt) ? record.unlockedAt : 0,
      sourceDayId: typeof record.sourceDayId === 'string' ? record.sourceDayId : null,
      seenReveal: Boolean(record.seenReveal),
    };
  }
  const requestedEquipped = normalizeSceneVariantId(candidate.equippedSceneId);
  const equipped = requestedEquipped && unlocked[requestedEquipped]
    ? requestedEquipped
    : DEFAULT_SCENE_ID;
  return {
    version: 2,
    equippedSceneId: equipped,
    unlocked,
    appliedReceiptIds: Array.isArray(candidate.appliedReceiptIds)
      ? [...new Set(candidate.appliedReceiptIds.filter((id): id is string => typeof id === 'string'))]
      : [],
  };
}
