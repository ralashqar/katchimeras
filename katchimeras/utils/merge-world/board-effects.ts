import { createSelectorStore } from './selector-store';

export const MERGE_EFFECT_SLOT_IDS = [0, 1, 2, 3, 4, 5] as const;
export type MergeBoardEffectKind = 'spawn-origin' | 'spawn-settle' | 'merge';
export type MergeBoardEffect = { id: number; cell: number; kind: MergeBoardEffectKind };

/** Transient effects have their own subscribers, never the board's React state. */
export function createMergeBoardEffects() {
  const store = createSelectorStore<readonly MergeBoardEffect[]>([]);
  let sequence = 0;
  return {
    ...store,
    emit(cell: number, kind: MergeBoardEffectKind) {
      // A rapid tap burst shares its launch decoration, never its game command
      // or item flight. Let the existing burst finish rather than stacking six
      // particle systems at the same generator or restarting them every tap.
      if (kind === 'spawn-origin') {
        const existing = store.getSnapshot().find((entry) => entry.kind === kind && entry.cell === cell);
        if (existing) return existing;
      }
      const effect = { cell, kind, id: ++sequence };
      const slot = effect.id % MERGE_EFFECT_SLOT_IDS.length;
      store.publish([...store.getSnapshot().filter((entry) => entry.id % MERGE_EFFECT_SLOT_IDS.length !== slot), effect]);
      return effect;
    },
    retire(id: number) {
      const current = store.getSnapshot();
      // A displaced burst's old completion cannot clear its replacement or
      // notify subscribers with an equivalent array.
      if (!current.some((effect) => effect.id === id)) return;
      store.publish(current.filter((effect) => effect.id !== id));
    },
    clear() {
      if (store.getSnapshot().length) store.publish([]);
    },
  };
}

export type MergeBoardEffects = ReturnType<typeof createMergeBoardEffects>;

export function mergeEffectRetentionMs(kind: MergeBoardEffectKind, reduceMotion: boolean) {
  return reduceMotion ? 220 : kind === 'merge' ? 700 : kind === 'spawn-settle' ? 620 : 520;
}

/** Spawns introduce no retiring ghosts. Reuse sprites only if the board
 * already presented is the canonical board; external edits require repair. */
export function canReuseSpawnSprites<T>(kind: 'board' | 'spawn', presentedBoard: T, committedBoard: T) {
  return kind === 'spawn' && presentedBoard === committedBoard;
}
