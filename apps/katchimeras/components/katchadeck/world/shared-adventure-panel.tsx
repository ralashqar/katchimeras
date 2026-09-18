import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { MistMissionDock } from './kingdom-opening-merge-dock';
import { FIRST_ANSWER, LANTERN_ROUTES, routeById } from '@/features/shared-adventure/catalog';
import { ADVENTURE_FLOWS, registerAdventureFlows } from '@/features/shared-adventure/flows';
import { adventureNext, routeRewardAvailable } from '@/features/shared-adventure/runtime';
import type { AdventureCommand } from '@/features/shared-adventure/types';
import { applyStoredAdventure } from '@/utils/merge-world/repository';
import { dispatchContentFlowCommand, startContentFlow } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { OPENING_BOARD_LAYOUT } from '@/features/onboarding/opening-mist';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { gameNow } from '@/utils/game-clock';

const LAYOUT = { ...OPENING_BOARD_LAYOUT, rows: 4, cellIndices: missionWindow(4).cellIndices, accessibilityLabel: 'Lantern route merge board, five columns by four rows' };
const EMPTY = new Set<string>();
export function SharedAdventurePanel({ world, onClose, onGarden, onFeastle }: {
  world: MergeWorldState; onClose: () => void; onGarden: () => void; onFeastle: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<ContentFlowRun | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [clock, setClock] = useState(gameNow);
  const next = adventureNext(world);
  const beatId = next?.kind === 'scene' ? next.beatId : undefined;
  const definition = ADVENTURE_FLOWS.find(d => d.id === `${FIRST_ANSWER.id}:${beatId}`);
  useEffect(() => {
    const timer = setInterval(() => setClock(gameNow()), 30_000);
    void applyStoredAdventure({ type: 'diagnostic', kind: 'view', target: FIRST_ANSWER.id }).catch(() => {});
    return () => { clearInterval(timer); };
  }, []);
  useEffect(() => {
    let active = true;
    setFlow(null);
    setError('');
    if (!definition) return;
    registerAdventureFlows();
    const runId = `${definition.id}:${world.createdAt}`;
    void loadContentFlowRun(runId).then(saved => saved ?? startContentFlow(definition, { runId }))
      .then(run => { if (active) setFlow(run); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [definition, world.createdAt, loadAttempt]);
  const work = async (action: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { busy.current = false; setPending(false); }
  };
  const send = (command: AdventureCommand) => work(() => applyStoredAdventure(command));
  const run = world.sharedAdventure?.run;
  const route = run && !run.completedAt ? routeById(run.routeId) : undefined;
  const scene = definition?.nodes.find(n => n.id === flow?.nodeId);
  const line = scene?.kind === 'scene' ? scene : null;
  const button = (label: string, action: () => void, key = label) => <KatchaButton key={key} label={label} disabled={pending} onPress={action} />;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={[styles.scrim, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView contentContainerStyle={styles.card} style={route ? { maxHeight: '36%' } : { maxHeight: '85%' }}>
        <Image source={require('@incubator/art-world/props/prop_lantern.png')} style={styles.lantern} contentFit="contain" />
        <Text style={styles.eyebrow}>{FIRST_ANSWER.destination}</Text>
        <Text accessibilityRole="header" style={styles.title}>{route?.title ?? next?.title ?? FIRST_ANSWER.title}</Text>
        {line ? <>
          <Text style={styles.speaker}>{String(line.payload?.speaker)}</Text>
          <Text style={styles.body}>{String(line.payload?.text)}</Text>
          {beatId === 'answer' && flow?.nodeId === 'line:3' ? <Text style={styles.body}>{({ welcome: 'You are welcome here. That is the promise our light carries.', rest: 'A place to rest. That is the promise our light carries.', company: 'You are not alone. That is the promise our light carries.' })[world.sharedAdventure?.promise ?? 'welcome']}</Text> : null}
          {line.actions.map(action => button(action.id === 'continue' ? 'Continue' : ({ welcome: 'You are welcome here', rest: 'A place to rest', company: 'You are not alone' }[action.id] ?? action.id), () => {
            void work(async () => { setFlow(await dispatchContentFlowCommand(flow!.runId, { type: 'submit_scene', actionId: action.id })); });
          }, action.id))}
        </> : null}
        {flow?.status === 'failed_recoverable' ? button('Try again', () => { void work(async () => setFlow(await dispatchContentFlowCommand(flow.runId, { type: 'retry' }))); }) : null}
        {next?.kind === 'garden' ? <><Text style={styles.body}>Your friends’ request is waiting in the Garden.</Text>{button('Open the Garden', onGarden)}</> : null}
        {next?.kind === 'feastle' ? <><Text style={styles.body}>A warm table is hidden in the Mist. Bring Feastle home and share the first Snack.</Text>{button('Visit Feastle', onFeastle)}</> : null}
        {next?.kind === 'mission' && !route ? button('Clear the signal site', () => { void send({ type: 'start_route', routeId: 'signal-site' }); }) : null}
        {route && run ? <><Text style={styles.body}>Match pairs and wake matching pieces in the Mist. Your route saves after every move.</Text>{run.merges >= route.required ? button(route.id === 'signal-site' ? 'Raise the Lantern Post' : 'Bring the light home', () => { void send({ type: 'finish_route', runId: run.id }); }) : null}</> : null}
        {next?.kind === 'routes' && !route ? <>
          <Text style={styles.body}>Someone beyond the trees answered. Follow the lantern paths while we prepare the way to Heartwood.</Text>
          {world.sharedAdventure?.pathfinderAt ? <Text style={styles.speaker}>First Pathfinder · all three paths explored</Text> : null}
          {run?.completedAt ? <Text style={styles.body}>{run.reward ? `You brought home ${run.reward} Glow.` : 'A little more light along the path.'}</Text> : null}
          {LANTERN_ROUTES.map(r => button(`${r.title} · ${routeRewardAvailable(world.sharedAdventure!, r.id, clock) ? '20 Glow today' : 'Practice · no Glow'}`, () => { void send({ type: 'start_route', routeId: r.id }); }, r.id))}
          <Text style={styles.body}>Each path gives Glow once per local day. Come back whenever you like.</Text>
        </> : null}
        {error ? <Text accessibilityRole="alert" style={styles.body}>{error}</Text> : null}
        {error && definition && !flow ? button('Load story again', () => setLoadAttempt(value => value + 1)) : null}
        {button('Back to the Kingdom', onClose)}
      </ScrollView>
      {route && run ? <MistMissionDock state={run.board} boardStep={null} layout={LAYOUT} progress={run.merges} required={route.required}
        barTitle={route.title} interactionKey={run.id} sessionId={run.id} hiddenItemIds={EMPTY} width={width} bottomInset={insets.bottom}
        onClose={onClose} onCommand={command => {
          if (busy.current || command.type !== 'move' || run.merges >= route.required) return null;
          const result = reduceMergeWorld(run.board, command);
          if (result.changed) void send({ type: 'move', runId: run.id, from: command.from, to: command.to });
          return result;
        }} /> : null}
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,28,24,0.9)', justifyContent: 'flex-start', paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF3D8', borderRadius: 24, padding: 22, gap: 14 },
  lantern: { width: 68, height: 76, alignSelf: 'center' },
  eyebrow: { color: '#5C7149', fontSize: 13, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#2C402F', textAlign: 'center' },
  speaker: { fontSize: 16, fontWeight: '700', color: '#647845', textTransform: 'capitalize' },
  body: { fontSize: 17, lineHeight: 25, color: '#344237' },
});
