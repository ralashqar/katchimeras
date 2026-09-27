import { useMemo, useRef } from 'react';

/** Stable keys retain native views up to the pool's high-water mark. Overflow is logical only. */
export function useEffectSlots<T extends { id: string | number }>(items: readonly T[], size: number): readonly (T | null)[] {
  const assignments = useRef(new Map<string | number, number>());
  const skipped = useRef(new Set<string | number>());
  const highWater = useRef(0);
  return useMemo(() => {
    const live = new Set(items.map((item) => item.id));
    for (const id of assignments.current.keys()) if (!live.has(id)) assignments.current.delete(id);
    for (const id of skipped.current) if (!live.has(id)) skipped.current.delete(id);
    const taken = new Set(assignments.current.values());
    const placed: (T | null)[] = Array.from({ length: size }, () => null);
    for (const item of items) {
      if (skipped.current.has(item.id)) continue;
      let slot = assignments.current.get(item.id);
      if (slot === undefined) {
        slot = placed.findIndex((_, index) => !taken.has(index));
        if (slot < 0) { skipped.current.add(item.id); continue; }
        assignments.current.set(item.id, slot);
        taken.add(slot);
      }
      placed[slot] = item;
      highWater.current = Math.max(highWater.current, slot + 1);
    }
    return placed.slice(0, highWater.current);
  }, [items, size]);
}
