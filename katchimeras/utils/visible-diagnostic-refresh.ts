/** A visible-only, coalesced reader. One read may finish after blur, but cannot publish. */
export function createVisibleDiagnosticRefresh<T>(
  read: () => Promise<T>,
  publish: (value: T) => void,
  fail: (error: unknown) => void,
) {
  let active = false;
  let generation = 0;
  let inFlight = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = () => {
    if (!active) return;
    pending = true;
    if (inFlight || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!active) return;
      pending = false;
      inFlight = true;
      const token = generation;
      void Promise.resolve().then(read).then((value) => {
        if (active && generation === token) publish(value);
      }).catch((error: unknown) => {
        if (active && generation === token) fail(error);
      }).finally(() => {
        inFlight = false;
        if (pending && active) request();
      });
    }, 0);
  };
  return {
    request,
    setActive(next: boolean) {
      if (next === active) return;
      active = next;
      generation += 1;
      if (next) request();
      else {
        pending = false;
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}
