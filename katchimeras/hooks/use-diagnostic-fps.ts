import { useEffect, useState } from 'react';

/** Only the explicitly enabled, visible lab should own this JS frame loop. */
export function useDiagnosticFps(active: boolean): number {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    if (!active) return;
    let frameCount = 0;
    let startedAt: number | null = null;
    let frame = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      startedAt ??= now;
      frameCount += 1;
      const elapsed = now - startedAt;
      if (elapsed >= 750) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        startedAt = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [active]);
  return fps;
}
