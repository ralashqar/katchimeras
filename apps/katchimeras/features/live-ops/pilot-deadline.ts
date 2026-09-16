/** A late response is ignored by the queue; retrying its immutable batch is safe. */
export async function withPilotDeadline<T>(operation: () => Promise<T>, timeoutMs = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Sync timed out. Saved moves are safe; reconnect and retry.')), timeoutMs);
      }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
