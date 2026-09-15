import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { DASHBOARD_STAT_ART } from '@/constants/journal-art-sources';
import { AppState, Linking, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { useCompanionSteps } from '@/hooks/use-companion-steps';
import { bestRecentStepDay, readRecentPedometerStepDays, getPedometerAccess, requestPedometerAccess, type PedometerAccess, type PedometerStepDay } from '@/utils/pedometer-steps';
import { localDayId } from '@/utils/world-identity';
import type { HatchableEggAction } from '@/features/onboarding/hatchable-egg-policy';

/** Steppling alone can awaken with recent movement; access is always optional. */
export function StepplingHatchAction({ busy, send }: {
  busy: boolean; send: (action: HatchableEggAction) => Promise<boolean>;
}) {
  const steps = useCompanionSteps();
  const [access, setAccess] = useState<PedometerAccess | null>(null);
  const [recentDays, setRecentDays] = useState<PedometerStepDay[]>([]);
  useEffect(() => {
    if (access !== 'available') return;
    let live = true;
    void readRecentPedometerStepDays(new Date(), 2).then((days) => { if (live) setRecentDays(days); });
    return () => { live = false; };
  }, [access, steps.dayId, steps.steps, steps.available]);
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const requestingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const check = async () => {
      const next = await getPedometerAccess();
      if (mounted.current) setAccess(next);
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    return () => { mounted.current = false; subscription.remove(); };
  }, []);
  const enable = async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    setRequesting(true);
    try {
      if (access === 'denied') await Linking.openSettings();
      else await requestPedometerAccess();
      const next = await getPedometerAccess();
      await steps.refresh();
      if (mounted.current) { setAccess(next); setDismissed(true); }
    } finally {
      requestingRef.current = false;
      if (mounted.current) { setRequesting(false); setDismissed(true); }
    }
  };
  if (!dismissed && (access === 'should_request' || access === 'denied')) return (
    <GameSurface>
      <ThemedText lightColor="#3A2517" darkColor="#3A2517" style={{ fontSize: 20, lineHeight: 26, fontWeight: '800' }}>Let your steps wake Steppling</ThemedText>
      <ThemedText lightColor="#61462C" darkColor="#61462C">Enable step tracking to hatch with 300 steps from today or yesterday and share your walks with Steppling. You can also hatch without it.</ThemedText>
      <KatchaButton label={access === 'denied' ? 'Open step settings' : 'Enable steps'} disabled={busy || requesting} onPress={() => void enable().catch(() => {})} />
      <KatchaButton label="Not now" disabled={busy || requesting} onPress={() => setDismissed(true)} />
    </GameSurface>
  );
  const best = bestRecentStepDay([...recentDays, ...(steps.available ? [{ dayId: steps.dayId, totalSteps: steps.steps }] : [])]);
  const canUseSteps = access === 'available' && best.totalSteps >= 300;
  const hatchButton = <KatchaButton label={canUseSteps ? 'Use steps to hatch' : 'Hatch'} disabled={busy || requesting || access === null}
    onPress={() => void send(canUseSteps
      ? { kind: 'hatch', steps: { dayId: best.dayId, observedSteps: best.totalSteps } }
      : { kind: 'hatch' })} />;
  if (!canUseSteps) return hatchButton;
  return <GameSurface>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
      <Image source={DASHBOARD_STAT_ART.steps} contentFit="contain" style={{ width: 52, height: 52 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText lightColor="#3A2517" darkColor="#3A2517" style={{ fontSize: 32, lineHeight: 38, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{best.totalSteps.toLocaleString()}</ThemedText>
        <ThemedText lightColor="#61462C" darkColor="#61462C" style={{ fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{best.dayId === localDayId() ? 'Steps today' : 'Steps yesterday'}</ThemedText>
      </View>
    </View>
    {hatchButton}
  </GameSurface>;
}

