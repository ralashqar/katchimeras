import { gameClock, gameNow } from '@/utils/game-clock';
import { subscribeGardenEventOpen } from './garden-event-adornment';
import { drainGameplaySourceOutboxes, subscribeGameplayOutbox } from '@/features/live-ops/source-outbox';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet, type KatchaSheetProps } from '@/components/katchadeck/ui/katcha-sheet';
import { MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import { availableLocalEvents, harmonyDefinition } from '@/features/live-ops/local-catalog';
import { localEventLock } from '@/features/live-ops/local-runtime';
import { emptyHarmony, eventPhase } from '@/features/live-ops/rules';
import type { HarmonyState } from '@/types/live-ops';
import type { LocalEventCommand } from '@/types/local-live-ops';
import type { MergeWorldState } from '@/types/merge-world';
import { appendSourceGameplayEvents, applyStoredLocalEvent, loadHarmonyProgress, loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';

function EventSheet({ embedded, ...props }: KatchaSheetProps & { embedded: boolean }) {
  return embedded ? <>{props.children}</> : <KatchaSheet {...props} />;
}

/** Mounted only when the Kingdom presentation coordinator permits ordinary interaction. */
export function LocalWorldEvents({ world, onMerge, initiallyOpen = false, onClose, embedded = false, onExplore }: { world: MergeWorldState; onMerge: () => void; initiallyOpen?: boolean; onClose?: () => void; embedded?: boolean; onExplore?: (eventId: string) => void }) {
  const [saved, setSaved] = useState(world);
  const previous = useRef(world.localLiveOps);
  const [notice, setNotice] = useState<{ text: string; revision: number } | null>(null);
  const acceptSnapshot = useCallback((next: MergeWorldState) => {
    const gains = Object.values(next.localLiveOps?.runs ?? {}).flatMap(run => {
      const old = previous.current?.runs[run.definition.id];
      const gain = old ? run.progress.points - old.progress.points : 0;
      return gain > 0 ? [`+${gain} ${run.definition.title}`] : [];
    });
    previous.current = next.localLiveOps;
    setSaved(next);
    if (gains.length) setNotice({ text: gains.join(' · '), revision: next.revision });
  }, []);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(null), 4500); return () => clearTimeout(timeout); }, [notice]);
  const [harmony, setHarmony] = useState<HarmonyState>(emptyHarmony);
  const [open, setOpen] = useState(initiallyOpen);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(gameNow());
  const refresh = useCallback(async () => {
    await drainGameplaySourceOutboxes(appendSourceGameplayEvents);
    const [next, progress] = await Promise.all([loadMergeWorldState(), loadHarmonyProgress()]);
    acceptSnapshot(next); setHarmony(progress);
  }, [acceptSnapshot]);
  useEffect(() => {
    let alive = true;
    void refresh().catch(e => alive && setError(String(e.message)));
    const unsubscribe = subscribeMergeWorldSnapshots(next => { acceptSnapshot(next); void loadHarmonyProgress().then(p => alive && setHarmony(p)).catch(e => alive && setError(e.message)); });
    const unsubscribeSources = subscribeGameplayOutbox(() => { void refresh().catch(e => alive && setError(e.message)); });
    const unsubscribeClock = gameClock.subscribe(() => { setTime(gameNow()); void refresh().catch(e => alive && setError(e.message)); });
    const timer = setInterval(() => setTime(gameNow()), 15000);
    return () => { alive = false; unsubscribe(); unsubscribeSources(); unsubscribeClock(); clearInterval(timer); };
  }, [acceptSnapshot, refresh]);
  const run = async (command: LocalEventCommand) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { const result = await applyStoredLocalEvent(command); acceptSnapshot(result.state); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); void applyStoredLocalEvent({ type: 'error' }).catch(() => {}); }
    finally { busyRef.current = false; setBusy(false); }
  };
  useEffect(() => subscribeGardenEventOpen(() => { setOpen(true); void refresh().catch(e => setError(e.message)); }), [refresh]);
  const local = saved.localLiveOps;
  const now = Math.max(time, local?.clock ?? 0);
  const events = [...new Map([...availableLocalEvents(), ...Object.values(local?.runs ?? {}).map(r => r.definition)].map(e => [e.id, e])).values()];
  const restored = (saved.haven.tileStages.mossprout ?? 0) >= 1;
  if (!restored && !events.length && !initiallyOpen) return null;
  const active = events.filter(e => eventPhase(e, now) === 'active');
  const hasKeepsakes = Object.keys(local?.keepsakes ?? {}).length > 0;
  return <>
    {notice && !open ? <View pointerEvents="none" style={styles.notice}><ThemedText lightColor="#332918" darkColor="#332918" accessibilityLiveRegion="polite">{notice.text}</ThemedText></View> : null}
    {!initiallyOpen ? <View style={styles.marker}>
      <KatchaButton label={active.length ? `World events · ${active.length}` : `Harmony · ${harmony.points}`} onPress={() => { setOpen(true); void run({ type: 'view' }); }} />
    </View> : null}
    {open ? <EventSheet embedded={embedded} header={{ eyebrow: 'THE LIVING GROVE', title: 'A little more of the world', subtitle: `${harmony.points} Harmony · lasting progress` }} onRequestClose={() => { setOpen(false); onClose?.(); void run({ type: 'dismiss' }); }} scroll size="tall" surface="parchment">
      <View style={styles.content}>
        <ThemedText lightColor="#332918" darkColor="#332918">Bring friends home, restore places and discover their stories. Harmony remembers what you have brought back.</ThemedText>
        {harmony.points < harmonyDefinition().incursionThreshold ? <ThemedText lightColor="#332918" darkColor="#332918">Next: returning Mist at {harmonyDefinition().incursionThreshold} Harmony.</ThemedText> : <ThemedText lightColor="#332918" darkColor="#332918">Returning Mist is unlocked. Your restored places always remain yours.</ThemedText>}
        {!events.length ? <ThemedText lightColor="#332918" darkColor="#332918">The Grove is quiet. New disturbances will appear here when an event is available.</ThemedText> : null}
        {events.map(definition => {
          const current = local?.runs[definition.id];
          const phase = eventPhase(definition, now);
          const reason = localEventLock(saved, harmony, definition);
          const next = definition.encounters?.find(n => current?.nodes[n.id]?.phase !== 'complete');
          const companionId = next?.companionId ?? 'mossprout';
          const companionHome = companionId === 'mossprout' || saved.companionDiscovery.records.some(record => record.characterId === companionId);
          const remaining = Math.max(0, Math.ceil(((phase === 'claim' ? Date.parse(definition.claimEndsAt) : Date.parse(definition.endsAt)) - now) / 3600000));
          return <View key={definition.id} style={styles.card}>
            <ThemedText lightColor="#332918" darkColor="#332918" type="subtitle">{definition.title}</ThemedText>
            <ThemedText lightColor="#332918" darkColor="#332918">{definition.description}</ThemedText>
            <ThemedText lightColor="#332918" darkColor="#332918">{phase === 'active' ? `${remaining}h left to play` : phase === 'claim' ? `${remaining}h left to collect rewards` : phase === 'upcoming' ? 'Coming soon' : 'This visit has ended'}</ThemedText>
            {!current && phase === 'active' ? reason ? <ThemedText lightColor="#332918" darkColor="#332918">{reason}</ThemedText> : <KatchaButton label={definition.encounters?.length && companionHome ? `Visit ${MERGE_CHARACTER_NAMES[companionId] ?? 'your friend'}` : 'Take part'} disabled={busy} onPress={() => { if (definition.encounters?.length && companionHome) { setOpen(false); onClose?.(); onExplore?.(definition.id); } else void run({ type: 'join', eventId: definition.id }); }} /> : null}
            {current ? <>
              <ThemedText lightColor="#332918" darkColor="#332918">{current.progress.points} event points</ThemedText>
              <ThemedText lightColor="#332918" darkColor="#332918">{definition.rules.map(r => `${r.kind.replaceAll('_', ' ')}: ${r.points} points (up to ${r.limit})`).join('\n')}</ThemedText>
              {next && !companionHome ? <ThemedText lightColor="#332918" darkColor="#332918">Find this friend on their hex tile and complete their rescue to continue the event story.</ThemedText> : null}
              {next && companionHome && phase === 'active' ? <KatchaButton label="Continue in the world" onPress={() => { setOpen(false); onClose?.(); onExplore?.(definition.id); }} /> : null}
              {current.completedAt ? <ThemedText lightColor="#332918" darkColor="#332918">The Mist has lifted. Your keepsake is safe in the collection below.</ThemedText> : null}
              {!definition.encounters && phase === 'active' ? <KatchaButton label="Help with a request" onPress={() => { setOpen(false); onMerge(); }} /> : null}
              {definition.tiers.map(t => <View key={t.id} style={styles.reward}>
                <ThemedText lightColor="#332918" darkColor="#332918">{t.points} points · {t.free.items.map(i => i.kind === 'glow' ? `${i.amount} Glow` : i.kind === 'cosmetic' ? definition.keepsakes?.find(k => k.id === i.id)?.title : '').join(', ')}</ThemedText>
                <KatchaButton label={current.claims[t.id] !== undefined ? 'Collected' : 'Collect'} disabled={busy || current.claims[t.id] !== undefined || current.progress.points < t.points || !['active', 'claim'].includes(phase)} onPress={() => void run({ type: 'claim', eventId: definition.id, tierId: t.id })} />
              </View>)}
            </> : null}
          </View>;
        })}
        {hasKeepsakes ? <><ThemedText lightColor="#332918" darkColor="#332918" type="subtitle">Memories of the Grove</ThemedText>{Object.values(local!.keepsakes).map(k => <View key={k.definition.id} style={styles.card}>
          <ThemedText lightColor="#332918" darkColor="#332918">{k.definition.symbol === 'moon' ? '☾' : '✿'} {k.definition.title}</ThemedText><ThemedText lightColor="#332918" darkColor="#332918">{k.definition.description}</ThemedText>
          <KatchaButton disabled={busy} label={local!.equipped === k.definition.id ? 'Put away' : 'Display in the garden'} onPress={() => void run({ type: 'equip', keepsakeId: local!.equipped === k.definition.id ? undefined : k.definition.id })} />
        </View>)}</> : null}
        {error ? <ThemedText lightColor="#332918" darkColor="#332918" accessibilityRole="alert">{error}</ThemedText> : null}
      </View>
    </EventSheet> : null}
  </>;
}

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 24, right: 24, bottom: 86, zIndex: 31, backgroundColor: '#FFF5DD', borderRadius: 14, padding: 12 },
  marker: { position: 'absolute', right: 16, bottom: 26, zIndex: 31 },
  content: { gap: 16, paddingBottom: 20 },
  card: { backgroundColor: '#F6F0E4', borderRadius: 18, padding: 16, gap: 12 },
  reward: { gap: 8, borderTopWidth: 1, borderTopColor: '#E1D7C4', paddingTop: 12 },
});
