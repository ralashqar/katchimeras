import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { companionAchievementIconSource } from '@/constants/achievement-icon-sources';

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

export function CompanionTrophyRoomScreen({ creatureId }: { creatureId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
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
    ? getCreatureVisual(family.anchorVisualKey).source
    : null;
  const maxWidth = Math.min(720, width);
  const [openHelpSectionId, setOpenHelpSectionId] = useState<string | null>(null);

  const sections = useMemo(() => familyId ? companionAchievementSections(familyId) : [], [familyId]);

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

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.ambientOne} />
      <View pointerEvents="none" style={styles.ambientTwo} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 34, paddingTop: insets.top + 12, width: maxWidth },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <KatchimeraBackButton accessibilityLabel={`Back to ${family.displayName}`} onPress={() => router.back()} />
          <View style={styles.topTitleWrap}>
            <ThemedText selectable style={styles.topTitle} lightColor="#FFE7A8" darkColor="#FFE7A8">
              Trophy room
            </ThemedText>
            <ThemedText selectable style={styles.topCount} lightColor="#E9D5B2" darkColor="#E9D5B2">
              {unlocked}/{entries.length} earned
            </ThemedText>
          </View>
          <View style={styles.topBalance} />
        </View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(320)} style={styles.hero}>
          <View style={styles.heroCopy}>
            <ThemedText selectable style={styles.eyebrow} lightColor="#8B5C17" darkColor="#8B5C17">
              {family.lifeAreaLabel}
            </ThemedText>
            <ThemedText selectable style={styles.heroTitle} lightColor="#352517" darkColor="#352517">
              {family.displayName}’s keepsakes
            </ThemedText>
            <ThemedText selectable style={styles.heroBody} lightColor="#62452B" darkColor="#62452B">
              Every shelf remembers something you practised, noticed or completed together.
            </ThemedText>
          </View>
          {companionSource ? (
            <Image accessibilityLabel={family.displayName} contentFit="contain" source={companionSource} style={styles.creature} transition={0} />
          ) : null}
        </Animated.View>

        <View accessibilityLabel={`${unlocked} of ${entries.length} trophies earned`} style={styles.cabinet}>
          <View style={styles.cabinetHeader}>
            <ThemedText selectable style={styles.cabinetTitle} lightColor="#FFEBC0" darkColor="#FFEBC0">The cabinet</ThemedText>
            <ThemedText selectable style={styles.cabinetMeta} lightColor="#D8C09A" darkColor="#D8C09A">your life, kept by theme</ThemedText>
          </View>
          <View style={styles.cabinetGrid}>
            {entries.map((entry) => <CabinetSlot entry={entry} key={entry.def.id} />)}
          </View>
        </View>

        {sections.map((section, sectionIndex) => {
          const sectionEntries = entries.filter((entry) => entry.def.sectionId === section.id);
          const found = sectionEntries.filter((entry) => entry.record).length;
          const pillar = sectionEntries[0]?.def.pillar ?? 'domain';
          return (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(80 + sectionIndex * 45).duration(280)}
              key={section.id}
              style={styles.trackSection}>
              <View style={styles.trackHeading}>
                <View style={[styles.trackIcon, { backgroundColor: `${PILLAR_TINT[pillar]}22` }]}>
                  <IconSymbol color={PILLAR_TINT[pillar]} name={PILLAR_ICON[pillar]} size={22} weight="semibold" />
                </View>
                <View style={styles.trackCopy}>
                  <View style={styles.trackTitleRow}>
                    <View style={styles.trackTitleAndHelp}>
                      <ThemedText selectable style={styles.trackTitle} lightColor="#FFF6E4" darkColor="#FFF6E4">{section.label}</ThemedText>
                      <Pressable
                        accessibilityHint="Shows how this progress is recorded"
                        accessibilityLabel={`How to record ${section.label}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: openHelpSectionId === section.id }}
                        hitSlop={8}
                        onPress={() => setOpenHelpSectionId((current) => current === section.id ? null : section.id)}
                        style={({ pressed }) => [styles.helpButton, pressed && styles.helpButtonPressed]}>
                        <IconSymbol color="#E2CFAF" name="questionmark.circle.fill" size={17} weight="semibold" />
                      </Pressable>
                    </View>
                    <ThemedText selectable style={styles.trackCount} lightColor="#E2CFAF" darkColor="#E2CFAF">{found}/{sectionEntries.length}</ThemedText>
                  </View>
                  <ThemedText selectable style={styles.trackDescription} lightColor="#D6C7B1" darkColor="#D6C7B1">{section.description}</ThemedText>
                  {openHelpSectionId === section.id ? (
                    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(180)} style={styles.helpCallout}>
                      <IconSymbol color="#E7BE68" name="sparkles" size={14} />
                      <View style={styles.helpCalloutCopy}>
                        <ThemedText selectable style={styles.helpCalloutTitle} lightColor="#FFE9BA" darkColor="#FFE9BA">How to record it</ThemedText>
                        <ThemedText selectable style={styles.helpCalloutBody} lightColor="#E7DAC4" darkColor="#E7DAC4">{section.recordingHelp}</ThemedText>
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
      </ScrollView>
    </View>
  );
}

function CabinetSlot({ entry }: { entry: CompanionAchievementEntry }) {
  const earned = Boolean(entry.record);
  const tint = PILLAR_TINT[entry.def.pillar];
  return (
    <View accessibilityLabel={`${entry.def.name}, tier ${entry.def.tier}, ${earned ? 'earned' : 'locked'}`} style={[styles.slot, earned && { borderColor: `${tint}A8` }]}>
      <View style={[styles.slotMedallion, earned && { backgroundColor: `${tint}38` }]}>
        <Image contentFit="contain" source={companionAchievementIconSource(entry.def)} style={[styles.slotArt, !earned && styles.artLocked]} transition={0} />
      </View>
      <ThemedText style={styles.slotTier} lightColor={earned ? '#FFE8AF' : '#8E8274'} darkColor={earned ? '#FFE8AF' : '#8E8274'}>
        {roman(entry.def.tier)}
      </ThemedText>
    </View>
  );
}

function AchievementCard({ entry }: { entry: CompanionAchievementEntry }) {
  const earned = Boolean(entry.record);
  const tint = PILLAR_TINT[entry.def.pillar];
  const date = entry.record
    ? new Date(entry.record.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <View style={[styles.card, earned ? { borderColor: `${tint}72` } : styles.cardLocked]}>
      <View style={[styles.cardIcon, earned && { backgroundColor: `${tint}25`, borderColor: `${tint}55` }]}>
        <Image contentFit="contain" source={companionAchievementIconSource(entry.def)} style={[styles.cardArt, !earned && styles.artLocked]} transition={0} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <ThemedText selectable style={styles.cardTitle} lightColor={earned ? '#352517' : '#65594D'} darkColor={earned ? '#352517' : '#65594D'}>{entry.def.name}</ThemedText>
          <View style={[styles.tierBadge, earned && { backgroundColor: `${tint}18`, borderColor: `${tint}55` }]}>
            <ThemedText style={styles.tierText} lightColor={earned ? tint : '#7E746A'} darkColor={earned ? tint : '#7E746A'}>{roman(entry.def.tier)}</ThemedText>
          </View>
        </View>
        <ThemedText selectable style={styles.cardDescription} lightColor="#624F3A" darkColor="#624F3A">{entry.def.description}</ThemedText>
        <ThemedText selectable style={styles.criterion} lightColor="#473522" darkColor="#473522">{entry.def.criterion}</ThemedText>
        <ThemedText selectable style={styles.countingNote} lightColor="#75634E" darkColor="#75634E">{countingLabel(entry)}</ThemedText>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: tint, width: `${Math.max(earned ? 100 : 3, entry.ratio * 100)}%` }]} />
          </View>
          <ThemedText selectable style={styles.progressValue} lightColor="#5A4630" darkColor="#5A4630">{formatProgress(Math.min(entry.current, entry.target))}/{formatProgress(entry.target)}</ThemedText>
        </View>
        <View style={styles.rewardRow}>
          <IconSymbol color={earned ? tint : '#887C6E'} name={earned ? 'sparkles' : 'lock.fill'} size={14} />
          <ThemedText selectable style={styles.rewardText} lightColor={earned ? '#493621' : '#75695C'} darkColor={earned ? '#493621' : '#75695C'}>{earned ? entry.def.reward.label : `Reward: ${entry.def.reward.label}`}</ThemedText>
          {date ? <ThemedText selectable style={styles.earnedDate} lightColor="#75634E" darkColor="#75634E">{date}</ThemedText> : null}
        </View>
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

function countingLabel(entry: CompanionAchievementEntry): string {
  if (entry.def.metric.counting === 'distinct') return 'Counts different confirmed items, not repeats';
  if (entry.def.metric.counting === 'peak') return 'Uses your highest single-day value';
  if (entry.def.metric.counting === 'streak') return 'Uses consecutive calendar days';
  return 'Counts every confirmed completion or journal entry';
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#171711', flex: 1, overflow: 'hidden' },
  ambientOne: { backgroundColor: 'rgba(186,126,42,0.22)', borderRadius: 999, height: 440, position: 'absolute', right: -210, top: -180, width: 440 },
  ambientTwo: { backgroundColor: 'rgba(75,98,74,0.18)', borderRadius: 999, bottom: 120, height: 360, left: -230, position: 'absolute', width: 360 },
  content: { alignSelf: 'center', flexGrow: 1, gap: 18, paddingHorizontal: 18 },
  topBar: { alignItems: 'center', flexDirection: 'row', minHeight: 48 },
  topTitleWrap: { alignItems: 'center', flex: 1 },
  topTitle: { ...KatchaUI.type.title, fontSize: 15 },
  topCount: { ...KatchaUI.type.meta, fontSize: 10, fontVariant: ['tabular-nums'] },
  topBalance: { height: 44, width: 44 },
  hero: { backgroundColor: '#EAD2A8', borderColor: 'rgba(255,245,215,0.72)', borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: '0 18px 38px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.72)', flexDirection: 'row', minHeight: 190, overflow: 'hidden', padding: 20 },
  heroCopy: { flex: 1, gap: 7, justifyContent: 'center', zIndex: 2 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 9 },
  heroTitle: { ...KatchaUI.type.display, fontSize: 31, lineHeight: 34 },
  heroBody: { ...KatchaUI.type.body, fontSize: 12.5, lineHeight: 18, maxWidth: 330 },
  creature: { alignSelf: 'flex-end', height: 176, marginBottom: -26, marginRight: -30, width: 154 },
  cabinet: { backgroundColor: '#28251E', borderColor: 'rgba(255,227,159,0.24)', borderCurve: 'continuous', borderRadius: 25, borderWidth: 1, boxShadow: '0 13px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.09)', gap: 13, padding: 14 },
  cabinetHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  cabinetTitle: { ...KatchaUI.type.title, fontSize: 15 },
  cabinetMeta: { ...KatchaUI.type.meta, fontSize: 9.5 },
  cabinetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slot: { alignItems: 'center', backgroundColor: 'rgba(12,12,10,0.42)', borderColor: 'rgba(255,255,255,0.07)', borderRadius: 13, borderWidth: 1, flexBasis: '22%', flexGrow: 1, gap: 3, justifyContent: 'center', minHeight: 59, paddingVertical: 7 },
  slotMedallion: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  slotArt: { height: 31, width: 31 },
  cardArt: { height: 42, width: 42 },
  artLocked: { opacity: 0.24 },
  slotTier: { ...KatchaUI.type.numeric, fontSize: 8.5, fontVariant: ['tabular-nums'] },
  trackSection: { gap: 10 },
  trackHeading: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingHorizontal: 3 },
  trackIcon: { alignItems: 'center', borderRadius: 15, height: 44, justifyContent: 'center', width: 44 },
  trackCopy: { flex: 1, gap: 1 },
  trackTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  trackTitleAndHelp: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 7 },
  trackTitle: { ...KatchaUI.type.title, flexShrink: 1, fontSize: 17 },
  helpButton: { alignItems: 'center', borderRadius: 999, height: 30, justifyContent: 'center', width: 30 },
  helpButtonPressed: { backgroundColor: 'rgba(255,233,186,0.10)' },
  trackCount: { ...KatchaUI.type.numeric, fontSize: 11, fontVariant: ['tabular-nums'] },
  trackDescription: { ...KatchaUI.type.meta, fontSize: 10.5, lineHeight: 14 },
  helpCallout: { alignItems: 'flex-start', backgroundColor: 'rgba(255,237,197,0.08)', borderColor: 'rgba(255,226,164,0.16)', borderCurve: 'continuous', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 7, paddingHorizontal: 10, paddingVertical: 9 },
  helpCalloutCopy: { flex: 1, gap: 2 },
  helpCalloutTitle: { ...KatchaUI.type.label, fontSize: 9 },
  helpCalloutBody: { ...KatchaUI.type.body, fontSize: 10.5, lineHeight: 15 },
  achievementList: { gap: 8 },
  card: { alignItems: 'flex-start', backgroundColor: '#E9D6B5', borderColor: 'rgba(116,79,39,0.22)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, boxShadow: '-2px 5px 14px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,248,230,0.72)', flexDirection: 'row', gap: 12, padding: 13 },
  cardLocked: { backgroundColor: '#CFC1AA', borderColor: 'rgba(83,72,57,0.16)', opacity: 0.88 },
  cardIcon: { alignItems: 'center', backgroundColor: 'rgba(82,72,60,0.08)', borderColor: 'rgba(82,72,60,0.12)', borderRadius: 15, borderWidth: 1, height: 47, justifyContent: 'center', width: 47 },
  cardBody: { flex: 1, gap: 5 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { ...KatchaUI.type.title, flex: 1, fontSize: 14.5, lineHeight: 19 },
  tierBadge: { alignItems: 'center', borderColor: 'rgba(70,59,48,0.20)', borderRadius: 9, borderWidth: 1, minWidth: 31, paddingHorizontal: 7, paddingVertical: 3 },
  tierText: { ...KatchaUI.type.numeric, fontSize: 9, fontWeight: '900', fontVariant: ['tabular-nums'] },
  cardDescription: { ...KatchaUI.type.body, fontSize: 11.5, lineHeight: 16 },
  criterion: { ...KatchaUI.type.action, fontSize: 10.5, lineHeight: 14 },
  countingNote: { ...KatchaUI.type.meta, fontSize: 9.5, lineHeight: 13 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  progressTrack: { backgroundColor: 'rgba(69,51,34,0.14)', borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: '100%' },
  progressValue: { ...KatchaUI.type.numeric, fontSize: 9.5, fontVariant: ['tabular-nums'] },
  rewardRow: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 18 },
  rewardText: { ...KatchaUI.type.meta, flex: 1, fontSize: 9.5 },
  earnedDate: { ...KatchaUI.type.meta, fontSize: 9, fontVariant: ['tabular-nums'] },
  missing: { alignItems: 'center', backgroundColor: '#171711', flex: 1, gap: 18, justifyContent: 'center', padding: 28 },
  missingTitle: { ...KatchaUI.type.display, textAlign: 'center' },
  missingButton: { backgroundColor: '#E7B951', borderRadius: 15, minHeight: 44, paddingHorizontal: 20, paddingVertical: 12 },
  missingButtonLabel: { ...KatchaUI.type.action },
});
