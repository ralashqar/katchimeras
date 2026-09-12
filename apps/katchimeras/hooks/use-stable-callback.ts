import { useCallback, useRef } from 'react';

/**
 * A callback whose identity never changes, that always runs the latest closure.
 * For handlers handed to memoised children (the Kingdom canvas): a fresh arrow
 * per render would re-render the child on every parent render for nothing.
 */
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(callback);
  latest.current = callback;
  return useCallback((...args: Args) => latest.current(...args), []);
}
