/** A fixed deadline from the FIRST dirty command, never a sliding debounce. */
export const MERGE_SAVE_BUFFER_MS = 250;

export function createMergeSaveDeadline(
  drain: () => void,
  schedule: (callback: () => void, ms: number) => () => void = (callback, ms) => {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
) {
  let cancelScheduled: (() => void) | null = null;
  const cancel = () => { cancelScheduled?.(); cancelScheduled = null; };
  return {
    cancel,
    enqueue() {
      if (cancelScheduled) return;
      cancelScheduled = schedule(() => { cancelScheduled = null; drain(); }, MERGE_SAVE_BUFFER_MS);
    },
    flush() { cancel(); drain(); },
  };
}
