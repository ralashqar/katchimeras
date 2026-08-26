import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { contentFlowDefinition, registeredContentFlowDefinitions } from '@/features/content-flow/content-flow-catalog';
import { bootstrapContentFlowCatalog } from '@/features/content-flow/content-flow-bootstrap';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { listContentFlowRuns, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import { storyFlowDiagnostics, subscribeStoryFlowDiagnostics, type StoryFlowDiagnostic } from '@/features/content-flow/story-flow-diagnostics';
import type { ContentFlowRun } from '@/types/content-flow';

function FlowRunCard({ onRetry, run }: { onRetry: () => void; run: ContentFlowRun }) {
  const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
  const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
  const effectCount = Object.keys(run.effectReceipts).length;
  const presentationCount = Object.keys(run.presentationReceipts).length;
  const navigationCount = Object.keys(run.navigationReceipts).length;
  const target = node?.kind === 'route' ? node.target.pathname : null;
  return <View style={styles.card}>
    <View style={styles.row}>
      <ThemedText selectable style={styles.title}>{run.definitionId}</ThemedText>
      <ThemedText selectable style={[styles.badge, run.status !== 'active' && styles.badgeMuted]}>{run.executionMode} · {run.status}</ThemedText>
    </View>
    <ThemedText selectable style={styles.node}>{run.nodeId}</ThemedText>
    <ThemedText selectable style={styles.detail}>v{run.definitionVersion} · revision {run.revision} · {node?.kind ?? 'missing node'} · {run.phase}</ThemedText>
    <ThemedText selectable style={styles.detail}>Effects {effectCount} · Presentations {presentationCount} · Navigation {navigationCount} · Parent {run.parentRunId ?? 'none'}</ThemedText>
    {target ? <ThemedText selectable style={styles.detail}>Expected route: {target}</ThemedText> : null}
    {typeof run.variables.shadowLastComparison === 'string' ? <ThemedText selectable style={run.variables.shadowLastComparison.startsWith('matched:') ? styles.match : styles.error}>{run.variables.shadowLastComparison}</ThemedText> : null}
    {run.error ? <ThemedText selectable style={styles.error}>{run.error}</ThemedText> : null}
    {run.status === 'failed_recoverable' ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><ThemedText style={styles.refreshLabel}>Retry node</ThemedText></Pressable> : null}
    {Object.keys(run.objectiveProgress).length ? <ThemedText selectable style={styles.code}>{JSON.stringify(run.objectiveProgress, null, 2)}</ThemedText> : null}
  </View>;
}

export function ContentFlowInspectorScreen() {
  const [runs, setRuns] = useState<ContentFlowRun[]>([]);
  const [diagnostics, setDiagnostics] = useState<StoryFlowDiagnostic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    bootstrapContentFlowCatalog();
    setDiagnostics(storyFlowDiagnostics());
    void listContentFlowRuns().then(setRuns).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the flow journal.'));
  }, []);
  useEffect(() => {
    refresh();
    const unsubscribeJournal = subscribeContentFlowJournal(refresh);
    const unsubscribeDiagnostics = subscribeStoryFlowDiagnostics(refresh);
    return () => { unsubscribeJournal(); unsubscribeDiagnostics(); };
  }, [refresh]);
  if (!DEV_TOOLS_ENABLED) return <View style={styles.center}><ThemedText>Content Flow Inspector is available in developer builds.</ThemedText></View>;
  return <>
    <Stack.Screen options={{ title: 'Content Flow Inspector' }} />
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.row}>
        <View style={styles.headingCopy}>
          <ThemedText selectable style={styles.heading}>Flow journal</ThemedText>
          <ThemedText selectable style={styles.detail}>Current nodes, durable receipts, and exact waiting phases.</ThemedText>
        </View>
        <Pressable accessibilityRole="button" onPress={refresh} style={styles.refresh}><ThemedText style={styles.refreshLabel}>Refresh</ThemedText></Pressable>
      </View>
      {error ? <ThemedText selectable style={styles.error}>{error}</ThemedText> : null}
      {runs.length ? runs.map((run) => <FlowRunCard key={run.runId} onRetry={() => { void dispatchContentFlowCommand(run.runId, { type: 'retry' }); }} run={run} />) : <View style={styles.card}><ThemedText selectable style={styles.detail}>No flow runs have been recorded yet.</ThemedText></View>}
      <ThemedText selectable style={styles.sectionHeading}>Registered graphs</ThemedText>
      {registeredContentFlowDefinitions().map((definition) => <View key={`${definition.id}@${definition.version}`} style={styles.card}>
        <ThemedText selectable style={styles.title}>{definition.id} · v{definition.version}</ThemedText>
        <ThemedText selectable style={styles.code}>{definition.nodes.map((node) => `${node.id} [${node.kind}]`).join('\n')}</ThemedText>
      </View>)}
      <ThemedText selectable style={styles.sectionHeading}>Recent diagnostics</ThemedText>
      {diagnostics.length ? diagnostics.slice(0, 30).map((entry) => <View key={`${entry.at}:${entry.message}`} style={styles.card}>
        <ThemedText selectable style={styles.node}>{entry.category} · {entry.message}</ThemedText>
        <ThemedText selectable style={styles.detail}>{new Date(entry.at).toLocaleTimeString()}</ThemedText>
        {entry.details ? <ThemedText selectable style={styles.code}>{JSON.stringify(entry.details, null, 2)}</ThemedText> : null}
      </View>) : <View style={styles.card}><ThemedText selectable style={styles.detail}>No navigation or ownership warnings in this session.</ThemedText></View>}
    </ScrollView>
  </>;
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#D9F0D2', borderRadius: 999, color: '#24472B', fontSize: 12, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  badgeMuted: { backgroundColor: '#E5E5E5', color: '#555' },
  card: { backgroundColor: '#FFF9EC', borderColor: '#DCCCA8', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 7, padding: 16 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  code: { backgroundColor: '#2D352D', borderRadius: 12, color: '#F4F0DF', fontFamily: 'monospace', fontSize: 11, padding: 10 },
  content: { backgroundColor: '#F3EBD8', gap: 12, minHeight: '100%', padding: 16 },
  detail: { color: '#6C624E', fontSize: 13, lineHeight: 18 },
  error: { color: '#A33131', fontWeight: '700' },
  heading: { color: '#302B22', fontSize: 26, fontWeight: '800' },
  headingCopy: { flex: 1, gap: 3 },
  match: { color: '#36713E', fontSize: 12, fontWeight: '800' },
  node: { color: '#36543A', fontSize: 16, fontWeight: '800' },
  refresh: { backgroundColor: '#36543A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  refreshLabel: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  retry: { alignSelf: 'flex-start', backgroundColor: '#A34D36', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  title: { color: '#302B22', flex: 1, fontSize: 17, fontWeight: '800' },
  sectionHeading: { color: '#302B22', fontSize: 20, fontWeight: '800', paddingTop: 8 },
});
