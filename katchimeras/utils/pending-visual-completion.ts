/** Owns only the latest camera move. Late native callbacks from an interrupted
 * or superseded animation cannot complete a newer move or repeat its effects. */
export function createPendingVisualCompletion<T>() {
  let sequence = 0;
  let pending: { id: number; target: T; onComplete?: () => void } | null = null;
  return {
    begin(target: T, onComplete?: () => void) {
      pending = { id: ++sequence, target, onComplete };
      return pending.id;
    },
    peek: () => pending,
    finish(id: number) {
      if (pending?.id !== id) return;
      const completed = pending;
      pending = null;
      completed.onComplete?.();
    },
    cancel() { pending = null; },
  };
}
