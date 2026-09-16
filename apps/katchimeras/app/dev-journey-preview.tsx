import { Stack } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { parseJourneyPreview, previewJourneyEpisode, type JourneyPreview } from '@/features/content-authoring/journey-draft';

/** Local walkthrough only: never mounts gameplay providers or writes progression. */
export default function JourneyDraftPreview() {
  const [document, setDocument] = useState('');
  const [preview, setPreview] = useState<JourneyPreview | null>(null);
  const [index, setIndex] = useState(0);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  if (!DEV_TOOLS_ENABLED) return null;
  const step = preview ? previewJourneyEpisode(preview.draft, index) : null;
  const node = step?.conversation?.nodes.find((entry) => entry.id === nodeId);
  const move = (next: number) => {
    if (!preview) return;
    setIndex(next); setReply('');
    setNodeId(previewJourneyEpisode(preview.draft, next).conversation?.entryNodeId ?? null);
  };
  return <><Stack.Screen options={{ title: 'Journey draft preview' }}/><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Mossprout draft walkthrough</Text>
    <Text>Paste the exported Studio preview. This previews base dialogue, objectives and tile art offline. Personalisation and gameplay are not simulated; your save is untouched.</Text>
    <TextInput accessibilityLabel="Preview JSON" multiline maxLength={3000000} value={document} onChangeText={setDocument} placeholder="Paste journey preview JSON" style={styles.input}/>
    <Pressable style={styles.button} onPress={() => {
      try {
        const next = parseJourneyPreview(JSON.parse(document));
        const first = previewJourneyEpisode(next.draft, 0);
        setPreview(next); setIndex(0); setNodeId(first.conversation?.entryNodeId ?? null); setReply(''); setError(''); setDocument('');
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    }}><Text>Load preview</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {preview && step && <>
      <Text style={styles.title}>{step.model.chapter.title}</Text>
      <Text>{index + 1} / {step.model.chapter.episodes.length} · {step.episode.title}</Text>
      <View style={styles.row}>
        <Pressable disabled={index === 0} style={styles.button} onPress={() => move(index - 1)}><Text>Previous</Text></Pressable>
        <Pressable disabled={index === step.model.chapter.episodes.length - 1} style={styles.button} onPress={() => move(index + 1)}><Text>Next episode</Text></Pressable>
        <Pressable style={styles.button} onPress={() => move(index)}><Text>Restart dialogue</Text></Pressable>
      </View>
      <View style={styles.card}>
        {!!reply && <Text>{reply}</Text>}
        <Text>{node && 'prompt' in node ? node.prompt : node && 'message' in node ? node.message : step.conversation ? nodeId ? 'This node uses a game interaction outside this walkthrough.' : 'Dialogue complete.' : 'This episode uses its existing game flow rather than a conversation.'}</Text>
        {node && 'options' in node && node.options.map((option) => <Pressable key={option.id} style={styles.button} onPress={() => {
          setReply('reply' in option && typeof option.reply === 'string' ? option.reply : '');
          setNodeId('nextNodeId' in option && typeof option.nextNodeId === 'string' ? option.nextNodeId : null);
        }}><Text>{option.label}</Text></Pressable>)}
      </View>
      <Text style={styles.title}>Objectives and progression</Text>
      <Text selectable>{JSON.stringify({ unlock: step.episode.unlock, consequence: step.episode.consequence, consequences: step.episode.consequences, reflectMs: step.episode.reflectMs }, null, 2)}</Text>
      <Text style={styles.title}>The Old Grove · q 0, r 3</Text>
      {preview.image && <Image source={{ uri: preview.image }} style={styles.image} resizeMode="contain"/>}
      <Text>{step.model.tiles[0].lines.reveal}</Text>
    </>}
  </ScrollView></>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 14, backgroundColor: '#f6f5ef' }, title: { fontSize: 20, fontWeight: '600' },
  input: { minHeight: 110, maxHeight: 180, borderWidth: 1, borderColor: '#849585', padding: 12, color: '#172e22' },
  button: { padding: 12, backgroundColor: '#dae6d8', borderRadius: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { padding: 16, gap: 14, backgroundColor: '#fff' }, image: { width: '100%', height: 280 }, error: { color: '#ae2733' },
});
