import { useCallback, useEffect, useRef, useState } from 'react';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { normalizeHavenMergeSandboxState } from '@/utils/merge-world/haven-sandbox';
import {
  loadHavenMergeSandboxState,
  saveHavenMergeSandboxState,
} from '@/utils/merge-world/haven-sandbox-repository';

export type HavenMergeSandboxController = {
  dispatch: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  error: string | null;
  loading: boolean;
  state: MergeWorldState | null;
};

export function useHavenMergeSandbox(active: boolean): HavenMergeSandboxController {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    void loadHavenMergeSandboxState().then((loaded) => {
      if (cancelled) return;
      stateRef.current = loaded;
      setState(loaded);
      setError(null);
      setLoading(false);
    }).catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : 'The Haven merge board could not be loaded.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [active]);

  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    if (!active || !current) return null;
    const result = reduceMergeWorld(current, command);
    if (!result.changed) return result;
    const next = normalizeHavenMergeSandboxState(result.state, command.now);
    const isolatedResult = next === result.state ? result : { ...result, state: next };
    stateRef.current = next;
    setState(next);
    setError(null);
    void saveHavenMergeSandboxState(next).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'The Haven merge board could not be saved.');
    });
    return isolatedResult;
  }, [active]);

  return { dispatch, error, loading, state };
}
