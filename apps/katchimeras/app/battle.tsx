import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HatchableMissionDock } from '@/components/katchadeck/world/hatchable-mission-dock';
import { MissionWisps } from '@/components/katchadeck/world/corruption-wisp-layer';
import { MissionGlowLayer, useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { useMistMission } from '@/features/onboarding/use-mist-mission';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { battleResumeAttempt, saveBattleSession, useBattleSession, type BattleSession } from '@/features/encounter/battle-session';
import { readMissionSnapshot } from '@/features/encounter/mission-persistence';
import type { StoredMission } from '@/features/onboarding/use-opening-mission-board';
import { useAppForeground } from '@/hooks/use-app-foreground';
import { todayAtmosphereBackgroundForScene } from '@/utils/day-background-scene';
import { abandonStoredEncounter, payStoredEncounterContinue } from '@/utils/merge-world/repository';
import { GLOW } from '@/constants/glow';
import { firstBattleLine, lostTrailLine, rescueBattleLine } from '@/constants/last-clearing-battle';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { regionFriendForMission } from '@/constants/region-friends';
import { BattleGuide } from '@/components/katchadeck/games/battle-guide';
import { BattlePerformanceProbe } from '@/features/encounter/battle-performance';
import { CombatEffectsProvider } from '@/components/katchadeck/games/combat-effects';
import { BattleArtContext, useBattleArt } from '@/features/encounter/battle-art';

export default function BattleRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useBattleSession();
  const router = useRouter();
  if (!session || session.id !== sessionId) return <View style={styles.recovery}>
    <Text style={styles.error}>This battle is no longer available.</Text>
    <KatchaButton label="Return to the world" onPress={() => router.replace('/katchimeras')} />
  </View>;
  return <BattleScene key={session.id} session={session} />;
}

function BattleScene({ session }: { session: BattleSession }) {
  const router = useRouter();
  const transition = useGameScreenTransition();
  const focused = useIsFocused();
  const foreground = useAppForeground();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const root = useRef<View | null>(null);
  const [anchor, setAnchor] = useState<View | null>(null);
  const [metrics, setMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [settled, setSettled] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [effectsReady, setEffectsReady] = useState(false);
  const markEffectsReady = useCallback(() => setEffectsReady(true), []);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);
  const [settling, setSettling] = useState(false);
  const [initialAttempt] = useState(() => battleResumeAttempt(session, readMissionSnapshot<StoredMission>(session.encounter.storageKey)));
  const glow = useOpeningGlow(anchor);
  const backdrop = useMemo(() => todayAtmosphereBackgroundForScene(session.backdrop), [session.backdrop]);
  const missionRef = useRef<ReturnType<typeof useMistMission> | null>(null);
  const returnToWorld = useCallback(() => {
    transition.transitionTo({ target: 'katchimeras', announcement: 'Returning to the world', expectedPathname: '/katchimeras',
      navigate: () => { if (router.canGoBack()) router.back(); else router.replace('/katchimeras'); },
      onReturn: () => router.replace('/katchimeras'),
    });
  }, [router, transition]);
  const finish = useCallback(async (won: boolean) => {
    if (finishing.current) return;
    finishing.current = true;
    setSettling(true);
    setError(null);
    try {
      const mission = missionRef.current;
      if (!mission) throw new Error('The battle is still preparing.');
      await mission.store.flush();
      // Back after the final hit (or after a failed completion save) must still award the win.
      const cleared = won || mission.store.status === 'cleared';
      if (cleared && (!mission.encounter?.outcome || !mission.runId)) throw new Error('Your victory is still settling. Please try again.');
      const result: BattleSession['result'] = cleared
        ? { kind: 'won', outcome: mission.encounter!.outcome!, runId: mission.runId! } : { kind: 'left' };
      if (!cleared && session.source.kind === 'island') await abandonStoredEncounter();
      saveBattleSession({ ...session, status: 'returning', result });
      returnToWorld();
    } catch (cause) {
      finishing.current = false;
      setSettling(false);
      setError(cause instanceof Error ? cause.message : 'Your battle could not be saved. Please try again.');
      throw cause;
    }
  }, [returnToWorld, session]);
  const win = useCallback(() => finish(true), [finish]);
  const leave = useCallback(() => { void finish(false).catch(() => undefined); }, [finish]);
  const pay = useCallback((receiptId: string) => payStoredEncounterContinue(receiptId, GLOW.keepGoingCost), []);
  const speech = useMemo(() => {
    const source = session.source;
    if (source.kind === 'first') return firstBattleLine;
    if (source.kind === 'trail') return (input: Parameters<typeof lostTrailLine>[1]) => lostTrailLine(source.index, input);
    const copy = source.kind === 'rescue' ? hatchableByCompanion(source.companion)?.mission.rescue
      : source.kind === 'island' ? regionFriendForMission(source.context.mission.id)?.rescue : undefined;
    return copy ? (input: Parameters<typeof rescueBattleLine>[1]) => rescueBattleLine(session.encounter, input, copy) : undefined;
  }, [session.encounter, session.source]);
  const mission = useMistMission({ guided: false, initialAttempt, active: focused && session.status === 'playing', mission: null, encounter: session.encounter, owner: 'mossprout',
    loadout: session.loadout, world: session.world, tileNode: anchor, boardMetrics: settled ? metrics : null, cameraSettled: settled,
    glow, complete: win, onLeave: leave, keepGoingCost: session.source.kind === 'island' ? GLOW.keepGoingCost : 0,
    payKeepGoing: session.source.kind === 'island' ? pay : undefined, speechFor: speech });
  missionRef.current = mission;
  const art = useBattleArt(session.encounter, metrics);
  const playing = focused && foreground && !transition.active && session.status === 'playing' && !settling
    && settled && backgroundReady && effectsReady && art.ready;
  const entranceSettled = useCallback(() => setSettled(true), []);
  useGameSurfaceReadiness('battle', { data: Boolean(mission.store.state), layout: Boolean(metrics), foreground: settled && effectsReady && art.ready,
    background: backgroundReady, interaction_target: settled, route: true }, focused);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => sub.remove();
  }, [leave]);
  useEffect(() => {
    // A process interrupted after recording the result resumes the return, never pays twice.
    if (focused && session.status !== 'playing' && !transition.active) returnToWorld();
  }, [focused, returnToWorld, session.status, transition.active]);
  const flushMission = mission.store.flush;
  useEffect(() => {
    if (!playing) void flushMission().catch(() => undefined);
  }, [flushMission, playing]);
  return <View ref={root} collapsable={false} style={styles.scene}>
    <BattleArtContext value={art.images}>
    <CombatEffectsProvider screenRef={root} active={playing} onReady={markEffectsReady}>
    <Image source={backdrop.havenSource} contentFit="cover" style={StyleSheet.absoluteFill} transition={0}
      onLoad={() => setBackgroundReady(true)} onError={() => setError('The battle background could not load. Return and try again.')} />
    <View pointerEvents="none" style={styles.dim} />
    <View ref={setAnchor} collapsable={false} pointerEvents="none" style={{ position: 'absolute', left: width * 0.15, top: insets.top + 60, width: width * 0.7, height: height * 0.24 }} />
    <View style={[styles.back, { top: insets.top + 8 }]}><KatchimeraBackButton accessibilityLabel="Leave battle" onPress={leave} /></View>
    <View style={StyleSheet.absoluteFill} pointerEvents={playing ? 'box-none' : 'none'}>
      {mission.mission && mission.store.state ? <HatchableMissionDock key={mission.runId} strictReadiness paused={!playing}
        mission={mission.mission} state={mission.store.state} send={mission.store.send} merges={mission.store.merges}
        mechanicState={mission.store.mechanicState} encounter={mission.encounter} width={width} bottomInset={insets.bottom}
        landings={glow.store} onStrike={mission.onStrike} onFinale={mission.onFinale} onReveal={mission.bumpReveal}
        onBoardMetrics={setMetrics} onEntranceSettled={entranceSettled} /> : null}
    </View>
    <MissionWisps target={mission.wispTarget} glow={glow.store} screenRef={root} />
    <MissionGlowLayer store={glow.store} screenRef={root} />
    {playing && settled && mission.store.state && mission.store.mechanicState && (session.source.kind === 'first' || session.source.kind === 'trail')
      ? <BattleGuide first={session.source.kind === 'first'} encounter={session.encounter} state={mission.store.state}
        mechanicState={mission.store.mechanicState} merges={mission.store.merges} metrics={metrics} screenRef={root} /> : null}
    <BattlePerformanceProbe active={playing} label={session.encounter.id} />
    {error || art.error || mission.stalled ? <View style={[styles.notice, { top: insets.top + 60 }]}>
      <Text style={styles.error}>{error ?? 'The battle could not load.'}</Text>
      <KatchaButton label="Return to the world" onPress={leave} />
    </View> : null}
    </CombatEffectsProvider>
    </BattleArtContext>
  </View>;
}
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: '#25243D' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,17,38,0.42)' },
  back: { position: 'absolute', left: 16, zIndex: 120 },
  notice: { position: 'absolute', left: 24, right: 24, padding: 16, backgroundColor: '#F4F9FD', borderRadius: 18, zIndex: 130 },
  error: { color: '#694659', marginBottom: 12 },
  recovery: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#F4F9FD' },
});
