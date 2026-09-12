import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { acknowledgeHatchableEggEntry, recoverHatchableEggHandoff } from './hatchable-runtime';
import { hatchableEggProgress } from './steppling-egg-policy';

/** Acceptance is durable; readiness belongs to the mounted encounter and camera. */
export function useGlowEggHandoff({ run, world, focused, available, open, enter, onOpening, definition = STEPPLING_HATCHABLE }: {
  run: ContentFlowRun | null; world: MergeWorldState; focused: boolean; available: boolean;
  open: boolean; enter: () => Promise<boolean>; onOpening: () => void;
  /** Whose Egg: the companion whose discovery `run` belongs to. */
  definition?: HatchableCompanionDefinition;
}) {
  const [error, setError] = useState(false);
  const entering = useRef(false);
  const acknowledging = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const failed = useCallback(() => { if (mounted.current) setError(true); }, []);
  const pending = run?.nodeId === 'egg.enter' && run.status !== 'completed';
  const egg = hatchableEggProgress(world, definition);
  const hatched = Boolean(egg?.hatchedAt || world.companionDiscovery.records.some((record) => record.characterId === definition.companion));
  useEffect(() => {
    if (focused) void recoverHatchableEggHandoff(definition, world).catch(failed);
  }, [definition, failed, focused, world]);
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
    if (!focused || !available || !pending || !open || !egg || acknowledging.current || error) return;
    acknowledging.current = true;
    void acknowledgeHatchableEggEntry(definition).catch(failed).finally(() => { acknowledging.current = false; });
  }, [available, definition, egg, error, failed, focused, open, pending]);
  const retry = useCallback(() => {
    setError(false);
    void recoverHatchableEggHandoff(definition, world).catch(failed);
    if (pending && open && !egg && focused && available) void begin();
  }, [available, begin, definition, egg, failed, focused, open, pending, world]);
  return { error, retry, onReady };
}
