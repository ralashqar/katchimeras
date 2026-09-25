import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { perkLabel, wispPerk } from '@/constants/helper-wisps';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { katchimeraLevel } from '@/constants/katchimera-progression';
import { AppFontFamilies } from '@/constants/theme';
import { UpgradePanelUI } from '@/constants/upgrade-panel';
import { WISP_CATALOG } from '@/constants/wisps';
import { ENCOUNTER_BASE_GLOW, ENCOUNTER_BASE_XP } from '@/features/encounter/encounter-rewards';
import { getCreatureVisual } from '@/game/days/visuals';
import type { RegionLadderEntry } from '@/constants/island-campaigns/helpers';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import type { EncounterDifficulty } from '@/types/encounter';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { Face } from './upgrade-rows';

/**
 * The pre-mission rows on a region's panel: what the rung asks (its card),
 * where it sits on the ladder, and what the player brings in (one Katchimera,
 * one helper Wisp). Nothing here decides anything: the rung comes from the
 * campaign's ladder, the numbers from the encounter and the reward tables.
 */
export type EncounterLoadoutChoice = {
  katchimeraId: MergeCharacterId; helperWispId: string | null;
  /** The second hero, once Chapter 3 opens the slot (`features/encounter/team.ts`). */
  partnerId?: MergeCharacterId | null;
};

export const DIFFICULTY_LABELS: Readonly<Record<EncounterDifficulty, string>> = { calm: 'Calm Mist', thick: 'Thick Mist', dark: 'Dark Mist', boss: 'Ancient Mist' };
const DIFFICULTY_TINT: Readonly<Record<EncounterDifficulty, string>> = { calm: '#5FA87B', thick: '#4E9CC4', dark: '#8A63C9', boss: '#D98A1F' };

export const UpgradeMissionCard = memo(function UpgradeMissionCard({ mission, cleared }: { mission: RegionMissionDefinition; cleared?: { bestGrade: string } | null }) {
  const encounter = mission.encounter;
  const glow = mission.rewards.glow > 0 ? mission.rewards.glow : ENCOUNTER_BASE_GLOW[mission.difficulty];
  const xp = mission.rewards.xp > 0 ? mission.rewards.xp : ENCOUNTER_BASE_XP[mission.difficulty];
  return <Face colors={UpgradePanelUI.rowFace} radius={UpgradePanelUI.rowRadius} style={styles.card}>
    <View accessible accessibilityLabel={`${mission.title}. ${DIFFICULTY_LABELS[mission.difficulty]}. ${mission.objective}. ${encounter.resolve == null ? 'No Resolve budget' : `${encounter.resolve} Resolve`}. ${glow} Glow, ${xp} experience.${cleared ? ` Cleared before: ${cleared.bestGrade}.` : ''}`} style={styles.cardBody}>
      <View style={styles.cardHead}>
        <Text numberOfLines={1} style={styles.cardTitle}>{mission.title}</Text>
        <View style={[styles.difficulty, { backgroundColor: DIFFICULTY_TINT[mission.difficulty] }]}><Text style={styles.difficultyText}>{DIFFICULTY_LABELS[mission.difficulty]}</Text></View>
      </View>
      <Text numberOfLines={2} style={styles.cardObjective}>{mission.objective}</Text>
      <View style={styles.cardStats}>
        <Stat icon="bolt.fill" label="Resolve" value={encounter.resolve == null ? '∞' : String(encounter.resolve)} />
        <Stat icon="sparkles" label="Glow" value={String(glow)} />
        <Stat icon="star.fill" label="XP" value={String(xp)} />
        {cleared ? <Stat icon="star.fill" label="Best" value={cleared.bestGrade === 'perfect' ? 'Perfect' : cleared.bestGrade === 'bright' ? 'Bright' : 'Cleared'} /> : null}
      </View>
    </View>
  </Face>;
});

function Stat({ icon, label, value }: { icon: 'bolt.fill' | 'sparkles' | 'star.fill'; label: string; value: string }) {
  return <View style={styles.stat}>
    <IconSymbol color={UpgradePanelUI.inkFaint} name={icon} size={14} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>;
}

/** The ladder as a row of rungs: cleared, the one to play, the ones ahead. */
export const UpgradeLadderRow = memo(function UpgradeLadderRow({ ladder }: { ladder: readonly RegionLadderEntry[] }) {
  return <View accessible accessibilityLabel={`${ladder.filter((entry) => entry.state === 'done').length} of ${ladder.length} rungs cleared`} style={styles.ladder}>
    {ladder.map((entry, index) => <View key={entry.missionId} style={styles.rungWrap}>
      <View style={[styles.rung, entry.state === 'done' ? styles.rungDone : entry.state === 'next' ? styles.rungNext : styles.rungAhead, { borderColor: DIFFICULTY_TINT[entry.difficulty] }]}>
        <Text style={[styles.rungText, entry.state === 'ahead' ? styles.rungTextAhead : null]}>{entry.state === 'done' ? '✓' : index + 1}</Text>
      </View>
      {index < ladder.length - 1 ? <View style={[styles.connector, entry.state === 'done' ? styles.connectorDone : null]} /> : null}
    </View>)}
  </View>;
});

/**
 * What the player brings in: one of the playable Katchimeras (their level
 * and ability under the portrait) and one helper Wisp from the collection.
 */
export const UpgradeLoadoutRow = memo(function UpgradeLoadoutRow({ world, playable, ownedWispIds, value, eligible, disabled, slots = 1, onChange }: {
  world: Pick<MergeWorldState, 'katchimeraProgress'>;
  playable: readonly MergeCharacterId[];
  ownedWispIds: readonly string[];
  value: EncounterLoadoutChoice;
  /** Katchimeras the rung allows; absent, any of the playable ones. */
  eligible?: readonly MergeCharacterId[] | null;
  disabled?: boolean;
  /** Heroes a battle takes (1, or 2 once the second slot is open). With two, a tap picks the partner; tapping the partner swaps them into the lead. */
  slots?: 1 | 2;
  onChange: (next: EncounterLoadoutChoice) => void;
}) {
  const wisps = useMemo(() => ownedWispIds.map((id) => WISP_CATALOG.find((wisp) => wisp.id === id)).filter((wisp): wisp is NonNullable<typeof wisp> => Boolean(wisp)).slice(0, 12), [ownedWispIds]);
  return <View style={styles.loadout}>
    <View style={styles.pickRow}>
      {playable.map((id) => {
        const skin = katchimeraSkinById.get(id);
        const visual = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown') : null;
        const partnered = slots === 2 && value.partnerId === id;
        // A level that asks for one friend holds its lead; anyone can come along as the partner.
        const allowed = !eligible || eligible.includes(id) || (slots === 2 && id !== value.katchimeraId);
        const picked = value.katchimeraId === id || partnered;
        const choose = () => {
          if (slots < 2) { onChange({ ...value, katchimeraId: id }); return; }
          if (id === value.katchimeraId) return;
          // The partner tapped: they take the lead (when the level allows), and the lead comes along instead.
          if (partnered && (!eligible || eligible.includes(id))) { onChange({ ...value, katchimeraId: id, partnerId: value.katchimeraId }); return; }
          onChange({ ...value, partnerId: id });
        };
        const level = katchimeraLevel(world, id);
        const ability = abilityForCompanion(id);
        const tier = ability ? abilityTier(ability, level) : null;
        return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: picked, disabled: disabled || !allowed }} accessibilityLabel={`${skin?.displayName ?? id}, level ${level}${ability ? `, ${ability.name}` : ''}${slots === 2 && value.katchimeraId === id ? ', lead' : partnered ? ', partner' : ''}${allowed ? '' : ', not for this rung'}`}
          disabled={disabled || !allowed} onPress={choose} style={[styles.portraitWrap, picked ? styles.portraitPicked : null, !allowed ? styles.portraitDimmed : null]}>
          {slots === 2 && picked ? <View style={styles.slotBadge}><Text style={styles.slotBadgeText}>{partnered ? '2' : '1'}</Text></View> : null}
          {visual ? <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={visual.source} style={styles.portrait} transition={0} /> : <View style={styles.portrait} />}
          <Text numberOfLines={1} style={styles.portraitName}>{skin?.displayName ?? id}</Text>
          <Text numberOfLines={1} style={styles.portraitMeta}>{`Lv. ${level}${ability && tier ? ` · ${ability.name}` : ''}`}</Text>
        </Pressable>;
      })}
    </View>
    <View style={styles.wispRow}>
      <Text style={styles.wispLabel}>Helper Wisp</Text>
      <View style={styles.wispChips}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: value.helperWispId == null }} accessibilityLabel="No helper Wisp" disabled={disabled} onPress={() => onChange({ ...value, helperWispId: null })} style={[styles.chip, value.helperWispId == null ? styles.chipPicked : null]}>
          <Text style={styles.chipText}>None</Text>
        </Pressable>
        {wisps.map((wisp) => {
          const perk = wispPerk(wisp.id);
          const picked = value.helperWispId === wisp.id;
          return <Pressable key={wisp.id} accessibilityRole="button" accessibilityState={{ selected: picked }} accessibilityLabel={`${wisp.name}${perk ? `, ${perkLabel(perk)}` : ''}`} disabled={disabled} onPress={() => onChange({ ...value, helperWispId: wisp.id })} style={[styles.chip, picked ? styles.chipPicked : null]}>
            <Text numberOfLines={1} style={styles.chipText}>{wisp.name}</Text>
            {perk ? <Text numberOfLines={1} style={styles.chipPerk}>{perkLabel(perk)}</Text> : null}
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
});

const styles = StyleSheet.create({
  slotBadge: { position: 'absolute', top: 2, right: 2, zIndex: 1, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5FA87B' },
  slotBadgeText: { color: '#FFFFFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  card: { marginBottom: 8 },
  cardBody: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flexShrink: 1, color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 16 },
  difficulty: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { color: '#FFFFFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  cardObjective: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 17 },
  cardStats: { flexDirection: 'row', gap: 14, marginTop: 2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 13 },
  statLabel: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  ladder: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 6, paddingVertical: 6, rowGap: 6 },
  rungWrap: { flexDirection: 'row', alignItems: 'center' },
  rung: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  rungDone: { backgroundColor: '#E6F6EA' },
  rungNext: { backgroundColor: '#FFF6D6', transform: [{ scale: 1.1 }] },
  rungAhead: { backgroundColor: 'rgba(255,255,255,0.6)', opacity: 0.7 },
  rungText: { color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 13 },
  rungTextAhead: { color: UpgradePanelUI.inkFaint },
  connector: { width: 10, height: 3, backgroundColor: 'rgba(46,74,102,0.18)' },
  connectorDone: { backgroundColor: '#9ED8AE' },
  loadout: { gap: 8, marginTop: 4 },
  pickRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  portraitWrap: { width: 96, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.55)' },
  portraitPicked: { borderColor: '#F2D27A', backgroundColor: '#FFF6D6' },
  portraitDimmed: { opacity: 0.4 },
  portrait: { width: 56, height: 56 },
  portraitName: { color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, marginTop: 2 },
  portraitMeta: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  wispRow: { gap: 6 },
  wispLabel: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, paddingHorizontal: 6 },
  wispChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.55)', maxWidth: 150 },
  chipPicked: { borderColor: '#F2D27A', backgroundColor: '#FFF6D6' },
  chipText: { color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  chipPerk: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.fredokaBold, fontSize: 10 },
});
