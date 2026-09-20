import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { CompanionNarrativePanel } from '@/components/katchadeck/world/companion-narrative-panel';
import { NarrativeDialogue } from '@/components/katchadeck/world/narrative-presentation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WispPackReveal, WispCollectionDeck } from './wisp-card-deck';
import { WispCollectionCard } from './wisp-collection-card';
import { WispPackAnticipation } from './wisp-pack-anticipation';
import { DiscoveryRewardSequence } from '@/components/katchadeck/world/discovery-reward-sequence';
import { WISP_RARITY } from '@/constants/wisp-card-art';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { AppFontFamilies } from '@/constants/theme';
import { useWisps } from '@/features/wisps/wisp-provider';
import { LANTERN_INTRO } from '@/features/wisps/lantern-definition';
import { registerLanternFlows } from '@/features/wisps/lantern-flows';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import { commandWispLantern as persistLanternCommand, loadWispState, localWispPackAuthority } from '@/utils/wisp-storage';
import type { WispId } from '@/types/wisp';
import type { WispLanternCommand } from '@/types/wisp-lantern';
import { pendingLanternPack, welcomeLanternPack } from '@/utils/wisp-lantern-state';
import { wispDefinition } from '@/constants/wisps';
import { LANTERN_VISITORS } from '@/constants/wisp-lantern';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { lanternDay } from '@/features/wisps/lantern-world';
import { gameNow } from '@/utils/game-clock';
import { WispCompanion } from './wisp-companion';
import { WispArtwork } from './wisp-artwork';

const ART = {
  lit: require('@incubator/art-wisps/cards/lantern-lit-v2.webp'),
  gathering: require('@incubator/art-wisps/lantern/first-gathering.webp'),
};
export function WispLanternWorld({ onPress, rewards, planted = true }: { onPress?: () => void; planted?: boolean; rewards?: NonNullable<MergeWorldState['wispLanternProgress']>['rewards'] }) {
  const { state } = useWisps();
  const reduced = useReducedMotion();
  const lantern = state.lantern;
  const pouches = Object.values(lantern?.packs ?? {}).filter(pack => pack.openedAt == null).length
    + Object.keys(rewards ?? {}).filter(id => !lantern?.packs[id]).length;
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole="button" accessibilityLabel={planted ? 'Wisp Lantern. Open collection and card packs' : 'A home for little lights'} style={styles.world}>
    {planted ? <Animated.View key="planted" entering={reduced ? FadeIn.duration(100) : ZoomIn.duration(650)} style={styles.worldStage}>
      {lantern?.cosmetics.includes('first-gathering') ? <Image source={ART.gathering} style={styles.habitat} contentFit="contain" /> : null}
      <Image source={ART.lit} style={styles.worldArt} contentFit="contain" transition={0} />
      <View pointerEvents="none" style={[styles.residents, lantern?.cosmetics.includes('lantern-trail') && styles.trail]}>{lantern?.residents.map(id => <WispCompanion key={id} id={id} size={26} />)}</View>
    </Animated.View> : null}
    <Text style={styles.worldLabel}>{!planted ? 'Little lights…' : pouches ? `${pouches} ${pouches === 1 ? 'pack' : 'packs'}` : 'Wisp Lantern'}</Text>
  </Pressable>;
}

export function WispLanternPanel({ world, onClose, onGarden, onPlantingChange }: {
  world: MergeWorldState; onClose: () => void; onGarden: () => void; onPlantingChange?: (active: boolean) => void;
}) {
  const { state, equip } = useWisps();
  const ownedIds = Object.keys(state.inventory).filter(id => (state.inventory[id as WispId]?.quantity ?? 0) > 0) as WispId[];
  const command = (input: WispLanternCommand) => persistLanternCommand(input, undefined, ownedIds);
  const lantern = state.lantern;
  const insets = useSafeAreaInsets();
  const [flow, setFlow] = useState<ContentFlowRun | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selected, setSelected] = useState<WispId | null>(null);
  const [page, setPage] = useState<'collection' | 'echoes' | 'odds'>('collection');
  const [legacyPlanting, setLegacyPlanting] = useState(false);
  const busy = useRef(false);
  const welcomeHandoffAttempt = useRef<string | null>(null);
  const introduced = lantern?.introducedAt != null;
  const placed = Boolean(world.wispLanternPlacement);
  const node = !introduced ? LANTERN_INTRO.nodes.find(n => n.id === flow?.nodeId) : undefined;
  const scene = node?.kind === 'scene' ? node : undefined;
  const planting = !placed && (scene?.id === 'plant' || legacyPlanting);
  const reveal = pendingLanternPack(state);
  const welcome = welcomeLanternPack(state);
  const welcomeComplete = Boolean(scene?.id === 'pouch' && welcome?.outcomes?.length && welcome.revealed >= welcome.outcomes.length);
  const rewardPack = reveal ?? (welcomeComplete ? welcome : undefined);
  const count = LANTERN_VISITORS.filter(id => ownedIds.includes(id)).length;
  const packs = Object.values(lantern?.packs ?? {}).filter(pack => pack.openedAt == null);
  const finishOpening = useCallback(() => { setOpening(null); setSelectedPackId(null); }, []);
  const selectablePackId = selectedPackId && lantern?.packs[selectedPackId]?.openedAt == null ? selectedPackId : undefined;
  const packStageId = opening ?? selectablePackId ?? (scene?.id === 'pouch' && !reveal && welcome?.openedAt == null ? welcome?.id : undefined);
  const packStageOpening = Boolean(opening && lantern?.packs[opening]?.outcomes);
  const work = async (action: () => unknown | Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { busy.current = false; setPending(false); }
  };
  const advance = async (actionId: string) => { if (flow) setFlow(await dispatchContentFlowCommand(flow.runId, { type: 'submit_scene', actionId })); };
  useEffect(() => {
    onPlantingChange?.(planting);
    return () => onPlantingChange?.(false);
  }, [onPlantingChange, planting]);
  useEffect(() => {
    if (introduced) return;
    let active = true;
    registerLanternFlows();
    const runId = `${LANTERN_INTRO.id}:${world.createdAt}`;
    void loadContentFlowRun(runId).then(saved => saved?.phase === 'awaiting_effect'
      ? dispatchContentFlowCommand(runId, { type: 'retry' })
      : saved ?? startContentFlow(LANTERN_INTRO, { runId }))
      .then(run => { if (active) setFlow(run); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [introduced, world.createdAt, attempt]);
  // Wait for the planted art to settle before presenting its first pouch.
  useEffect(() => {
    if (!placed || !['plant', 'lit'].includes(scene?.id ?? '') || !flow || flow.status === 'failed_recoverable') return;
    const timer = setTimeout(() => { void work(() => advance(scene?.id === 'lit' ? 'ready' : 'planted'));  }, 850);
    return () => clearTimeout(timer);
    // The node and placement are durable checkpoints; unrelated renders must not restart this timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, scene?.id, flow?.status, attempt]);
  useEffect(() => {
    if (!legacyPlanting || !placed) return;
    const timer = setTimeout(() => setLegacyPlanting(false), 1000);
    return () => clearTimeout(timer);
  }, [legacyPlanting, placed]);
  useEffect(() => {
    if (!welcomeComplete) { welcomeHandoffAttempt.current = null; return; }
    if (opening || pending || !flow) return;
    const handoffKey = `${flow.runId}:${attempt}`;
    if (welcomeHandoffAttempt.current === handoffKey) return;
    welcomeHandoffAttempt.current = handoffKey;
    void work(() => advance('welcomed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeComplete, opening, pending, flow?.runId, attempt]);
  useEffect(() => {
    if (!introduced) return;
    try {
      for (const [id, reward] of Object.entries(world.wispLanternProgress?.rewards ?? {})) {
        if (!loadWispState().lantern?.packs[id]) persistLanternCommand({ type: 'grant_pack', receiptId: id, definitionId: reward.packId, seed: Math.floor(Math.random() * 0x100000000) }, reward.grantedAt);
      }
    } catch (e) { setError(String(e)); }
  }, [introduced, world.wispLanternProgress?.rewards, attempt]);
  const button = (label: string, action: () => unknown | Promise<unknown>, disabled = false, secondary = false) => <KatchaButton key={label} fullWidth label={label} variant={secondary ? 'secondary' : 'primary'} disabled={pending || disabled} onPress={() => { void work(action); }} />;
  const open = async (id: string) => {
    // A stale CTA must resume its committed card, never replay an opened pack.
    if (loadWispState().lantern?.packs[id]?.openedAt != null) {
      setSelectedPackId(null);
      return;
    }
    setOpening(id);
    try { await localWispPackAuthority.openPack(id, ownedIds); }
    catch (error) { setOpening(null); throw error; }
  };
  const errorView = error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{button('Try again', async () => {
    if (flow?.status === 'failed_recoverable') setFlow(await dispatchContentFlowCommand(flow.runId, { type: 'retry' }));
    else setAttempt(value => value + 1);
  })}</View> : null;
  const narrative = (text: string, label: string, action: () => unknown | Promise<unknown>, disabled = false) => <View pointerEvents="box-none" style={[styles.narrativeLayer, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
    <CompanionNarrativePanel style={styles.narrativePanel}>
      <NarrativeDialogue name="Mossprout" text={text} portrait={<Image source={resolveCreatureArtSource('mossprout', { stage: 'grown' })} style={{ width: 84, height: 92 }} contentFit="contain" />} />
      {errorView}{button(label, action, disabled)}
    </CompanionNarrativePanel>
  </View>;
  if (planting || legacyPlanting || (!introduced && (scene?.id === 'plant' || scene?.id === 'lit'))) return errorView ? <View style={styles.narrativeLayer}>{errorView}</View> : null;
  if (introduced && !placed) return narrative('Let’s give your Lantern its own patch beside Heartwood. Your visitors will come with it. Any plant in that patch returns to your collection with its growth.', 'Find a place', () => setLegacyPlanting(true));
  if (scene?.id === 'notice') {
    const displaced = world.haven.plantableMemories.some(plant => plant.status === 'planted' && plant.slotId === 'front-right');
    return narrative(`${String(scene.payload?.text)}${displaced ? ' The plant in that patch will return to your collection with all its growth.' : ''}`, 'Find a place', () => advance('Find a place'));
  }
  if (scene?.id === 'collection' && !reveal) return narrative(String(scene.payload?.text), 'See collection', () => advance('See collection'));
  if (!introduced && !scene && !reveal) return narrative('The Lantern is finding its light…', error ? 'Try again' : 'Continue', () => setAttempt(value => value + 1));
  return <Modal transparent visible animationType={rewardPack ? 'none' : 'fade'} onRequestClose={pending || opening ? () => {} : onClose}><GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      {packStageId ? <DiscoveryRewardSequence key={`pack:${packStageId}`} backdrop={false} keepHeroInPlace
        renderHero={size => <WispPackAnticipation size={size} opening={packStageOpening} onDone={finishOpening} />}
        eyebrow={scene?.id === 'pouch' ? 'Your first Wisp pack' : 'Wisp card pack'}
        title="A little mystery inside"
        description={opening ? 'A little light is waking up inside…' : scene?.id === 'pouch' && welcome?.definitionVersion === 2
          ? 'One of five Common visitors is inside. Each has an equal chance. Let’s meet them.'
          : 'Little lights are waiting inside. Open this pack to discover your Wisp cards.'}
        actionLabel={opening ? 'Opening…' : scene?.id === 'pouch' ? 'Open welcome pack' : 'Open pack'}
        pending={pending || Boolean(opening)} error={error}
        onContinue={() => { if (!opening) void work(() => open(packStageId)); }}
      /> : rewardPack ? <WispPackReveal
        pack={rewardPack} pending={pending || (welcomeComplete && !error)} error={error}
        actionLabel={welcomeComplete ? error ? 'Try again' : 'Continuing…' : undefined}
        onFocus={index => { if (!welcomeComplete) void work(() => command({ type: 'focus_pack_card', packId: rewardPack.id, index })); }}
        onDone={() => { void work(() => {
          if (welcomeComplete) { setAttempt(value => value + 1); return; }
          command({ type: 'acknowledge_reveal', packId: rewardPack.id, revealed: rewardPack.outcomes!.length });
          if (rewardPack.outcomes!.some(card => !card.discovered)) command({ type: 'explain_duplicate' });
        }); }}
      /> : <View style={styles.collectionShell}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>WISP LANTERN</Text><Text accessibilityRole="header" style={styles.title}>{selected ? wispDefinition(selected).name : page === 'echoes' ? 'Wisp Echoes' : page === 'odds' ? 'Inside the packs' : 'Little Lantern Visitors'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={selected || page !== 'collection' ? 'Back to collection' : 'Close collection'} hitSlop={8} style={styles.close} onPress={() => { if (selected) setSelected(null); else if (page !== 'collection') setPage('collection'); else onClose(); }}><Text style={styles.closeText}>{selected || page !== 'collection' ? '‹' : '×'}</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.collectionBody}>
          {selected ? <>
            <View style={styles.detailHero}><WispCollectionCard wispId={selected} width={200} owned={ownedIds.includes(selected)} /></View>
            <Text style={styles.body}>{wispDefinition(selected).description}</Text>
            <Text style={styles.small}>{WISP_RARITY[wispDefinition(selected).rarity].label} · {ownedIds.includes(selected) ? 'At home in your collection' : 'Waiting to be discovered'}</Text>
            {ownedIds.includes(selected) ? <>
              {button(state.equippedWispId === selected ? 'Following you' : 'Follow me', () => equip(selected), state.equippedWispId === selected)}
              {button(lantern?.residents.includes(selected) ? 'Rest elsewhere' : 'Live at the Lantern', () => command({ type: 'residents', ids: lantern?.residents.includes(selected) ? lantern.residents.filter(id => id !== selected) : [...(lantern?.residents ?? []).slice(-2), selected] }), false, true)}
            </> : button('Invite · 15 Echoes', () => command({ type: 'exchange', receiptId: `lantern:invite:${selected}`, wispId: selected }), (lantern?.echoes ?? 0) < 15)}
          </> : page === 'odds' ? <Text style={styles.body}>Your first pack contains one Common Wisp card: Dewdrop, Bubble, Nimbus, Clover or Pebble, with a 20% chance each. Previously earned welcome packs keep their original three different common visitors.{ '\n\n' }Ordinary packs contain three Wisp cards. Each slot: the five common visitors have an 18% chance each; Crystal has a 10% chance. After two packs without a new visitor, the next guarantees a missing visitor if you still need one.{ '\n\n' }Repeat common visitors leave one Echo; Crystal leaves five. Bond and story Wisps are earned through their own discoveries.</Text>
          : page === 'echoes' ? <>
            <Text style={styles.title}>{lantern?.echoes ?? 0} Echoes</Text><Text style={styles.body}>Familiar visitors leave Echoes. Save 15 to invite a missing Wisp, or 20 for a golden Lantern glow.</Text>
            {LANTERN_VISITORS.filter(id => !ownedIds.includes(id)).map(id => <View key={id} style={styles.exchange}><WispArtwork id={id} size={56} silhouette /><View style={{ flex: 1 }}>{button(`Invite ${wispDefinition(id).name} · 15`, () => command({ type: 'exchange', receiptId: `lantern:invite:${id}`, wispId: id }), (lantern?.echoes ?? 0) < 15)}</View></View>)}
            {button(lantern?.cosmetics.includes('lantern-trail') ? 'Golden glow collected' : 'Golden Lantern glow · 20', () => command({ type: 'exchange', receiptId: 'lantern:trail', cosmeticId: 'lantern-trail' }), (lantern?.echoes ?? 0) < 20 || lantern?.cosmetics.includes('lantern-trail'))}
          </> : <>
            <Text style={styles.body}>{count} of 6 visitors have found a home</Text>
            <View accessibilityLabel={`${count} of 6 collected`} style={styles.progress}>{LANTERN_VISITORS.map(id => <View key={id} style={[styles.progressDot, ownedIds.includes(id) && styles.progressFilled]} />)}</View>
            <WispCollectionDeck ownedIds={ownedIds} onInspect={setSelected} />
            {packs.length ? button(`Open pack · ${packs.length} waiting`, () => setSelectedPackId(packs[0].id)) : button('Find more in the Garden', onGarden)}
            <Text style={styles.small}>Garden orders today: {world.wispLanternProgress && lanternDay(gameNow()) <= world.wispLanternProgress.day ? world.wispLanternProgress.dailyOrders : 0}/5 · Five everyday orders bring a pack.</Text>
            {count === 6 && !lantern?.cosmetics.includes('first-gathering') ? button('Claim First Gathering habitat', () => command({ type: 'claim_collection' })) : <Text style={styles.small}>{lantern?.cosmetics.includes('first-gathering') ? 'First Gathering habitat collected' : 'Meet all six to earn the First Gathering habitat.'}</Text>}
            <View style={styles.links}><Pressable accessibilityRole="button" onPress={() => setPage('echoes')} style={styles.link}><Text style={styles.name}>{lantern?.echoes ?? 0} Echoes</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setPage('odds')} style={styles.link}><Text style={styles.name}>Pack details</Text></Pressable></View>
          </>}
          {errorView}
        </ScrollView>
      </View>}
    </View>
  </GestureHandlerRootView></Modal>;
}

const styles = StyleSheet.create({
  world: { width: 104, height: 124, alignItems: 'center', justifyContent: 'flex-end' }, worldStage: { width: 104, height: 104 }, worldArt: { width: 104, height: 104 }, habitat: { position: 'absolute', width: 130, height: 100, left: -13, top: 15 },
  residents: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', borderRadius: 24 }, trail: { backgroundColor: '#FFDC8080', borderColor: '#FFE8A8', borderWidth: 2 },
  worldLabel: { color: '#59482D', backgroundColor: '#FFF3DC', borderRadius: 10, padding: 4, fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  scrim: { flex: 1, backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  narrativeLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, zIndex: 140 }, narrativePanel: { width: '100%', maxWidth: 520, paddingVertical: 18, gap: 16 },
  collectionShell: { width: '100%', maxWidth: 460, maxHeight: '100%', backgroundColor: '#FFF8E6', borderRadius: 28, borderWidth: 2, borderColor: '#D6B758', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: '#E9DDBB' }, collectionBody: { padding: 20, gap: 18 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.25, color: '#8D7136', marginBottom: 5 },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 25, lineHeight: 30, color: '#332918' },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 15, lineHeight: 22, color: '#5C513B' }, small: { fontFamily: AppFontFamilies.manrope, fontSize: 12, lineHeight: 18, color: '#776B53' }, name: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 15, color: '#59482D' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 30, color: '#765A2D' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 }, visitor: { width: '31%', alignItems: 'center', gap: 4, minHeight: 112 },
  progress: { flexDirection: 'row', gap: 6 }, progressDot: { height: 6, flex: 1, backgroundColor: '#E9E0CA', borderRadius: 3 }, progressFilled: { backgroundColor: '#94B36C' },
  links: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E9DDBB' }, link: { paddingVertical: 14, minHeight: 44 }, detailHero: { alignItems: 'center', paddingVertical: 12 }, exchange: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  errorBox: { gap: 10, padding: 12, backgroundColor: '#FFF8E6', borderRadius: 16 }, error: { color: '#923F38', fontSize: 15 },
});
