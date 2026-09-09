import { useFrameQuality } from "./use-frame-quality";
import { choosePlacement } from "./opponent";
import { useCallback, useEffect, useRef, useState } from "react";
import { CombatPresentation } from "./combat-presentation";
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
  stress = false,
  /** Keep the rival from acting — while a lesson is up. See `tickCombat`. */
  holdAi = false,
) {
  const [state, setState] = useState(() =>
    createCombat(
      definition,
      `egg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      seed,
      practice,
    ),
  );
  const [presentation] = useState(() => new CombatPresentation(state));
  const ref = useRef(state);
  const pauseRef = useRef(paused);
  pauseRef.current = paused;
  const holdRef = useRef(holdAi);
  holdRef.current = holdAi;
  const autoAt = useRef(600);
  const foreground = useRef(AppState.currentState === "active");
  const [backgrounded, setBackgrounded] = useState(false);
  const clock = useSharedValue(0);
  useFrameQuality(presentation, !paused && !backgrounded && !state.outcome, practice);
  const commit = useCallback(
    (next: CombatState) => {
      const old = ref.current;
      // Consume this frame's event batch once. The pure engine retains history for tests/replays;
      // a live duel need not copy 256 past events for every new cell collision.
      const snapshot = next.events.length ? {...next, events: []} : next;
      ref.current = snapshot;
      presentation.commit(next);
      presentation.current = snapshot;
      clock.value = next.elapsed;
      if (
        old.player.run !== next.player.run ||
        old.opponent.run !== next.opponent.run ||
        old.outcome !== next.outcome
      )
        setState(snapshot);
    },
    [clock, presentation],
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
      const interval = previous ? now - previous : 0;
      const delta = Math.min(80, interval);
      previous = now;
      const active = !pauseRef.current && foreground.current;
      if (practice && active && !ref.current.outcome) presentation.performance.frame(interval);
      if (active) {
        if (!ref.current.outcome) {
          const start = practice ? performance.now() : 0;
          const target = ref.current.elapsed + delta;
          if (stress) while (autoAt.current <= target && !ref.current.outcome) {
            commit(tickCombat(ref.current, autoAt.current, holdRef.current));
            const current = ref.current;
            const action = choosePlacement(current.run, true, current.elapsed-current.lastDropAt, .5);
            if (action?.type === 'place' || action?.type === 'discard') commit(placeCombat(current,
              action.type === 'place' ? action : {pieceId: action.pieceId, discard: true}, current.elapsed));
            autoAt.current += 600;
          }
          commit(tickCombat(ref.current, target, holdRef.current));
          if (practice) presentation.performance.simulation(performance.now() - start);
        }
        else clock.value += delta; // Let terminal impact particles settle before results.
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      sub.remove();
    };
  }, [commit, clock, presentation, practice, stress]);
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
    presentation,
    ref,
    clock,
    drop,
    backgrounded,
    acknowledgeBackground: () => setBackgrounded(false),
  };
}
