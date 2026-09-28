import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import type { ActivitySceneProps } from '@/features/activities/activity-scene';
import { worldEventActions } from '@/features/live-ops/world-event-presentation';
import { availableLocalEvents } from '@/features/live-ops/local-catalog';
import { useHarmonyProgress } from '@/features/live-ops/use-harmony-progress';
import { gameNow } from '@/utils/game-clock';
import { LocalEventMissionDock } from '../world/local-event-mission-dock';
import { KatchaButton } from '../ui/katcha-button';

export function EventActivity({ session, world, active, width, bottomInset, topInset, onBoardMetrics, onReady, onLeave }: ActivitySceneProps) {
  const harmony = useHarmonyProgress();
  const [now, setNow] = useState(gameNow);
  useEffect(() => { const timer = setInterval(() => setNow(gameNow()), 15000); return () => clearInterval(timer); }, []);
  const source = session.source;
  const action = useMemo(() => worldEventActions(world, harmony, availableLocalEvents(), now)
    .find(action => source.kind === 'event' && action.event.id === source.eventId && action.encounter.id === source.nodeId), [world, harmony, now, source]);
  const pending = useRef<Promise<unknown> | null>(null);
  const leaving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const leave = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    try { await pending.current; await onLeave({ eventComplete: action?.phase === 'resolution' }); }
    catch { leaving.current = false; setError('Could not return to the world. Please try again.'); }
  }, [action?.phase, onLeave]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { void leave(); return true; }); return () => sub.remove(); }, [leave]);
  const available = Boolean(action?.state?.board && (action.phase === 'board' || action.phase === 'resolution'));
  useEffect(() => { if (!available) onReady(); }, [available, onReady]);
  useEffect(() => {
    if (!active || action?.phase !== 'resolution') return;
    const timer = setTimeout(() => { void leave(); }, 900);
    return () => clearTimeout(timer);
  }, [active, action?.phase, leave]);
  return <>
    {available && action ? <LocalEventMissionDock action={action} width={width} bottomInset={bottomInset} strictReadiness
      pendingRef={pending} onBoardMetrics={onBoardMetrics} onEntranceSettled={onReady} onClose={() => { void leave(); }} /> : null}
    {!available || error ? <View style={{ position: 'absolute', top: topInset + 90, left: 24, right: 24, zIndex: 150 }}>
      <Text accessibilityRole="alert">{error ?? 'This event is no longer available. Your progress has been kept.'}</Text>
      <KatchaButton label="Return to the world" onPress={() => { void leave(); }} />
    </View> : null}
  </>;
}
