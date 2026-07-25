import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import { getCreatureVisual } from '@/game/days';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { KingdomSkinOption } from '@/utils/katchimera-wardrobe';

export function CompanionSkinsThread({
  companionName,
  equippedSkinId,
  onEquip,
  skins,
}: {
  companionName: string;
  equippedSkinId: KatchimeraSkinId | null;
  onEquip: (skinId: KatchimeraSkinId) => void;
  skins: readonly KingdomSkinOption[];
}) {
  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>
          WARDROBE
        </ThemedText>
        <ThemedText selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          Choose {companionName}&apos;s form
        </ThemedText>
        <ThemedText selectable style={styles.description} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          Forms change how this companion appears in your Kingdom. Their bond, quests, and memories stay together.
        </ThemedText>
      </View>

      <View accessibilityRole="list" style={styles.grid}>
        {skins.map((skin) => {
          if (!skin.visualKey) return null;
          const selected = skin.id === equippedSkinId;
          const visual = getCreatureVisual(skin.visualKey);
          return (
            <Pressable
              accessibilityLabel={`${skin.unlocked ? 'Equip' : 'Locked'} ${skin.displayName}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !skin.unlocked, selected }}
              disabled={!skin.unlocked}
              key={skin.id}
              onPress={() => {
                if (selected) return;
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                onEquip(skin.id);
              }}
              style={({ pressed }) => [
                styles.card,
                selected && styles.selectedCard,
                !skin.unlocked && styles.lockedCard,
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
                    <IconSymbol color={Meadow.chipLabel} name="checkmark" size={13} />
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
                  lightColor={Meadow.ink}
                  darkColor={Meadow.ink}>
                  {skin.displayName}
                </ThemedText>
                <ThemedText
                  selectable
                  style={[styles.status, selected && styles.selectedStatus]}
                  lightColor={selected ? Meadow.goldDeep : Meadow.inkFaint}
                  darkColor={selected ? Meadow.goldDeep : Meadow.inkFaint}>
                  {selected ? 'Equipped' : skin.unlocked ? 'Available' : 'Locked'}
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
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontFamily: AppFontFamilies.manrope, fontSize: 23, fontWeight: '900', letterSpacing: -0.55, lineHeight: 28 },
  description: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: 'rgba(255,248,232,0.42)',
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '-2px 3px 7px rgba(58,38,18,0.13), inset 0 1px 0 rgba(255,252,234,0.62)',
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 132,
    overflow: 'hidden',
    padding: 8,
  },
  selectedCard: { backgroundColor: '#F5DFA8', borderColor: Meadow.goldDeep, borderWidth: 2, padding: 7 },
  lockedCard: { opacity: 0.48 },
  pressedCard: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  artStage: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 13, height: 118, justifyContent: 'center', overflow: 'hidden' },
  art: { height: 112, width: '100%' },
  check: {
    alignItems: 'center',
    backgroundColor: Meadow.goldDeep,
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 24,
  },
  cardCopy: { gap: 1, paddingHorizontal: 4, paddingBottom: 2, paddingTop: 8 },
  skinName: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900', letterSpacing: -0.15 },
  status: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  selectedStatus: { fontWeight: '900' },
});
