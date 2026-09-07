import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import {
  createCombat,
  placeCombat,
  tickCombat,
  type CombatState,
} from "./combat";
import type { DuelDefinition } from "./types";

export function useCombat(
  definition: DuelDefinition,
  seed: string,
  paused: boolean,
  practice: boolean,
) {
  const [state, setState] = useState(() =>
    createCombat(
      definition,
      `egg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      seed,
      practice,
    ),
  );
  const ref = useRef(state);
  const pauseRef = useRef(paused);
  pauseRef.current = paused;
  const foreground = useRef(AppState.currentState === "active");
  const [backgrounded, setBackgrounded] = useState(false);
  const clock = useSharedValue(0);
  const commit = useCallback(
    (next: CombatState) => {
      const old = ref.current;
      ref.current = next;
      clock.value = next.elapsed;
      if (
        old.run !== next.run ||
        old.eventSequence !== next.eventSequence ||
        old.phase !== next.phase
      )
        setState(next);
    },
    [clock],
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      foreground.current = status === "active";
      if (status !== "active") setBackgrounded(true);
    });
    let frame = 0;
    let previous = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const delta = previous ? Math.min(80, now - previous) : 0;
      previous = now;
      if (!pauseRef.current && foreground.current && !ref.current.outcome)
        commit(tickCombat(ref.current, ref.current.elapsed + delta));
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      sub.remove();
    };
  }, [commit]);
  const drop = useCallback(
    (input: Parameters<typeof placeCombat>[1]) => {
      if (pauseRef.current || !foreground.current) return ref.current;
      const next = placeCombat(ref.current, input, ref.current.elapsed);
      commit(next);
      return next;
    },
    [commit],
  );
  return {
    state,
    ref,
    clock,
    drop,
    backgrounded,
    acknowledgeBackground: () => setBackgrounded(false),
  };
}
