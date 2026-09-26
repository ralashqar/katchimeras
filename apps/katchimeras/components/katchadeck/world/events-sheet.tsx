import { StyleSheet, Text, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaUI } from '@/constants/katcha-ui';
import type { SanctuaryEvent } from '@/constants/sanctuary-events';

export type EventEntry = { event: SanctuaryEvent; host: string; progress: { done: number; total: number }; open: boolean };

/**
 * The Sanctuary's events (`constants/sanctuary-events.ts`): every repeatable mode open now, with today's progress and
 * the way in. The shape every later event joins.
 */
export function EventsSheet({ entries, onPlay, onClose }: { entries: readonly EventEntry[]; onPlay: (eventId: string) => void; onClose: () => void }) {
  return <KatchaSheet header={{ eyebrow: 'YOUR SANCTUARY', title: 'Events', subtitle: 'Other ways to push back the Mist. New every day.' }} onRequestClose={onClose} surface="parchment">
    <View style={styles.list}>
      {entries.map(({ event, host, progress, open }) => <View key={event.id} style={styles.card}>
        <Text style={styles.name}>{event.name} <Text style={styles.host}>with {host}</Text></Text>
        <Text style={styles.detail}>{event.tagline}</Text>
        <Text style={styles.progress}>{open ? `Today: ${progress.done} of ${progress.total}` : 'Opens later in the story'}</Text>
        {open ? <View style={styles.actions}><KatchaButton size="compact" glow={progress.done < progress.total} label={progress.done < progress.total ? 'Play' : 'Play again'} onPress={() => onPlay(event.id)} /></View> : null}
      </View>)}
    </View>
  </KatchaSheet>;
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 8 },
  card: { gap: 4, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 1, borderColor: 'rgba(120,90,50,0.18)' },
  name: { ...KatchaUI.type.title, color: '#3A2A1A' },
  host: { ...KatchaUI.type.label, color: '#8A6A3A' },
  detail: { ...KatchaUI.type.body, fontSize: 13, lineHeight: 18, color: '#5A4630' },
  progress: { ...KatchaUI.type.label, color: '#8A5A2A', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
