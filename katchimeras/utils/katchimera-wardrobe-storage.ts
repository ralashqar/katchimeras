import type { KatchimeraWardrobeState } from '@/types/katchimera';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  EMPTY_KATCHIMERA_WARDROBE,
  normalizeKatchimeraWardrobe,
} from '@/utils/katchimera-wardrobe';

const STORAGE_KEY = 'katchimeras.wardrobe.v1';

export function loadKatchimeraWardrobe(): KatchimeraWardrobeState {
  return normalizeKatchimeraWardrobe(
    getStoredJson<unknown>(STORAGE_KEY, EMPTY_KATCHIMERA_WARDROBE)
  );
}

export function saveKatchimeraWardrobe(state: KatchimeraWardrobeState): void {
  setStoredJson(STORAGE_KEY, normalizeKatchimeraWardrobe(state));
}
