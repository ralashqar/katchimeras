import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CollectibleCardDeck } from '@/components/katchadeck/collection/collectible-card-deck';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { DiscoveryRewardSequence } from '@/components/katchadeck/world/discovery-reward-sequence';
import { AppFontFamilies } from '@/constants/theme';
import { LANTERN_VISITORS } from '@/constants/wisp-lantern';
import { WISP_RARITY } from '@/constants/wisp-card-art';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import type { WispPackInstance } from '@/types/wisp-lantern';
import { wispPackCards, wispPackFocus } from '@/utils/wisp-pack-presentation';
import { WispCollectionCard } from './wisp-collection-card';

export function WispPackReveal({ pack, onFocus, onDone, pending, error, actionLabel }: {
  pack: WispPackInstance; onFocus: (index: number) => void; onDone: () => void; pending?: boolean; error?: string; actionLabel?: string;
}) {
  const { height } = useWindowDimensions();
  const cards = useMemo(() => wispPackCards(pack), [pack]);
  const selected = cards[wispPackFocus(pack)];
  if (!selected) return null;
  const newCount = cards.filter(card => card.discovered).length;
  const echoes = cards.reduce((sum, card) => sum + card.echoes, 0);
  return <DiscoveryRewardSequence key={pack.id} backdrop={false}
    renderHero={size => <WispCollectionCard wispId={selected.wispId} width={size / 1.5} cardNumber={LANTERN_VISITORS.indexOf(selected.wispId as typeof LANTERN_VISITORS[number]) + 1} />}
    eyebrow="WISP CARD DISCOVERED" title={wispDefinition(selected.wispId).name}
    description="Their card joins your collection. Their light joins your world."
    actionLabel="Welcome home" onContinue={onDone}
    renderAfterCelebration={() => <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.reveal} bounces={false}>
    <View style={styles.heading}><Text style={styles.eyebrow}>LITTLE LANTERN VISITORS</Text><Text accessibilityRole="header" style={styles.title}>{cards.length === 1 ? 'Your first Wisp card' : 'Your Wisp cards'}</Text><Text style={styles.summary}>{newCount} new {newCount === 1 ? 'discovery' : 'discoveries'}{echoes ? ` · +${echoes} Echoes` : ''}</Text></View>
    <CollectibleCardDeck cards={cards} selectedId={selected.id} onSelect={(_, index) => onFocus(index)} cardRatio={2 / 3} maxCardHeight={Math.min(430, Math.max(230, height * 0.5))} navigationLabel="Wisp pack"
      renderCard={(card, _, size) => <WispCollectionCard wispId={card.wispId} width={size.width} cardNumber={LANTERN_VISITORS.indexOf(card.wispId as typeof LANTERN_VISITORS[number]) + 1} />}
      renderCaption={card => <View style={styles.caption}><Text style={[styles.status, { color: WISP_RARITY[wispDefinition(card.wispId).rarity].glow }]}>{card.discovered ? `NEW · ${WISP_RARITY[wispDefinition(card.wispId).rarity].label.toUpperCase()}` : `ALREADY COLLECTED · +${card.echoes} ${card.echoes === 1 ? 'ECHO' : 'ECHOES'}`}</Text><Text style={styles.description}>{card.discovered ? 'Their card joins your collection. Their light joins your world.' : 'Your Wisp stays with you. Save Echoes to invite someone new.'}</Text></View>} />
    <View style={styles.footer}>
      {cards.length > 1 ? <Text style={styles.hint}>Swipe to browse every card in this pack</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.description}>{error}</Text> : null}
      <KatchaButton fullWidth glow disabled={pending} label={actionLabel ?? (cards.length === 1 ? 'Welcome home' : `Keep ${cards.length} cards`)} onPress={onDone} />
    </View>
  </ScrollView>} />;
}

const VISITOR_CARDS = LANTERN_VISITORS.map(id => ({ id }));
export function WispCollectionDeck({ ownedIds, onInspect }: { ownedIds: readonly WispId[]; onInspect: (id: WispId) => void }) {
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState<string>(() => LANTERN_VISITORS.find(id => ownedIds.includes(id)) ?? LANTERN_VISITORS[0]);
  return <View style={styles.album}>
    <CollectibleCardDeck cards={VISITOR_CARDS} selectedId={selected} onSelect={card => setSelected(card.id)} cardRatio={2 / 3} maxCardHeight={Math.min(350, height * 0.43)} navigationLabel="Wisp collection"
      renderCard={(card, index, size) => <WispCollectionCard wispId={card.id} owned={ownedIds.includes(card.id)} width={size.width} cardNumber={index + 1} />}
      renderCaption={card => <KatchaButton label={ownedIds.includes(card.id) ? 'Meet this Wisp' : 'How to discover'} size="compact" variant="secondary" onPress={() => onInspect(card.id)} />} />
  </View>;
}
const styles = StyleSheet.create({
  reveal: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 6 }, heading: { gap: 5, alignItems: 'center', paddingHorizontal: 18 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#D6B758' }, title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 28, lineHeight: 34, color: '#FFF8E6', textAlign: 'center' },
  summary: { fontFamily: AppFontFamilies.manrope, fontSize: 13, color: '#E4D8B9' }, caption: { gap: 7, alignItems: 'center', paddingHorizontal: 35, maxWidth: 410 }, status: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 14, lineHeight: 20, textAlign: 'center', color: '#F1E6CE' }, footer: { width: '100%', maxWidth: 380, paddingHorizontal: 12, gap: 12 }, hint: { fontSize: 12, color: '#DBCCAC', textAlign: 'center' },
  album: { alignItems: 'center', marginHorizontal: -20 },
});
