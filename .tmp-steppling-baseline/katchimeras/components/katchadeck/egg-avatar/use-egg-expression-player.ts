import { useEffect, useState } from 'react';

import type { EggAvatarFaceId } from '@/types/egg-avatar';

export type EggExpressionCue = {
  faceId: EggAvatarFaceId;
  atMs: number;
  durationMs: number;
};

type EggExpressionPresentation = {
  faceId: EggAvatarFaceId;
  transitionMs: number;
};

type UseEggExpressionPlayerOptions = {
  baseFaceId: EggAvatarFaceId;
  baseTransitionMs?: number;
  sequence?: readonly EggExpressionCue[];
  sequenceKey?: string | number;
};

/**
 * The single face-expression timeline for an Egg avatar.
 *
 * A running sequence deliberately keeps the face that is already on screen
 * until its first cue. This is what lets sleeping -> delighted, hatching, and
 * future scripted reactions crossfade instead of briefly snapping through the
 * equipped idle face whenever their event key changes.
 */
export function useEggExpressionPlayer({
  baseFaceId,
  baseTransitionMs = 180,
  sequence,
  sequenceKey,
}: UseEggExpressionPlayerOptions): EggExpressionPresentation {
  const [presentation, setPresentation] = useState<EggExpressionPresentation>({
    faceId: baseFaceId,
    transitionMs: 0,
  });

  useEffect(() => {
    if (!sequence?.length) {
      setPresentation((current) => current.faceId === baseFaceId
        ? current
        : { faceId: baseFaceId, transitionMs: baseTransitionMs });
      return;
    }

    const timers = sequence.map((cue) => setTimeout(() => {
      setPresentation({ faceId: cue.faceId, transitionMs: cue.durationMs });
    }, cue.atMs));

    return () => timers.forEach(clearTimeout);
  }, [baseFaceId, baseTransitionMs, sequence, sequenceKey]);

  return presentation;
}
