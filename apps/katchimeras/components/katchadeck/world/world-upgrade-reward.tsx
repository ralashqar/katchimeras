import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchimeraCardDeckCarousel } from '@/components/katchadeck/collection/katchimera-card-deck-carousel';
import { useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import type { KatchimeraSkinId } from '@/types/katchimera';

export function WorldUpgradeReward({ skinId, onClose }: { skinId: KatchimeraSkinId; onClose: () => void }) {
  const [collection, setCollection] = useState(false);
  const skin = katchimeraSkinById.get(skinId);
  const { cards } = useKatchimeraCards(skin?.familyId ?? null);
  const insets = useSafeAreaInsets(); const reduced = useReducedMotion();
  return <>
    <Animated.View entering={reduced ? undefined : FadeInUp.duration(200)} accessibilityLiveRegion="polite" style={[styles.toast, { top: insets.top + 16 }]}>
      <View style={styles.words}><Text style={styles.title}>{skin?.displayName} is here to stay!</Text>
        <Pressable accessibilityRole="button" onPress={() => setCollection(true)} style={styles.action}><Text style={styles.link}>View collection ›</Text></Pressable></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close skin reward" onPress={onClose} style={styles.action}><Text style={styles.title}>×</Text></Pressable>
    </Animated.View>
    {collection ? <KatchaSheet header={{ title: `${skin?.displayName} joined your collection` }} surface="parchment" appearance="game" onRequestClose={() => { setCollection(false); onClose(); }} scroll>
      <KatchimeraCardDeckCarousel cards={cards} initialCardId={skinId} />
    </KatchaSheet> : null}
  </>;
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', width: '90%', maxWidth: 380, zIndex: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF3D0', borderWidth: 2, borderColor: '#D6AF62', boxShadow: '0 5px 16px rgba(40,35,20,0.2)' },
  words: { flex: 1 }, title: { color: '#59462D', fontSize: 16, fontWeight: '800' }, action: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, link: { color: '#59713B', fontWeight: '800', fontSize: 13 },
});
