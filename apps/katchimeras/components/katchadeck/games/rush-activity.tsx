import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { ActivitySceneProps } from '@/features/activities/activity-scene';
import type { ActivityResult } from '@/features/activities/activity-session';
import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import type { RewardFlightPoint } from '../ui/reward-token-flight';
import type { MissionStrike } from '@/types/mission-mechanic';
import { WispRushDock } from '../world/wisp-rush-dock';
import { MissionWisps } from '../world/corruption-wisp-layer';
import { MissionGlowLayer, OPENING_GLOW_FLIGHT_MS, useOpeningGlow } from '../world/kingdom-opening-merge-dock';
import { createRushLive, heatHost } from '@/features/time-trial/heat-mechanic';
import { heatFor, heatPars } from '@/features/time-trial/ladder';
import { createMechanicState, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { missionWispTarget } from '@/features/mission-mechanics/wisp-target';
import { recordStoredTimeTrialHeat } from '@/utils/merge-world/repository';
import { WISP_FALL_MS } from '@/features/onboarding/use-mist-mission';
import { KatchaButton } from '../ui/katcha-button';

export function RushActivity({ session, tileNode, rootRef, width, bottomInset, topInset, onBoardMetrics, onReady, onLeave }: ActivitySceneProps) {
  const source = session.source;
  if (source.kind !== 'rush') throw new Error('A Rush scene needs a Rush session.');
  const spec = useMemo(() => heatFor(source.dayId, source.index), [source.dayId, source.index]);
  const goal = heatPars(spec).bronze;
  const live = useMemo(createRushLive, []);
  const host = useMemo(() => heatHost(spec, goal), [spec, goal]);
  const [metrics, setMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [settled, setSettled] = useState(false);
  const glow = useOpeningGlow(tileNode);
  const target = useMemo(() => ({ ...missionWispTarget({ key: session.id, host,
    mechanicState: createMechanicState(resolveMechanic(host)), node: tileNode, boardMetrics: metrics, settled }), live }), [session.id, host, tileNode, metrics, settled, live]);
  const measure = useCallback((value: MergeBoardScreenMetrics | null) => { setMetrics(value); onBoardMetrics(value); }, [onBoardMetrics]);
  const ready = useCallback(() => { setSettled(true); onReady(); }, [onReady]);
  const { launch } = glow;
  const strike = useCallback((from: RewardFlightPoint, hit: MissionStrike) => launch(from, undefined, hit), [launch]);
  const finishing = useRef(false);
  const result = useRef<ActivityResult | null>(null);
  const finalScore = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const saveAndReturn = useCallback(async () => {
    setError(null);
    try {
      if (!result.current && finalScore.current != null) {
        const score = finalScore.current;
        const { outcome } = await recordStoredTimeTrialHeat({ dayId: source.dayId, index: source.index, score });
        result.current = { rush: { index: source.index, score, outcome } };
      }
      await onLeave(result.current ?? {});
    } catch { finishing.current = false; setError('Your run could not be saved. Tap to try again.'); }
  }, [onLeave, source.dayId, source.index]);
  const finish = useCallback((score: number) => {
    if (finishing.current || finalScore.current != null) return;
    finishing.current = true;
    finalScore.current = score;
    timer.current = setTimeout(() => { timer.current = null; void saveAndReturn(); }, OPENING_GLOW_FLIGHT_MS + WISP_FALL_MS);
  }, [saveAndReturn]);
  const leave = useCallback((voided = false) => {
    if (finishing.current) return;
    finishing.current = true;
    if (finalScore.current == null) result.current = voided ? { notice: 'You left the app, so that run does not count. Run it again.' } : {};
    void saveAndReturn();
  }, [saveAndReturn]);
  const close = useCallback(() => leave(), [leave]);
  const voidRun = useCallback(() => leave(true), [leave]);
  return <>
    <WispRushDock spec={spec} goal={goal} title={`Heat ${source.index + 1} · ${goal} wisps`} live={live} strictReadiness
      width={width} bottomInset={bottomInset} landings={glow.store} onStrike={strike} onBoardMetrics={measure}
      onEntranceSettled={ready} onFinished={finish} onVoided={voidRun} onClose={close} />
    <MissionWisps target={target} glow={glow.store} screenRef={rootRef} />
    <MissionGlowLayer store={glow.store} screenRef={rootRef} retainPool />
    {error ? <View style={{ position: 'absolute', left: 24, right: 24, top: topInset + 60, zIndex: 150 }}>
      <Text accessibilityRole="alert">{error}</Text><KatchaButton label="Try saving again" onPress={close} />
    </View> : null}
  </>;
}
