import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaUI } from '@/constants/katcha-ui';
import { useDiscoveries, type DiscoveryEntry } from '@/hooks/use-discoveries';
import type { DiscoveryCategory, DiscoveryRarity } from '@/types/discoveries';
import { artefactForReward } from '@/utils/discoveries-artefacts';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { Image } from 'expo-image';
import { discoveryIconSource } from '@/constants/achievement-icon-sources';

const CATEGORY_META: Record<DiscoveryCategory, { label: string; icon: IconSymbolName; copy: string }> = {
  exploration: { label: 'Exploration', icon: 'map.fill', copy: 'Places and paths that widened your world.' },
  memory: { label: 'Memories', icon: 'camera.fill', copy: 'Moments you chose to keep.' },
  life: { label: 'Life chapters', icon: 'heart.fill', copy: 'Milestones and turning points.' },
  journey: { label: 'Journey', icon: 'figure.walk', copy: 'Movement accumulated across real days.' },
  reflection: { label: 'Reflection', icon: 'leaf.fill', copy: 'Pauses, feelings and inner weather.' },
  world: { label: 'World', icon: 'globe.americas.fill', copy: 'The home your days have built.' },
};

const CATEGORY_ORDER: DiscoveryCategory[] = ['exploration', 'memory', 'life', 'journey', 'reflection', 'world'];
const RARITY_TINT: Record<DiscoveryRarity, string> = { common: '#71818A', rare: '#4386A8', epic: '#7356A5', legendary: '#A36B16' };
type Filter = 'all' | 'found' | 'locked';

export function GlobalDiscoveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { entries, unlockedCount, totalCount } = useDiscoveries();
  const [filter, setFilter] = useState<Filter>('all');
  const maxWidth = Math.min(720, width);
  const completion = totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const visible = useMemo(() => entries.filter((entry) => filter === 'all' || (filter === 'found' ? entry.record : !entry.record)), [entries, filter]);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glow} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36, paddingTop: insets.top + 12, width: maxWidth }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <KatchimeraBackButton accessibilityLabel="Back" onPress={() => router.back()} />
          <ThemedText selectable style={styles.topTitle} lightColor="#FFE5A6" darkColor="#FFE5A6">Discoveries</ThemedText>
          <View style={styles.balance} />
        </View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(300)} style={styles.hero}>
          <ThemedText selectable style={styles.eyebrow} lightColor="#9A6924" darkColor="#9A6924">Your life, noticed over time</ThemedText>
          <ThemedText selectable style={styles.heroTitle} lightColor="#322216" darkColor="#322216">The things your world remembers.</ThemedText>
          <ThemedText selectable style={styles.heroBody} lightColor="#60482F" darkColor="#60482F">App-wide discoveries remember milestones that span every companion: your archive, your world and the collection you built.</ThemedText>
          <View style={styles.heroProgressRow}>
            <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${completion}%` }]} /></View>
            <ThemedText selectable style={styles.heroProgress} lightColor="#5A4027" darkColor="#5A4027">{unlockedCount}/{totalCount} · {completion}%</ThemedText>
          </View>
        </Animated.View>

        <View accessibilityRole="tablist" style={styles.filters}>
          {(['all', 'found', 'locked'] as const).map((item) => {
            const selected = filter === item;
            return (
              <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item} onPress={() => setFilter(item)} style={[styles.filter, selected && styles.filterSelected]}>
                <ThemedText style={styles.filterText} lightColor={selected ? '#332315' : '#D6C5A7'} darkColor={selected ? '#332315' : '#D6C5A7'}>{item === 'all' ? 'All' : item === 'found' ? 'Found' : 'Still growing'}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {CATEGORY_ORDER.map((category, index) => {
          const categoryEntries = visible.filter((entry) => entry.def.category === category);
          if (!categoryEntries.length) return null;
          const all = entries.filter((entry) => entry.def.category === category);
          const found = all.filter((entry) => entry.record).length;
          const meta = CATEGORY_META[category];
          return (
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(70 + index * 45).duration(260)} key={category} style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><IconSymbol color="#705537" name={meta.icon} size={21} weight="semibold" /></View>
                <View style={styles.sectionCopy}>
                  <View style={styles.sectionTitleRow}>
                    <ThemedText selectable style={styles.sectionTitle} lightColor="#FFF4DC" darkColor="#FFF4DC">{meta.label}</ThemedText>
                    <ThemedText selectable style={styles.sectionCount} lightColor="#D5C1A0" darkColor="#D5C1A0">{found}/{all.length}</ThemedText>
                  </View>
                  <ThemedText selectable style={styles.sectionDescription} lightColor="#CDBB9E" darkColor="#CDBB9E">{meta.copy}</ThemedText>
                </View>
              </View>
              <View style={styles.list}>{categoryEntries.map((entry) => <DiscoveryCard entry={entry} key={entry.def.id} />)}</View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DiscoveryCard({ entry }: { entry: DiscoveryEntry }) {
  const unlocked = Boolean(entry.record);
  const hidden = !unlocked && entry.def.hidden;
  const tint = RARITY_TINT[entry.def.rarity];
  const reward = artefactForReward(entry.def.worldRewardId);
  return (
    <View style={[styles.card, !unlocked && styles.cardLocked, unlocked && { borderColor: `${tint}58` }]}>
      <View style={[styles.cardIcon, unlocked && { backgroundColor: `${tint}20` }]}>
        {hidden ? (
          <IconSymbol color="#81766A" name="lock.fill" size={24} weight="bold" />
        ) : (
          <Image contentFit="contain" source={discoveryIconSource(entry.def.category, entry.def.rarity)} style={[styles.discoveryArt, !unlocked && styles.discoveryArtLocked]} transition={0} />
        )}
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <ThemedText selectable style={styles.cardTitle} lightColor={unlocked ? '#352517' : '#62574B'} darkColor={unlocked ? '#352517' : '#62574B'}>{hidden ? 'A hidden discovery' : entry.def.name}</ThemedText>
          <ThemedText selectable style={[styles.rarity, { color: unlocked ? tint : '#81766A' }]}>{entry.def.rarity}</ThemedText>
        </View>
        <ThemedText selectable style={styles.cardDescription} lightColor="#614D39" darkColor="#614D39">{hidden ? 'Its shape will become clear when your life finds it.' : entry.def.description}</ThemedText>
        {unlocked ? (
          <View style={styles.cardMeta}>
            <ThemedText selectable style={styles.metaText} lightColor="#715E49" darkColor="#715E49">{new Date(entry.record!.unlockedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</ThemedText>
            {reward ? <ThemedText selectable style={styles.metaText} lightColor={tint} darkColor={tint}>{reward.name}</ThemedText> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#171711', flex: 1, overflow: 'hidden' },
  glow: { backgroundColor: 'rgba(181,126,42,0.20)', borderRadius: 999, height: 520, position: 'absolute', right: -250, top: -260, width: 520 },
  content: { alignSelf: 'center', flexGrow: 1, gap: 18, paddingHorizontal: 18 },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 48 },
  topTitle: { ...KatchaUI.type.title, flex: 1, textAlign: 'center' },
  balance: { height: 44, width: 44 },
  hero: { backgroundColor: '#E9D1A8', borderColor: 'rgba(255,248,224,0.78)', borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: '0 18px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.72)', gap: 9, padding: 22 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 9 },
  heroTitle: { ...KatchaUI.type.display, fontSize: 33, lineHeight: 37, maxWidth: 420 },
  heroBody: { ...KatchaUI.type.body, fontSize: 12.5, maxWidth: 520 },
  heroProgressRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingTop: 4 },
  heroTrack: { backgroundColor: 'rgba(78,57,36,0.16)', borderRadius: 999, flex: 1, height: 7, overflow: 'hidden' },
  heroFill: { backgroundColor: '#A97328', borderRadius: 999, height: '100%' },
  heroProgress: { ...KatchaUI.type.numeric, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  filters: { flexDirection: 'row', gap: 7 },
  filter: { alignItems: 'center', backgroundColor: 'rgba(255,248,226,0.07)', borderColor: 'rgba(255,232,180,0.13)', borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 8 },
  filterSelected: { backgroundColor: '#E7B951', borderColor: '#F6D987' },
  filterText: { ...KatchaUI.type.action, fontSize: 11.5 },
  section: { gap: 10 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingHorizontal: 3 },
  sectionIcon: { alignItems: 'center', backgroundColor: '#D8C095', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  sectionCopy: { flex: 1, gap: 1 },
  sectionTitleRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { ...KatchaUI.type.title, fontSize: 17 },
  sectionCount: { ...KatchaUI.type.numeric, fontSize: 11, fontVariant: ['tabular-nums'] },
  sectionDescription: { ...KatchaUI.type.meta, fontSize: 10.5 },
  list: { gap: 8 },
  card: { alignItems: 'flex-start', backgroundColor: '#E8D5B5', borderColor: 'rgba(116,79,39,0.20)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, boxShadow: '-2px 5px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,248,230,0.66)', flexDirection: 'row', gap: 11, padding: 13 },
  cardLocked: { backgroundColor: '#CEC0AA', opacity: 0.86 },
  cardIcon: { alignItems: 'center', backgroundColor: 'rgba(79,67,54,0.08)', borderRadius: 14, height: 45, justifyContent: 'center', width: 45 },
  discoveryArt: { height: 42, width: 42 },
  discoveryArtLocked: { opacity: 0.28 },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { ...KatchaUI.type.title, flex: 1, fontSize: 14.5 },
  rarity: { ...KatchaUI.type.label, fontSize: 8.5 },
  cardDescription: { ...KatchaUI.type.body, fontSize: 11.5, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 2 },
  metaText: { ...KatchaUI.type.meta, fontSize: 9.5, fontVariant: ['tabular-nums'] },
});
