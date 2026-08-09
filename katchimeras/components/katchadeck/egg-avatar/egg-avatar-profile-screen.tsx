import * as Haptics from 'expo-haptics';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EGG_AVATAR_FACES } from '@/constants/egg-avatar-faces';
import { EGG_AVATAR_HATS } from '@/constants/egg-avatar-hats';
import { EGG_AVATAR_HELD_ACCESSORIES } from '@/constants/egg-avatar-held-accessories';
import { EGG_AVATAR_SKINS } from '@/constants/egg-avatar-skins';
import { homeTabBarHeight } from '@/constants/home-loop-layout';
import { Meadow } from '@/constants/meadow-theme';
import { READY_WISPS } from '@/constants/wisps';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { useWisps } from '@/features/wisps/wisp-provider';
import type { HomeDayRecord } from '@/types/home';
import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSkinId } from '@/types/egg-avatar';
import { eggAvatarCustomizerPanelHeight } from '@/utils/egg-avatar-customizer-camera';

type Category = 'body' | 'face' | 'hat' | 'held';
type YouMode = 'egg' | 'wisps';
type WispFilter = 'all' | 'life' | 'achieve' | 'special';
type Option = { id: string | null; name: string };
type GridItem =
  | { key: string; kind: 'egg'; option: Option }
  | { key: string; kind: 'wisp'; wisp: (typeof READY_WISPS)[number] };

const CATEGORIES: readonly { id: Category; label: string }[] = [
  { id: 'body', label: 'Body' }, { id: 'face', label: 'Face' }, { id: 'hat', label: 'Hats' }, { id: 'held', label: 'Held' },
];
const WISP_FILTERS: readonly { id: WispFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'life', label: 'Life' }, { id: 'achieve', label: 'Achieve' }, { id: 'special', label: 'Special' },
];
const GRID_COLUMNS = 4;
const GRID_GAP = 8;
const GRID_HORIZONTAL_PADDING = 14;
const PANEL_HORIZONTAL_BORDER = 2;

export function EggAvatarProfileScreen({ bottomInset = 0, days }: { bottomInset?: number; days: HomeDayRecord[] }) {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const avatar = useEggAvatar();
  const wisps = useWisps();
  const [mode, setMode] = useState<YouMode>('egg');
  const [category, setCategory] = useState<Category>('body');
  const [wispFilter, setWispFilter] = useState<WispFilter>('all');
  const syncWispsFromDays = wisps.syncFromDays;
  useEffect(() => { syncWispsFromDays(days); }, [days, syncWispsFromDays]);
  const tabBarHeight = homeTabBarHeight(bottomInset);
  const panelHeight = eggAvatarCustomizerPanelHeight(height);
  const cellWidth = (width - PANEL_HORIZONTAL_BORDER - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const options = useMemo<readonly Option[]>(() => category === 'body' ? EGG_AVATAR_SKINS : category === 'face' ? EGG_AVATAR_FACES : category === 'hat'
    ? [{ id: null, name: 'None' }, ...EGG_AVATAR_HATS]
    : [{ id: null, name: 'None' }, ...EGG_AVATAR_HELD_ACCESSORIES], [category]);
  const selectedId = category === 'body' ? avatar.equippedSkinId : category === 'face' ? avatar.equippedFaceId : category === 'hat' ? avatar.equippedHatId : avatar.equippedHeldAccessoryId;
  const visibleWisps = useMemo(() => READY_WISPS.filter((item) => wispFilter === 'all'
    || (wispFilter === 'life' && item.acquisition === 'experience')
    || (wispFilter === 'achieve' && item.acquisition === 'achievement')
    || (wispFilter === 'special' && !['experience', 'achievement'].includes(item.acquisition))), [wispFilter]);
  const gridItems = useMemo<readonly GridItem[]>(() => mode === 'egg'
    ? options.map((option) => ({ key: `egg:${option.id ?? 'none'}`, kind: 'egg' as const, option }))
    : visibleWisps.map((wisp) => ({ key: `wisp:${wisp.id}`, kind: 'wisp' as const, wisp })),
  [mode, options, visibleWisps]);

  const selectEgg = (id: string | null) => {
    if (id === selectedId) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (category === 'body') avatar.equipSkin(id as EggAvatarSkinId);
    else if (category === 'face') avatar.equipFace(id as EggAvatarFaceId);
    else if (category === 'hat') avatar.equipHat(id as EggAvatarHatId | null);
    else avatar.equipHeldAccessory(id as EggAvatarHeldAccessoryId | null);
  };

  return (
    <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} pointerEvents="auto" style={styles.screen}>
      <View style={[styles.panel, { bottom: tabBarHeight, height: panelHeight }]}>
        <View style={styles.grabber} />

        <View accessibilityRole="tablist" style={styles.modeTabs}>
          {(['egg', 'wisps'] as const).map((item) => {
            const active = mode === item;
            return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item} onPress={() => setMode(item)} style={[styles.modeTab, active && styles.modeTabActive]}>
              <ThemedText style={[styles.modeTabLabel, active && styles.modeTabLabelActive]} lightColor={active ? Meadow.ink : '#FFF1D7'} darkColor={active ? Meadow.ink : '#FFF1D7'}>{item === 'egg' ? 'Egg' : 'Wisps'}</ThemedText>
            </Pressable>;
          })}
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(mode === 'egg' ? CATEGORIES : WISP_FILTERS).map((item) => {
            const active = mode === 'egg' ? category === item.id : wispFilter === item.id;
            return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => mode === 'egg' ? setCategory(item.id as Category) : setWispFilter(item.id as WispFilter)} style={[styles.tab, active && styles.tabActive]}>
              <ThemedText style={[styles.tabLabel, active && styles.tabLabelActive]} lightColor={Meadow.ink} darkColor={Meadow.ink}>{item.label}</ThemedText>
            </Pressable>;
          })}
        </View>

        <FlashList
          contentContainerStyle={styles.grid}
          data={gridItems}
          keyExtractor={(item) => item.key}
          numColumns={GRID_COLUMNS}
          renderItem={({ item }) => {
            if (item.kind === 'egg') {
              const option = item.option;
            const selected = option.id === selectedId;
            const previewProps = categoryPreview(category, option.id, avatar);
              return <Pressable accessibilityLabel={`${option.name}${selected ? ', selected' : ''}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectEgg(option.id)} style={({ pressed }) => [styles.item, { width: cellWidth }, selected && { borderColor: avatar.equippedSkin.accent, borderWidth: 2 }, pressed && styles.itemPressed]}>
              <View style={[styles.itemPreview, { height: cellWidth - 12, backgroundColor: `${avatar.equippedSkin.accent}1C` }]}>
                {option.id == null ? <IconSymbol color={Meadow.inkSoft} name="nosign" size={24} /> : <EggAvatar presentation="grid" size={cellWidth - 18} {...previewProps} />}
                {selected ? <View style={[styles.check, { backgroundColor: avatar.equippedSkin.accent }]}><IconSymbol color="#FFF9EC" name="checkmark" size={11} /></View> : null}
              </View>
              <ThemedText selectable numberOfLines={1} style={styles.itemLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.name}</ThemedText>
            </Pressable>;
            }
            const owned = wisps.isOwned(item.wisp.id);
            const equipped = wisps.equippedWispId === item.wisp.id;
            const progress = wisps.progressFor(item.wisp.id, days);
            return <Pressable accessibilityLabel={`${item.wisp.name}${owned ? ', discovered' : `, ${progress.current} of ${progress.target}`}${equipped ? ', equipped' : ''}`} accessibilityRole="button" accessibilityState={{ selected: equipped }} onPress={() => router.push({ pathname: '/wisp/[wispId]', params: { wispId: item.wisp.id } })} style={({ pressed }) => [styles.item, { width: cellWidth }, equipped && styles.wispEquipped, pressed && styles.itemPressed]}>
              <View style={[styles.itemPreview, { height: cellWidth - 12, backgroundColor: `${avatar.equippedSkin.accent}1C` }]}>
                <WispArtwork id={item.wisp.id} size={cellWidth - 22} thumbnail silhouette={!owned} />
                {equipped ? <View style={[styles.check, { backgroundColor: avatar.equippedSkin.accent }]}><IconSymbol color="#FFF9EC" name="checkmark" size={11} /></View> : null}
                {!owned ? <View style={styles.progressBadge}><ThemedText style={styles.progressText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{progress.current}/{progress.target}</ThemedText></View> : null}
              </View>
              <ThemedText selectable numberOfLines={1} style={styles.itemLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{owned ? item.wisp.name : item.wisp.hidden ? '???' : item.wisp.name}</ThemedText>
            </Pressable>;
          }}
          showsVerticalScrollIndicator={false}
          style={styles.gridScroll}
        />
      </View>
    </Animated.View>
  );
}

function categoryPreview(category: Category, id: string | null, avatar: ReturnType<typeof useEggAvatar>) {
  if (category === 'body') return { skinId: id as EggAvatarSkinId, faceId: avatar.equippedFaceId, hatId: null, heldAccessoryId: null };
  if (category === 'face') return { skinId: avatar.equippedSkinId, faceId: id as EggAvatarFaceId, hatId: null, heldAccessoryId: null };
  if (category === 'hat') return { skinId: avatar.equippedSkinId, faceId: avatar.equippedFaceId, hatId: id as EggAvatarHatId, heldAccessoryId: null };
  return { skinId: avatar.equippedSkinId, faceId: avatar.equippedFaceId, hatId: null, heldAccessoryId: id as EggAvatarHeldAccessoryId };
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, elevation: 100, zIndex: 100 },
  panel: { backgroundColor: 'rgba(248,235,210,0.97)', borderColor: 'rgba(125,83,43,0.18)', borderCurve: 'continuous', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, boxShadow: '0 -14px 34px rgba(22,16,13,0.24)', gap: 6, left: 0, overflow: 'hidden', paddingTop: 6, position: 'absolute', right: 0 },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(97,66,38,0.25)', borderRadius: 99, height: 4, width: 34 },
  modeTabs: { alignSelf: 'center', backgroundColor: 'rgba(70,49,30,0.9)', borderRadius: 14, flexDirection: 'row', padding: 2, width: 196 },
  modeTab: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 34, paddingVertical: 5 },
  modeTabActive: { backgroundColor: '#FFF1D7' },
  modeTabLabel: { fontSize: 13, fontWeight: '800', opacity: 0.78 },
  modeTabLabelActive: { opacity: 1 },
  tabs: { backgroundColor: 'rgba(125,83,43,0.11)', borderRadius: 13, flexDirection: 'row', marginHorizontal: 14, padding: 2 },
  tab: { alignItems: 'center', borderRadius: 11, flex: 1, justifyContent: 'center', minHeight: 32, paddingVertical: 4 },
  tabActive: { backgroundColor: '#FFF5E2', boxShadow: '0 2px 8px rgba(71,45,21,0.13)' },
  tabLabel: { fontSize: 11.5, fontWeight: '800', opacity: 0.58 },
  tabLabelActive: { opacity: 1 },
  gridScroll: { flex: 1, minHeight: 0 },
  grid: { paddingBottom: 20, paddingHorizontal: GRID_HORIZONTAL_PADDING },
  item: { backgroundColor: 'rgba(232,207,171,0.76)', borderColor: 'rgba(120,78,38,0.14)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, gap: 3, marginBottom: GRID_GAP, overflow: 'hidden', padding: 5 },
  itemPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  wispEquipped: { backgroundColor: 'rgba(255,244,218,0.96)', borderColor: 'rgba(89,123,78,0.58)', borderWidth: 2 },
  itemPreview: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  itemLabel: { fontSize: 10.5, fontWeight: '800', paddingBottom: 3, paddingHorizontal: 2, textAlign: 'center' },
  check: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, height: 21, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 21 },
  progressBadge: { backgroundColor: 'rgba(255,247,228,0.9)', borderRadius: 8, bottom: 4, paddingHorizontal: 5, paddingVertical: 2, position: 'absolute', right: 4 },
  progressText: { fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
