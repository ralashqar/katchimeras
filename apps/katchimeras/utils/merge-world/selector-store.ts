export function createSelectorStore<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish(next: T) {
      if (Object.is(snapshot, next)) return;
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/** Cache selector results, including allocating selectors, for useSyncExternalStore. */
export function selectedSnapshot<T, S>(read: () => T, select: (value: T) => S, equal: (a: S, b: S) => boolean = Object.is) {
  let initialized = false;
  let previous: T;
  let selected: S;
  return () => {
    const next = read();
    if (initialized && Object.is(previous, next)) return selected;
    const value = select(next);
    if (!initialized || !equal(selected, value)) selected = value;
    previous = next;
    initialized = true;
    return selected;
  };
}

export function reuseShallowValue<T extends object>(previous: T, next: T): T {
  if (previous === next) return previous;
  const keys = Object.keys(next) as (keyof T)[];
  return keys.length === Object.keys(previous).length && keys.every((key) => {
    const a = previous[key], b = next[key];
    return Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
  }) ? previous : next;
}

export function reuseShallowRows<T extends { id: string }>(previous: readonly T[], next: readonly T[]): readonly T[] {
  const byId = new Map(previous.map((row) => [row.id, row]));
  const rows = next.map((row) => {
    const old = byId.get(row.id);
    if (!old) return row;
    return reuseShallowValue(old, row);
  });
  return rows.length === previous.length && rows.every((row, index) => row === previous[index]) ? previous : rows;
}
