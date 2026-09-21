import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { friendConstellation, friendConstellationWisps } from '@/constants/friend-wisp-constellations';
import { AppFontFamilies } from '@/constants/theme';
import { wispDefinition } from '@/constants/wisps';
import { commandFriendWispPacks } from '@/features/wisps/friend-wisp-runtime';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { WispId } from '@/types/wisp';
import { friendEquippedWisp } from '@/utils/friend-wisp-packs';
import { FriendWispPouch } from './friend-wisp-pouch';
import { WispCollectionDeck } from './wisp-card-deck';

/**
 * One friend's Wisps, and only theirs: the nine cards of their constellation in the game's own collection deck (found
 * ones in colour, the rest as the deck already shows a card not yet found), today's sparks and any pack waiting, and
 * for a found Wisp the choice to have it follow this friend at their shoulder in the Kingdom.
 */
export function FriendWispsSheet({ familyId, friendName, onClose }: { familyId: string; friendName: string; onClose: () => void }) {
  const { state } = useWisps();
  const constellation = friendConstellation(familyId);
  const ids = useMemo(() => (constellation ? friendConstellationWisps(constellation) : []), [constellation]);
  const ownedIds = useMemo(() => ids.filter((id) => (state.inventory[id]?.quantity ?? 0) > 0), [ids, state.inventory]);
  const carried = friendEquippedWisp(state, familyId);
  const [error, setError] = useState('');
  const carry = useCallback((wispId: WispId | null) => {
    setError('');
    try { commandFriendWispPacks({ type: 'equip', familyId, wispId }, undefined, ownedIds); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
  }, [familyId, ownedIds]);
  if (!constellation) return null;

  return <KatchaSheet surface="parchment" size="tall" scroll onRequestClose={onClose}
    header={{ eyebrow: `${ownedIds.length} OF ${ids.length} FOUND`, title: constellation.name, subtitle: carried ? `${wispDefinition(carried).name} is with ${friendName}.` : `Found Wisps can follow ${friendName} around the Kingdom.` }}>
    <View style={styles.body}>
      <FriendWispPouch familyId={familyId} friendName={friendName} />
      <WispCollectionDeck ids={ids} ownedIds={ownedIds}
        onInspect={() => {}}
        renderAction={(id, owned) => <View style={styles.action}>
          {owned
            ? <KatchaButton size="compact" variant={carried === id ? 'secondary' : 'primary'}
                label={carried === id ? `With ${friendName} · send home` : `Follow ${friendName}`}
                accessibilityLabel={carried === id ? `${wispDefinition(id).name} is with ${friendName}. Send home` : `Have ${wispDefinition(id).name} follow ${friendName}`}
                onPress={() => carry(carried === id ? null : id)} />
            : <Text style={styles.hint}>{id === constellation.signature ? `${friendName} gives this one at the top of your Bond.` : `Waiting in ${friendName}’s packs.`}</Text>}
        </View>} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  </KatchaSheet>;
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8 },
  action: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  hint: { color: '#78644E', fontFamily: AppFontFamilies.manrope, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  error: { color: '#85362D', fontFamily: AppFontFamilies.manrope, fontSize: 12, textAlign: 'center' },
});
