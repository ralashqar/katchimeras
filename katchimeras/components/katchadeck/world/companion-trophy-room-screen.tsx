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
import { companionQuestListSpacer } from '@/utils/companion-home-layout';
import { todayKatchimeraExplorationBackgroundKeyForEnvironment } from '@/utils/today-exploration-backgrounds';

import { CompanionCinematicStage } from './companion-cinematic-stage';

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
    ? getCreatureVisual(family.anchorVisualKey).source
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
        lifeAreaLabel={family.lifeAreaLabel}
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
          title="These are our keepsakes"
          visualKey={family.anchorVisualKey}
        />
      ) : null}
      <View style={[styles.topBar, { paddingTop: insets.top + 10, width: maxWidth }]}>
        <KatchimeraBackButton accessibilityLabel={`Back to ${family.displayName}`} onPress={() => router.back()} />
        <View style={styles.topTitleWrap}>
          <ThemedText selectable style={styles.topTitle} lightColor="#FFF9EA" darkColor="#FFF9EA">
            Trophy room
          </ThemedText>
          <ThemedText selectable style={styles.topCount} lightColor="#F3DFC0" darkColor="#F3DFC0">
            {unlocked}/{entries.length} earned
          </ThemedText>
        </View>
        <View style={styles.topBalance} />
      </View>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 34, width: maxWidth },
        ]}
        showsVerticalScrollIndicator={false}>
        <View accessibilityElementsHidden pointerEvents="none" style={{ minHeight: companionQuestListSpacer(height) }} />

        <TrophyArchive
          entries={entries}
          familyId={family.id}
          lifeAreaLabel={family.lifeAreaLabel}
          unlocked={unlocked}
        />
      </ScrollView>
    </View>
  );
}

function TrophyArchive({
  entries,
  familyId,
  lifeAreaLabel,
  unlocked,
}: {
  entries: CompanionAchievementEntry[];
  familyId: string;
  lifeAreaLabel: string;
  unlocked: number;
}) {
  const reduceMotion = useReducedMotion();
  const [openHelpSectionId, setOpenHelpSectionId] = useState<string | null>(null);
  const sections = useMemo(() => companionAchievementSections(familyId), [familyId]);

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(320)} style={styles.archive}>
      <View style={styles.archiveHeading}>
        <View style={styles.archiveHeadingCopy}>
          <ThemedText selectable style={styles.archiveEyebrow} lightColor="#DDBB75" darkColor="#DDBB75">
            {lifeAreaLabel}
          </ThemedText>
          <ThemedText selectable style={styles.archiveBody} lightColor="#E7D9C3" darkColor="#E7D9C3">
            Every shelf remembers something you practised, noticed or completed together.
          </ThemedText>
        </View>
        <View style={styles.archiveCountBadge}>
          <ThemedText selectable style={styles.archiveCountValue} lightColor="#FFE7A8" darkColor="#FFE7A8">{unlocked}</ThemedText>
          <ThemedText selectable style={styles.archiveCountLabel} lightColor="#CDBB9F" darkColor="#CDBB9F">earned</ThemedText>
        </View>
      </View>

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
    </Animated.View>
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
    <View
      accessibilityLabel={`${entry.def.name}. ${entry.def.criterion}. ${formatProgress(Math.min(entry.current, entry.target))} of ${formatProgress(entry.target)}. ${earned ? `Earned ${date}` : 'Locked'}.`}
      accessible
      style={[styles.card, earned ? { borderColor: `${tint}72` } : styles.cardLocked]}>
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
  topTitle: { ...KatchaUI.type.companionPageTitle, fontSize: 22, lineHeight: 27, textShadowColor: 'rgba(23,40,49,0.58)', textShadowOffset: { height: 2, width: 0 }, textShadowRadius: 3 },
  topCount: { ...KatchaUI.type.meta, fontSize: 10, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(23,40,49,0.58)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 2 },
  topBalance: { height: 44, width: 44 },
  archive: { backgroundColor: '#211F19', borderColor: 'rgba(255,232,180,0.22)', borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: '0 18px 42px rgba(40,25,11,0.34), inset 0 1px 0 rgba(255,255,255,0.07)', gap: 18, padding: 14, paddingBottom: 20 },
  archiveHeading: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingHorizontal: 4, paddingTop: 3 },
  archiveHeadingCopy: { flex: 1, gap: 4 },
  archiveEyebrow: { ...KatchaUI.type.label, fontSize: 9.5 },
  archiveBody: { ...KatchaUI.type.companionBody, fontSize: 11.5, lineHeight: 17 },
  archiveCountBadge: { alignItems: 'center', backgroundColor: 'rgba(255,232,180,0.08)', borderColor: 'rgba(255,232,180,0.14)', borderRadius: 14, borderWidth: 1, minWidth: 54, paddingHorizontal: 9, paddingVertical: 7 },
  archiveCountValue: { ...KatchaUI.type.numeric, fontSize: 17, fontVariant: ['tabular-nums'] },
  archiveCountLabel: { ...KatchaUI.type.meta, fontSize: 8.5 },
  cabinet: { backgroundColor: '#28251E', borderColor: 'rgba(255,227,159,0.24)', borderCurve: 'continuous', borderRadius: 25, borderWidth: 1, boxShadow: '0 13px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.09)', gap: 13, padding: 14 },
  cabinetHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  cabinetTitle: { ...KatchaUI.type.title, fontSize: 15 },
  cabinetMeta: { ...KatchaUI.type.meta, fontSize: 9.5 },
  cabinetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slot: { alignItems: 'center', backgroundColor: 'rgba(12,12,10,0.42)', borderColor: 'rgba(255,255,255,0.07)', borderRadius: 13, borderWidth: 1, flexBasis: '22%', flexGrow: 1, gap: 3, justifyContent: 'center', minHeight: 59, paddingVertical: 7 },
  slotMedallion: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  slotArt: { height: 31, width: 31 },
  cardArt: { height: 38, width: 38 },
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
  achievementList: { gap: 7 },
  card: { alignItems: 'center', backgroundColor: '#E9D6B5', borderColor: 'rgba(116,79,39,0.22)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '-2px 4px 11px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,248,230,0.72)', flexDirection: 'row', gap: 10, minHeight: 76, paddingHorizontal: 11, paddingVertical: 10 },
  cardLocked: { backgroundColor: '#CFC1AA', borderColor: 'rgba(83,72,57,0.16)', opacity: 0.88 },
  cardIcon: { alignItems: 'center', backgroundColor: 'rgba(82,72,60,0.08)', borderColor: 'rgba(82,72,60,0.12)', borderRadius: 13, borderWidth: 1, height: 43, justifyContent: 'center', width: 43 },
  cardBody: { flex: 1, gap: 7 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { ...KatchaUI.type.title, flex: 1, fontSize: 14.5, lineHeight: 19 },
  tierBadge: { alignItems: 'center', borderColor: 'rgba(70,59,48,0.20)', borderRadius: 9, borderWidth: 1, minWidth: 31, paddingHorizontal: 7, paddingVertical: 3 },
  tierText: { ...KatchaUI.type.numeric, fontSize: 9, fontWeight: '900', fontVariant: ['tabular-nums'] },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  progressTrack: { backgroundColor: 'rgba(69,51,34,0.14)', borderRadius: 999, flex: 1, height: 6, overflow: 'hidden' },
  progressFill: { borderRadius: 999, height: '100%' },
  progressValue: { ...KatchaUI.type.numeric, fontSize: 9.5, fontVariant: ['tabular-nums'] },
  earnedRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  earnedDate: { ...KatchaUI.type.meta, fontSize: 9, fontVariant: ['tabular-nums'] },
  missing: { alignItems: 'center', backgroundColor: '#171711', flex: 1, gap: 18, justifyContent: 'center', padding: 28 },
  missingTitle: { ...KatchaUI.type.display, textAlign: 'center' },
  missingButton: { backgroundColor: '#E7B951', borderRadius: 15, minHeight: 44, paddingHorizontal: 20, paddingVertical: 12 },
  missingButtonLabel: { ...KatchaUI.type.action },
});
