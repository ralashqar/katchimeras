import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ARCHETYPE_THEME } from '@/constants/world';
import { Lantern } from '@/constants/theme';
import type { MemoryNode, WorldPatch } from '@/types/world';

type Props = {
  patch: WorldPatch;
  focusMemory: MemoryNode | null;
  onClose: () => void;
};

// The patch's "construction breakdown" — every object paired with the day-signal
// it grew from. This is the visual-journal payoff: a patch explains itself.
export function PatchInspector({ patch, focusMemory, onClose }: Props) {
  const theme = ARCHETYPE_THEME[patch.primaryArchetype];
  const anchor = patch.objects.find((o) => o.kind === 'anchor');
  const props = patch.objects.filter((o) => o.kind === 'prop');

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.backdropTap} onPress={onClose} />
      <View style={[styles.sheet, { borderColor: theme.accent }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{patch.name}</Text>
          <Text style={styles.subtitle}>
            {patch.isoDate}
            {'  ·  '}
            {theme.label}
            {patch.secondaryArchetype ? ` + ${ARCHETYPE_THEME[patch.secondaryArchetype].label}` : ''}
          </Text>
          {patch.creatureName ? (
            <Text style={[styles.creature, { color: theme.accent }]}>
              {patch.creatureName}
              {patch.rarity ? `  ·  ${patch.rarity}` : ''}
            </Text>
          ) : null}

          <Text style={styles.section}>Created from</Text>
          {anchor ? <BreakdownRow source={anchor.sourceLabel ?? '·'} label={anchor.label} /> : null}
          {props.map((prop) => (
            <BreakdownRow key={prop.id} source="•" label={prop.label} />
          ))}

          {patch.memoryNodes.length ? <Text style={styles.section}>Memories</Text> : null}
          {patch.memoryNodes.map((node) => (
            <MemoryCard key={node.id} node={node} highlight={focusMemory?.id === node.id} accent={theme.accent} />
          ))}
        </ScrollView>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BreakdownRow({ source, label }: { source: string; label: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowSource}>{source}</Text>
      <Text style={styles.rowArrow}>→</Text>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

function MemoryCard({ node, highlight, accent }: { node: MemoryNode; highlight: boolean; accent: string }) {
  return (
    <View style={[styles.memory, highlight && { borderColor: accent, borderWidth: 1 }]}>
      {node.photoThumbnailUri ? (
        <Image source={{ uri: node.photoThumbnailUri }} style={styles.memoryPhoto} contentFit="cover" />
      ) : (
        <View style={[styles.memoryPhoto, styles.memoryPhotoEmpty]}>
          <Text style={styles.memoryGlyph}>✦</Text>
        </View>
      )}
      <View style={styles.memoryBody}>
        <Text style={styles.memoryLabel}>{node.label}</Text>
        {node.meaningLabel ? <Text style={styles.memoryMeaning}>{node.meaningLabel}</Text> : null}
        <Text style={styles.memoryMeta}>
          {[node.locationLabel, node.timeLabel].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    maxHeight: '72%',
    backgroundColor: Lantern.ink900,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: Lantern.dusk700, marginBottom: 14 },
  title: { color: Lantern.moon50, fontSize: 24, fontWeight: '700' },
  subtitle: { color: Lantern.moon500, fontSize: 13, marginTop: 4 },
  creature: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  section: { color: Lantern.moon300, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowSource: { color: Lantern.moon300, fontSize: 14, width: 132 },
  rowArrow: { color: Lantern.moon500, fontSize: 13, marginHorizontal: 8 },
  rowLabel: { color: Lantern.moon50, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  memory: { flexDirection: 'row', backgroundColor: Lantern.ink800, borderRadius: 16, padding: 10, marginBottom: 10, borderWidth: 0, borderColor: 'transparent' },
  memoryPhoto: { width: 56, height: 56, borderRadius: 12, backgroundColor: Lantern.dusk700 },
  memoryPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  memoryGlyph: { color: Lantern.auroraViolet, fontSize: 22 },
  memoryBody: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  memoryLabel: { color: Lantern.moon50, fontSize: 14, fontWeight: '700' },
  memoryMeaning: { color: Lantern.moon300, fontSize: 13, marginTop: 2 },
  memoryMeta: { color: Lantern.moon500, fontSize: 11, marginTop: 3 },
  close: { marginTop: 14, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 999, backgroundColor: Lantern.dusk700 },
  closeText: { color: Lantern.moon50, fontSize: 13, fontWeight: '700' },
});
