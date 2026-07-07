import type { StoredHomeState } from '@/types/home';
import {
  clearStoredHomeState,
  loadStoredHomeState,
  loadStoredHomeStateRaw,
  saveStoredHomeState,
  subscribeHomeStateChanges,
} from '@/utils/home-storage';

export type HomeRepository = {
  load: () => StoredHomeState | null;
  loadRaw: () => string | null;
  save: (state: StoredHomeState) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
};

export const homeRepository: HomeRepository = {
  load: loadStoredHomeState,
  loadRaw: loadStoredHomeStateRaw,
  save: saveStoredHomeState,
  clear: clearStoredHomeState,
  subscribe: subscribeHomeStateChanges,
};
