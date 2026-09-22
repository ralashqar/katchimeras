import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpgradeActionRow } from '@/components/katchadeck/upgrade/upgrade-rows';
import { DiscoveryRewardSequence } from '@/components/katchadeck/world/discovery-reward-sequence';
import { FRIEND_PACK_NAMES, friendConstellation, friendPackKind } from '@/constants/friend-wisp-constellations';
import { FRIEND_POUCH_SPARKS } from '@/features/wisps/friend-sparks';
import { commandFriendWispPacks, friendRewardStandings, reconcileFriendWispRewards } from '@/features/wisps/friend-wisp-runtime';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { WispId } from '@/types/wisp';
import { subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { subscribeCompanionLifeActivities } from '@/utils/companion-life-activity-storage';
import { friendPacksWaiting } from '@/utils/friend-wisp-packs';
import { WispPackReveal } from './wisp-card-deck';
import { WispPackAnticipation } from './wisp-pack-anticipation';

/**
 * A friend's Wisps for today, as strips on the panel's own rows: the day's pouch (one Wisp a day, once three sparks
 * from time spent with the friend have filled its meter), then any gift waiting from Bond or a chapter. Opening uses
 * the Lantern's own anticipation and reveal, as they are.
 */
export function FriendWispPouch({ familyId, friendName }: { familyId: string; friendName: string }) {
  const insets = useSafeAreaInsets();
  const { state } = useWisps();
  const constellation = friendConstellation(familyId);
  // Sparks are read off the day's records, so they are re-read when those records move.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((value) => value + 1);
    const stops = [subscribeCompanionBondState(again), subscribeCompanionLifeActivities(again)];
    return () => stops.forEach((stop) => stop());
  }, []);
  const sparks = useMemo(() => {
    void tick;
    return friendRewardStandings().find((standing) => standing.familyId === familyId)?.sparks ?? null;
  }, [familyId, tick]);
  const waiting = friendPacksWaiting(state, familyId);
  const [packId, setPackId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const pack = packId ? state.friendPacks?.packs[packId] ?? null : null;
  const ownedIds = useMemo(() => Object.keys(state.inventory).filter((id) => (state.inventory[id as WispId]?.quantity ?? 0) > 0) as WispId[], [state.inventory]);

  const open = useCallback(() => {
    if (!packId || opening) return;
    setOpening(true); setError('');
    try { commandFriendWispPacks({ type: 'open', packId }, undefined, ownedIds); }
    catch (e) { setOpening(false); setError(e instanceof Error ? e.message : 'Please try again.'); }
  }, [opening, ownedIds, packId]);
  const done = useCallback(() => {
    if (pack?.outcomes) commandFriendWispPacks({ type: 'acknowledge_reveal', packId: pack.id, revealed: pack.outcomes.length });
    setPackId(null); setOpening(false);
  }, [pack]);

  if (!constellation) return null;
  const filled = Math.min(FRIEND_POUCH_SPARKS, sparks?.total ?? 0);
  const todayDone = Boolean(sparks && filled >= FRIEND_POUCH_SPARKS);
  const revealing = Boolean(pack?.outcomes) && !opening;

  const pouch = waiting.find((entry) => { const kind = friendPackKind(entry.definitionId); return kind === 'pouch' || kind === 'bright'; }) ?? null;
  const gifts = waiting.filter((entry) => entry !== pouch);
  const openPack = (id: string) => { reconcileFriendWispRewards(); setError(''); setOpening(false); setPackId(id); };
  const pips = <View style={styles.pips} pointerEvents="none">{Array.from({ length: FRIEND_POUCH_SPARKS }, (_, index) => <View key={index} style={[styles.pip, index < filled && styles.pipLit]} />)}</View>;
  const pouchDetail = pouch
    ? `${FRIEND_PACK_NAMES[friendPackKind(pouch.definitionId)]} is waiting: one Wisp inside.`
    : !sparks ? `${friendName} is resting today.`
    : todayDone ? 'Today’s Wisp is found. Another tomorrow.'
    : `${FRIEND_POUCH_SPARKS - filled} more ${FRIEND_POUCH_SPARKS - filled === 1 ? 'spark' : 'sparks'} from time with ${friendName}.`;
  return <View style={styles.rows}>
    <View accessible accessibilityLabel={sparks ? `Daily pouch. ${filled} of ${FRIEND_POUCH_SPARKS} sparks with ${friendName} today. ${pouchDetail}` : `Daily pouch. ${pouchDetail}`}>
      <UpgradeActionRow icon="sparkles" label="Daily Pouch" detail={pouchDetail} done={todayDone && !pouch}
        action={pouch ? { label: 'Open', primary: true, accessibilityLabel: `Open today’s pouch from ${friendName}`, onPress: () => openPack(pouch.id) } : undefined} />
      <View style={styles.pipsRow}>{pips}</View>
    </View>
    {gifts.map((gift) => <UpgradeActionRow key={gift.id} icon="star.fill" label={FRIEND_PACK_NAMES[friendPackKind(gift.definitionId)]} detail={`A gift from ${friendName}: three Wisps inside.`}
      action={{ label: 'Open', primary: true, accessibilityLabel: `Open ${FRIEND_PACK_NAMES[friendPackKind(gift.definitionId)]} from ${friendName}`, onPress: () => openPack(gift.id) }} />)}
    {packId ? <Modal transparent visible animationType={revealing ? 'none' : 'fade'} onRequestClose={opening ? () => {} : done}><GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {revealing && pack ? <WispPackReveal pack={pack} error={error}
          onFocus={() => {}} onDone={done} />
        : <DiscoveryRewardSequence key={`friend-pack:${packId}`} backdrop={false} keepHeroInPlace
          renderHero={(size) => <WispPackAnticipation size={size} opening={Boolean(opening && pack?.outcomes)} onDone={() => setOpening(false)} />}
          eyebrow={`From ${friendName}`} title={pack ? FRIEND_PACK_NAMES[friendPackKind(pack.definitionId)] : 'A little mystery inside'}
          description={opening ? 'A little light is waking up inside…' : `Little lights that gathered around ${friendName}. Open it to see who came.`}
          actionLabel={opening ? 'Opening…' : 'Open'} pending={opening} error={error} onContinue={open} />}
      </View>
    </GestureHandlerRootView></Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  rows: { gap: 8 },
  // The sparks sit on the strip's far left, under its mark.
  pipsRow: { position: 'absolute', left: 12, bottom: 6, flexDirection: 'row' },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { backgroundColor: 'rgba(98,77,137,0.16)', borderColor: 'rgba(98,77,137,0.3)', borderRadius: 4, borderWidth: 1, height: 8, width: 8 },
  pipLit: { backgroundColor: '#F2C45A', borderColor: '#C98F1F' },
  scrim: { flex: 1, backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
});
