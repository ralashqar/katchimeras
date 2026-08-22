import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

export type KatchimeraActionTransitionPhase =
  | 'settling'
  | 'resting'
  | 'inserting'
  | 'completing'
  | 'awaiting_source'
  | 'compacting';

type StackPresentation<T> = {
  activeCompletionId: string | null;
  departedId: string | null;
  enteringId: string | null;
  items: readonly T[];
  phase: KatchimeraActionTransitionPhase;
};

const STACK_COMPACTION_MS = 330;
const STACK_ENTRY_MS = 320;
const REDUCED_MOTION_SETTLE_MS = 120;

function sameIds<T>(left: readonly T[], right: readonly T[], getId: (item: T) => string) {
  return left.length === right.length && left.every((item, index) => getId(item) === getId(right[index]));
}

/**
 * Separates the repository's latest action list from the rows currently being
 * presented. A completed row keeps its invisible layout slot until the source
 * supplies a replacement. That replacement enters in the same slot, so the
 * surviving rows do not briefly move up and then back down.
 */
export function useKatchimeraActionStackTransition<T>({
  acknowledgeCompletion,
  getId,
  isCompleted,
  items,
  ready,
}: {
  acknowledgeCompletion: (item: T) => void;
  getId: (item: T) => string;
  isCompleted: (item: T) => boolean;
  items: readonly T[];
  ready: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const acknowledgeRef = useRef(acknowledgeCompletion);
  const getIdRef = useRef(getId);
  const isCompletedRef = useRef(isCompleted);
  const [presentation, setPresentation] = useState<StackPresentation<T>>({
    activeCompletionId: null,
    departedId: null,
    enteringId: null,
    items,
    phase: 'settling',
  });
  const presentationRef = useRef(presentation);

  acknowledgeRef.current = acknowledgeCompletion;
  getIdRef.current = getId;
  isCompletedRef.current = isCompleted;
  presentationRef.current = presentation;

  useEffect(() => {
    setPresentation((current) => {
      if (!ready) {
        if (
          current.phase === 'settling'
          && sameIds(current.items, items, getIdRef.current)
          && current.items.every((item, index) => item === items[index])
        ) return current;
        return {
          activeCompletionId: null,
          departedId: null,
          enteringId: null,
          items,
          phase: 'settling',
        };
      }

      if (current.phase === 'settling') {
        return {
          activeCompletionId: null,
          departedId: null,
          enteringId: null,
          items,
          phase: 'resting',
        };
      }

      const desiredById = new Map(items.map((item) => [getIdRef.current(item), item]));

      if (current.phase === 'awaiting_source') {
        const departedId = current.departedId;
        if (!departedId || desiredById.has(departedId)) return current;

        const departureIndex = current.items.findIndex((item) => getIdRef.current(item) === departedId);
        if (departureIndex < 0) {
          return { ...current, departedId: null, phase: 'resting' };
        }

        const survivorIds = new Set(
          current.items
            .filter((item) => getIdRef.current(item) !== departedId)
            .map((item) => getIdRef.current(item)),
        );
        const replacementItem = items.find((item) => !survivorIds.has(getIdRef.current(item)));

        if (replacementItem) {
          const nextItems = [...current.items];
          nextItems[departureIndex] = replacementItem;
          return {
            activeCompletionId: null,
            departedId: null,
            enteringId: getIdRef.current(replacementItem),
            items: nextItems,
            phase: 'inserting',
          };
        }

        return {
          activeCompletionId: null,
          departedId: null,
          enteringId: null,
          items: current.items.filter((item) => getIdRef.current(item) !== departedId),
          phase: 'compacting',
        };
      }

      if (current.phase !== 'resting') return current;

      const refreshed = current.items.map((item) => desiredById.get(getIdRef.current(item)) ?? item);
      const completedItem = refreshed.find((item) => isCompletedRef.current(item));
      if (completedItem) {
        return {
          activeCompletionId: getIdRef.current(completedItem),
          departedId: null,
          enteringId: null,
          items: refreshed,
          phase: 'completing',
        };
      }

      const staleIndex = refreshed.findIndex((item) => !desiredById.has(getIdRef.current(item)));
      if (staleIndex >= 0) {
        const survivingIds = new Set(
          refreshed
            .filter((_, index) => index !== staleIndex)
            .map((item) => getIdRef.current(item)),
        );
        const replacementItem = items.find((item) => !survivingIds.has(getIdRef.current(item)));
        if (replacementItem) {
          const nextItems = [...refreshed];
          nextItems[staleIndex] = replacementItem;
          return {
            activeCompletionId: null,
            departedId: null,
            enteringId: getIdRef.current(replacementItem),
            items: nextItems,
            phase: 'inserting',
          };
        }

        return {
          activeCompletionId: null,
          departedId: null,
          enteringId: null,
          items: refreshed.filter((_, index) => index !== staleIndex),
          phase: 'compacting',
        };
      }

      const currentIds = new Set(refreshed.map((item) => getIdRef.current(item)));
      const missingItem = items.find((item) => !currentIds.has(getIdRef.current(item)));
      if (missingItem) {
        return {
          activeCompletionId: null,
          departedId: null,
          enteringId: getIdRef.current(missingItem),
          items: [...refreshed, missingItem],
          phase: 'inserting',
        };
      }

      if (refreshed.some((item, index) => item !== current.items[index])) {
        return { ...current, items: refreshed };
      }
      return current;
    });
  }, [items, presentation.phase, ready]);

  useEffect(() => {
    if (!ready || (presentation.phase !== 'compacting' && presentation.phase !== 'inserting')) return;
    const duration = reduceMotion
      ? REDUCED_MOTION_SETTLE_MS
      : presentation.phase === 'compacting'
        ? STACK_COMPACTION_MS
        : STACK_ENTRY_MS;
    const timer = setTimeout(() => {
      setPresentation((current) => {
        if (current.phase !== presentation.phase) return current;
        return {
          ...current,
          activeCompletionId: null,
          enteringId: null,
          phase: 'resting',
        };
      });
    }, duration);
    return () => clearTimeout(timer);
  }, [presentation.phase, ready, reduceMotion]);

  const onCompletedExit = useCallback((id: string) => {
    const current = presentationRef.current;
    if (current.phase !== 'completing' || current.activeCompletionId !== id) return;
    const completedItem = current.items.find((item) => getIdRef.current(item) === id);
    if (!completedItem) return;
    setPresentation({
      activeCompletionId: null,
      departedId: id,
      enteringId: null,
      items: current.items,
      phase: 'awaiting_source',
    });
    acknowledgeRef.current(completedItem);
  }, []);

  return {
    interactionLocked: presentation.phase !== 'resting',
    isEntering: (id: string) => presentation.phase === 'inserting' && presentation.enteringId === id,
    isStartingCompletion: (id: string) => presentation.phase === 'completing' && presentation.activeCompletionId === id,
    items: presentation.items,
    onCompletedExit,
    phase: presentation.phase,
  };
}
