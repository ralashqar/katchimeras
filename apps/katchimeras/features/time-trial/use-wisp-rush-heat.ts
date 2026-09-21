import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { MergeWorldCommand } from '@/types/merge-world';
import { gameNow } from '@/utils/game-clock';
import type { HeatEvent, HeatSpec, HeatStrike } from './heat';
import { commandRushBoard, startRushBoard, tickRushBoard, type RushBoard, type RushCommandResult } from './heat-board';

const TICK_MS = 100;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * One heat, live. The clock starts on the first move and counts down foreground time only, from a monotonic timer
 * (never a wall-clock difference, so changing the device's time does nothing); when it runs out the heat is over. Leaving the app voids the heat: a time trial
 * cannot be paused to think. The board and the rules live in a ref and are published to React only when something the
 * screen draws has changed; the running clock is read through `elapsedMs()` by whoever shows it.
 */
export function useWispRushHeat(spec: HeatSpec, onStrike?: (strike: HeatStrike) => void, onEvents?: (events: readonly HeatEvent[]) => void) {
  const boardRef = useRef<RushBoard | null>(null);
  if (!boardRef.current || boardRef.current.heat.spec.id !== spec.id) boardRef.current = startRushBoard(spec, gameNow());
  const [board, setBoard] = useState<RushBoard>(boardRef.current);
  const [voided, setVoided] = useState(false);
  const startedAt = useRef<number | null>(null);
  const callbacks = useRef({ onStrike, onEvents });
  callbacks.current = { onStrike, onEvents };

  /** What is left on the clock. */
  const remainingMs = useCallback(() => {
    const heat = boardRef.current!.heat;
    if (heat.finishedMs != null) return 0;
    return Math.max(0, heat.spec.durationMs - (startedAt.current == null ? 0 : now() - startedAt.current));
  }, []);
  const playMs = () => (startedAt.current == null ? 0 : Math.max(0, now() - startedAt.current));

  const publish = useCallback((next: RushBoard, events: readonly HeatEvent[]) => {
    boardRef.current = next;
    setBoard(next);
    if (events.length) callbacks.current.onEvents?.(events);
  }, []);

  const restart = useCallback(() => {
    startedAt.current = null;
    setVoided(false);
    publish(startRushBoard(spec, gameNow()), []);
  }, [publish, spec]);
  useEffect(() => { setBoard(boardRef.current!); setVoided(false); startedAt.current = null; }, [spec.id]);

  /** A board command: what the Merge engine did with it, and the strike it made on the lane (if it was a merge). */
  const dispatch = useCallback((command: MergeWorldCommand): RushCommandResult | null => {
    const current = boardRef.current!;
    if (voided || current.heat.finishedMs != null) return null;
    if (command.type !== 'move') return null;
    // The clock starts on the first move, not when the board appears.
    if (startedAt.current == null) startedAt.current = now();
    const moved = commandRushBoard(current, command, playMs());
    publish(moved.board, moved.events);
    if (moved.strike) callbacks.current.onStrike?.(moved.strike);
    return moved;
  }, [publish, voided]);

  const running = startedAt.current != null && board.heat.finishedMs == null && !voided;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const ticked = tickRushBoard(boardRef.current!, playMs());
      if (ticked.board !== boardRef.current) publish(ticked.board, ticked.events);
    }, TICK_MS);
    const app = AppState.addEventListener('change', (status) => { if (status !== 'active') setVoided(true); });
    return () => { clearInterval(timer); app.remove(); };
  }, [publish, running]);

  return { board, dispatch, remainingMs, restart, voided, started: startedAt.current != null, finished: board.heat.finishedMs != null, score: board.heat.cleared };
}
