import type { StoredHomeState } from '@/types/home';
import {
  clearStoredHomeState,
  loadStoredHomeState,
  loadStoredHomeStateRaw,
  loadStoredHomeArchivePage,
  flushStoredHomeStateWrites,
  saveStoredHomeState,
  saveStoredHomeStateDeferred,
  subscribeHomeStateChanges,
  type HomeSaveOptions,
} from '@/utils/home-storage';

export type HomeRepository = {
  load: () => StoredHomeState | null;
  loadRaw: () => string | null;
  save: (state: StoredHomeState, options?: HomeSaveOptions) => void;
  saveDeferred: (state: StoredHomeState, options?: HomeSaveOptions) => Promise<void>;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  loadArchivePage: (offset: number, limit: number) => StoredHomeState['archivedDays'];
  flush: () => Promise<void>;
};

export const homeRepository: HomeRepository = {
  load: loadStoredHomeState,
  loadRaw: loadStoredHomeStateRaw,
  save: saveStoredHomeState,
  saveDeferred: saveStoredHomeStateDeferred,
  clear: clearStoredHomeState,
  subscribe: subscribeHomeStateChanges,
  loadArchivePage: loadStoredHomeArchivePage,
  flush: flushStoredHomeStateWrites,
};
