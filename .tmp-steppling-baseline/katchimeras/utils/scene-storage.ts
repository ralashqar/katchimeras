import type { SceneCollectionState } from '@/types/scene';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { EMPTY_SCENE_STATE, normalizeSceneState } from '@/utils/scene-state';

export const SCENE_STORAGE_KEY = 'katchimera.scenes.v1';

export function loadSceneState() {
  return normalizeSceneState(getStoredJson<unknown>(SCENE_STORAGE_KEY, EMPTY_SCENE_STATE));
}

export function saveSceneState(state: SceneCollectionState) {
  const normalized = normalizeSceneState(state);
  setStoredJson(SCENE_STORAGE_KEY, normalized);
  return normalized;
}
