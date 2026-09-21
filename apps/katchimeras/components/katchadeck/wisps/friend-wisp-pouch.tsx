import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { DiscoveryRewardSequence } from '@/components/katchadeck/world/discovery-reward-sequence';
import { FRIEND_PACK_NAMES, friendConstellation, friendPackKind } from '@/constants/friend-wisp-constellations';
import { AppFontFamilies } from '@/constants/theme';
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
 * A friend's Wisps for today: the spark meter their daily tasks fill, and whatever packs are waiting (the day's
 * pouch, a gift from Bond or a chapter). Opening uses the Lantern's own anticipation and reveal, as they are.
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

  const begin = useCallback(() => {
    // The meter may have filled a moment ago: make sure what is owed has been given before looking for it.
    reconcileFriendWispRewards();
    setError(''); setOpening(false); setPackId(waiting[0]?.id ?? null);
  }, [waiting]);
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
  const next = waiting[0];
  const nextName = next ? FRIEND_PACK_NAMES[friendPackKind(next.definitionId)] : null;
  const todayDone = Boolean(sparks && filled >= FRIEND_POUCH_SPARKS);
  const revealing = Boolean(pack?.outcomes) && !opening;

  return <View style={styles.row}>
    <View style={styles.meter} accessible accessibilityLabel={sparks ? `${filled} of ${FRIEND_POUCH_SPARKS} sparks with ${friendName} today` : `${friendName} has no tasks today`}>
      <View style={styles.pips}>{Array.from({ length: FRIEND_POUCH_SPARKS }, (_, index) => <View key={index} style={[styles.pip, index < filled && styles.pipLit]} />)}</View>
      <Text style={styles.caption}>{!sparks ? `${friendName} is resting today.` : todayDone ? 'Today’s pouch is earned.' : `Spend time with ${friendName} today: ${FRIEND_POUCH_SPARKS - filled} more ${FRIEND_POUCH_SPARKS - filled === 1 ? 'spark' : 'sparks'} fill a pouch.`}</Text>
    </View>
    {next ? <KatchaButton size="compact" label={waiting.length > 1 ? `Open ${nextName} · ${waiting.length}` : `Open ${nextName}`} accessibilityLabel={`Open ${nextName} from ${friendName}`} onPress={begin} /> : null}
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
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  meter: { flex: 1, gap: 4 },
  pips: { flexDirection: 'row', gap: 5 },
  pip: { backgroundColor: 'rgba(98,77,137,0.16)', borderColor: 'rgba(98,77,137,0.3)', borderRadius: 6, borderWidth: 1, height: 12, width: 12 },
  pipLit: { backgroundColor: '#F2C45A', borderColor: '#C98F1F' },
  caption: { color: '#78644E', fontFamily: AppFontFamilies.manrope, fontSize: 11, lineHeight: 15 },
  scrim: { flex: 1, backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
});
