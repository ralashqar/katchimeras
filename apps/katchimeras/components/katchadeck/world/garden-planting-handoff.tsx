import { useEffect, useState } from 'react';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';

/** The Seed was already received in dialogue; this checkpoint has no entrance UI. */
export function GardenPlantingHandoff({ onContinue }: { onContinue?: () => unknown }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    Promise.resolve().then(async () => {
      if (active && await onContinue?.() === false) throw new Error('Garden handoff failed');
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [onContinue, attempt]);
  return failed ? <KatchaButton label="Try opening the Garden again" onPress={() => setAttempt((value) => value + 1)} /> : null;
}
