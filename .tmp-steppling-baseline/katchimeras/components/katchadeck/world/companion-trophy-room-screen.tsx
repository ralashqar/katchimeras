import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { companionAchievementSections } from '@/constants/companion-achievements';
import {
  canonicalFamilyId,
  familyIdFromCompanionId,
  katchimeraFamilyById,
} from '@/constants/katchimera-skins';
import { KatchaUI } from '@/constants/katcha-ui';
import { useCompanionAchievements } from '@/hooks/use-companion-achievements';
import type { CompanionAchievementEntry, CompanionAchievementPillar } from '@/types/companion-achievements';
import { getCreatureVisual } from '@/game/days';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { companionAchievementIconSource } from '@/constants/achievement-icon-sources';
import { companionQuestListSpacer } from '@/utils/companion-home-layout';
import { todayKatchimeraExplorationBackgroundKeyForEnvironment } from '@/utils/today-exploration-backgrounds';
import { wispFamilySeries } from '@/constants/wisp-family-series';
import { wispDefinition } from '@/constants/wisps';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';

import { CompanionCinematicStage } from './companion-cinematic-stage';
import { KatchimeraPageHeader } from './katchimera-page-header';

const PILLAR_TINT: Record<CompanionAchievementPillar, string> = {
  domain: '#55795D',
  collection: '#5E6E99',
  goals: '#B96157',
  quests: '#A87726',
  journey: '#77649A',
};

const PILLAR_ICON: Record<CompanionAchievementPillar, IconSymbolName> = {
  domain: 'sparkles',
  collection: 'books.vertical.fill',
  goals: 'target',
  quests: 'list.clipboard.fill',
  journey: 'map.fill',
};

const TROPHY_WIDTH = 144;
const TROPHY_ART_SIZE = 120;
const TIER_PRESENTATION = [
  { label: 'Common', color: '#756B59' },
  { label: 'Uncommon', color: '#66834F' },
  { label: 'Rare', color: '#477E91' },
  { label: 'Epic', color: '#8C5798' },
  { label: 'Legendary', color: '#9A7421' },
] as const;

export function CompanionTrophyRoomScreen({ creatureId, embedded = false }: { creatureId: string; embedded?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const familyId = familyIdFromCompanionId(creatureId) ?? canonicalFamilyId(creatureId);
  const family = familyId ? katchimeraFamilyById.get(familyId) : null;
  const achievements = useCompanionAchievements();
  const entriesForFamily = achievements.entriesForFamily;
  const entries = useMemo(
    () => familyId ? entriesForFamily(familyId) : [],
    [entriesForFamily, familyId]
  );
  const unlocked = entries.filter((entry) => entry.record).length;
  const companionSource = family?.anchorVisualKey
    ? getCreatureVisual(family.anchorVisualKey, 'grown').source
    : null;
  const environmentKey = todayKatchimeraExplorationBackgroundKeyForEnvironment(family?.anchorVisualKey);
  const maxWidth = Math.min(720, width);
  if (!family) {
    return (
      <View style={styles.missing}>
        <ThemedText selectable style={styles.missingTitle} lightColor="#FFF7E5" darkColor="#FFF7E5">Trophy room unavailable</ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.missingButton}>
          <ThemedText style={styles.missingButtonLabel} lightColor="#352517" darkColor="#352517">Go back</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (embedded) {
    return (
      <TrophyArchive
        entries={entries}
        familyId={family.id}
        unlocked={unlocked}
      />
    );
  }

  return (
    <View style={styles.root}>
      {companionSource && family.anchorVisualKey ? (
        <CompanionCinematicStage
          creature={companionSource}
          environmentKey={environmentKey}
          lifted
          name={family.displayName}
          title="Look what we’ve achieved together!"
          visualKey={family.anchorVisualKey}
        />
      ) : null}
      <KatchimeraPageHeader
        creatureId={creatureId}
        onBack={() => router.back()}
      />
      <View style={[styles.topBar, { width: maxWidth }]}>
        <View style={styles.topTitleWrap}>
          <ThemedText
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            selectable
            style={styles.topTitle}
            lightColor="#FFD36E"
            darkColor="#FFD36E">
            Trophy room
          </ThemedText>
          <ThemedText selectable style={styles.topCount} lightColor="#F3DFC0" darkColor="#F3DFC0">
            {unlocked}/{entries.length} earned
          </ThemedText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 34, width: maxWidth },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View accessibilityElementsHidden pointerEvents="none" style={{ minHeight: companionQuestListSpacer(height) }} />
        <TrophyArchive
          entries={entries}
          familyId={family.id}
          unlocked={unlocked}
        />
      </ScrollView>
    </View>
  );
}

function TrophyArchive({
  entries,
  familyId,
  unlocked,
}: {
  entries: CompanionAchievementEntry[];
  familyId: string;
  unlocked: number;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const wisps = useWisps();
  const constellation = wispFamilySeries(familyId as KatchimeraFamilyId);
  const visibleConstellationWispIds = constellation?.featuredWispIds ?? [];
  const [openHelpSectionId, setOpenHelpSectionId] = useState<string | null>(null);
  const sections = useMemo(() => companionAchievementSections(familyId), [familyId]);
  const [visibleSectionCount, setVisibleSectionCount] = useState(1);
  const [cabinetFilter, setCabinetFilter] = useState('all');
  const [selectedTrophyId, setSelectedTrophyId] = useState<string | null>(null);
  const previousCabinetFilterRef = useRef<string | null>(null);
  const cabinetEntries = useMemo(() => {
    const filtered = cabinetFilter === 'all'
      ? entries
      : entries.filter((entry) => entry.def.sectionId === cabinetFilter);
    return [...filtered].sort((left, right) => Number(Boolean(right.record)) - Number(Boolean(left.record)));
  },
    [cabinetFilter, entries]
  );
  const cabinetEntryKey = cabinetEntries.map((entry) => entry.def.id).join('|');

  useEffect(() => setVisibleSectionCount(1), [familyId]);
  useEffect(() => {
    if (visibleSectionCount >= sections.length) return;
    const frame = requestAnimationFrame(() => {
      setVisibleSectionCount((count) => Math.min(sections.length, count + 1));
    });
    return () => cancelAnimationFrame(frame);
  }, [sections.length, visibleSectionCount]);

  useEffect(() => {
    const filterChanged = previousCabinetFilterRef.current !== cabinetFilter;
    previousCabinetFilterRef.current = cabinetFilter;
    const currentIndex = cabinetEntries.findIndex((entry) => entry.def.id === selectedTrophyId);
    if (!filterChanged && currentIndex >= 0) return;
    const next = cabinetEntries.find((entry) => entry.record)
      ?? [...cabinetEntries].sort((left, right) => right.ratio - left.ratio)[0]
      ?? null;
    setSelectedTrophyId(next?.def.id ?? null);
  }, [cabinetEntryKey, cabinetEntries, cabinetFilter, selectedTrophyId]);

  return (
    <Animated.View
      accessibilityLabel={`${unlocked} of ${entries.length} trophies earned`}
      entering={reduceMotion ? undefined : FadeInDown.duration(320)}
      style={styles.archive}>
      {constellation?.pilot ? (
        <View style={styles.constellation}>
          <View style={styles.constellationHeader}>
            <View style={styles.cabinetTitleRow}>
              <IconSymbol color="#6D5B9B" name="sparkles" size={17} weight="semibold" />
              <ThemedText selectable style={styles.cabinetTitle} lightColor="#3B2A1B" darkColor="#3B2A1B">Companion constellation</ThemedText>
            </View>
            <ThemedText selectable style={styles.cabinetMeta} lightColor="#725B44" darkColor="#725B44">
              {visibleConstellationWispIds.filter(wisps.isOwned).length}/{visibleConstellationWispIds.length}
            </ThemedText>
          </View>
          <ThemedText selectable style={styles.constellationCopy} lightColor="#78644E" darkColor="#78644E">
            Achievements, life Wisps and matching Egg pieces gathered around this Katchimera family.
          </ThemedText>
          <View style={styles.constellationWisps}>
            {visibleConstellationWispIds.map((id) => {
              const definition = wispDefinition(id);
              const owned = wisps.isOwned(id);
              return (
                <Pressable accessibilityLabel={`${definition.name}, ${owned ? 'owned' : 'locked'}`} accessibilityRole="button" key={id} onPress={() => definition.availability === 'ready' ? router.push({ pathname: '/wisp/[wispId]', params: { wispId: id } }) : Alert.alert(definition.name, `${definition.description}\n\nIts artwork is being prepared for a future catalog release.`)} style={({ pressed }) => [styles.constellationWisp, !owned && styles.constellationWispLocked, pressed && styles.helpButtonPressed]}>
                  <View style={styles.constellationArt}>
                    {definition.availability === 'ready'
                      ? <WispArtwork id={id} size={54} thumbnail silhouette={!owned} />
                      : <IconSymbol color={owned ? '#6D5B9B' : '#8D8378'} name="sparkles" size={24} />}
                  </View>
                  <ThemedText numberOfLines={1} style={styles.constellationName} lightColor="#3B2A1B" darkColor="#3B2A1B">
                    {owned || !definition.hidden ? definition.name : '???'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={styles.cabinet}>
        <View style={styles.cabinetHeader}>
          <View style={styles.cabinetTitleRow}>
            <IconSymbol color="#806126" name="sparkles" size={17} weight="semibold" />
            <ThemedText selectable style={styles.cabinetTitle} lightColor="#3B2A1B" darkColor="#3B2A1B">Our keepsakes</ThemedText>
          </View>
          <ThemedText selectable style={styles.cabinetMeta} lightColor="#725B44" darkColor="#725B44">{unlocked} of {entries.length}</ThemedText>
        </View>
        <FlatList
          contentContainerStyle={styles.trophyListContent}
          data={cabinetEntries}
          extraData={selectedTrophyId}
          horizontal
          initialNumToRender={8}
          keyExtractor={(entry) => entry.def.id}
          keyboardShouldPersistTaps="handled"
          maxToRenderPerBatch={4}
          removeClippedSubviews={process.env.EXPO_OS === 'android'}
          renderItem={({ item }) => (
            <CarouselTrophy
              entry={item}
              isSelected={item.def.id === selectedTrophyId}
              onPress={() => setSelectedTrophyId(item.def.id)}
            />
          )}
          showsHorizontalScrollIndicator={false}
          style={styles.cabinetViewport}
          windowSize={7}
        />
        <ScrollView contentContainerStyle={styles.cabinetFilters} horizontal showsHorizontalScrollIndicator={false}>
          {[{ id: 'all', label: 'All' }, ...sections].map((section) => {
            const selected = cabinetFilter === section.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={section.id}
                onPress={() => setCabinetFilter(section.id)}
                style={[styles.cabinetFilter, selected && styles.cabinetFilterSelected]}>
                <ThemedText style={styles.cabinetFilterLabel} lightColor={selected ? '#2E351C' : '#705B46'} darkColor={selected ? '#2E351C' : '#705B46'}>
                  {section.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {sections.slice(0, visibleSectionCount).map((section, sectionIndex) => {
        const sectionEntries = entries.filter((entry) => entry.def.sectionId === section.id);
        const found = sectionEntries.filter((entry) => entry.record).length;
        const pillar = sectionEntries[0]?.def.pillar ?? 'domain';
        return (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.delay(80 + sectionIndex * 45).duration(280)}
            key={section.id}
            style={[styles.trackSection, sectionIndex === 0 && styles.trackSectionFirst]}>
            <View style={styles.trackHeading}>
              <View style={styles.trackIcon}>
                <IconSymbol color={PILLAR_TINT[pillar]} name={PILLAR_ICON[pillar]} size={22} weight="semibold" />
              </View>
              <View style={styles.trackCopy}>
                <View style={styles.trackTitleRow}>
                  <View style={styles.trackTitleAndHelp}>
                    <ThemedText selectable style={styles.trackTitle} lightColor="#3B2A1B" darkColor="#3B2A1B">{section.label}</ThemedText>
                    <Pressable
                      accessibilityHint="Shows how this progress is recorded"
                      accessibilityLabel={`How to record ${section.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: openHelpSectionId === section.id }}
                      hitSlop={8}
                      onPress={() => setOpenHelpSectionId((current) => current === section.id ? null : section.id)}
                      style={({ pressed }) => [styles.helpButton, pressed && styles.helpButtonPressed]}>
                      <IconSymbol color="#7A624A" name="questionmark.circle.fill" size={17} weight="semibold" />
                    </Pressable>
                  </View>
                  <ThemedText selectable style={styles.trackCount} lightColor="#725B44" darkColor="#725B44">{found}/{sectionEntries.length}</ThemedText>
                </View>
                <ThemedText selectable style={styles.trackDescription} lightColor="#78644E" darkColor="#78644E">{section.description}</ThemedText>
                {openHelpSectionId === section.id ? (
                  <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(180)} style={styles.helpCallout}>
                    <IconSymbol color="#8A6729" name="sparkles" size={14} />
                    <View style={styles.helpCalloutCopy}>
                      <ThemedText selectable style={styles.helpCalloutTitle} lightColor="#604623" darkColor="#604623">How to record it</ThemedText>
                      <ThemedText selectable style={styles.helpCalloutBody} lightColor="#6E5942" darkColor="#6E5942">{section.recordingHelp}</ThemedText>
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            </View>
            <View style={styles.achievementList}>
              {sectionEntries.map((entry) => <AchievementCard entry={entry} key={entry.def.id} />)}
            </View>
          </Animated.View>
        );
      })}
      {visibleSectionCount < sections.length ? (
        <View accessibilityLabel="Loading more achievements" accessibilityLiveRegion="polite" style={styles.sectionLoading}>
          <ActivityIndicator color="#806126" size="small" />
        </View>
      ) : null}
    </Animated.View>
  );
}

function CarouselTrophy({
  entry,
  isSelected,
  onPress,
}: {
  entry: CompanionAchievementEntry;
  isSelected: boolean;
  onPress: () => void;
}) {
  const earned = Boolean(entry.record);
  const rarity = tierPresentation(entry);
  return (
    <Pressable
      accessibilityLabel={`${entry.def.name}, tier ${entry.def.tier}, ${earned ? 'earned' : 'locked'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.carouselTrophy,
        !earned && styles.carouselTrophyLocked,
        pressed && styles.carouselTrophyPressed,
      ]}>
      <View style={styles.carouselArtFrame}>
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={isSelected ? 'high' : 'normal'}
          source={companionAchievementIconSource(entry.def)}
          style={styles.carouselArt}
          transition={0}
        />
        {earned ? (
          <View style={styles.earnedCheck}>
            <IconSymbol color="#F4FFE9" name="checkmark" size={11} weight="bold" />
          </View>
        ) : null}
      </View>
      <ThemedText numberOfLines={1} style={styles.trophyName} lightColor="#3B2A1B" darkColor="#3B2A1B">
        {entry.def.name}
      </ThemedText>
      <ThemedText numberOfLines={1} style={styles.trophyRarity} lightColor={rarity.color} darkColor={rarity.color}>
        {rarity.label}
      </ThemedText>
      <View style={[styles.trophySelection, isSelected && styles.trophySelectionActive]} />
    </Pressable>
  );
}

function tierPresentation(entry: CompanionAchievementEntry) {
  return TIER_PRESENTATION[Math.max(0, Math.min(TIER_PRESENTATION.length - 1, entry.def.tier - 1))];
}

function AchievementCard({ entry }: { entry: CompanionAchievementEntry }) {
  const earned = Boolean(entry.record);
  const tint = PILLAR_TINT[entry.def.pillar];
  const date = entry.record
    ? new Date(entry.record.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <View
      accessibilityLabel={`${entry.def.name}. ${entry.def.criterion}. ${formatProgress(Math.min(entry.current, entry.target))} of ${formatProgress(entry.target)}. ${earned ? `Earned ${date}` : 'Locked'}.`}
      accessible
      style={[styles.card, earned ? { borderColor: `${tint}72` } : styles.cardLocked]}>
      <View style={[styles.cardIcon, earned && { backgroundColor: `${tint}25`, borderColor: `${tint}55` }]}>
        <Image
          contentFit="contain"
          source={companionAchievementIconSource(entry.def)}
          style={[
            styles.cardArt,
            !earned && styles.artLocked,
          ]}
          transition={0}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <ThemedText selectable style={styles.cardTitle} lightColor={earned ? '#352517' : '#65594D'} darkColor={earned ? '#352517' : '#65594D'}>{entry.def.name}</ThemedText>
          <View style={[styles.tierBadge, earned && { backgroundColor: `${tint}18`, borderColor: `${tint}55` }]}>
            <ThemedText style={styles.tierText} lightColor={earned ? tint : '#7E746A'} darkColor={earned ? tint : '#7E746A'}>{roman(entry.def.tier)}</ThemedText>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: tint, width: `${Math.max(earned ? 100 : 3, entry.ratio * 100)}%` }]} />
          </View>
          <ThemedText selectable style={styles.progressValue} lightColor="#5A4630" darkColor="#5A4630">{formatProgress(Math.min(entry.current, entry.target))}/{formatProgress(entry.target)}</ThemedText>
        </View>
        {date ? (
          <View style={styles.earnedRow}>
            <IconSymbol color={tint} name="checkmark" size={12} />
            <ThemedText selectable style={styles.earnedDate} lightColor="#75634E" darkColor="#75634E">Earned {date}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function roman(tier: number): string {
  return ['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? String(tier);
}

function formatProgress(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#E6CDA7', flex: 1, overflow: 'hidden' },
  content: { alignSelf: 'center', flexGrow: 1, paddingHorizontal: 14, zIndex: 3 },
  topBar: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', minHeight: 58, paddingBottom: 8, paddingHorizontal: 18, position: 'relative', zIndex: 4 },
  topTitleWrap: { alignItems: 'center', flex: 1 },
  topTitle: { ...KatchaUI.type.companionName, fontSize: 29, letterSpacing: -0.2, lineHeight: 33, textShadowColor: 'rgba(30,48,53,0.88)', textShadowOffset: { height: 3, width: 0 }, textShadowRadius: 4 },
  topCount: { ...KatchaUI.type.meta, fontSize: 10, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(23,40,49,0.58)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  topBalance: { height: 44, width: 44 },
  archive: { backgroundColor: KatchaUI.companionPanel.background, borderColor: KatchaUI.companionPanel.border, borderCurve: 'continuous', borderRadius: 29, borderWidth: 1, boxShadow: KatchaUI.companionPanel.shadow, gap: 12, overflow: 'hidden', paddingBottom: 18, paddingHorizontal: 13, paddingTop: 15, position: 'relative', zIndex: 4 },
  sectionLoading: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  cabinet: { gap: 9 },
  constellation: { backgroundColor: 'rgba(116,95,151,0.08)', borderColor: 'rgba(98,77,137,0.18)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, gap: 8, padding: 11 },
  constellationHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  constellationCopy: { ...KatchaUI.type.meta, fontSize: 10.5, lineHeight: 14 },
  constellationWisps: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  constellationWisp: { alignItems: 'center', flex: 1, gap: 3, minWidth: 0 },
  constellationWispLocked: { opacity: 0.45 },
  constellationArt: { alignItems: 'center', backgroundColor: 'rgba(255,249,234,0.68)', borderRadius: 14, height: 58, justifyContent: 'center', width: '100%' },
  constellationName: { ...KatchaUI.type.meta, fontSize: 8.5, fontWeight: '800', maxWidth: '100%' },
  cabinetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  cabinetTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  cabinetTitle: { ...KatchaUI.type.title, fontSize: 18, lineHeight: 22 },
  cabinetMeta: { ...KatchaUI.type.meta, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  cabinetFilters: { gap: 8, paddingHorizontal: 2 },
  cabinetFilter: { backgroundColor: 'rgba(91,65,38,0.04)', borderColor: 'rgba(91,65,38,0.16)', borderRadius: 999, borderWidth: 1, minHeight: 37, paddingHorizontal: 16, paddingVertical: 9 },
  cabinetFilterSelected: { backgroundColor: '#B9C66B', borderColor: '#C9D57C' },
  cabinetFilterLabel: { ...KatchaUI.type.meta, fontSize: 10.5, fontWeight: '900' },
  cabinetViewport: { marginHorizontal: -13 },
  trophyListContent: { gap: 5, paddingHorizontal: 13 },
  carouselTrophy: { alignItems: 'center', minHeight: 162, opacity: 1, paddingHorizontal: 4, paddingTop: 0, position: 'relative', width: TROPHY_WIDTH },
  carouselTrophyLocked: { opacity: 0.42 },
  carouselTrophyPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  carouselArtFrame: { alignItems: 'center', height: 120, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: TROPHY_WIDTH - 4 },
  carouselArt: { height: TROPHY_ART_SIZE, width: TROPHY_ART_SIZE },
  earnedCheck: { alignItems: 'center', backgroundColor: '#4F8458', borderColor: '#D8F1C7', borderRadius: 999, borderWidth: 1.5, bottom: 2, boxShadow: '0 3px 8px rgba(22,55,27,0.28)', height: 24, justifyContent: 'center', position: 'absolute', right: 8, width: 24, zIndex: 4 },
  trophyName: { ...KatchaUI.type.title, fontSize: 12.5, lineHeight: 16, paddingHorizontal: 2, textAlign: 'center' },
  trophyRarity: { ...KatchaUI.type.meta, fontSize: 9.5, fontWeight: '800', lineHeight: 12, marginTop: 1, textAlign: 'center' },
  trophySelection: { backgroundColor: 'transparent', borderRadius: 999, height: 4, marginTop: 4, width: 48 },
  trophySelectionActive: { backgroundColor: '#B08B31' },
  cardArt: { height: 78, width: 78 },
  artLocked: { opacity: 0.24 },
  trackSection: { borderColor: 'rgba(91,65,38,0.13)', borderTopWidth: 1, gap: 10, paddingHorizontal: 4, paddingTop: 18 },
  trackSectionFirst: { borderTopWidth: 0, paddingTop: 4 },
  trackHeading: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingHorizontal: 3 },
  trackIcon: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  trackCopy: { flex: 1, gap: 1 },
  trackTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  trackTitleAndHelp: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7 },
  trackTitle: { ...KatchaUI.type.title, flexShrink: 1, fontSize: 17 },
  helpButton: { alignItems: 'center', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  helpButtonPressed: { backgroundColor: 'rgba(91,65,38,0.08)' },
  trackCount: { ...KatchaUI.type.numeric, fontSize: 11, fontVariant: ['tabular-nums'] },
  trackDescription: { ...KatchaUI.type.meta, fontSize: 10.5, lineHeight: 14 },
  helpCallout: { alignItems: 'flex-start', backgroundColor: KatchaUI.companionPanel.softBackground, borderColor: KatchaUI.companionPanel.softBorder, borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 7, paddingHorizontal: 10, paddingVertical: 9 },
  helpCalloutCopy: { flex: 1, gap: 2 },
  helpCalloutTitle: { ...KatchaUI.type.label, fontSize: 9 },
  helpCalloutBody: { ...KatchaUI.type.body, fontSize: 10.5, lineHeight: 15 },
  achievementList: { gap: 7 },
  card: { alignItems: 'center', backgroundColor: KatchaUI.companionPanel.cardBackground, borderColor: KatchaUI.companionPanel.cardBorder, borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: KatchaUI.companionPanel.cardShadow, flexDirection: 'row', gap: 9, minHeight: 96, paddingHorizontal: 7, paddingVertical: 6 },
  cardLocked: { backgroundColor: '#CFC1AA', borderColor: 'rgba(83,72,57,0.16)', opacity: 0.88 },
  cardIcon: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: 'rgba(82,72,60,0.06)', borderColor: 'rgba(82,72,60,0.10)', borderRadius: 13, borderWidth: 1, justifyContent: 'center', minHeight: 82, overflow: 'hidden', width: 84 },
  cardBody: { flex: 1, gap: 5, paddingRight: 3 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { ...KatchaUI.type.title, flex: 1, fontSize: 14, lineHeight: 17 },
  tierBadge: { alignItems: 'center', borderColor: 'rgba(70,59,48,0.20)', borderRadius: 8, borderWidth: 1, minWidth: 29, paddingHorizontal: 6, paddingVertical: 2 },
  tierText: { ...KatchaUI.type.numeric, fontSize: 9, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  progressTrack: { backgroundColor: 'rgba(69,51,34,0.14)', borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: '100%' },
  progressValue: { ...KatchaUI.type.numeric, fontSize: 9.5, fontVariant: ['tabular-nums'] },
  earnedRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  earnedDate: { ...KatchaUI.type.meta, fontSize: 9, fontVariant: ['tabular-nums'] },
  missing: { alignItems: 'center', backgroundColor: '#171711', flex: 1, gap: 18, justifyContent: 'center', padding: 28 },
  missingTitle: { ...KatchaUI.type.display, textAlign: 'center' },
  missingButton: { backgroundColor: '#E7B951', borderRadius: 15, minHeight: 44, paddingHorizontal: 20, paddingVertical: 12 },
  missingButtonLabel: { ...KatchaUI.type.action },
});
