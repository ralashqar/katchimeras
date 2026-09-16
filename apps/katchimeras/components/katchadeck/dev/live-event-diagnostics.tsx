import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useEconomy } from '@/features/economy/economy-provider';
import type { VerifiedEventState } from '@/features/live-ops/client';
import { liveEventService } from '@/features/live-ops/service';

/** Deliberately developer-only until the command verifier and native acceptance ship. */
export function LiveEventDiagnostics() {
  const [state, setState] = useState<VerifiedEventState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Read verified progress from the server. Local playtest points do not qualify for rewards.');
  const economy = useEconomy();
  const perform = async (work?: () => Promise<{ ok: boolean; reason?: string }>) => {
    setBusy(true);
    try {
      if (work) {
        const result = await work();
        if (!result.ok) { setMessage(`Unavailable: ${result.reason ?? 'request refused'}`); return; }
        await economy.refresh();
      }
      setState(await liveEventService.load());
      setMessage(work ? 'Server operation confirmed. Economy refreshed.' : 'Showing verified server progress.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reach the event service.');
    } finally { setBusy(false); }
  };
  return <View style={styles.card}>
    <ThemedText style={styles.title}>Verified live events</ThemedText>
    <ThemedText selectable>{message}</ThemedText>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void perform(); }} style={styles.button}>
      <ThemedText style={styles.buttonText}>{busy ? 'Working…' : 'Refresh server state'}</ThemedText>
    </Pressable>
    {state ? <ThemedText>Verified Harmony: {state.harmony} · {state.events.length} events</ThemedText> : null}
    {state?.events.map((event) => <View key={event.definition.id} style={styles.event}>
      <ThemedText style={styles.title}>{event.definition.title}</ThemedText>
      <ThemedText>{event.points} verified points · {event.enabled ? 'available' : 'retired'}</ThemedText>
      {!event.enrolledAt ? <Pressable accessibilityRole="button" disabled={busy || !event.enabled} style={styles.button} onPress={() => { void perform(() => liveEventService.enroll(event.definition.id)); }}>
        <ThemedText style={styles.buttonText}>Enroll</ThemedText>
      </Pressable> : event.definition.tiers.map((tier) => {
        const claimed = event.claims.some((claim) => claim.tierId === tier.id && claim.track === 'free');
        const supported = tier.free.items.every((item) => item.kind === 'gems' || item.kind === 'wisp');
        return <View key={tier.id} style={styles.event}>
          <ThemedText>{tier.id} · {tier.points} points{claimed ? ' · delivered' : !supported ? ' · delivery not implemented' : ''}</ThemedText>
          <Pressable accessibilityRole="button" disabled={busy || claimed || !supported || !event.enabled || event.points < tier.points} style={styles.button}
            onPress={() => { void perform(() => liveEventService.claim(event.definition.id, tier.id)); }}>
            <ThemedText style={styles.buttonText}>Claim free reward</ThemedText>
          </Pressable>
        </View>;
      })}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF9EC', borderColor: '#DCCCA8', borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  event: { gap: 8, borderTopWidth: 1, borderColor: '#DCCCA8', paddingTop: 12 },
  button: { padding: 12, backgroundColor: '#36713E', borderRadius: 12 },
  buttonText: { color: '#FFF9EC', fontWeight: '700' },
});
