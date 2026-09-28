import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppForeground } from '@/hooks/use-app-foreground';
import { useActivityWorld } from '@/features/activities/use-activity-world';
import { flushMergeWorldWriters } from '@/utils/merge-world/writer-flush';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { saveActivitySession, useActivitySession, type ActivityResult, type ActivitySession } from '@/features/activities/activity-session';
import { todayAtmosphereBackgroundForScene } from '@/utils/day-background-scene';
import { ActivityTile } from '@/components/katchadeck/games/activity-tile';
import { CafeActivity } from '@/components/katchadeck/games/cafe-activity';
import { EventActivity } from '@/components/katchadeck/games/event-activity';
import { RushActivity } from '@/components/katchadeck/games/rush-activity';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { MergeWorldState } from '@/types/merge-world';
import type { ActivitySceneProps } from '@/features/activities/activity-scene';

export default function ActivityRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useActivitySession();
  const { state, loading, error } = useActivityWorld();
  const router = useRouter();
  if (loading) return <View style={styles.scene} />;
  if (!session || session.id !== sessionId || !state) return <View style={styles.recovery}>
    <Text>{error ?? 'This activity is no longer available.'}</Text>
    <KatchaButton label="Return to the world" onPress={() => router.replace('/katchimeras')} />
  </View>;
  return <ActivityScene key={session.id} session={session} world={state} />;
}

function ActivityScene({ session, world }: { session: ActivitySession; world: MergeWorldState }) {
  const router = useRouter();
  const transition = useGameScreenTransition();
  const focused = useIsFocused();
  const foreground = useAppForeground();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View | null>(null);
  const [tileNode, setTileNode] = useState<View | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [tileReady, setTileReady] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [artError, setArtError] = useState(false);
  const leaving = useRef(false);
  const [returning, setReturning] = useState(false);
  const tileLoaded = useCallback(() => setTileReady(true), []);
  const tileFailed = useCallback(() => { setTileReady(true); setArtError(true); }, []);
  const ready = useCallback(() => setBoardReady(true), []);
  const metrics = useCallback(() => undefined, []);
  const backdrop = useMemo(() => todayAtmosphereBackgroundForScene(session.backdrop), [session.backdrop]);
  const returnToWorld = useCallback(() => transition.transitionTo({ target: 'katchimeras', announcement: 'Returning to the world', expectedPathname: '/katchimeras',
    navigate: () => { if (router.canGoBack()) router.back(); else router.replace('/katchimeras'); },
    onReturn: () => router.replace('/katchimeras'),
  }), [router, transition]);
  const leave = useCallback(async (result: ActivityResult = {}) => {
    if (leaving.current) return;
    leaving.current = true; setReturning(true);
    try {
      await flushMergeWorldWriters();
      saveActivitySession({ ...session, status: 'returning', result });
      returnToWorld();
    } catch (error) { leaving.current = false; setReturning(false); throw error; }
  }, [returnToWorld, session]);
  useEffect(() => { if (focused && session.status === 'returning' && !transition.active) returnToWorld(); }, [focused, returnToWorld, session.status, transition.active]);
  useGameSurfaceReadiness('activity', { data: true, layout: layoutReady, background: backgroundReady && tileReady,
    foreground: boardReady, interaction_target: boardReady, route: true }, focused);
  const active = focused && foreground && !transition.active && boardReady && tileReady && backgroundReady && !returning && session.status === 'playing';
  const props: ActivitySceneProps = { session, world, active, rootRef, tileNode, width, bottomInset: insets.bottom, topInset: insets.top,
    onReady: ready, onBoardMetrics: metrics, onLeave: leave };
  return <View ref={rootRef} collapsable={false} onLayout={() => setLayoutReady(true)} style={styles.scene}>
    <Image source={backdrop.havenSource} contentFit="cover" style={StyleSheet.absoluteFill} transition={0}
      onLoad={() => setBackgroundReady(true)} onError={() => { setBackgroundReady(true); setArtError(true); }} />
    <View pointerEvents="none" style={styles.dim} />
    <ActivityTile session={session} width={width} height={height} anchorRef={setTileNode} onReady={tileLoaded} onError={tileFailed} />
    <View style={StyleSheet.absoluteFill} pointerEvents={active ? 'box-none' : 'none'}>
      {session.source.kind === 'cafe' ? <CafeActivity {...props} /> : session.source.kind === 'event' ? <EventActivity {...props} /> : <RushActivity {...props} />}
    </View>
    {artError ? <View pointerEvents="none" style={[styles.notice, { top: insets.top + 64 }]}><Text>Some scenery could not load. Your board is still available.</Text></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: '#25243D' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,17,38,0.42)' },
  recovery: { flex: 1, justifyContent: 'center', padding: 30 },
  notice: { position: 'absolute', left: 24, right: 24, padding: 12, backgroundColor: '#F4F9FD', borderRadius: 12, zIndex: 150 },
});
