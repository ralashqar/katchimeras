import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { CompanionNarrativePanel } from '@/components/katchadeck/world/companion-narrative-panel';
import { NarrativeDialogue } from '@/components/katchadeck/world/narrative-presentation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WispPackReveal } from './wisp-card-deck';
import { WispPackAnticipation } from './wisp-pack-anticipation';
import { DiscoveryRewardSequence } from '@/components/katchadeck/world/discovery-reward-sequence';
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
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { WispCompanion } from './wisp-companion';
import { WispLanternHub } from './wisp-lantern-hub';
import { LANTERN_LEVEL_ART } from '@/constants/wisp-lantern-art';
import { lanternLevel, type LanternLevel } from '@/constants/wisp-lantern-levels';
import { assignStoredLanternResidents } from '@/utils/merge-world/repository';

const ART = {
  gathering: require('@incubator/art-wisps/lantern/first-gathering.webp'),
};
export function WispLanternWorld({ onPress, rewards, planted = true, level = 1 }: { onPress?: () => void; planted?: boolean; level?: LanternLevel; rewards?: NonNullable<MergeWorldState['wispLanternProgress']>['rewards'] }) {
  const { state } = useWisps();
  const reduced = useReducedMotion();
  const lantern = state.lantern;
  const pouches = Object.values(lantern?.packs ?? {}).filter(pack => pack.openedAt == null).length
    + Object.keys(rewards ?? {}).filter(id => !lantern?.packs[id]).length;
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole="button" accessibilityLabel={planted ? 'Wisp Lantern. Open collection and card packs' : 'A home for little lights'} style={styles.world}>
    {planted ? <Animated.View key="planted" entering={reduced ? FadeIn.duration(100) : ZoomIn.duration(650)} style={styles.worldStage}>
      {lantern?.cosmetics.includes('first-gathering') ? <Image source={ART.gathering} style={styles.habitat} contentFit="contain" /> : null}
      <Image source={LANTERN_LEVEL_ART[lanternLevel(level)]} style={styles.worldArt} contentFit="contain" transition={reduced ? 0 : 250} />
      <View pointerEvents="none" style={[styles.residents, lantern?.cosmetics.includes('lantern-trail') && styles.trail]}>{lantern?.residents.map(id => <WispCompanion key={id} id={id} size={26} />)}</View>
    </Animated.View> : null}
    <Text style={styles.worldLabel}>{!planted ? 'Little lights…' : pouches ? `${pouches} ${pouches === 1 ? 'pack' : 'packs'}` : 'Wisp Lantern'}</Text>
  </Pressable>;
}

export function WispLanternPanel({ world, onClose, onGarden, onUpgrade, onPlantingChange }: {
  world: MergeWorldState; onClose: () => void; onGarden: () => void;
  /** Hands over to the shared upgrade stage: the Lantern framed in the world, its panel docked below. */
  onUpgrade: () => void; onPlantingChange?: (active: boolean) => void;
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
  const [initialHubTab, setInitialHubTab] = useState<'packs' | 'collection'>('packs');
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
        if (!loadWispState().lantern?.packs[id]) persistLanternCommand({ type: 'grant_pack', receiptId: id, definitionId: reward.packId, definitionVersion: reward.definitionVersion ?? 1, seed: Math.floor(Math.random() * 0x100000000) }, reward.grantedAt);
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
  if (scene?.id === 'collection' && !reveal) return narrative(String(scene.payload?.text), 'See collection', () => { setInitialHubTab('collection'); return advance('See collection'); });
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
        pack={rewardPack} previewStartedAt={lantern?.previewSeasonStartedAt} pending={pending || (welcomeComplete && !error)} error={error}
        actionLabel={welcomeComplete ? error ? 'Try again' : 'Continuing…' : undefined}
        onFocus={index => { if (!welcomeComplete) void work(() => command({ type: 'focus_pack_card', packId: rewardPack.id, index })); }}
        onDone={() => { void work(() => {
          if (welcomeComplete) { setAttempt(value => value + 1); return; }
          command({ type: 'acknowledge_reveal', packId: rewardPack.id, revealed: rewardPack.outcomes!.length });
          if (rewardPack.outcomes!.some(card => !card.discovered)) command({ type: 'explain_duplicate' });
        }); }}
      /> : null}
      {introduced && !welcomeComplete ? <View style={[{ width: '100%', maxWidth: 460, maxHeight: '100%' }, (packStageId || rewardPack) && { display: 'none' }]}>
        <WispLanternHub initialTab={initialHubTab} world={world} state={state} ownedIds={ownedIds} pending={pending} errorView={packStageId || rewardPack ? null : errorView}
          onClose={onClose} onGarden={onGarden} onOpen={setSelectedPackId}
          onCommand={input => { void work(() => command(input)); }}
          onOpenUpgrade={onUpgrade}
          onResidents={ids => { void work(() => assignStoredLanternResidents(ids)); }}
          onEquip={id => { void work(() => equip(id)); }} />
      </View> : null}
    </View>
  </GestureHandlerRootView></Modal>;
}

const styles = StyleSheet.create({
  world: { width: 104, height: 124, alignItems: 'center', justifyContent: 'flex-end' }, worldStage: { width: 104, height: 104 }, worldArt: { width: 104, height: 104 }, habitat: { position: 'absolute', width: 130, height: 100, left: -13, top: 15 },
  residents: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', borderRadius: 24 }, trail: { backgroundColor: '#FFDC8080', borderColor: '#FFE8A8', borderWidth: 2 },
  worldLabel: { color: '#59482D', backgroundColor: '#FFF3DC', borderRadius: 10, padding: 4, fontFamily: AppFontFamilies.fredokaBold, fontSize: 11 },
  scrim: { flex: 1, backgroundColor: 'rgba(24,42,23,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  narrativeLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, zIndex: 140 }, narrativePanel: { width: '100%', maxWidth: 520, paddingVertical: 18, gap: 16 },
  errorBox: { gap: 10, padding: 12, backgroundColor: '#FFF8E6', borderRadius: 16 }, error: { color: '#923F38', fontSize: 15 },
});
