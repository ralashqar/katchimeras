import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
export function DeveloperProfilePanel({ enabled, title, diagnostics, actions }: {
  enabled: boolean; title: string; diagnostics: string;
  actions: readonly { label: string; run(): Promise<void> }[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!enabled) return null;
  return <ScrollView contentContainerStyle={{ padding: 22, gap: 12 }}>
    <Text style={{ fontSize: 26, color: '#FFF4DB', fontWeight: '700' }}>{title}</Text>
    {!!message && <Text accessibilityRole="alert" style={{ color: '#FFE1A6' }}>{message}</Text>}
    {actions.map(action => <Pressable key={action.label} accessibilityRole="button" disabled={busy} onPress={() => { setBusy(true); setMessage(''); void action.run().then(() => setMessage('Done')).catch(e => setMessage(e instanceof Error ? e.message : 'Unable to complete action')).finally(() => setBusy(false)); }} style={{ backgroundColor: '#E8D8B7', padding: 16, borderRadius: 12, opacity: busy ? .5 : 1 }}><Text style={{ color: '#233B2E', fontWeight: '700' }}>{action.label}</Text></Pressable>)}
    <Text selectable style={{ color: '#D9E6DB' }}>{diagnostics}</Text>
    <View style={{ height: 24 }} />
  </ScrollView>;
}
