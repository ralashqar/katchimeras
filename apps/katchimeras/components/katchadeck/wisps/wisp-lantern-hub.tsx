import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { AppFontFamilies } from '@/constants/theme';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { LANTERN_LEVEL_ART } from '@/constants/wisp-lantern-art';
import { LANTERN_LEVELS, LANTERN_RECURRING_ORDERS, lanternLevel, lanternResidentCapacity } from '@/constants/wisp-lantern-levels';
import { LANTERN_VISITORS } from '@/constants/wisp-lantern';
import { WISP_CARD_ART, WISP_RARITY } from '@/constants/wisp-card-art';
import { albumPhase, albumWisps, wispAlbums, type WispAlbum } from '@/constants/wisp-albums';
import { wispDefinition } from '@/constants/wisps';
import { canUpgradeLantern, lanternDay } from '@/features/wisps/lantern-world';
import { lanternPackGroups, packOddsText } from '@/utils/wisp-lantern-hub';
import { gameNow } from '@/utils/game-clock';
import type { MergeWorldState } from '@/types/merge-world';
import type { WispCollectionState, WispId } from '@/types/wisp';
import type { WispLanternCommand, WispPackDefinition } from '@/types/wisp-lantern';
import { WispCollectionDeck } from './wisp-card-deck';
import { WispCollectionCard } from './wisp-collection-card';
import { WispCompanion } from './wisp-companion';

type Page = { kind: 'home' } | { kind: 'echoes' } | { kind: 'pack'; definition: WispPackDefinition } | { kind: 'album'; album: WispAlbum } | { kind: 'discoveries' };
export function WispLanternHub({ world, state, ownedIds, pending, errorView, onClose, onGarden, onOpen, onCommand, onOpenUpgrade, onResidents, onEquip, initialTab = 'packs' }: {
  world: MergeWorldState; state: WispCollectionState; ownedIds: WispId[]; pending: boolean; errorView: ReactNode;
  onClose: () => void; onGarden: () => void; onOpen: (id: string) => void;
  onCommand: (command: WispLanternCommand) => void;
  /** Growing the Lantern happens on the shared upgrade stage, out in the world. */
  onOpenUpgrade: () => void; onResidents: (ids: WispId[]) => void; onEquip: (id: WispId) => void;
  initialTab?: 'packs' | 'collection';
}) {
  const [tab, setTab] = useState<'packs' | 'collection'>(initialTab);
  const [page, setPage] = useState<Page>({ kind: 'home' });
  const [selected, setSelected] = useState<WispId | null>(null);
  const [now, setNow] = useState(gameNow);
  useEffect(() => { const timer = setInterval(() => setNow(gameNow()), 30000); return () => clearInterval(timer); }, []);
  const reduced = useReducedMotion();
  const compact = useWindowDimensions().width < 360;
  const progress = world.wispLanternProgress;
  const level = lanternLevel(progress?.level);
  const previousLevel = useRef(level);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (level > previousLevel.current) setCelebrating(true);
    previousLevel.current = level;
    const timer = setTimeout(() => setCelebrating(false), 1150);
    return () => clearTimeout(timer);
  }, [level]);
  const lantern = state.lantern;
  const albums = wispAlbums(lantern?.previewSeasonStartedAt);
  const active = albums.find(a => a.seasonal && ['active', 'claim'].includes(albumPhase(a, now)));
  const groups = lanternPackGroups(lantern, now);
  const discoveries = ownedIds.filter(id => !['cosmetic', 'seasonal'].includes(wispDefinition(id).semanticClass));
  const count = (ids: readonly WispId[]) => ids.filter(id => ownedIds.includes(id)).length;
  const button = (label: string, action: () => void, disabled = false) => <KatchaButton fullWidth label={label} disabled={pending || disabled} onPress={action} />;
  const back = () => selected ? setSelected(null) : setPage({ kind: 'home' });
  const title = selected ? wispDefinition(selected).name : page.kind === 'home' ? 'Wisp Lantern' : page.kind === 'echoes' ? 'Wisp Echoes' : page.kind === 'album' ? page.album.name : page.kind === 'pack' ? page.definition.name ?? 'Inside your pack' : 'Our discoveries';
  const albumRow = (album: WispAlbum) => {
    const ids = albumWisps(album); const phase = albumPhase(album, now);
    const deadline = phase === 'claim' ? album.claimEndsAt : album.endsAt;
    return <Pressable key={album.id} accessibilityRole="button" accessibilityLabel={`View ${album.name}`} onPress={() => setPage({ kind: 'album', album })} style={styles.albumRow}>
      <Image source={WISP_CARD_ART.pack} style={styles.albumArt} contentFit="contain" />
      <View style={styles.flex}><Text style={styles.name}>{album.name}</Text><Text style={styles.small}>{count(ids)} / {ids.length} collected · {phase === 'permanent' ? 'Permanent' : phase === 'archived' ? 'Archived' : phase === 'upcoming' ? 'Coming soon' : `${Math.max(1, Math.ceil((deadline! - now) / 86400000))} days ${phase === 'claim' ? 'to claim' : 'left'}`}</Text><Text style={styles.reward}>{album.reward.label}</Text></View><Text style={styles.chevron}>›</Text>
    </Pressable>;
  };
  const residentIds = lantern?.residents ?? [];
  const residentLimit = lanternResidentCapacity(level);
  const home = <>
    <View style={styles.lanternHeader}>
      <View style={[styles.lanternStage, compact && { width: 80, height: 112 }]}><Image source={LANTERN_LEVEL_ART[level]} style={[styles.lanternArt, compact && { width: 80, height: 96 }]} contentFit="contain" transition={reduced ? 0 : 250} />
        {celebrating && !reduced ? <CelebrationParticles tier={3} tint="#EBC46B" /> : null}
        <View style={styles.residents}>{residentIds.map(id => <WispCompanion key={id} id={id} size={22} />)}</View>
      </View>
      <View style={styles.flex}><Text style={styles.eyebrow}>LEVEL {level} · {LANTERN_LEVELS[level - 1].name.toUpperCase()}</Text><Text style={styles.body}>{level === 3 ? 'Your bonus packs guarantee a Rare or better.' : level === 1 ? 'Next: bonus packs and another Wisp at home.' : 'Next: a Rare in every bonus pack.'}</Text><KatchaButton label={level === 3 ? 'View levels' : canUpgradeLantern(progress) ? 'Upgrade ready' : 'Upgrade'} size="compact" variant="secondary" onPress={onOpenUpgrade} /></View>
    </View>
    <View accessibilityRole="tablist" style={styles.tabs}>{(['packs', 'collection'] as const).map(id => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === id }} key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.activeTab]}><Text style={styles.name}>{id === 'packs' ? 'Packs' : 'Collection'}</Text></Pressable>)}</View>
    {tab === 'packs' ? <>
      <Text style={styles.eyebrow}>YOUR PACKS</Text>
      {groups.map(group => <View key={group.key} style={styles.packRow}>
        <Image source={WISP_CARD_ART.pack} style={[styles.packArt, compact && { width: 40, height: 65 }]} contentFit="contain" />
        <View style={styles.flex}><Text style={styles.name}>{group.definition.name ?? 'Welcome pack'} <Text style={styles.quantity}>×{group.packs.length}</Text></Text><Text style={styles.small}>{group.definition.slots} {group.definition.slots === 1 ? 'card' : 'cards'} · {albums.find(a => a.id === group.definition.collectionId)?.seasonal ? 'Seasonal' : 'Permanent'}</Text>{group.definition.guaranteedRarity ? <Text style={styles.reward}>Rare or better guaranteed</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Details for ${group.definition.name ?? 'Welcome pack'}`} onPress={() => setPage({ kind: 'pack', definition: group.definition })} style={styles.detailLink}><Text style={styles.link}>Pack details ⓘ</Text></Pressable></View>
        <KatchaButton label="Open" size="compact" disabled={pending} onPress={() => onOpen(group.packs[0].id)} />
      </View>)}
      {!groups.length ? <View style={styles.empty}><Text style={styles.body}>Little lights are waiting in the Garden.</Text>{button('Go to Garden', onGarden)}</View> : null}
      {active ? albumRow(active) : null}
      <View style={styles.rule}><Text style={styles.eyebrow}>NEXT FREE PACK</Text><Text style={styles.body}>Garden orders: {progress && lanternDay(now) <= progress.day ? progress.dailyOrders : 0} / 5 today</Text>{level >= 2 ? <Text style={styles.small}>{level === 3 ? 'Rare bonus' : 'Bonus pack'}: {progress?.recurringOrders ?? 0} / {LANTERN_RECURRING_ORDERS} orders · carries across days</Text> : <Text style={styles.small}>Level 2 unlocks a second, ongoing pack reward.</Text>}{groups.length ? <KatchaButton label="Go to Garden" variant="secondary" size="compact" onPress={onGarden} /> : null}</View>
    </> : <>
      {albums.filter(a => !a.seasonal).map(albumRow)}
      {active ? albumRow(active) : null}
      {albums.filter(a => a.seasonal && a !== active && albumPhase(a, now) === 'archived').map(albumRow)}
      <Pressable accessibilityRole="button" onPress={() => setPage({ kind: 'discoveries' })} style={styles.albumRow}><View style={styles.flex}><Text style={styles.name}>Our discoveries</Text><Text style={styles.small}>{discoveries.length} Wisps earned through your own moments</Text></View><Text style={styles.chevron}>›</Text></Pressable>
    </>}
  </>;
  return <View style={styles.shell}>
    <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, styles.flex]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={selected || page.kind !== 'home' ? 'Back to collection' : 'Close collection'} hitSlop={8} style={styles.close} onPress={selected || page.kind !== 'home' ? back : onClose}><Text style={styles.chevron}>{selected || page.kind !== 'home' ? '‹' : '×'}</Text></Pressable></View>
    {/* Home stays mounted while inspecting details so its scroll position survives. */}
    <ScrollView style={page.kind !== 'home' || selected ? styles.hidden : undefined} contentContainerStyle={styles.content}>{home}</ScrollView>
    {page.kind !== 'home' || selected ? <ScrollView key={selected ?? page.kind} contentContainerStyle={styles.content}>
      {selected ? <>
        <View style={styles.center}><WispCollectionCard wispId={selected} width={190} owned={ownedIds.includes(selected)} /></View><Text style={styles.body}>{wispDefinition(selected).description}</Text><Text style={styles.small}>{WISP_RARITY[wispDefinition(selected).rarity].label}</Text>
        {ownedIds.includes(selected) ? <>{button(state.equippedWispId === selected ? 'Following you' : 'Follow me', () => onEquip(selected), state.equippedWispId === selected)}{button(residentIds.includes(selected) ? 'Rest elsewhere' : residentIds.length >= residentLimit ? 'Lantern is full' : 'Live at the Lantern', () => onResidents(residentIds.includes(selected) ? residentIds.filter(id => id !== selected) : [...residentIds, selected]), !residentIds.includes(selected) && residentIds.length >= residentLimit)}<Text style={styles.small}>{residentIds.length} / {residentLimit} residents</Text></> : (LANTERN_VISITORS as readonly string[]).includes(selected) ? button('Invite · 15 Echoes', () => onCommand({ type: 'exchange', receiptId: `lantern:invite:${selected}`, wispId: selected }), (lantern?.echoes ?? 0) < 15) : <Text style={styles.body}>{wispDefinition(selected).packEligible ? 'Find this visitor in its collection’s Wisp packs.' : 'Earn this Wisp through its own discovery.'}</Text>}
      </> : page.kind === 'pack' ? <><Image source={WISP_CARD_ART.pack} style={styles.upgradeArt} contentFit="contain" /><Text style={styles.body}>{packOddsText(page.definition)}</Text></> : page.kind === 'album' ? <>
        <Text style={styles.body}>{page.album.description}</Text><Text style={styles.small}>{count(albumWisps(page.album))} / {albumWisps(page.album).length} collected{page.album.seasonal ? ` · Rewards ${albumPhase(page.album, now) === 'archived' ? 'ended' : `claimable until ${new Date(page.album.claimEndsAt!).toLocaleDateString()}`}` : ''}</Text>
        {page.album.sets.map(set => <View key={set.id} style={styles.rule}><Text style={styles.name}>{set.name}</Text><WispCollectionDeck ids={set.wispIds} ownedIds={ownedIds} onInspect={setSelected} />{page.album.sets.length > 1 ? button(lantern?.claims.includes(`${page.album.id}:set:${set.id}`) ? 'Set reward collected' : `Claim ${set.reward.label}`, () => onCommand({ type: 'claim_collection', collectionId: page.album.id, setId: set.id }), count(set.wispIds) !== set.wispIds.length || lantern?.claims.includes(`${page.album.id}:set:${set.id}`) || !['permanent', 'active', 'claim'].includes(albumPhase(page.album, now))) : null}</View>)}
        {button(lantern?.claims.includes(page.album.id) ? 'Album reward collected' : `Claim ${page.album.reward.label}`, () => onCommand({ type: 'claim_collection', collectionId: page.album.id }), count(albumWisps(page.album)) !== albumWisps(page.album).length || lantern?.claims.includes(page.album.id) || !['permanent', 'active', 'claim'].includes(albumPhase(page.album, now)))}
      </> : page.kind === 'discoveries' ? discoveries.length ? <WispCollectionDeck ids={discoveries} ownedIds={ownedIds} onInspect={setSelected} /> : <Text style={styles.body}>Wisps discovered through your adventures and relationships will live here.</Text> : <>
        <Text style={styles.title}>{lantern?.echoes ?? 0} Echoes</Text><Text style={styles.body}>Familiar visitors leave Echoes. Invite a missing permanent visitor for 15, or collect the golden Lantern glow for 20.</Text>
        {LANTERN_VISITORS.filter(id => !ownedIds.includes(id)).map(id => <View key={id}>{button(`Invite ${wispDefinition(id).name} · 15`, () => onCommand({ type: 'exchange', receiptId: `lantern:invite:${id}`, wispId: id }), (lantern?.echoes ?? 0) < 15)}</View>)}
        {button(lantern?.cosmetics.includes('lantern-trail') ? 'Golden glow collected' : 'Golden Lantern glow · 20', () => onCommand({ type: 'exchange', receiptId: 'lantern:trail', cosmeticId: 'lantern-trail' }), (lantern?.echoes ?? 0) < 20 || lantern?.cosmetics.includes('lantern-trail'))}
      </>}
    </ScrollView> : null}
    {errorView}
    <Pressable accessibilityRole="button" accessibilityLabel="Exchange Wisp Echoes" style={styles.echoFooter} onPress={() => { setSelected(null); setPage({ kind: 'echoes' }); }}><Text style={styles.name}>✦ {lantern?.echoes ?? 0} Echoes</Text><Text style={styles.link}>Exchange ›</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 460, maxHeight: '100%', backgroundColor: '#FFF8E6', borderRadius: 28, borderWidth: 2, borderColor: '#D6B758', overflow: 'hidden', flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9DDBB', gap: 10 },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 25, lineHeight: 30, color: '#332918' },
  name: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 17, lineHeight: 22, color: '#59482D' },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 14, lineHeight: 20, color: '#5C513B' },
  small: { fontFamily: AppFontFamilies.manrope, fontSize: 12, lineHeight: 18, color: '#776B53' },
  eyebrow: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, lineHeight: 17, color: '#8D7136' },
  content: { padding: 18, gap: 16 }, flex: { flex: 1, gap: 5 }, hidden: { display: 'none' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, chevron: { fontSize: 30, color: '#765A2D' },
  lanternHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' }, lanternStage: { width: 108, height: 132, justifyContent: 'center' }, lanternArt: { width: 108, height: 116 }, residents: { position: 'absolute', bottom: 0, flexDirection: 'row', alignSelf: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5D9B9' }, tab: { flex: 1, alignItems: 'center', paddingVertical: 12, minHeight: 48 }, activeTab: { borderBottomWidth: 3, borderBottomColor: '#94B36C' },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E9DDBB' }, packArt: { width: 58, height: 86 }, quantity: { color: '#7A915C' },
  detailLink: { minHeight: 44, justifyContent: 'center' }, link: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, color: '#5F743E' }, reward: { fontSize: 12, lineHeight: 17, color: '#8D7136' },
  albumRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9DDBB' }, albumArt: { width: 44, height: 60 },
  empty: { gap: 14, paddingVertical: 12 }, rule: { gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E9DDBB' }, center: { alignItems: 'center' }, upgradeArt: { width: 150, height: 160, alignSelf: 'center' },
  echoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E9DDBB' },
});
