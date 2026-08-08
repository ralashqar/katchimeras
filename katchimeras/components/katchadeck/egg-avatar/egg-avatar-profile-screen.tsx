import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EGG_AVATAR_FACES } from '@/constants/egg-avatar-faces';
import { EGG_AVATAR_HATS } from '@/constants/egg-avatar-hats';
import { EGG_AVATAR_HELD_ACCESSORIES } from '@/constants/egg-avatar-held-accessories';
import { EGG_AVATAR_SKINS } from '@/constants/egg-avatar-skins';
import { homeTabBarHeight } from '@/constants/home-loop-layout';
import { Meadow } from '@/constants/meadow-theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSkinId } from '@/types/egg-avatar';

type Category = 'body' | 'face' | 'hat' | 'held';
type Option = { id: string | null; name: string };

const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'face', label: 'Face' },
  { id: 'hat', label: 'Hats' },
  { id: 'held', label: 'Held' },
];

const GRID_COLUMNS = 4;
const GRID_GAP = 8;
const GRID_HORIZONTAL_PADDING = 14;
const PANEL_HORIZONTAL_BORDER = 2;

export function EggAvatarProfileScreen({ bottomInset = 0 }: { bottomInset?: number }) {
  const { height, width } = useWindowDimensions();
  const avatar = useEggAvatar();
  const [category, setCategory] = useState<Category>('body');
  const tabBarHeight = homeTabBarHeight(bottomInset);
  const panelHeight = Math.min(430, Math.max(320, height * 0.46));
  const cellWidth = (
    width
    - PANEL_HORIZONTAL_BORDER
    - GRID_HORIZONTAL_PADDING * 2
    - GRID_GAP * (GRID_COLUMNS - 1)
  ) / GRID_COLUMNS;

  const options: readonly Option[] = category === 'body'
    ? EGG_AVATAR_SKINS
    : category === 'face'
      ? EGG_AVATAR_FACES
      : category === 'hat'
        ? [{ id: null, name: 'None' }, ...EGG_AVATAR_HATS]
        : [{ id: null, name: 'None' }, ...EGG_AVATAR_HELD_ACCESSORIES];

  const selectedId = category === 'body'
    ? avatar.equippedSkinId
    : category === 'face'
      ? avatar.equippedFaceId
      : category === 'hat'
        ? avatar.equippedHatId
        : avatar.equippedHeldAccessoryId;

  const select = (id: string | null) => {
    if (id === selectedId) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (category === 'body') avatar.equipSkin(id as EggAvatarSkinId);
    else if (category === 'face') avatar.equipFace(id as EggAvatarFaceId);
    else if (category === 'hat') avatar.equipHat(id as EggAvatarHatId | null);
    else avatar.equipHeldAccessory(id as EggAvatarHeldAccessoryId | null);
  };

  return (
    <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} pointerEvents="box-none" style={styles.screen}>
      <View style={[styles.panel, { bottom: tabBarHeight, height: panelHeight }]}>
        <View style={styles.grabber} />
        <View style={styles.heading}>
          <View>
            <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>YOUR EGG</ThemedText>
            <ThemedText selectable numberOfLines={1} style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {avatar.equippedSkin.name} · {avatar.equippedFace.name}
            </ThemedText>
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {CATEGORIES.map((item) => {
            const active = category === item.id;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item.id}
                onPress={() => setCategory(item.id)}
                style={[styles.tab, active && styles.tabActive]}>
                <ThemedText style={[styles.tabLabel, active && styles.tabLabelActive]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.grid}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const selected = option.id === selectedId;
            const previewProps = categoryPreview(category, option.id, avatar);
            return (
              <Pressable
                accessibilityLabel={`${option.name}${selected ? ', selected' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.id ?? 'none'}
                onPress={() => select(option.id)}
                style={({ pressed }) => [
                  styles.item,
                  { width: cellWidth },
                  selected && { borderColor: avatar.equippedSkin.accent, borderWidth: 2 },
                  pressed && styles.itemPressed,
                ]}>
                <View style={[styles.itemPreview, { height: cellWidth - 12, backgroundColor: `${avatar.equippedSkin.accent}1C` }]}>
                  {option.id == null ? (
                    <IconSymbol color={Meadow.inkSoft} name="nosign" size={24} />
                  ) : (
                    <EggAvatar presentation="grid" size={cellWidth - 18} {...previewProps} />
                  )}
                  {selected ? <View style={[styles.check, { backgroundColor: avatar.equippedSkin.accent }]}><IconSymbol color="#FFF9EC" name="checkmark" size={11} /></View> : null}
                </View>
                <ThemedText selectable numberOfLines={1} style={styles.itemLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.name}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function categoryPreview(category: Category, id: string | null, avatar: ReturnType<typeof useEggAvatar>) {
  if (category === 'body') return {
    skinId: id as EggAvatarSkinId,
    faceId: avatar.equippedFaceId,
    hatId: null,
    heldAccessoryId: null,
  };
  if (category === 'face') return {
    skinId: avatar.equippedSkinId,
    faceId: id as EggAvatarFaceId,
    hatId: null,
    heldAccessoryId: null,
  };
  if (category === 'hat') return {
    skinId: avatar.equippedSkinId,
    faceId: avatar.equippedFaceId,
    hatId: id as EggAvatarHatId,
    heldAccessoryId: null,
  };
  return {
    skinId: avatar.equippedSkinId,
    faceId: avatar.equippedFaceId,
    hatId: null,
    heldAccessoryId: id as EggAvatarHeldAccessoryId,
  };
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, elevation: 100, zIndex: 100 },
  panel: { backgroundColor: 'rgba(248,235,210,0.97)', borderColor: 'rgba(125,83,43,0.18)', borderCurve: 'continuous', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, boxShadow: '0 -14px 34px rgba(22,16,13,0.24)', gap: 10, left: 0, overflow: 'hidden', paddingTop: 8, position: 'absolute', right: 0 },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(97,66,38,0.25)', borderRadius: 99, height: 4, width: 38 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontFamily: 'InstrumentSerif', fontSize: 25, lineHeight: 29 },
  tabs: { backgroundColor: 'rgba(125,83,43,0.11)', borderRadius: 15, flexDirection: 'row', marginHorizontal: 14, padding: 3 },
  tab: { alignItems: 'center', borderRadius: 12, flex: 1, paddingVertical: 8 },
  tabActive: { backgroundColor: '#FFF5E2', boxShadow: '0 2px 8px rgba(71,45,21,0.13)' },
  tabLabel: { fontSize: 12.5, fontWeight: '800', opacity: 0.58 },
  tabLabelActive: { opacity: 1 },
  grid: { columnGap: GRID_GAP, flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 20, paddingHorizontal: GRID_HORIZONTAL_PADDING, rowGap: GRID_GAP },
  item: { backgroundColor: 'rgba(232,207,171,0.76)', borderColor: 'rgba(120,78,38,0.14)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, gap: 3, overflow: 'hidden', padding: 5 },
  itemPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  itemPreview: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  itemLabel: { fontSize: 10.5, fontWeight: '800', paddingBottom: 3, paddingHorizontal: 2, textAlign: 'center' },
  check: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, height: 21, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 21 },
});
