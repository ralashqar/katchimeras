import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EGG_AVATAR_SKINS } from '@/constants/egg-avatar-skins';
import { Meadow } from '@/constants/meadow-theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { EggAvatarSkinDefinition } from '@/types/egg-avatar';

export function EggAvatarProfileScreen() {
  const { width } = useWindowDimensions();
  const { equippedSkin, equippedSkinId, equipSkin } = useEggAvatar();
  const cardWidth = Math.max(142, Math.min(190, (width - Meadow.space.page * 2 - 12) / 2));
  const heroSize = Math.min(286, width - 80);

  const handleSelect = (skin: EggAvatarSkinDefinition) => {
    if (skin.id === equippedSkinId) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    equipSkin(skin.id);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Profile',
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F4E5CB' },
          headerTintColor: Meadow.ink,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={styles.screen}
      >
        <LinearGradient colors={['#F8EBD2', '#DFC08D']} style={styles.heroCard}>
          <View style={[styles.heroHalo, { backgroundColor: `${equippedSkin.accent}36` }]} />
          <EggAvatar key={equippedSkinId} presentation="hero" size={heroSize} skinId={equippedSkinId} />
          <View style={styles.heroCopy}>
            <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              YOUR EGG
            </ThemedText>
            <ThemedText selectable style={styles.heroTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {equippedSkin.name}
            </ThemedText>
            <ThemedText selectable style={styles.heroDescription} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
              {equippedSkin.description}
            </ThemedText>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeading}>
          <ThemedText selectable style={styles.sectionTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
            Choose your look
          </ThemedText>
          <ThemedText selectable style={styles.sectionCopy} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
            Every launch skin is yours to use.
          </ThemedText>
        </View>

        <View style={styles.grid}>
          {EGG_AVATAR_SKINS.map((skin) => {
            const selected = skin.id === equippedSkinId;
            return (
              <Pressable
                accessibilityLabel={`${skin.name} egg skin${selected ? ', selected' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={skin.id}
                onPress={() => handleSelect(skin)}
                style={({ pressed }) => [
                  styles.skinCard,
                  { width: cardWidth },
                  selected && { borderColor: skin.accent, borderWidth: 2 },
                  pressed && styles.skinCardPressed,
                ]}
              >
                <View style={[styles.skinPreview, { backgroundColor: `${skin.accent}22` }]}>
                  <EggAvatar presentation="grid" size={cardWidth - 28} skinId={skin.id} />
                  {selected ? (
                    <View style={[styles.check, { backgroundColor: skin.accent }]}>
                      <IconSymbol color="#FFF9EC" name="checkmark" size={15} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.skinCopy}>
                  <ThemedText selectable style={styles.skinName} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                    {skin.name}
                  </ThemedText>
                  <ThemedText selectable numberOfLines={2} style={styles.skinDescription} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    {skin.description}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#F4E5CB' },
  content: {
    alignItems: 'center',
    gap: 26,
    paddingBottom: 48,
    paddingHorizontal: Meadow.space.page,
    paddingTop: 14,
  },
  heroCard: {
    alignItems: 'center',
    borderColor: 'rgba(125,83,43,0.18)',
    borderCurve: 'continuous',
    borderRadius: 30,
    borderWidth: 1,
    boxShadow: '0 14px 34px rgba(71,45,21,0.20)',
    gap: 4,
    maxWidth: 520,
    overflow: 'hidden',
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 14,
    width: '100%',
  },
  heroHalo: {
    borderRadius: 999,
    height: 230,
    position: 'absolute',
    top: 40,
    width: 230,
  },
  heroCopy: { alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { fontFamily: 'InstrumentSerif', fontSize: 34, lineHeight: 40 },
  heroDescription: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  sectionHeading: { gap: 4, maxWidth: 520, width: '100%' },
  sectionTitle: { fontFamily: 'InstrumentSerif', fontSize: 27, lineHeight: 33 },
  sectionCopy: { fontSize: 13.5, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: 520, width: '100%' },
  skinCard: {
    backgroundColor: '#E8CFAB',
    borderColor: 'rgba(120,78,38,0.18)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 7px 18px rgba(65,40,18,0.16)',
    overflow: 'hidden',
    padding: 8,
  },
  skinCardPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  skinPreview: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 17, justifyContent: 'center', overflow: 'hidden' },
  check: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, height: 27, justifyContent: 'center', position: 'absolute', right: 8, top: 8, width: 27 },
  skinCopy: { gap: 3, paddingHorizontal: 7, paddingBottom: 8, paddingTop: 8 },
  skinName: { fontSize: 15, fontWeight: '800' },
  skinDescription: { fontSize: 11.5, lineHeight: 16, minHeight: 32 },
});
