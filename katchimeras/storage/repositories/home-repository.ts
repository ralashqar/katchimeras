import type { StoredHomeState } from '@/types/home';
import {
  clearStoredHomeState,
  loadStoredHomeState,
  loadStoredHomeStateRaw,
  saveStoredHomeState,
  saveStoredHomeStateDeferred,
  subscribeHomeStateChanges,
} from '@/utils/home-storage';

export type HomeRepository = {
  load: () => StoredHomeState | null;
  loadRaw: () => string | null;
  save: (state: StoredHomeState, options?: { notify?: boolean }) => void;
  saveDeferred: (state: StoredHomeState, options?: { notify?: boolean }) => Promise<void>;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
};

export const homeRepository: HomeRepository = {
  load: loadStoredHomeState,
  loadRaw: loadStoredHomeStateRaw,
  save: saveStoredHomeState,
  saveDeferred: saveStoredHomeStateDeferred,
  clear: clearStoredHomeState,
  subscribe: subscribeHomeStateChanges,
};
