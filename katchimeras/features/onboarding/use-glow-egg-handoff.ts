import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { acknowledgeGlowEggEntry, recoverGlowEggHandoff } from './glow-discovery-runtime';

/** Acceptance is durable; readiness belongs to the mounted encounter and camera. */
export function useGlowEggHandoff({ run, world, focused, available, open, enter, onOpening }: {
  run: ContentFlowRun | null; world: MergeWorldState; focused: boolean; available: boolean;
  open: boolean; enter: () => Promise<boolean>; onOpening: () => void;
}) {
  const [error, setError] = useState(false);
  const entering = useRef(false);
  const acknowledging = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const failed = useCallback(() => { if (mounted.current) setError(true); }, []);
  const pending = run?.nodeId === 'egg.enter' && run.status !== 'completed';
  const hatched = Boolean(world.stepplingEgg?.hatchedAt || world.companionDiscovery.records.some((record) => record.characterId === 'steppling'));
  useEffect(() => {
    if (focused) void recoverGlowEggHandoff(world).catch(failed);
  }, [failed, focused, world]);
  const begin = useCallback(async () => {
    if (entering.current) return;
    entering.current = true;
    onOpening();
    try { if (!await enter()) failed(); }
    catch { failed(); }
    finally { entering.current = false; }
  }, [enter, failed, onOpening]);
  useEffect(() => {
    if (focused && available && pending && !hatched && !open && !error) void begin();
  }, [available, begin, error, focused, hatched, open, pending]);
  const onReady = useCallback(() => {
    if (!focused || !available || !pending || !open || !world.stepplingEgg || acknowledging.current || error) return;
    acknowledging.current = true;
    void acknowledgeGlowEggEntry().catch(failed).finally(() => { acknowledging.current = false; });
  }, [available, error, failed, focused, open, pending, world.stepplingEgg]);
  const retry = useCallback(() => {
    setError(false);
    void recoverGlowEggHandoff(world).catch(failed);
    if (pending && open && !world.stepplingEgg && focused && available) void begin();
  }, [available, begin, failed, focused, open, pending, world]);
  return { error, retry, onReady };
}
