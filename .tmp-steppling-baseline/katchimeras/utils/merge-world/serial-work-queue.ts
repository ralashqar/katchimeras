/** A replacement generation waits for the one unavoidable in-flight decode. */
export function createSerialWorkQueue() {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(work: () => Promise<void>): Promise<void> {
      const next = tail.then(work, work);
      tail = next.catch(() => undefined);
      return next;
    },
  };
}
