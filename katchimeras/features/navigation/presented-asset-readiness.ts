import { useCallback, useEffect, useRef, useState } from 'react';

export type PresentedAssetResolution = {
  generation: number;
  status: 'displayed' | 'fallback';
};

export type PresentedAssetStatus = 'inactive' | 'waiting' | 'displayed' | 'fallback';

export function resolvePresentedAssetStatus({
  active,
  generation,
  resolution,
}: {
  active: boolean;
  generation: number;
  resolution: PresentedAssetResolution | null;
}): PresentedAssetStatus {
  if (!active) return 'inactive';
  if (!resolution || resolution.generation !== generation) return 'waiting';
  return resolution.status;
}

export function settlePresentedAssetResolution(
  current: PresentedAssetResolution | null,
  next: PresentedAssetResolution,
) {
  if (current && next.generation < current.generation) return current;
  if (current?.generation === next.generation && current.status === 'displayed') return current;
  return next;
}

/**
 * Tracks whether a native image was actually presented for the current focus
 * session. Generation changes happen during render, so a cached image may call
 * `onDisplay` immediately without a later focus effect erasing that event.
 */
export function usePresentedAssetReadiness(
  active: boolean,
  {
    fallbackAfterMs = 2_000,
    label,
  }: {
    fallbackAfterMs?: number | null;
    label: string;
  },
) {
  const wasActiveRef = useRef(false);
  const generationRef = useRef(0);
  if (active && !wasActiveRef.current) generationRef.current += 1;
  wasActiveRef.current = active;

  const generation = generationRef.current;
  const [resolution, setResolution] = useState<PresentedAssetResolution | null>(null);
  const status = resolvePresentedAssetStatus({ active, generation, resolution });

  useEffect(() => {
    if (!active || status !== 'waiting' || fallbackAfterMs == null) return;
    const timeout = setTimeout(() => {
      console.warn('[presented-asset] Using visual fallback after display timeout', {
        generation,
        label,
      });
      setResolution((current) => settlePresentedAssetResolution(current, {
        generation,
        status: 'fallback',
      }));
    }, fallbackAfterMs);
    return () => clearTimeout(timeout);
  }, [active, fallbackAfterMs, generation, label, status]);

  const onDisplay = useCallback(() => {
    setResolution((current) => settlePresentedAssetResolution(current, {
      generation,
      status: 'displayed',
    }));
  }, [generation]);

  const onError = useCallback((error?: string) => {
    console.warn('[presented-asset] Image presentation failed; using fallback', {
      error,
      generation,
      label,
    });
    setResolution((current) => settlePresentedAssetResolution(current, {
      generation,
      status: 'fallback',
    }));
  }, [generation, label]);

  return {
    generation,
    onDisplay,
    onError,
    ready: status === 'displayed' || status === 'fallback',
    status,
  };
}
