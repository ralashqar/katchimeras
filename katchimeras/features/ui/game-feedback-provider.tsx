import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { KatchaToast } from '@/components/katchadeck/ui/katcha-toast';
import { GameUI } from '@/constants/game-ui';
import { enqueueGameFeedback, type GameFeedbackInput, type GameFeedbackTone, type QueuedGameFeedback } from '@/utils/game-feedback';

export type { GameFeedbackInput, GameFeedbackTone } from '@/utils/game-feedback';

type GameFeedbackContextValue = {
  dismiss: () => void;
  show: (input: GameFeedbackInput | string) => void;
};

const GameFeedbackContext = createContext<GameFeedbackContextValue | null>(null);

export function GameFeedbackProvider({ children }: PropsWithChildren) {
  const [queue, setQueue] = useState<QueuedGameFeedback[]>([]);
  const nonce = useRef(0);
  const active = queue[0] ?? null;
  const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);
  const show = useCallback((input: GameFeedbackInput | string) => {
    const next = typeof input === 'string' ? { message: input } : input;
    setQueue((current) => enqueueGameFeedback(current, next, `feedback:${++nonce.current}`));
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(dismiss, active.durationMs);
    return () => clearTimeout(timer);
  }, [active, dismiss]);
  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);
  return <GameFeedbackContext value={value}>
    {children}
    <KatchaSurfaceProvider surface="parchment">
      <KatchaToast icon={active?.icon} message={active?.message ?? null} placementStyle={styles.toast} tone={active?.tone} />
    </KatchaSurfaceProvider>
  </GameFeedbackContext>;
}

export function useGameFeedback() {
  const value = use(GameFeedbackContext);
  if (!value) throw new Error('useGameFeedback must be used inside GameFeedbackProvider.');
  return value;
}

const styles = StyleSheet.create({ toast: { bottom: 112, zIndex: GameUI.layer.toast } });
