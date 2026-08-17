import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SectionHeader } from '@/components/katchadeck/ui/section-header';
import { ThemedText } from '@/components/themed-text';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import type { PlayerProfileSnapshot } from '@/types/player-profile-snapshot';
import { deleteCapturedPlayerProfileSnapshot, listCapturedPlayerProfileSnapshots } from '@/utils/dev-profile-snapshot-storage';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import { getDevProfileSession, replacePlayerProfileSnapshot, restorePlayerProfileRollback } from '@/utils/player-profile-snapshots';
import { reloadAfterProfileSnapshotChange } from '@/utils/player-profile-runtime';

export function ProfileSnapshotManagerScreen() {
  const router = useRouter();
  const fixtures = useMemo(() => buildPlayerProfileFixtures(), []);
  const [captures, setCaptures] = useState<PlayerProfileSnapshot[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const session = getDevProfileSession();
  const matches = useCallback((snapshot: PlayerProfileSnapshot) => {
    const needle = query.trim().toLocaleLowerCase();
    return !needle || [snapshot.name, snapshot.description, ...snapshot.tags, snapshot.summary.ftueStep ?? '', snapshot.summary.activeGateId ?? '']
      .some((value) => value.toLocaleLowerCase().includes(needle));
  }, [query]);
  const visibleFixtures = fixtures.filter(matches);
  const visibleCaptures = captures.filter(matches);

  const refresh = useCallback(() => {
    void listCapturedPlayerProfileSnapshots().then(setCaptures).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Captured snapshots could not be loaded.');
    });
  }, []);
  useFocusEffect(refresh);

  const load = useCallback((snapshot: PlayerProfileSnapshot) => {
    Alert.alert(
      `Load “${snapshot.name}”?`,
      'This replaces gameplay progress on this device. A rollback snapshot will be saved automatically, and remote progression sync will stay sandboxed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load snapshot',
          style: 'destructive',
          onPress: () => {
            setBusyId(snapshot.id);
            setError(null);
            void replacePlayerProfileSnapshot(snapshot).then(reloadAfterProfileSnapshotChange).catch((caught) => {
              setBusyId(null);
              setError(caught instanceof Error ? caught.message : 'The profile snapshot could not be loaded.');
            });
          },
        },
      ],
    );
  }, []);

  const restore = useCallback(() => {
    Alert.alert('Restore previous profile?', 'This exits the snapshot sandbox and restores the profile saved before the latest load.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore profile',
        onPress: () => {
          setBusyId('__rollback__');
          void restorePlayerProfileRollback().then((restored) => {
            if (!restored) throw new Error('No rollback profile is available.');
            return reloadAfterProfileSnapshotChange();
          }).catch((caught) => {
            setBusyId(null);
            setError(caught instanceof Error ? caught.message : 'The previous profile could not be restored.');
          });
        },
      },
    ]);
  }, []);

  const removeCapture = useCallback((snapshot: PlayerProfileSnapshot) => {
    Alert.alert(`Delete “${snapshot.name}”?`, 'This local capture cannot be recovered.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteCapturedPlayerProfileSnapshot(snapshot.id).then(refresh) },
    ]);
  }, [refresh]);

  if (!DEV_TOOLS_ENABLED) {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ThemedText selectable type="title">Developer tools are disabled</ThemedText>
    </ScrollView>;
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <GlassPanel contentStyle={styles.panelBody}>
        <SectionHeader label="Active profile" title={session ? 'Snapshot sandbox' : 'Normal local profile'} />
        <ThemedText selectable style={styles.secondary}>
          {session ? `${session.snapshotName} · loaded ${new Date(session.loadedAt).toLocaleString()}` : 'Remote progression uses the normal app policy.'}
        </ThemedText>
        {session ? <KatchaButton fullWidth label={busyId === '__rollback__' ? 'Restoring…' : 'Restore previous profile'} loading={busyId === '__rollback__'} onPress={restore} variant="primary" /> : null}
      </GlassPanel>

      {error ? <GlassPanel contentStyle={styles.panelBody}>
        <ThemedText selectable style={styles.error}>{error}</ThemedText>
      </GlassPanel> : null}

      <GlassPanel contentStyle={styles.panelBody}>
        <SectionHeader label="Device-only" title="Capture the current profile" />
        <ThemedText selectable style={styles.secondary}>Preserves exact timestamps for reproducing a bug on this device.</ThemedText>
        <KatchaButton fullWidth label="Create local capture" onPress={() => router.push('/dev-profile-snapshot-capture')} variant="secondary" />
      </GlassPanel>

      <TextInput accessibilityLabel="Search profile snapshots" onChangeText={setQuery} placeholder="Search FTUE, parcel, Gate 4…" placeholderTextColor="#8EA3C7" style={styles.search} value={query} />

      <View style={styles.section}>
        <SectionHeader label={`${visibleFixtures.length} of ${fixtures.length} checked-in states`} title="Discovery milestones" />
        {visibleFixtures.map((snapshot) => <SnapshotCard busy={busyId === snapshot.id} key={snapshot.id} onLoad={() => load(snapshot)} snapshot={snapshot} />)}
      </View>

      {visibleCaptures.length ? <View style={styles.section}>
        <SectionHeader label={`${visibleCaptures.length} on this device`} title="Local captures" />
        {visibleCaptures.map((snapshot) => <SnapshotCard busy={busyId === snapshot.id} key={snapshot.id} onDelete={() => removeCapture(snapshot)} onLoad={() => load(snapshot)} onRename={() => router.push({ pathname: '/dev-profile-snapshot-capture', params: { snapshotId: snapshot.id } })} snapshot={snapshot} />)}
      </View> : null}
    </ScrollView>
  );
}

function SnapshotCard({ busy, onDelete, onLoad, onRename, snapshot }: {
  busy: boolean;
  onDelete?: () => void;
  onLoad: () => void;
  onRename?: () => void;
  snapshot: PlayerProfileSnapshot;
}) {
  const summary = snapshot.summary;
  const details = [
    summary.ftueStep ? `FTUE ${summary.ftueStep}` : 'Before FTUE',
    summary.activeGateId,
    summary.selectedCharacterId,
    summary.discoveryStage == null ? null : `stage ${summary.discoveryStage}`,
    summary.pendingParcelCount ? `${summary.pendingParcelCount} parcel waiting` : null,
  ].filter(Boolean).join(' · ');
  return <GlassPanel contentStyle={styles.cardBody}>
    <View style={styles.cardHeader}>
      <View style={styles.cardCopy}>
        <ThemedText selectable type="subtitle">{snapshot.name}</ThemedText>
        <ThemedText selectable style={styles.secondary}>{snapshot.description}</ThemedText>
      </View>
      <ThemedText selectable style={styles.source}>{snapshot.source === 'fixture' ? 'REBASED' : 'FROZEN'}</ThemedText>
    </View>
    <ThemedText selectable style={styles.details}>{details}</ThemedText>
    <View style={styles.tags}>{snapshot.tags.map((tag) => <View key={tag} style={styles.tag}><ThemedText selectable style={styles.tagText}>{tag}</ThemedText></View>)}</View>
    <KatchaButton fullWidth label={busy ? 'Loading…' : 'Load snapshot'} loading={busy} onPress={onLoad} variant="primary" />
    {onRename ? <KatchaButton fullWidth label="Edit name and notes" onPress={onRename} variant="secondary" /> : null}
    {onDelete ? <KatchaButton fullWidth label="Delete local capture" onPress={onDelete} variant="destructive" /> : null}
  </GlassPanel>;
}

const styles = StyleSheet.create({
  content: { gap: 18, padding: 20, paddingBottom: 48 },
  panelBody: { gap: 12 },
  section: { gap: 12 },
  cardBody: { gap: 12 },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  cardCopy: { flex: 1, gap: 4 },
  secondary: { color: '#C4D8FF', lineHeight: 20 },
  details: { color: '#E7EEFF', fontSize: 12, lineHeight: 18 },
  source: { color: '#9BD7B0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: 'rgba(196,216,255,0.12)', borderCurve: 'continuous', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  tagText: { color: '#D9E4FF', fontSize: 11, fontWeight: '700' },
  error: { color: '#FFD0D0', lineHeight: 20 },
  search: { backgroundColor: 'rgba(9,18,38,0.62)', borderColor: 'rgba(196,216,255,0.2)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, color: '#F8FBFF', fontSize: 16, paddingHorizontal: 15, paddingVertical: 13 },
});
