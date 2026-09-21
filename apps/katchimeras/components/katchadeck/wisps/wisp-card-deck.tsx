import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { CollectibleCardDeck } from '@/components/katchadeck/collection/collectible-card-deck';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { AppFontFamilies } from '@/constants/theme';
import { LANTERN_VISITORS } from '@/constants/wisp-lantern';
import { albumWisps, isFriendPackId, packDefinition, wispAlbum } from '@/constants/wisp-albums';
import { WISP_CARD_ART, WISP_RARITY } from '@/constants/wisp-card-art';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import type { WispPackInstance } from '@/types/wisp-lantern';
import { wispPackCards, wispPackFocus } from '@/utils/wisp-pack-presentation';
import { WispCollectionCard } from './wisp-collection-card';
import { WISP_PACK_HANDOFF_SCALE } from './wisp-pack-handoff';

const PACK_SHRINK_MS = 300;
const CARD_GROW_MS = 340;
const CARD_HOLD_MS = 360;
const CARD_SLIDE_MS = 420;
const CARD_LIFT = 34;
/** The friend celebration's window: rays and confetti behind the deck, then only the deck. */
const CELEBRATION_MS = 1_150;
const ARRIVAL_MS = CARD_GROW_MS + CARD_HOLD_MS + CARD_SLIDE_MS;

/**
 * A pack's cards, on their deck from the first frame. The opened pack shrinks
 * away in the middle of the page while the new card grows out of the same
 * spot, lifted a little over the deck; then it slides down into the deck's
 * middle slot, so it reads as a card being added to the deck rather than a
 * separate reward screen that later turns into one.
 */
export function WispPackReveal({ pack, onFocus, onDone, pending, error, actionLabel, previewStartedAt }: {
  pack: WispPackInstance; onFocus: (index: number) => void; onDone: () => void; pending?: boolean; error?: string; actionLabel?: string; previewStartedAt?: number;
}) {
  const { height, width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const cards = useMemo(() => wispPackCards(pack), [pack]);
  const selected = cards[wispPackFocus(pack)];
  // The card that arrives is the one the page opened on; browsing away and back never replays its arrival.
  const arrivingId = useRef(selected?.id ?? null).current;
  const [celebrating, setCelebrating] = useState(!reduced);
  const [arrived, setArrived] = useState(reduced);
  // The carried-over pack leaves the tree as soon as it has shrunk away, not when the card lands.
  const [packGone, setPackGone] = useState(reduced);
  useEffect(() => {
    if (reduced) { setCelebrating(false); setArrived(true); setPackGone(true); return; }
    const celebration = setTimeout(() => setCelebrating(false), CELEBRATION_MS);
    const arrival = setTimeout(() => setArrived(true), ARRIVAL_MS + 60);
    const shrunk = setTimeout(() => setPackGone(true), PACK_SHRINK_MS + 40);
    return () => { clearTimeout(celebration); clearTimeout(arrival); clearTimeout(shrunk); };
  }, [reduced]);
  if (!selected) return null;
  const newCount = cards.filter(card => card.discovered).length;
  const echoes = cards.reduce((sum, card) => sum + card.echoes, 0);
  const album = wispAlbum(packDefinition(pack.definitionId, pack.definitionVersion, previewStartedAt).collectionId, previewStartedAt);
  const ids = albumWisps(album);
  const friendPack = isFriendPackId(pack.definitionId);
  const packSize = Math.min(300, width - 44);
  // The rest of the page arrives once the card has grown, so the eye follows one thing at a time.
  const settle = (delay: number) => reduced ? FadeIn.duration(80) : FadeIn.delay(delay).duration(260);
  return <Animated.View key={pack.id} accessibilityViewIsModal entering={FadeIn.duration(reduced ? 80 : 140)} exiting={FadeOut.duration(reduced ? 80 : 180)} style={styles.overlay}>
    {celebrating ? <Animated.View exiting={FadeOut.duration(220)} pointerEvents="none" style={styles.celebration}>
      <RotatingRadialSunburst baseOpacity={0.9} rotationDurationMs={18_000} size={390} />
      <CelebrationParticles layerStyle={styles.confetti} tier={3} tint="#8DD56B" />
    </Animated.View> : null}
    <ScrollView style={styles.page} contentContainerStyle={styles.reveal} bounces={false}>
      <Animated.View entering={settle(CARD_GROW_MS)} style={styles.heading}><Text style={styles.eyebrow}>{album.name.toUpperCase()}</Text><Text accessibilityRole="header" style={styles.title}>{cards.length === 1 ? friendPack ? 'Today’s Wisp card' : 'Your first Wisp card' : 'Your Wisp cards'}</Text><Text style={styles.summary}>{newCount} new {newCount === 1 ? 'discovery' : 'discoveries'}{echoes ? ` · +${echoes} Echoes` : ''}</Text></Animated.View>
      <CollectibleCardDeck cards={cards} selectedId={selected.id} onSelect={(_, index) => onFocus(index)} cardRatio={2 / 3} maxCardHeight={Math.min(430, Math.max(230, height * 0.5))} navigationLabel="Wisp pack"
        renderCard={(card, _, size) => {
          const face = <WispCollectionCard wispId={card.wispId} width={size.width} cardNumber={ids.indexOf(card.wispId) + 1} />;
          // The deck it joins is already there, a beat behind it. Both wrappers stay for good (swapping one for the bare
          // card when the arrival ends would remount the card); once arrived, a slot browsed back to mounts settled.
          return card.id === arrivingId ? <ArrivingCard settled={arrived}>{face}</ArrivingCard> : <Animated.View entering={arrived ? undefined : settle(CARD_GROW_MS + 80)}>{face}</Animated.View>;
        }}
        renderCaption={card => <Animated.View entering={settle(CARD_GROW_MS + CARD_HOLD_MS)} style={styles.caption}><Text style={[styles.status, { color: WISP_RARITY[wispDefinition(card.wispId).rarity].glow }]}>{card.discovered ? `NEW · ${WISP_RARITY[wispDefinition(card.wispId).rarity].label.toUpperCase()}` : friendPack ? 'ANOTHER COPY' : `ALREADY COLLECTED · +${card.echoes} ${card.echoes === 1 ? 'ECHO' : 'ECHOES'}`}</Text><Text style={styles.description}>{card.discovered ? 'Their card joins your collection. Their light joins your world.' : friendPack ? 'Copies help this Wisp grow brighter.' : 'Your Wisp stays with you. Save Echoes to invite someone new.'}</Text></Animated.View>} />
      <Animated.View entering={settle(ARRIVAL_MS - 120)} style={styles.footer}>
        {cards.length > 1 ? <Text style={styles.hint}>Swipe to browse every card in this pack</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.description}>{error}</Text> : null}
        <KatchaButton fullWidth glow disabled={pending} label={actionLabel ?? (cards.length === 1 ? 'Welcome home' : `Keep ${cards.length} cards`)} onPress={onDone} />
      </Animated.View>
    </ScrollView>
    {!packGone ? <ShrinkingPack size={packSize} /> : null}
  </Animated.View>;
}

/** The opened pack, carried over from the sealed stage: it goes on shrinking into the spot the card grows out of. */
function ShrinkingPack({ size }: { size: number }) {
  const shrink = useSharedValue(0);
  useEffect(() => { shrink.value = withTiming(1, { duration: PACK_SHRINK_MS, easing: Easing.in(Easing.cubic) }); }, [shrink]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - shrink.value,
    transform: [{ scale: WISP_PACK_HANDOFF_SCALE - shrink.value * (WISP_PACK_HANDOFF_SCALE - 0.08) }, { rotateZ: `${shrink.value * -10}deg` }],
  }));
  return <View pointerEvents="none" style={styles.packLayer}>
    <Animated.View style={style}><Image source={WISP_CARD_ART.pack} contentFit="contain" style={{ width: size * 190 / 310, height: size * 285 / 310 }} transition={0} /></Animated.View>
  </View>;
}

/** Grows out of the shrinking pack, held a little over the deck, then slides down into its slot. */
function ArrivingCard({ children, settled }: { children: ReactNode; settled: boolean }) {
  // Mounted after the arrival (browsed away and back): already in its slot, nothing replays.
  const startSettled = useRef(settled).current;
  const grow = useSharedValue(startSettled ? 1 : 0);
  const slide = useSharedValue(startSettled ? 1 : 0);
  useEffect(() => {
    if (startSettled) return;
    grow.value = withTiming(1, { duration: CARD_GROW_MS, easing: Easing.out(Easing.back(1.4)) });
    slide.value = withDelay(CARD_GROW_MS + CARD_HOLD_MS, withSequence(
      withTiming(1.04, { duration: CARD_SLIDE_MS - 110, easing: Easing.inOut(Easing.cubic) }),
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
    ));
  }, [grow, slide, startSettled]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, grow.value * 1.6),
    transform: [
      { translateY: -CARD_LIFT * (1 - slide.value) },
      { scale: (0.18 + grow.value * 0.96) - slide.value * 0.14 },
    ],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function WispCollectionDeck({ ownedIds, onInspect, ids = LANTERN_VISITORS, renderAction }: {
  ownedIds: readonly WispId[]; onInspect: (id: WispId) => void; ids?: readonly WispId[];
  /** Replaces the card's own button (a friend's menu offers to bring the Wisp along instead). */
  renderAction?: (id: WispId, owned: boolean) => ReactNode;
}) {
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState<string>(() => ids.find(id => ownedIds.includes(id)) ?? ids[0]);
  return <View style={styles.album}>
    <CollectibleCardDeck cards={ids.map(id => ({ id }))} selectedId={selected} onSelect={card => setSelected(card.id)} cardRatio={2 / 3} maxCardHeight={Math.min(350, height * 0.43)} navigationLabel="Wisp collection"
      renderCard={(card, index, size) => <WispCollectionCard wispId={card.id} owned={ownedIds.includes(card.id)} width={size.width} cardNumber={index + 1} />}
      renderCaption={card => renderAction ? renderAction(card.id as WispId, ownedIds.includes(card.id as WispId)) : <KatchaButton label={ownedIds.includes(card.id) ? 'Meet this Wisp' : 'How to discover'} size="compact" variant="secondary" onPress={() => onInspect(card.id)} />} />
  </View>;
}
const styles = StyleSheet.create({
  // The modal host owns the dark backdrop; this page sits where the sealed pack's stage sat.
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, zIndex: 140 },
  celebration: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  confetti: { top: '50%', zIndex: 3 },
  packLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  page: { width: '100%' },
  reveal: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 6 }, heading: { gap: 5, alignItems: 'center', paddingHorizontal: 18 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#D6B758' }, title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 28, lineHeight: 34, color: '#FFF8E6', textAlign: 'center' },
  summary: { fontFamily: AppFontFamilies.manrope, fontSize: 13, color: '#E4D8B9' }, caption: { gap: 7, alignItems: 'center', paddingHorizontal: 35, maxWidth: 410 }, status: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 14, lineHeight: 20, textAlign: 'center', color: '#F1E6CE' }, footer: { width: '100%', maxWidth: 380, paddingHorizontal: 12, gap: 12 }, hint: { fontSize: 12, color: '#DBCCAC', textAlign: 'center' },
  album: { alignItems: 'center', marginHorizontal: -20 },
});
