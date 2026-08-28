import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import {
  KingdomHexCanvas,
  type KingdomResidentScreenAnchor,
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { HavenTileHudLayer } from '@/components/katchadeck/world/haven-tile-hud-layer';
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { useHavenMergeSandbox } from '@/hooks/use-haven-merge-sandbox';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import type { EggVisualState } from '@/types/home';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { HAVEN_ENVIRONMENTS, havenStoryGateSatisfied, type HavenEnvironmentStage, type HavenStage } from '@/constants/haven-catalog';
import { completeMossproutHavenUpgrade } from '@/utils/companion-story-storage';
import { reconcileStoredHavenStory, upgradeStoredHavenTile } from '@/utils/merge-world/repository';
import { havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import type { HavenTileUpgradePresentation } from '@/utils/haven-upgrade-presentation';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { commitFtueAction } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';

type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  daysHatched: number;
  eggVisual: EggVisualState | null;
  onContentReady?: () => void;
  onOpenProfile: () => void;
  onOpenWorldBoardLab?: () => void;
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
  daysHatched,
  eggVisual,
  onContentReady,
  onOpenProfile,
  onOpenWorldBoardLab,
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
  const [enteringGrove, setEnteringGrove] = useState(false);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const ftueRestoreStartedRef = useRef(false);
  const ftueRecoveryRef = useRef<string | null>(null);
  const enterGroveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identity = useMemo(loadWorldIdentity, []);
  const visibleCompanionSlots = useMemo(
    () => companionSlots.filter((slot) => slot.familyId === 'mossprout'),
    [companionSlots],
  );
  const havenMergeSandboxActive = visibleCompanionSlots.some((slot) => slot.kind === 'owned');
  const havenMergeSandbox = useHavenMergeSandbox(havenMergeSandboxActive);
  const havenMergeBoard = useMemo(() => havenMergeSandbox.state ? ({
    dispatch: havenMergeSandbox.dispatch,
    state: havenMergeSandbox.state,
  }) : null, [havenMergeSandbox.dispatch, havenMergeSandbox.state]);
  const ftueStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
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
  const ownedCount = useMemo(
    () => visibleCompanionSlots.filter((slot) => slot.kind === 'owned').length,
    [visibleCompanionSlots],
  );
  const havenOpeningActive = ftueStepId === 'haven.home_notice'
    || ftueStepId === 'haven.mossprout_focus'
    || ftueStepId === 'haven.mossprout_reveal'
    || ftueStepId === 'haven.first_bloom';
  const subtitle = havenOpeningActive
    ? 'Your home in the Dream Mist'
    : [
        `${ownedCount} ${ownedCount === 1 ? 'companion' : 'companions'}`,
        `${daysHatched} ${daysHatched === 1 ? 'day together' : 'days together'}`,
      ].join('  ·  ');

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
      {!upgradePresentation ? <View style={[styles.header, { top: insets.top + 14 }]}>
        <View pointerEvents="none" style={styles.headerCopy}>
          <ThemedText selectable style={styles.eyebrow} lightColor="#FFD36E" darkColor="#FFD36E">
            YOUR HAVEN
          </ThemedText>
          <ThemedText selectable style={styles.subtitle} lightColor="#F8FCFF" darkColor="#F8FCFF">
            {subtitle}
          </ThemedText>
          <ThemedText selectable style={styles.hint} lightColor="rgba(248,252,255,0.82)" darkColor="rgba(248,252,255,0.82)">
            {havenOpeningActive ? 'Something is moving in the mist' : 'Tap a home or a mist tile'}
          </ThemedText>
        </View>
        <View style={styles.headerActions}>
          {__DEV__ && onOpenWorldBoardLab ? (
            <Pressable
              accessibilityHint="Opens the procedural world and board experiment"
              accessibilityLabel="Open World and Board Lab"
              accessibilityRole="button"
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenWorldBoardLab();
              }}
              style={({ pressed }) => [styles.labButton, pressed && styles.profileButtonPressed]}>
              <IconSymbol color="#FFF1A8" name="sparkles" size={17} />
              <ThemedText style={styles.labButtonLabel} lightColor="#FFF1A8" darkColor="#FFF1A8">LAB</ThemedText>
            </Pressable>
          ) : null}
          <Pressable
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
          </Pressable>
        </View>
      </View> : null}
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
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    left: 20,
    position: 'absolute',
    right: 16,
    zIndex: 30,
  },
  headerCopy: { flex: 1 },
  headerActions: { alignItems: 'center', gap: 7 },
  labButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(25,63,76,0.9)',
    borderColor: 'rgba(255,241,168,0.64)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    minHeight: 32,
    paddingHorizontal: 8,
  },
  labButtonLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
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
  eyebrow: {
    fontFamily: AppFontFamilies.fredokaBold,
    fontSize: 28,
    letterSpacing: 0.1,
    lineHeight: 34,
    textShadowColor: 'rgba(30,70,111,0.92)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textShadowColor: 'rgba(27,72,111,0.76)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hint: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    textShadowColor: 'rgba(27,72,111,0.76)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
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
