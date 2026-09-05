import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { VisitorChoiceCard } from '@/components/katchadeck/wisps/visitor-choice-card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EGG_AVATAR_FACES } from '@/constants/egg-avatar-faces';
import { EGG_AVATAR_HATS } from '@/constants/egg-avatar-hats';
import { EGG_AVATAR_HELD_ACCESSORIES } from '@/constants/egg-avatar-held-accessories';
import { EGG_AVATAR_SKINS } from '@/constants/egg-avatar-skins';
import { Meadow } from '@/constants/meadow-theme';
import { READY_WISPS } from '@/constants/wisps';
import { SCENE_CATALOG } from '@/constants/scenes';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { useWisps } from '@/features/wisps/wisp-provider';
import { useScenes } from '@/features/scenes/scene-provider';
import { useEconomy } from '@/features/economy/economy-provider';
import type { HomeDayRecord } from '@/types/home';
import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSkinId } from '@/types/egg-avatar';
import { eggAvatarCustomizerPanelHeight } from '@/utils/egg-avatar-customizer-camera';

type Category = 'body' | 'face' | 'hat' | 'held';
type YouMode = 'egg' | 'wisps' | 'scenes';
type WispFilter = 'all' | 'life' | 'achieve' | 'special';
type Option = { id: string | null; name: string };
type GridItem =
  | { key: string; kind: 'egg'; option: Option }
  | { key: string; kind: 'wisp'; wisp: (typeof READY_WISPS)[number] }
  | { key: string; kind: 'scene'; scene: (typeof SCENE_CATALOG)[number] };

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
  const scenes = useScenes();
  const economy = useEconomy();
  const [mode, setMode] = useState<YouMode>('egg');
  const [category, setCategory] = useState<Category>('body');
  const [wispFilter, setWispFilter] = useState<WispFilter>('all');
  const syncWispsFromDays = wisps.syncFromDays;
  const syncScenesFromDays = scenes.syncFromDays;
  useEffect(() => { syncWispsFromDays(days); }, [days, syncWispsFromDays]);
  useEffect(() => { syncScenesFromDays(days); }, [days, syncScenesFromDays]);
  const tabBarHeight = Math.max(bottomInset, 12);
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
    : mode === 'wisps'
      ? visibleWisps.map((wisp) => ({ key: `wisp:${wisp.id}`, kind: 'wisp' as const, wisp }))
      : SCENE_CATALOG.map((scene) => ({ key: `scene:${scene.id}`, kind: 'scene' as const, scene })),
  [mode, options, visibleWisps]);

  const equipEgg = (id: string | null) => {
    if (id === selectedId) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    if (category === 'body') avatar.equipSkin(id as EggAvatarSkinId);
    else if (category === 'face') avatar.equipFace(id as EggAvatarFaceId);
    else if (category === 'hat') avatar.equipHat(id as EggAvatarHatId | null);
    else avatar.equipHeldAccessory(id as EggAvatarHeldAccessoryId | null);
  };

  const selectEgg = (id: string | null) => {
    if (id == null) { equipEgg(null); return; }
    const catalogItem = (category === 'body' ? EGG_AVATAR_SKINS : category === 'face' ? EGG_AVATAR_FACES : category === 'hat' ? EGG_AVATAR_HATS : EGG_AVATAR_HELD_ACCESSORIES).find((item) => item.id === id);
    if (!catalogItem) return;
    const access = economy.avatarAccess({ category, itemId: id, rarity: catalogItem.rarity, access: catalogItem.access });
    if (access.hasAccess) { equipEgg(id); return; }
    if (access.source === 'locked-plus') {
      router.push('/modal');
      return;
    }
    Alert.alert(
      `Unlock ${catalogItem.name}?`,
      `${access.price} Essence · Your balance is ${economy.snapshot.essenceBalance}.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Unlock', onPress: () => { void economy.purchaseAvatar({ category, itemId: id, rarity: catalogItem.rarity, access: catalogItem.access }).then((result) => { if (result.ok) equipEgg(id); else Alert.alert('Could not unlock', result.reason === 'insufficient_essence' ? 'You need a little more Essence.' : 'Please try again when you are online.'); }); } },
      ],
    );
  };

  return (
    <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} pointerEvents="auto" style={styles.screen}>
      <View style={[styles.panel, { bottom: tabBarHeight, height: panelHeight }]}>
        <View style={styles.grabber} />

        <View style={styles.economyBar}>
          <ThemedText selectable style={styles.balance} lightColor={Meadow.ink} darkColor={Meadow.ink}>✦ {economy.snapshot.essenceBalance}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => router.push('/modal')} style={({ pressed }) => [styles.plusPill, economy.snapshot.activePlus && styles.plusPillActive, pressed && styles.itemPressed]}>
            <ThemedText style={styles.plusLabel} lightColor="#FFF8E7" darkColor="#FFF8E7">{economy.snapshot.activePlus ? 'PLUS ACTIVE' : 'KATCHIMERAS PLUS'}</ThemedText>
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={styles.modeTabs}>
          {(['egg', 'wisps', 'scenes'] as const).map((item) => {
            const active = mode === item;
            return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item} onPress={() => setMode(item)} style={[styles.modeTab, active && styles.modeTabActive]}>
              <ThemedText style={[styles.modeTabLabel, active && styles.modeTabLabelActive]} lightColor={active ? Meadow.ink : '#FFF1D7'} darkColor={active ? Meadow.ink : '#FFF1D7'}>{item === 'egg' ? 'Egg' : item === 'wisps' ? 'Wisps' : 'Scenes'}</ThemedText>
            </Pressable>;
          })}
        </View>

        {mode !== 'scenes' ? <View accessibilityRole="tablist" style={styles.tabs}>
          {(mode === 'egg' ? CATEGORIES : WISP_FILTERS).map((item) => {
            const active = mode === 'egg' ? category === item.id : wispFilter === item.id;
            return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => mode === 'egg' ? setCategory(item.id as Category) : setWispFilter(item.id as WispFilter)} style={[styles.tab, active && styles.tabActive]}>
              <ThemedText style={[styles.tabLabel, active && styles.tabLabelActive]} lightColor={Meadow.ink} darkColor={Meadow.ink}>{item.label}</ThemedText>
            </Pressable>;
          })}
        </View> : <View style={styles.sceneHint}><ThemedText selectable style={styles.sceneHintText} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>Choose an unlocked cinematic environment for Today.</ThemedText></View>}

        {mode === 'wisps' ? <VisitorChoiceCard /> : null}

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
            const catalogItem = option.id == null ? null : (category === 'body' ? EGG_AVATAR_SKINS : category === 'face' ? EGG_AVATAR_FACES : category === 'hat' ? EGG_AVATAR_HATS : EGG_AVATAR_HELD_ACCESSORIES).find((entry) => entry.id === option.id);
            const access = catalogItem ? economy.avatarAccess({ category, itemId: option.id!, rarity: catalogItem.rarity, access: catalogItem.access }) : null;
            const owned = access?.hasAccess ?? true;
              return <Pressable accessibilityLabel={`${option.name}${selected ? ', selected' : ''}${owned ? '' : ', locked'}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectEgg(option.id)} style={({ pressed }) => [styles.item, { width: cellWidth }, !owned && styles.itemLocked, selected && { borderColor: avatar.equippedSkin.accent, borderWidth: 2 }, pressed && styles.itemPressed]}>
              <View style={[styles.itemPreview, { height: cellWidth - 12, backgroundColor: `${avatar.equippedSkin.accent}1C` }]}>
                {option.id == null ? <IconSymbol color={Meadow.inkSoft} name="nosign" size={24} /> : <EggAvatar presentation="grid" size={cellWidth - 18} {...previewProps} />}
                {selected ? <View style={[styles.check, { backgroundColor: avatar.equippedSkin.accent }]}><IconSymbol color="#FFF9EC" name="checkmark" size={11} /></View> : null}
                {!owned ? <View style={styles.lock}><IconSymbol color="#FFF9EC" name="lock.fill" size={10} /></View> : null}
                {!owned && access ? <View style={styles.priceBadge}><ThemedText style={styles.priceText} lightColor={Meadow.ink} darkColor={Meadow.ink}>{access.source === 'locked-plus' ? 'PLUS' : `✦ ${access.price}`}</ThemedText></View> : null}
              </View>
              <ThemedText selectable numberOfLines={1} style={styles.itemLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{option.name}</ThemedText>
            </Pressable>;
            }
            if (item.kind === 'scene') {
              const owned = scenes.isOwned(item.scene.id);
              const equipped = scenes.equippedSceneId === item.scene.id;
              return <Pressable
                accessibilityLabel={`${item.scene.name}${owned ? ', discovered' : ', undiscovered'}${equipped ? ', equipped' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !owned, selected: equipped }}
                disabled={!owned}
                onPress={() => {
                  if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                  scenes.equip(item.scene.id);
                }}
                style={({ pressed }) => [styles.item, styles.sceneItem, { width: cellWidth }, !owned && styles.itemLocked, equipped && styles.sceneEquipped, pressed && styles.itemPressed]}>
                <View style={[styles.itemPreview, styles.scenePreview, { height: cellWidth - 12 }]}>
                  <Image contentFit="cover" source={TODAY_EXPLORATION_BACKGROUND_SOURCES[item.scene.id].source} style={StyleSheet.absoluteFill} transition={0} />
                  {equipped ? <View style={[styles.check, { backgroundColor: avatar.equippedSkin.accent }]}><IconSymbol color="#FFF9EC" name="checkmark" size={11} /></View> : null}
                  {!owned ? <View style={styles.lock}><IconSymbol color="#FFF9EC" name="lock.fill" size={10} /></View> : null}
                </View>
                <ThemedText selectable numberOfLines={1} style={styles.itemLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>{owned ? item.scene.name : 'Undiscovered'}</ThemedText>
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
  economyBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 26, paddingHorizontal: 14 },
  balance: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '900' },
  plusPill: { backgroundColor: '#5C4633', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  plusPillActive: { backgroundColor: '#667A4D' },
  plusLabel: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  modeTabs: { alignSelf: 'center', backgroundColor: 'rgba(70,49,30,0.9)', borderRadius: 14, flexDirection: 'row', padding: 2, width: 286 },
  modeTab: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 34, paddingVertical: 5 },
  modeTabActive: { backgroundColor: '#FFF1D7' },
  modeTabLabel: { fontSize: 13, fontWeight: '800', opacity: 0.78 },
  modeTabLabelActive: { opacity: 1 },
  tabs: { backgroundColor: 'rgba(125,83,43,0.11)', borderRadius: 13, flexDirection: 'row', marginHorizontal: 14, padding: 2 },
  tab: { alignItems: 'center', borderRadius: 11, flex: 1, justifyContent: 'center', minHeight: 32, paddingVertical: 4 },
  tabActive: { backgroundColor: '#FFF5E2', boxShadow: '0 2px 8px rgba(71,45,21,0.13)' },
  tabLabel: { fontSize: 11.5, fontWeight: '800', opacity: 0.58 },
  tabLabelActive: { opacity: 1 },
  sceneHint: { alignItems: 'center', minHeight: 36, paddingHorizontal: 18, paddingVertical: 8 },
  sceneHintText: { fontSize: 11.5, textAlign: 'center' },
  gridScroll: { flex: 1, minHeight: 0 },
  grid: { paddingBottom: 20, paddingHorizontal: GRID_HORIZONTAL_PADDING },
  item: { backgroundColor: 'rgba(232,207,171,0.76)', borderColor: 'rgba(120,78,38,0.14)', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, gap: 3, marginBottom: GRID_GAP, overflow: 'hidden', padding: 5 },
  itemPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  itemLocked: { opacity: 0.58 },
  lock: { alignItems: 'center', backgroundColor: 'rgba(49,36,27,0.76)', borderRadius: 999, height: 21, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 21 },
  wispEquipped: { backgroundColor: 'rgba(255,244,218,0.96)', borderColor: 'rgba(89,123,78,0.58)', borderWidth: 2 },
  sceneItem: { backgroundColor: 'rgba(224,199,163,0.86)' },
  sceneEquipped: { backgroundColor: 'rgba(255,244,218,0.96)', borderColor: 'rgba(89,123,78,0.72)', borderWidth: 2 },
  scenePreview: { backgroundColor: '#6F8063' },
  itemPreview: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 12, justifyContent: 'center', overflow: 'hidden' },
  itemLabel: { fontSize: 10.5, fontWeight: '800', paddingBottom: 3, paddingHorizontal: 2, textAlign: 'center' },
  check: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.72)', borderRadius: 999, borderWidth: 1, height: 21, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 21 },
  progressBadge: { backgroundColor: 'rgba(255,247,228,0.9)', borderRadius: 8, bottom: 4, paddingHorizontal: 5, paddingVertical: 2, position: 'absolute', right: 4 },
  progressText: { fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '900' },
  priceBadge: { backgroundColor: 'rgba(255,247,228,0.94)', borderRadius: 8, bottom: 4, left: 4, paddingHorizontal: 5, paddingVertical: 2, position: 'absolute' },
  priceText: { fontSize: 8, fontWeight: '900' },
});
