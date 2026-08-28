import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import {
  KingdomHexCanvas,
  type KingdomMergeCoinPresentation,
  type KingdomResidentScreenAnchor,
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { HavenTileHudLayer } from '@/components/katchadeck/world/haven-tile-hud-layer';
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { AppFontFamilies } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { useMergeWorldActions } from '@/features/merge-world/merge-world-provider';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import type { EggVisualState } from '@/types/home';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity, localDayId } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { HAVEN_ENVIRONMENTS, havenStoryGateSatisfied, type HavenEnvironmentStage, type HavenStage } from '@/constants/haven-catalog';
import { completeMossproutHavenUpgrade } from '@/utils/companion-story-storage';
import { reconcileStoredHavenStory, upgradeStoredHavenTile } from '@/utils/merge-world/repository';
import { havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import type { HavenTileUpgradePresentation } from '@/utils/haven-upgrade-presentation';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { commitFtueAction, dispatchFtueEvent } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { mergeFtueAllowsCommand, mergeFtueBoardGate, mergeFtueEventForCommand, mergeFtueRailGate, mergeFtueStepForBoard } from '@/features/onboarding/merge-ftue';
import { mossproutJourneyForDay, mossproutJourneyRuntimeDayId } from '@/game/katchimeras/relationship-progression';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { mergeOrderItemReadiness, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import type { MergeOrderTrayEntry } from '@/components/katchadeck/games/merge-order-rail';

type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  eggVisual: EggVisualState | null;
  onContentReady?: () => void;
  onOpenProfile: () => void;
  onSelectCreature: (creatureId: string) => void;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  mergeWorld: MergeWorldState;
  ftueStepId?: string;
  onFtueRestore?: () => void;
  onFtueReveal?: () => void;
  onFtueInspect?: () => void;
};

export function KatchimeraKingdomScreen({
  background,
  companionSlots,
  eggVisual,
  onContentReady,
  onOpenProfile,
  onSelectCreature,
  residentStatusGlyphs,
  mergeWorld,
  ftueStepId,
  onFtueRestore,
  onFtueReveal,
  onFtueInspect,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const avatar = useEggAvatar();
  const [lockedHintVisible, setLockedHintVisible] = useState(false);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const [detailCreatureId, setDetailCreatureId] = useState<string | null>(null);
  const [residentAnchors, setResidentAnchors] = useState<KingdomResidentScreenAnchor[]>([]);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradePresentation, setUpgradePresentation] = useState<HavenTileUpgradePresentation | null>(null);
  const [presentedCoins, setPresentedCoins] = useState<number | null>(null);
  const [coinValueAnimationDurationMs, setCoinValueAnimationDurationMs] = useState(0);
  const [coinPulseNonce, setCoinPulseNonce] = useState(0);
  const [enteringGrove, setEnteringGrove] = useState(false);
  const coinHudRef = useRef<View>(null);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const ftueRestoreStartedRef = useRef(false);
  const ftueRecoveryRef = useRef<string | null>(null);
  const enterGroveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identity = useMemo(loadWorldIdentity, []);
  const { dispatch: dispatchMergeWorld } = useMergeWorldActions();
  const relationships = useRelationshipProgression();
  const mergeWorldRef = useRef(mergeWorld);
  mergeWorldRef.current = mergeWorld;
  const visibleCompanionSlots = useMemo(
    () => companionSlots.filter((slot) => slot.familyId === 'mossprout'),
    [companionSlots],
  );
  const havenMergeBoardActive = visibleCompanionSlots.some((slot) => slot.kind === 'owned');
  const mossproutJourneyDayId = mossproutJourneyRuntimeDayId(
    relationships,
    localDayId(),
    isJourneyQuickModeEnabled(),
  );
  const mossproutJourney = mossproutJourneyForDay(relationships, mossproutJourneyDayId);
  const ftueStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
  const boardFtueStep = useMemo(() => mergeFtueStepForBoard(mergeWorld, ftueStep), [ftueStep, mergeWorld]);
  const boardInteractionGate = useMemo(() => mergeFtueBoardGate(boardFtueStep, mergeWorld), [boardFtueStep, mergeWorld]);
  const orderInteractionGate = useMemo(() => mergeFtueRailGate(boardFtueStep, mergeWorld), [boardFtueStep, mergeWorld]);
  const dispatchHavenMergeWorld = useCallback((command: MergeWorldCommand) => {
    const before = mergeWorldRef.current;
    const activeStep = mergeFtueStepForBoard(before, ftueStep);
    if (!mergeFtueAllowsCommand(activeStep, before, command)) return null;
    const result = dispatchMergeWorld(command);
    if (result) mergeWorldRef.current = result.state;
    const event = mergeFtueEventForCommand(before, command, result);
    if (event) dispatchFtueEvent(event, `haven-merge-command:${event.revision}`);
    return result;
  }, [dispatchMergeWorld, ftueStep]);
  const havenMergeOrders = useMemo<MergeOrderTrayEntry[]>(() => {
    if (!havenMergeBoardActive) return [];
    const journeyOrderIds = new Set(mossproutJourney?.activity?.mergeOrderIds
      ?? (mossproutJourney?.activity ? [mossproutJourney.activity.mergeOrderId] : []));
    const activeResidentDiscovery = mergeWorld.residentCardDiscovery.records.find((record) => (
      record.status !== 'locked' && record.status !== 'card_earned'
    ));
    const readyOrderIds = readyMergeOrderIds(mergeWorld);
    return prioritizedVisibleMergeOrders(mergeWorld, {
      activeResidentDiscoveryId: activeResidentDiscovery?.id,
      exclusiveJourney: Boolean(mossproutJourney && mossproutJourney.status !== 'complete'),
      journeyOrderIds,
    }).slice(0, 3).map((order) => ({
      id: order.id,
      itemReadiness: mergeOrderItemReadiness(mergeWorld, order),
      kind: 'order' as const,
      order,
      ready: readyOrderIds.has(order.id),
    }));
  }, [havenMergeBoardActive, mergeWorld, mossproutJourney]);
  const havenMergeBoard = useMemo(() => havenMergeBoardActive ? ({
    boardInteractionGate,
    dispatch: dispatchHavenMergeWorld,
    orderInteractionGate,
    orders: havenMergeOrders,
    state: mergeWorld,
  }) : null, [boardInteractionGate, dispatchHavenMergeWorld, havenMergeBoardActive, havenMergeOrders, mergeWorld, orderInteractionGate]);
  const tutorialCamera = useMemo<FtueCameraDirective | null>(() => {
    if (ftueStepId === 'haven.mossprout_reveal' && enteringGrove) {
      return { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: 1.25, anchorY: 0.46, durationMs: 360 };
    }
    return ftueStep?.camera ?? null;
  }, [enteringGrove, ftueStep?.camera, ftueStepId]);
  useEffect(() => {
    if (ftueStepId !== 'haven.mossprout_reveal') setEnteringGrove(false);
  }, [ftueStepId]);
  useEffect(() => () => {
    if (enterGroveTimerRef.current) clearTimeout(enterGroveTimerRef.current);
  }, []);
  const advanceOpening = useCallback(() => {
    if (ftueStepId !== 'haven.mossprout_reveal') {
      onFtueInspect?.();
      return;
    }
    if (enteringGrove) return;
    setEnteringGrove(true);
    enterGroveTimerRef.current = setTimeout(() => {
      enterGroveTimerRef.current = null;
      onFtueInspect?.();
    }, 380);
  }, [enteringGrove, ftueStepId, onFtueInspect]);
  const registerFtueTarget = useCallback((key: string, node: View | null) => {
    const current = ftueTargetRefs.current.get(key) ?? null;
    if (current === node) return;
    if (node) ftueTargetRefs.current.set(key, node);
    else ftueTargetRefs.current.delete(key);
    setFtueTargetRevision((revision) => revision + 1);
  }, []);
  const setRestoreButtonNode = useCallback((node: View | null) => {
    restoreButtonRef.current = node;
    registerFtueTarget('upgrade:mossprout', node);
  }, [registerFtueTarget]);
  useEffect(() => {
    if (ftueStepId !== 'haven.mossprout.focus' && ftueStepId !== 'haven.mossprout.restore') {
      ftueRestoreStartedRef.current = false;
      return;
    }
    if (ftueRestoreStartedRef.current) return;
    const mossprout = visibleCompanionSlots.find((slot) => slot.kind === 'owned');
    if (mossprout?.kind === 'owned') {
      setSelectedCreatureId(mossprout.creature.creatureId);
      if (ftueStepId === 'haven.mossprout.restore') setDetailCreatureId(mossprout.creature.creatureId);
    }
  }, [ftueStepId, visibleCompanionSlots]);
  useEffect(() => {
    if (upgrading || upgradePresentation || (mergeWorld.haven.tileStages.mossprout ?? 0) < 1 || !ftueStepId) return;
    if (ftueRecoveryRef.current === ftueStepId) return;
    if (ftueStepId === 'haven.mossprout.focus') {
      ftueRecoveryRef.current = ftueStepId;
      commitFtueAction({ actionId: 'haven.open_mossprout_upgrade', evidenceRef: 'haven:mossprout:already-restored' });
    } else if (ftueStepId === 'haven.mossprout.restore') {
      ftueRecoveryRef.current = ftueStepId;
      onFtueRestore?.();
    }
  }, [ftueStepId, mergeWorld.haven.tileStages.mossprout, onFtueRestore, upgradePresentation, upgrading]);
  const havenPresentations = useMemo(() => visibleCompanionSlots.flatMap((slot) => {
    if (slot.kind !== 'owned' || !HAVEN_ENVIRONMENTS[slot.familyId as MergeCharacterId]) return [];
    return [deriveHavenTilePresentation({
      characterId: slot.familyId as MergeCharacterId,
      creatureId: slot.creature.creatureId,
      creatureName: slot.creature.name,
      mergeWorld,
      saving: upgrading && upgradePresentation?.characterId === slot.familyId,
    })];
  }), [mergeWorld, upgradePresentation?.characterId, upgrading, visibleCompanionSlots]);
  const havenOpeningActive = ftueStepId === 'haven.home_notice'
    || ftueStepId === 'haven.mossprout_focus'
    || ftueStepId === 'haven.mossprout_reveal'
    || ftueStepId === 'haven.first_bloom';
  const handleMergeCoinPresentation = useCallback((event: KingdomMergeCoinPresentation) => {
    if (event.type === 'prepare') {
      setCoinValueAnimationDurationMs(0);
      setPresentedCoins(event.value);
      return;
    }
    if (event.type === 'contact') {
      setCoinValueAnimationDurationMs(event.durationMs);
      setPresentedCoins(event.value);
      return;
    }
    if (event.type === 'pulse') {
      setCoinPulseNonce((current) => current + 1);
      return;
    }
    setCoinValueAnimationDurationMs(0);
    setPresentedCoins(null);
  }, []);

  const measureRestoreOrigin = useCallback(() => new Promise<{ x: number; y: number }>((resolve) => {
    const fallback = { x: window.width / 2, y: window.height - Math.max(90, insets.bottom + 66) };
    const node = restoreButtonRef.current;
    if (!node) {
      resolve(fallback);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : fallback);
    });
  }), [insets.bottom, window.height, window.width]);

  const beginUpgrade = useCallback(async (
    characterId: MergeCharacterId,
    creatureId: string,
    creatureName: string,
    currentStage: HavenStage,
    next: HavenEnvironmentStage,
  ) => {
    if (upgrading || upgradePresentation) return;
    setUpgrading(true);
    setUpgradeError(null);
    const coinOrigin = await measureRestoreOrigin();
    const presentation: HavenTileUpgradePresentation = {
      characterId,
      coinCost: next.coinCost,
      coinOrigin,
      creatureId,
      creatureName,
      fromStage: currentStage,
      nonce: ++upgradeNonceRef.current,
      palette: next.effectPalette ?? {
        accent: '#FFE28A',
        glow: '#A8E873',
        mist: 'rgba(226,255,213,0.88)',
        primary: '#4F9F57',
      },
      reactionLine: next.reactionLine ?? 'Look what we built together.',
      status: 'armed',
      toStage: next.stage,
      upgradeName: next.name,
    };
    if (ftueStepId === 'haven.mossprout.restore' && characterId === 'mossprout' && next.stage === 1) {
      ftueRestoreStartedRef.current = true;
    }
    setUpgradePresentation(presentation);
    setDetailCreatureId(null);

    // Give the canvas one frame to mount the old-art guard before the stored
    // snapshot publishes the new Haven stage.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const result = await upgradeStoredHavenTile(characterId, next.stage);
      if (!result.changed) throw new Error('The Haven upgrade could not be completed.');
      setUpgradePresentation({ ...presentation, status: 'playing' });
      if (characterId === 'mossprout' && next.stage >= 2) {
        const story = completeMossproutHavenUpgrade(next.stage);
        void reconcileStoredHavenStory('mossprout', story.currentLevel).catch(() => undefined);
      }
    } catch {
      if (ftueStepId === 'haven.mossprout.restore' && characterId === 'mossprout' && next.stage === 1) {
        ftueRestoreStartedRef.current = false;
      }
      setUpgradePresentation(null);
      setSelectedCreatureId(creatureId);
      setDetailCreatureId(creatureId);
      setUpgradeError('The restoration did not complete. Your Haven has not been changed. Please try again.');
      setUpgrading(false);
    }
  }, [ftueStepId, measureRestoreOrigin, upgradePresentation, upgrading]);

  const completeUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
    setUpgrading(false);
    if (
      ftueStepId === 'haven.mossprout.restore'
      && presentation.characterId === 'mossprout'
      && presentation.toStage === 1
    ) {
      ftueRecoveryRef.current = ftueStepId;
      onFtueRestore?.();
    }
  }, [ftueStepId, onFtueRestore]);

  const openHavenDetail = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (!presentation) return;
    if (ftueStepId === 'haven.mossprout.focus' && presentation.characterId !== 'mossprout') return;
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCreatureId(creatureId);
    setDetailCreatureId(creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation.characterId === 'mossprout') {
      commitFtueAction({ actionId: 'haven.open_mossprout_upgrade', evidenceRef: 'haven:mossprout:hud-opened' });
    }
  }, [ftueStepId, havenPresentations]);

  const selectResident = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation?.characterId !== 'mossprout') return;
    if (ftueStepId === 'haven.mossprout.restore') return;
    setSelectedCreatureId(creatureId);
  }, [ftueStepId, havenPresentations]);

  return (
    <View collapsable={false} onLayout={onContentReady} ref={screenRef} style={styles.screen}>
      <KingdomHexCanvas
        background={background}
        companionSlots={visibleCompanionSlots}
        eggVisual={eggVisual}
        identity={identity}
        discoveryRevealFamilyId={ftueStepId === 'haven.mossprout_reveal' || ftueStepId === 'haven.first_bloom' ? 'mossprout' : null}
        highlightedLockedFamilyId={ftueStepId === 'haven.mossprout_focus' ? 'mossprout' : null}
        interactionEnabled={havenOpeningActive || !ftueStep || ftueStep.surface !== 'haven'}
        mergeBoard={havenMergeBoard}
        mergeCoinTargetRef={coinHudRef}
        onMergeCoinPresentation={handleMergeCoinPresentation}
        onSelectHome={() => {
          if (ftueStepId === 'haven.home_notice') advanceOpening();
        }}
        onSelectLocked={(familyId) => {
          if (ftueStepId === 'haven.mossprout_focus' || ftueStepId === 'haven.mossprout_reveal') {
            if (familyId === 'mossprout') advanceOpening();
            return;
          }
          if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true);
        }}
        onSelectResident={selectResident}
        onResidentAnchorsChange={setResidentAnchors}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={Math.max(insets.bottom, 12) + 68}
        residentStatusGlyphs={residentStatusGlyphs}
        tutorialCamera={tutorialCamera}
        upgradePresentation={upgradePresentation}
        squareWorld
      />
      {!upgradePresentation ? (
        <HavenTileHudLayer
          anchors={residentAnchors}
          bottomInset={Math.max(insets.bottom, 12)}
          height={window.height}
          interactionCharacterId={ftueStepId === 'haven.mossprout.focus' ? 'mossprout' : ftueStepId === 'haven.mossprout.restore' ? '__none__' : null}
          onOpen={openHavenDetail}
          onTargetRef={(characterId, node) => registerFtueTarget(`hud:${characterId}`, node)}
          presentations={havenPresentations}
          selectedCreatureId={selectedCreatureId}
          topInset={insets.top}
          width={window.width}
        />
      ) : null}
      {!upgradePresentation ? (
        <View pointerEvents="box-none" style={[styles.topHudLayer, { top: insets.top + 3 }]}>
          <GameHudBar
            content={<GameCurrencyHud balances={[{
              animateValue: presentedCoins != null,
              art: GAME_CURRENCY_ART.coins,
              id: 'coins',
              pulseNonce: coinPulseNonce,
              targetRef: coinHudRef,
              value: presentedCoins ?? mergeWorld.coins,
              valueAnimationDurationMs: coinValueAnimationDurationMs,
            }]} style={styles.currencyHud} tone="glass" />}
            density="compact"
            style={styles.topHud}
            tone="glass"
            trailing={<Pressable
              accessibilityHint="Opens your avatar and cosmetics"
              accessibilityLabel="Open You"
              accessibilityRole="button"
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenProfile();
              }}
              style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
              <EggAvatar
                faceId={avatar.equippedFaceId}
                hatId={avatar.equippedHatId}
                heldAccessoryId={avatar.equippedHeldAccessoryId}
                presentation="button"
                size={42}
                skinId={avatar.equippedSkinId}
              />
            </Pressable>}
          />
        </View>
      ) : null}
      {lockedHintVisible ? (
        <KatchaSheet
          header={{
            eyebrow: 'UNDISCOVERED KATCHIMERA',
            title: 'Hidden in the Dream Mist',
            subtitle: 'A new companion is waiting somewhere beyond the clouds.',
          }}
          onRequestClose={() => setLockedHintVisible(false)}
          surface="night">
          <View style={styles.discoveryHint}>
            <ThemedText selectable style={styles.discoveryHintText} lightColor="#E9E3F5" darkColor="#E9E3F5">
              Keep living days and growing your relationships to discover who is waiting here.
            </ThemedText>
          </View>
        </KatchaSheet>
      ) : null}
      {havenOpeningActive && ftueStep ? (
        <View pointerEvents="box-none" style={[styles.discoveryCalloutLayer, { bottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View pointerEvents="none" style={styles.discoveryCallout}>
            <ThemedText style={styles.discoveryCalloutEyebrow} lightColor="#FFD36E" darkColor="#FFD36E">{ftueStep.guide.eyebrow.toUpperCase()}</ThemedText>
            <ThemedText style={styles.discoveryCalloutText} lightColor="#F8FCFF" darkColor="#F8FCFF">
              {ftueStep.guide.title} {ftueStep.guide.body}
            </ThemedText>
          </View>
          <View style={styles.discoveryCalloutButton}>
            <KatchaButton disabled={enteringGrove} fullWidth icon="sparkles" label={ftueStep.actions[0]?.title ?? 'Continue'} onPress={advanceOpening} />
          </View>
        </View>
      ) : null}
      {detailCreatureId ? (() => {
        const slot = visibleCompanionSlots.find((candidate) => candidate.kind === 'owned' && candidate.creature.creatureId === detailCreatureId);
        if (!slot || slot.kind !== 'owned') return null;
        const characterId = slot.familyId as MergeCharacterId;
        const environment = HAVEN_ENVIRONMENTS[characterId];
        const currentStage = mergeWorld.haven.tileStages[characterId] ?? 0;
        const current = environment?.stages[currentStage];
        const next = environment?.stages[currentStage + 1];
        const storyReady = next ? havenStoryGateSatisfied(mergeWorld, next.storyGate) : false;
        const currentArt = havenHexTileSpec(characterId, currentStage);
        const nextArt = next ? havenHexTileSpec(characterId, next.stage) : null;
        return <KatchaSheet
          footer={<View style={styles.actions}>
            {next ? <View ref={characterId === 'mossprout' ? setRestoreButtonNode : undefined} style={styles.restoreButtonAnchor}>
              <KatchaButton
                disabled={!storyReady || mergeWorld.coins < next.coinCost || upgrading}
                fullWidth
                icon="sparkles"
                label={`Restore · ${next.coinCost} Coins`}
                onPress={() => void beginUpgrade(characterId, slot.creature.creatureId, slot.creature.name, currentStage, next)}
              />
            </View> : null}
            {ftueStepId !== 'haven.mossprout.restore' ? <KatchaButton fullWidth label={`Visit ${slot.creature.name}`} onPress={() => { setDetailCreatureId(null); onSelectCreature(slot.creature.creatureId); }} variant="secondary" /> : null}
          </View>}
          header={{ eyebrow: `${slot.creature.name.toUpperCase()} · HAVEN LV${currentStage}`, title: current?.name ?? `${slot.creature.name}’s Haven`, subtitle: current?.narrative ?? 'A home with room to grow.' }}
          onRequestClose={() => { if (ftueStepId !== 'haven.mossprout.restore') setDetailCreatureId(null); }}
          portal={ftueStepId !== 'haven.mossprout.restore'}
          scroll
          showClose={ftueStepId !== 'haven.mossprout.restore'}
          surface="night">
          <View style={styles.progressCard}>
            <ThemedText style={styles.progressEyebrow} lightColor="#B7D98B" darkColor="#B7D98B">ENVIRONMENT · {currentStage} / 4</ThemedText>
            <View style={styles.previewRow}>
              {currentArt ? <View style={styles.previewCell}>
                <Image contentFit="contain" source={kingdomHexTileSourceForLod(currentArt, 'medium')} style={styles.previewImage} />
                <ThemedText style={styles.previewLabel} lightColor="#D7E2D1" darkColor="#D7E2D1">CURRENT</ThemedText>
              </View> : null}
              {nextArt ? <View style={styles.previewCell}>
                <Image blurRadius={storyReady ? 0 : 8} contentFit="contain" source={kingdomHexTileSourceForLod(nextArt, 'medium')} style={[styles.previewImage, !storyReady && styles.previewLocked]} />
                <ThemedText style={styles.previewLabel} lightColor="#D7E2D1" darkColor="#D7E2D1">NEXT</ThemedText>
              </View> : null}
            </View>
            {next ? <>
              <ThemedText style={styles.nextTitle} lightColor="#F8FCFF" darkColor="#F8FCFF">Next: {next.name}</ThemedText>
              <ThemedText style={styles.discoveryHintText} lightColor="#D7E2D1" darkColor="#D7E2D1">{next.narrative}</ThemedText>
              <View style={styles.requirementRow}>
                <ThemedText style={styles.requirement} lightColor={storyReady ? '#CBEBA5' : '#E8C889'} darkColor={storyReady ? '#CBEBA5' : '#E8C889'}>{storyReady ? '✓ Story ready' : '◌ Story locked'}</ThemedText>
                <ThemedText style={styles.requirement} lightColor="#FFE19A" darkColor="#FFE19A">Grows through Journey Days</ThemedText>
              </View>
            </> : <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">Signature Haven complete</ThemedText>}
            {upgradeError ? <ThemedText selectable style={styles.upgradeError} lightColor="#FFD2C8" darkColor="#FFD2C8">{upgradeError}</ThemedText> : null}
          </View>
        </KatchaSheet>;
      })() : null}
      {ftueStepId === 'haven.reveal' ? <KatchaSheet
        footer={<KatchaButton fullWidth icon="leaf.fill" label="Wear Leaf Pin" onPress={onFtueReveal} />}
        header={{ eyebrow: 'NEW COSMETIC', title: 'MOSSPROUT LEAF PIN', subtitle: 'A keepsake from your first Katchimera.' }}
        onRequestClose={() => undefined}
        showClose={false}
        surface="night">
        <View style={styles.progressCard}>
              <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">First Bloom restored · Petalimp found a home.</ThemedText>
              <ThemedText style={styles.discoveryHintText} lightColor="#D7E2D1" darkColor="#D7E2D1">Mossprout is reflecting. The Garden remains open while the next relationship interaction waits.</ThemedText>
        </View>
      </KatchaSheet> : null}
      {!upgradePresentation && (ftueStepId === 'haven.mossprout.focus' || ftueStepId === 'haven.mossprout.restore') ? (
        <HavenFtueOverlay
          cue={ftueStep?.cue ?? null}
          screenRef={screenRef}
          spotlight={ftueStep?.spotlight ?? null}
          targetRefs={ftueTargetRefs}
          targetRevision={ftueTargetRevision}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  topHudLayer: {
    alignItems: 'center',
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 30,
  },
  topHud: { maxWidth: 430, width: '100%' },
  currencyHud: { flex: 1 },
  profileButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,231,0.94)',
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 27,
    borderWidth: 2,
    boxShadow: '0 4px 14px rgba(27,72,111,0.32)',
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  profileButtonPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  discoveryHint: {
    backgroundColor: 'rgba(214,203,242,0.09)',
    borderColor: 'rgba(214,203,242,0.2)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  discoveryHintText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  discoveryCalloutLayer: {
    gap: 10,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 40,
  },
  discoveryCallout: {
    alignSelf: 'center',
    backgroundColor: 'rgba(24,22,31,0.93)',
    borderColor: 'rgba(255,211,110,0.22)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 8px 22px rgba(13,10,21,0.32)',
    gap: 2,
    maxWidth: 430,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
  discoveryCalloutEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  discoveryCalloutText: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  discoveryCalloutButton: { alignSelf: 'center', maxWidth: 430, width: '100%' },
  actions: { gap: 10 },
  restoreButtonAnchor: { width: '100%' },
  progressCard: { backgroundColor: 'rgba(214,233,197,0.08)', borderColor: 'rgba(203,235,165,0.2)', borderRadius: 20, borderWidth: 1, gap: 9, padding: 17 },
  progressEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  nextTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 22, lineHeight: 27 },
  requirementRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  requirement: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  upgradeError: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  previewRow: { flexDirection: 'row', gap: 10 },
  previewCell: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, flex: 1, overflow: 'hidden', padding: 6 },
  previewImage: { aspectRatio: 1, width: '100%' },
  previewLocked: { opacity: 0.58 },
  previewLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
