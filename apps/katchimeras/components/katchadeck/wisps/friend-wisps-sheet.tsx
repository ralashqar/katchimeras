import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { UpgradeSection } from '@/components/katchadeck/upgrade/upgrade-rows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { friendConstellation, friendConstellationWisps } from '@/constants/friend-wisp-constellations';
import { AppFontFamilies } from '@/constants/theme';
import { UpgradePanelUI } from '@/constants/upgrade-panel';
import { WISP_RARITY } from '@/constants/wisp-rarity';
import { wispDefinition } from '@/constants/wisps';
import { commandFriendWispPacks } from '@/features/wisps/friend-wisp-runtime';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { WispId } from '@/types/wisp';
import { friendEquippedWisp } from '@/utils/friend-wisp-packs';
import { FriendWispPouch } from './friend-wisp-pouch';
import { WispCollectionCard } from './wisp-collection-card';

const COLUMNS = 3;
const GRID_GAP = 8;

/**
 * One friend's Wisps, and only theirs, on the panel's own cards: today's pouch (one Wisp a day, earned by spending
 * time with the friend) and any gift waiting, then the nine cards of their constellation in a grid, found ones in
 * colour, the rest as silhouettes. Tapping a card picks it; one strip under the grid says what it is and, for a
 * found Wisp, lets it follow the friend at their shoulder in the Kingdom.
 */
export function FriendWispsSheet({ familyId, friendName, onClose }: { familyId: string; friendName: string; onClose: () => void }) {
  const { state } = useWisps();
  const constellation = friendConstellation(familyId);
  const ids = useMemo(() => (constellation ? friendConstellationWisps(constellation) : []), [constellation]);
  const ownedIds = useMemo(() => ids.filter((id) => (state.inventory[id]?.quantity ?? 0) > 0), [ids, state.inventory]);
  const carried = friendEquippedWisp(state, familyId);
  const [selected, setSelected] = useState<WispId | null>(() => carried ?? ownedIds[0] ?? ids[0] ?? null);
  const [gridWidth, setGridWidth] = useState(0);
  const [error, setError] = useState('');
  const carry = useCallback((wispId: WispId | null) => {
    setError('');
    try { commandFriendWispPacks({ type: 'equip', familyId, wispId }, undefined, ownedIds); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
  }, [familyId, ownedIds]);
  if (!constellation) return null;
  const cardWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  const picked = selected ? wispDefinition(selected) : null;
  const pickedOwned = Boolean(selected && ownedIds.includes(selected));
  const pickedRarity = picked ? WISP_RARITY[picked.rarity] : null;

  return <KatchaSheet surface="parchment" size="tall" scroll onRequestClose={onClose}
    header={{ eyebrow: `${ownedIds.length} OF ${ids.length} FOUND`, title: constellation.name, subtitle: carried ? `${wispDefinition(carried).name} is with ${friendName}.` : `Found Wisps can follow ${friendName} around the Kingdom.` }}>
    <View style={styles.body}>
      <UpgradeSection label="Today" aside="One Wisp a day">
        <FriendWispPouch familyId={familyId} friendName={friendName} />
      </UpgradeSection>

      <UpgradeSection label="Constellation" aside={`${ownedIds.length} found`}>
        <View style={styles.grid} onLayout={(event) => setGridWidth(Math.round(event.nativeEvent.layout.width))}>
          {cardWidth > 0 ? ids.map((id, index) => {
            const owned = ownedIds.includes(id);
            const isSelected = selected === id;
            return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${owned ? wispDefinition(id).name : 'An undiscovered Wisp'}${carried === id ? `, with ${friendName}` : ''}`}
              onPress={() => setSelected(id)} style={[styles.cell, { width: cardWidth }, isSelected && styles.cellSelected]}>
              <WispCollectionCard wispId={id} owned={owned} width={cardWidth - 6} cardNumber={index + 1} />
              {carried === id ? <View style={styles.carriedBadge}><IconSymbol color={UpgradePanelUI.badgeInk} name="figure.walk" size={11} /></View> : null}
            </Pressable>;
          }) : null}
        </View>
        {picked && pickedRarity ? <View style={styles.pickedRow} accessible accessibilityLabel={`${pickedOwned ? picked.name : 'An undiscovered Wisp'}, ${pickedRarity.label}`}>
          <View style={styles.pickedText}>
            <Text numberOfLines={1} style={styles.pickedName}>{pickedOwned ? picked.name : 'Not found yet'}</Text>
            <Text numberOfLines={2} style={styles.pickedDetail}>
              {pickedOwned
                ? `${pickedRarity.symbol} ${pickedRarity.label}${carried === selected ? ` · with ${friendName}` : ''}`
                : selected === constellation.signature ? `${friendName} gives this one at the top of your Bond.` : `${pickedRarity.symbol} ${pickedRarity.label} · waiting in ${friendName}’s packs.`}
            </Text>
          </View>
          {pickedOwned ? <KatchaButton size="compact" variant={carried === selected ? 'secondary' : 'primary'}
            label={carried === selected ? 'Send home' : 'Follow'}
            accessibilityLabel={carried === selected ? `${picked.name} is with ${friendName}. Send home` : `Have ${picked.name} follow ${friendName}`}
            onPress={() => carry(carried === selected ? null : selected)} /> : null}
        </View> : null}
      </UpgradeSection>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  </KatchaSheet>;
}

const styles = StyleSheet.create({
  body: { gap: 10, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cell: { alignItems: 'center', borderRadius: 14, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  cellSelected: { borderColor: UpgradePanelUI.leaf },
  carriedBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: UpgradePanelUI.leaf, borderRadius: 10, height: 20, width: 20, alignItems: 'center', justifyContent: 'center' },
  pickedRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 2 },
  pickedText: { flex: 1, gap: 2 },
  pickedName: { color: UpgradePanelUI.ink, fontFamily: AppFontFamilies.fredokaBold, fontSize: 15 },
  pickedDetail: { color: UpgradePanelUI.inkFaint, fontFamily: AppFontFamilies.manrope, fontSize: 12, lineHeight: 16 },
  error: { color: '#85362D', fontFamily: AppFontFamilies.manrope, fontSize: 12, textAlign: 'center' },
});
