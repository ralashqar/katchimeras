import { Link, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LiveEventDiagnostics } from './live-event-diagnostics';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import fixturePack from '@/data/content-packs/event-column-shot.json';
import { contentPackLabel, registriesBuiltBeforePriming } from '@/features/content-packs/active-pack';
import { activateContentPackDocument, contentPackStatus, deactivateContentPack, fetchContentPackDocument } from '@/features/content-packs/content-pack-activation';
import { normalizeContentPack } from '@/features/content-packs/normalize-content-pack';
import { APP_VERSION } from '@/features/content-packs/prime';
import type { ContentPack } from '@/types/content-pack';

/**
 * Developer Tools: load a content pack from a URL, a pasted document or the
 * bundled fixture; see exactly what is wrong with it; activate it (its art
 * downloads, then the app restarts with the pack in every registry); or put
 * it away. What the app is playing right now is shown at the top.
 */
function counts(pack: ContentPack): string {
  const kinds = ['characters', 'families', 'skins', 'mergeChains', 'mergeGenerators', 'islands', 'storyTiles', 'hatchables', 'missions', 'chapters', 'conversations', 'flows'] as const;
  const parts = kinds.flatMap((kind) => { const entries = pack[kind]; return entries?.length ? [`${entries.length} ${kind}`] : []; });
  parts.push(`${Object.keys(pack.art ?? {}).length} art`);
  return parts.join(' · ');
}

export function ContentPackScreen() {
  const [url, setUrl] = useState('');
  const [document, setDocument] = useState('');
  const [issues, setIssues] = useState<string[] | null>(null);
  const [candidate, setCandidate] = useState<ContentPack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState(() => contentPackStatus());
  const primedLate = useMemo(() => registriesBuiltBeforePriming(), []);
  const check = useCallback((value: unknown) => {
    const result = normalizeContentPack(value);
    setIssues(result.issues);
    setCandidate(result.pack);
    return result;
  }, []);
  const checkDocument = useCallback(() => {
    try { check(JSON.parse(document)); } catch (error) { setIssues([`not JSON: ${error instanceof Error ? error.message : String(error)}`]); setCandidate(null); }
  }, [check, document]);
  const loadUrl = useCallback(async () => {
    setBusy('fetching');
    try {
      const fetched = await fetchContentPackDocument(url.trim());
      setDocument(JSON.stringify(fetched, null, 2));
      check(fetched);
    } catch (error) { setIssues([error instanceof Error ? error.message : String(error)]); setCandidate(null); }
    finally { setBusy(null); }
  }, [check, url]);
  const loadFixture = useCallback(() => {
    setDocument(JSON.stringify(fixturePack, null, 2));
    check(fixturePack);
  }, [check]);
  const activate = useCallback(async () => {
    if (!candidate) return;
    setBusy('downloading');
    const result = await activateContentPackDocument(JSON.parse(document), { source: 'dev', onProgress: (progress) => setBusy(`downloading ${progress.done}/${progress.total}`) });
    setBusy(null);
    if (!result.ok) { setIssues(result.issues); return; }
    setStatus(contentPackStatus());
  }, [candidate, document]);
  const deactivate = useCallback(() => {
    Alert.alert('Retire installed packs?', 'New event scoring stops after restart. Definitions and art stay installed so saved progress and earned content remain available.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retire packs', onPress: () => { void deactivateContentPack(); } },
    ]);
  }, []);
  if (!DEV_TOOLS_ENABLED) return null;
  return <>
    <Stack.Screen options={{ title: 'Content Packs' }} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText selectable style={styles.heading}>Content Packs</ThemedText>
      <LiveEventDiagnostics />
      <Link href="../dev-verified-merge">Open verified merge pilot</Link>
      <Link href="../dev-journey-preview">Journey draft preview</Link>
      <View style={styles.card}>
        <ThemedText selectable style={styles.title}>Playing now</ThemedText>
        {status.playing.packs.length ? status.playing.packs.map((record) => <ThemedText key={record.pack.id} selectable style={styles.detail}>{contentPackLabel(record.pack)} · {record.retiredAt ? 'retained for saved progress' : 'active'} · {counts(record.pack)}</ThemedText>) : <ThemedText style={styles.detail}>Bundled content only.</ThemedText>}
        {status.installed.revision !== status.playing.revision ? <ThemedText selectable style={styles.detail}>Release revision {status.installed.revision} is stored for the next launch.</ThemedText> : null}
        <ThemedText selectable style={styles.detail}>App {APP_VERSION}{primedLate.length ? ` · primed late: ${primedLate.join(', ')}` : ''}</ThemedText>
        {status.installed.packs.some((record) => !record.retiredAt) ? <Pressable onPress={deactivate} style={styles.buttonMuted}><ThemedText style={styles.buttonText}>Retire packs and restart</ThemedText></Pressable> : null}
      </View>
      <View style={styles.card}>
        <ThemedText selectable style={styles.title}>Load a pack</ThemedText>
        <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={setUrl} placeholder="https://…/pack.json" placeholderTextColor="#9A8E78" style={styles.input} value={url} />
        <View style={styles.row}>
          <Pressable disabled={!url.trim() || busy != null} onPress={() => { void loadUrl(); }} style={[styles.button, (!url.trim() || busy != null) && styles.buttonDisabled]}><ThemedText style={styles.buttonText}>Fetch</ThemedText></Pressable>
          <Pressable onPress={loadFixture} style={styles.buttonMuted}><ThemedText style={styles.buttonText}>Bundled fixture</ThemedText></Pressable>
        </View>
        <TextInput autoCapitalize="none" autoCorrect={false} multiline onChangeText={setDocument} placeholder="…or paste a pack document" placeholderTextColor="#9A8E78" style={[styles.input, styles.documentInput]} value={document} />
        <View style={styles.row}>
          <Pressable disabled={!document.trim()} onPress={checkDocument} style={[styles.button, !document.trim() && styles.buttonDisabled]}><ThemedText style={styles.buttonText}>Check</ThemedText></Pressable>
          <Pressable disabled={!candidate || busy != null} onPress={() => { void activate(); }} style={[styles.button, (!candidate || busy != null) && styles.buttonDisabled]}><ThemedText style={styles.buttonText}>{busy ?? 'Activate and restart'}</ThemedText></Pressable>
        </View>
      </View>
      {issues ? <View style={styles.card}>
        <ThemedText selectable style={styles.title}>{issues.length ? `Refused: ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}` : `Accepted: ${candidate ? counts(candidate) : ''}`}</ThemedText>
        {issues.map((issue, index) => <ThemedText key={index} selectable style={styles.error}>{issue}</ThemedText>)}
        {!issues.length && candidate ? <ThemedText selectable style={styles.detail}>{contentPackLabel(candidate)}{candidate.title ? ` · ${candidate.title}` : ''}{candidate.minAppVersion ? ` · needs app ${candidate.minAppVersion}` : ''}</ThemedText> : null}
      </View> : null}
    </ScrollView>
  </>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#36713E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  buttonDisabled: { opacity: 0.45 },
  buttonMuted: { backgroundColor: '#6C624E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { color: '#FFF9EC', fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: '#FFF9EC', borderColor: '#DCCCA8', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  content: { backgroundColor: '#F3EBD8', gap: 12, minHeight: '100%', padding: 16 },
  detail: { color: '#6C624E', fontSize: 13, lineHeight: 18 },
  documentInput: { fontFamily: 'monospace', fontSize: 11, minHeight: 140, textAlignVertical: 'top' },
  error: { color: '#A33131', fontSize: 13, lineHeight: 18 },
  heading: { color: '#302B22', fontSize: 26, fontWeight: '800' },
  input: { backgroundColor: '#FFFFFF', borderColor: '#DCCCA8', borderRadius: 12, borderWidth: 1, color: '#302B22', fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  title: { color: '#302B22', fontSize: 17, fontWeight: '800' },
});
