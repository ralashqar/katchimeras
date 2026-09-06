import { StyleSheet, View } from 'react-native';

import { KatchimeraCardDeckCarousel } from '@/components/katchadeck/collection/katchimera-card-deck-carousel';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI } from '@/constants/katcha-ui';
import { useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import type { KatchimeraFamilyId } from '@/types/katchimera';

export function CompanionSkinsThread({ companionName, familyId, showHeading = true }: {
  companionName: string;
  familyId: KatchimeraFamilyId;
  showHeading?: boolean;
}) {
  const { tokens } = useKatchaSurface();
  const { cards, collectionOpen, loading } = useKatchimeraCards(familyId);
  return (
    <View style={styles.root}>
      {showHeading ? <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>KATCHIMERA CARDS</ThemedText>
        <ThemedText selectable style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>Your {companionName} collection</ThemedText>
      </View> : null}
      <View style={styles.intro}>
        <ThemedText selectable style={styles.description} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
          Each resident has one card. Help with their garden requests to reveal the whole set.
        </ThemedText>
        {!collectionOpen && !loading ? <ThemedText selectable style={styles.lockedMessage} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>A new visitor will bring the first card during an early Journey Day.</ThemedText> : null}
      </View>
      {collectionOpen ? <KatchimeraCardDeckCarousel cards={cards} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 10, paddingHorizontal: 4, paddingTop: 8 },
  heading: { gap: 6, paddingHorizontal: 4 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 10, letterSpacing: 1.2 },
  title: { ...KatchaUI.type.screenTitle, fontSize: 23, lineHeight: 28 },
  intro: { backgroundColor: 'rgba(255,248,232,0.9)', borderCurve: 'continuous', borderRadius: 18, gap: 7, padding: 12 },
  description: { ...KatchaUI.type.companionBody, fontSize: 12, lineHeight: 18 },
  lockedMessage: { fontSize: 11, fontWeight: '800', lineHeight: 16 },
});
