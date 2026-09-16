import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { openPilotQueue, setupPilotQueueOnline } from '@/features/live-ops/pilot-service';
import { PilotError, type PilotQueue } from '@/features/live-ops/pilot-queue';
import { resolveReplayRuleset } from '@/features/live-ops/generated/registry';
import type { VerifiedBoardAction } from '@/features/live-ops/replay';
import { supabase } from '@/utils/supabase';

export default function VerifiedMergePilot() {
  const active = useRef<{ accountId: string; queue: PilotQueue } | null>(null);
  const generation = useRef(0);
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Open the pilot to load this account’s saved command queue.');
  const [selected, select] = useState<number | null>(null);
  const [stored, selectStored] = useState<number | null>(null);
  const [conflict, setConflict] = useState<number | null>(null);
  useEffect(() => {
    const lifecycle = generation;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT' || (active.current && session?.user.id !== active.current.accountId)) {
        generation.current++; active.current = null; setBusy(false); select(null); selectStored(null); setConflict(null);
        setMessage('Account changed. Open the pilot again.'); refresh((n) => n + 1);
      }
    });
    return () => { lifecycle.current++; data.subscription.unsubscribe(); };
  }, []);
  if (!DEV_TOOLS_ENABLED) return null;
  const queue = active.current?.queue;
  const snapshot = queue?.snapshot();
  const world = queue?.preview();
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    const current = generation.current;
    setBusy(true);
    try { await operation(); if (current === generation.current) { setMessage('Saved locally. Only acknowledged commands count toward online events.'); setConflict(null); } }
    catch (error) {
      if (current === generation.current) {
        setMessage(error instanceof Error ? error.message : String(error));
        if (error instanceof PilotError && error.reply.reason === 'device_conflict' && error.reply.epoch) setConflict(error.reply.epoch);
      }
    } finally { if (current === generation.current) { setBusy(false); refresh((n) => n + 1); } }
  }
  function enqueue(action: VerifiedBoardAction) {
    try { queue?.enqueue(action); select(null); selectStored(null); setMessage('Command saved on this device. Submit to verify.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    refresh((n) => n + 1);
  }
  const button = (title: string, onPress: () => void, disabled = busy) => (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>
  );
  const recoveryEpoch = snapshot?.recovery ?? conflict;
  const frozen = snapshot?.recovery != null || Boolean(snapshot?.reconciliation);
  const queuedCount = (snapshot?.pending?.batch.actions.length ?? 0) + (snapshot?.queued.reduce((sum, p) => sum + p.batch.actions.length, 0) ?? 0);
  return <ScrollView contentContainerStyle={styles.page}>
    <Stack.Screen options={{ title: 'Verified merge pilot' }} />
    <Text style={styles.title}>Verified merge pilot</Text>
    <Text style={styles.copy}>Developer board, separate from your world save. Local moves are predictions; the server decides rewards. The pilot service must be enabled by an operator.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text>
    {!queue ? <>
      {button('Open saved pilot offline', () => void run(async () => { active.current = openPilotQueue(); }))}
      {button('Set up pilot online', () => void run(async () => { const current = generation.current; const opened = await setupPilotQueueOnline(); if (generation.current === current) active.current = opened; }))}
    </> : <>
      <Text style={styles.copy}>Sequence {snapshot?.checkpoint?.sequence ?? '—'} · {queuedCount} queued · {snapshot?.pending?.phase ?? 'acknowledged'} · {snapshot?.archived.length ?? 0} archived batches</Text>
      {snapshot?.checkpoint && <Text style={styles.copy}>Rules {snapshot.checkpoint.rulesetId.slice(-8)} · {resolveReplayRuleset(snapshot.checkpoint.rulesetId)?.replayTiming ? 'Bounded offline timeline' : 'Legacy timing — save retained on its original rules'}</Text>}
      {snapshot?.reconciliation && <Text style={styles.copy}>{snapshot.reconciliation.reason}</Text>}
      {button('Connect / renew lease', () => void run(() => queue.connect()))}
      {button('Sync saved moves', () => void run(async () => { await queue.connect(); await queue.sync(); }), busy || !snapshot?.pending || frozen)}
      <Text style={styles.copy}>You can keep playing while a sync is pending. Reconnect before event end to qualify for its rewards; claims may have a separate grace period.</Text>
      {recoveryEpoch != null && button('Recover on this device', () => Alert.alert('Move pilot to this device?', 'The server board is preserved. Commands still on another device will no longer be accepted. This device’s superseded queue will be archived.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Recover', onPress: () => void run(() => queue.recover(recoveryEpoch)) },
      ]))}
    </>}
    {world && <>
      <Text style={styles.copy}>Tap an item, then its destination. Tap a generator to produce an item. Numbered cells match replay diagnostics.</Text>
      <View style={styles.board}>{world.board.map((cell, index) => <Pressable key={index} accessibilityRole="button"
        accessibilityLabel={`Cell ${index}: ${cell.occupant?.kind === 'item' ? cell.occupant.definitionId : cell.occupant?.kind === 'generator' ? cell.occupant.generatorId : cell.locked ? 'Mist' : 'Empty'}`}
        disabled={frozen} style={[styles.cell, selected === index && styles.selected, cell.locked && styles.mist]}
        onPress={() => {
          if (stored !== null) enqueue({ type: 'restoreItem', storageIndex: stored, cell: index });
          else if (selected !== null && selected !== index) enqueue({ type: 'move', from: selected, to: index });
          else if (cell.occupant?.kind === 'generator') enqueue({ type: 'tapGenerator', generatorId: cell.occupant.generatorId });
          else select(selected === index ? null : index);
        }}><Text style={styles.cellText}>{index}{'\n'}{cell.occupant?.kind === 'item' ? cell.occupant.definitionId : cell.occupant?.kind === 'generator' ? cell.occupant.generatorId : cell.locked ? 'Mist' : '·'}</Text></Pressable>)}</View>
      {selected !== null && <View style={styles.row}>
        {button('Store selected', () => enqueue({ type: 'storeItem', cell: selected }), frozen)}
        {button('Sell selected', () => enqueue({ type: 'sellItem', cell: selected }), frozen)}
      </View>}
      <Text style={styles.heading}>Storage</Text>
      {world.storage.map((item, index) => <View key={item.instanceId}>{button(`${stored === index ? 'Selected: ' : ''}${item.definitionId}`, () => { selectStored(index); select(null); }, frozen)}</View>)}
      <Text style={styles.heading}>Orders</Text>
      {world.activeOrders.map((order) => <View key={order.id}>{button(`Serve ${order.id}`, () => enqueue({ type: 'serveOrder', orderId: order.id }), frozen)}</View>)}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 12, backgroundColor: '#faf7ef', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#243b30' }, heading: { fontSize: 18, fontWeight: '600', color: '#243b30' },
  copy: { fontSize: 14, lineHeight: 21, color: '#3d5046' },
  button: { backgroundColor: '#315c45', padding: 12, borderRadius: 8 }, buttonText: { color: '#fff', fontWeight: '600' }, disabled: { opacity: 0.45 },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 }, row: { flexDirection: 'row', gap: 8 },
  cell: { width: '13.4%', minHeight: 76, backgroundColor: '#e4eddb', borderWidth: 2, borderColor: 'transparent', padding: 2 },
  selected: { borderColor: '#285d3d' }, mist: { backgroundColor: '#d8dce2' }, cellText: { fontSize: 9, color: '#243b30' },
});
