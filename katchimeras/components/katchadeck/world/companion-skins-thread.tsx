import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { getCreatureVisual } from '@/game/days';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';

export function CompanionSkinsThread({
  activePlus,
  companionName,
  equippedSkinId,
  onEquip,
  showHeading = true,
  skins,
}: {
  activePlus: boolean;
  companionName: string;
  equippedSkinId: KatchimeraSkinId | null;
  onEquip: (skinId: KatchimeraSkinId) => void;
  showHeading?: boolean;
  skins: readonly KingdomSkinOption[];
}) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={styles.root}>
      {showHeading ? <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>
          WARDROBE
        </ThemedText>
        <ThemedText selectable style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>
          Choose {companionName}&apos;s form
        </ThemedText>
        <ThemedText selectable style={styles.description} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
          Forms change how this companion appears in your Kingdom. Their bond, quests, and memories stay together.
        </ThemedText>
      </View> : null}

      <View accessibilityRole="list" style={styles.grid}>
        {skins.map((skin) => {
          if (!skin.visualKey) return null;
          const selected = skin.id === equippedSkinId;
        const available = activePlus;
          const visual = getCreatureVisual(skin.visualKey);
          return (
            <Pressable
              accessibilityLabel={`${available ? 'Equip' : 'Unlock with Plus'} ${skin.displayName}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={skin.id}
              onPress={() => {
                if (selected) return;
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                onEquip(skin.id);
              }}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: 'rgba(255,248,232,0.93)', borderColor: tokens.border, boxShadow: '0 8px 22px rgba(37,42,29,0.18), inset 0 1px 0 rgba(255,255,255,0.76)' },
                selected && [styles.selectedCard, { backgroundColor: 'rgba(255,244,204,0.97)', borderColor: tokens.accentPressed }],
                !available && styles.lockedCard,
                pressed && styles.pressedCard,
              ]}>
              <View style={[styles.artStage, { backgroundColor: `${visual.accentColor}28` }]}>
                <Image
                  accessibilityLabel={skin.displayName}
                  contentFit="contain"
                  source={visual.source}
                  style={styles.art}
                  transition={120}
                />
                {selected ? (
                  <View style={styles.check}>
                    <IconSymbol color={tokens.accentText} name="checkmark" size={13} />
                  </View>
                ) : null}
              </View>
              <View style={styles.cardCopy}>
                <ThemedText
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={1}
                  selectable
                  style={styles.skinName}
                  lightColor={tokens.text}
                  darkColor={tokens.text}>
                  {skin.displayName}
                </ThemedText>
                <ThemedText
                  selectable
                  style={[styles.status, selected && styles.selectedStatus]}
                  lightColor={selected ? tokens.accentPressed : tokens.textTertiary}
                  darkColor={selected ? tokens.accentPressed : tokens.textTertiary}>
                  {selected ? 'Equipped' : available ? 'Available' : 'Plus'}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, paddingBottom: 10, paddingHorizontal: 4, paddingTop: 8 },
  heading: { gap: 6, paddingHorizontal: 4 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 10, letterSpacing: 1.2 },
  title: { ...KatchaUI.type.screenTitle, fontSize: 23, lineHeight: 28 },
  description: { ...KatchaUI.type.companionBody, fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    borderCurve: 'continuous',
    borderRadius: KatchaUI.radius.card,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 132,
    overflow: 'hidden',
    padding: 8,
  },
  selectedCard: { borderWidth: 2, padding: 7 },
  lockedCard: { opacity: 0.48 },
  pressedCard: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  artStage: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 13, height: 118, justifyContent: 'center', overflow: 'hidden' },
  art: { height: 112, width: '100%' },
  check: {
    alignItems: 'center',
    backgroundColor: '#A77928',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 24,
  },
  cardCopy: { gap: 1, paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8 },
  skinName: { ...KatchaUI.type.companionAction, fontSize: 14, letterSpacing: -0.15 },
  status: { ...KatchaUI.type.label, fontSize: 10, letterSpacing: 0.5 },
  selectedStatus: { fontWeight: '900' },
});
