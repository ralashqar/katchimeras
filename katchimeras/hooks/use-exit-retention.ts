import { useEffect, useState } from 'react';

/** Keep a fading layer mounted only until its exit finishes. */
export function useExitRetention(visible: boolean, durationMs: number) {
  const [retained, setRetained] = useState(visible);
  useEffect(() => {
    if (visible) { setRetained(true); return; }
    const timer = setTimeout(() => setRetained(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, visible]);
  return visible || retained;
}
