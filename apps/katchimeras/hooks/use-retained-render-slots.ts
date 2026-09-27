import { useMemo, useRef } from 'react';

export type RetainedRenderSlot<T> = { key: number; id: string; item: T; active: boolean };

/** Presentation-only pool: keep live identities in place and reuse vacant views.
 * Unlike an effect pool this never drops overflow: every gameplay sprite, including
 * a consumed piece finishing its animation, must remain represented.
 */
export function retainRenderSlots<T>(previous: readonly RetainedRenderSlot<T>[], items: readonly T[], identify: (item: T) => string): RetainedRenderSlot<T>[] {
  const live = new Map(items.map(item => [identify(item), item]));
  const slots = previous.map(slot => {
    const item = live.get(slot.id);
    if (item === undefined) return slot.active ? { ...slot, active: false } : slot;
    live.delete(slot.id);
    return slot.active && slot.item === item ? slot : { ...slot, item, active: true };
  });
  let vacant = 0;
  for (const [id, item] of live) {
    while (vacant < slots.length && slots[vacant].active) vacant++;
    slots[vacant] = { key: vacant, id, item, active: true };
    vacant++;
  }
  return slots;
}

export function useRetainedRenderSlots<T>(items: readonly T[], identify: (item: T) => string) {
  const retained = useRef<readonly RetainedRenderSlot<T>[]>([]);
  return useMemo(() => {
    retained.current = retainRenderSlots(retained.current, items, identify);
    return retained.current;
  }, [identify, items]);
}
