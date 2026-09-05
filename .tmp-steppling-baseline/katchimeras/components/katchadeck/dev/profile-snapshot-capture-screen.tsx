import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { capturePlayerProfileSnapshot } from '@/utils/player-profile-snapshots';
import { listCapturedPlayerProfileSnapshots, saveCapturedPlayerProfileSnapshot } from '@/utils/dev-profile-snapshot-storage';

export function ProfileSnapshotCaptureScreen() {
  const router = useRouter();
  const { snapshotId } = useLocalSearchParams<{ snapshotId?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Awaited<ReturnType<typeof listCapturedPlayerProfileSnapshots>>[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!snapshotId) return;
    void listCapturedPlayerProfileSnapshots().then((snapshots) => {
      const snapshot = snapshots.find((candidate) => candidate.id === snapshotId) ?? null;
      if (!snapshot) {
        setError('This local capture no longer exists.');
        return;
      }
      setEditing(snapshot);
      setName(snapshot.name);
      setDescription(snapshot.description);
    });
  }, [snapshotId]);
  const save = () => {
    setSaving(true);
    setError(null);
    const operation = editing
      ? saveCapturedPlayerProfileSnapshot({ ...editing, name: name.trim(), description: description.trim() })
      : capturePlayerProfileSnapshot({ name, description }).then(() => undefined);
    void operation.then(() => router.back()).catch((caught) => {
      setSaving(false);
      setError(caught instanceof Error ? caught.message : 'The profile could not be captured.');
    });
  };
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <GlassPanel contentStyle={styles.panelBody}>
      <SectionHeader label="Device-only snapshot" title={editing ? 'Edit local capture' : 'Capture current profile'} />
      <ThemedText selectable style={styles.secondary}>{editing ? 'The captured game state and exact timestamps will not change.' : 'Board state, parcels, discovery gates, FTUE, and player progression will be preserved with their exact timestamps.'}</ThemedText>
      <TextInput accessibilityLabel="Snapshot name" autoFocus onChangeText={setName} placeholder="Snapshot name" placeholderTextColor="#8EA3C7" style={styles.input} value={name} />
      <TextInput accessibilityLabel="Snapshot notes" multiline onChangeText={setDescription} placeholder="What are you testing?" placeholderTextColor="#8EA3C7" style={[styles.input, styles.notes]} value={description} />
      {error ? <ThemedText selectable style={styles.error}>{error}</ThemedText> : null}
      <KatchaButton disabled={!name.trim()} fullWidth label={saving ? 'Saving…' : editing ? 'Save changes' : 'Capture profile'} loading={saving} onPress={save} variant="primary" />
    </GlassPanel>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  panelBody: { gap: 14 },
  secondary: { color: '#C4D8FF', lineHeight: 20 },
  input: { backgroundColor: 'rgba(9,18,38,0.62)', borderColor: 'rgba(196,216,255,0.2)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, color: '#F8FBFF', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  error: { color: '#FFD0D0' },
});
