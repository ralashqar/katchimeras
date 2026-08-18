import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';
import { homeTabBarHeight } from '@/constants/home-loop-layout';
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
  onSelectCreature: (creatureId: string) => void;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  mergeWorld: MergeWorldState;
  ftueStepId?: string;
  onFtueRestore?: () => void;
  onFtueReveal?: () => void;
};

export function KatchimeraKingdomScreen({
  background,
  companionSlots,
  daysHatched,
  eggVisual,
  onContentReady,
  onSelectCreature,
  residentStatusGlyphs,
  mergeWorld,
  ftueStepId,
  onFtueRestore,
  onFtueReveal,
}: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [lockedHintVisible, setLockedHintVisible] = useState(false);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const [detailCreatureId, setDetailCreatureId] = useState<string | null>(null);
  const [residentAnchors, setResidentAnchors] = useState<KingdomResidentScreenAnchor[]>([]);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradePresentation, setUpgradePresentation] = useState<HavenTileUpgradePresentation | null>(null);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const ftueRestoreStartedRef = useRef(false);
  const ftueRecoveryRef = useRef<string | null>(null);
  const identity = useMemo(loadWorldIdentity, []);
  const ftueStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
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
    const mossprout = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'mossprout');
    if (mossprout?.kind === 'owned') {
      setSelectedCreatureId(mossprout.creature.creatureId);
      if (ftueStepId === 'haven.mossprout.restore') setDetailCreatureId(mossprout.creature.creatureId);
    }
  }, [companionSlots, ftueStepId]);
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
  const havenPresentations = useMemo(() => companionSlots.flatMap((slot) => {
    if (slot.kind !== 'owned' || !HAVEN_ENVIRONMENTS[slot.familyId as MergeCharacterId]) return [];
    return [deriveHavenTilePresentation({
      characterId: slot.familyId as MergeCharacterId,
      creatureId: slot.creature.creatureId,
      creatureName: slot.creature.name,
      mergeWorld,
      saving: upgrading && upgradePresentation?.characterId === slot.familyId,
    })];
  }), [companionSlots, mergeWorld, upgradePresentation?.characterId, upgrading]);
  const ownedCount = useMemo(
    () => companionSlots.filter((slot) => slot.kind === 'owned').length,
    [companionSlots],
  );
  const subtitle = [
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
        companionSlots={companionSlots}
        eggVisual={eggVisual}
        identity={identity}
        interactionEnabled={!ftueStep || ftueStep.surface !== 'haven'}
        onSelectLocked={() => { if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true); }}
        onSelectResident={selectResident}
        onResidentAnchorsChange={setResidentAnchors}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={homeTabBarHeight(insets.bottom) + 76}
        residentStatusGlyphs={residentStatusGlyphs}
        tutorialCamera={ftueStep?.camera ?? null}
        upgradePresentation={upgradePresentation}
      />
      {!upgradePresentation ? (
        <HavenTileHudLayer
          anchors={residentAnchors}
          bottomInset={homeTabBarHeight(insets.bottom)}
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
      {!upgradePresentation ? <View pointerEvents="none" style={[styles.header, { top: insets.top + 14 }]}>
        <ThemedText selectable style={styles.eyebrow} lightColor="#FFD36E" darkColor="#FFD36E">
          YOUR HAVEN
        </ThemedText>
        <ThemedText selectable style={styles.subtitle} lightColor="#F8FCFF" darkColor="#F8FCFF">
          {subtitle}
        </ThemedText>
        <ThemedText selectable style={styles.hint} lightColor="rgba(248,252,255,0.82)" darkColor="rgba(248,252,255,0.82)">
          Tap a home or a mist tile
        </ThemedText>
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
              Keep progressing on the Merge board to discover who is waiting here.
            </ThemedText>
          </View>
        </KatchaSheet>
      ) : null}
      {detailCreatureId ? (() => {
        const slot = companionSlots.find((candidate) => candidate.kind === 'owned' && candidate.creature.creatureId === detailCreatureId);
        if (!slot || slot.kind !== 'owned') return null;
        const characterId = slot.familyId as MergeCharacterId;
        const environment = HAVEN_ENVIRONMENTS[characterId];
        const currentStage = mergeWorld.haven.tileStages[characterId] ?? 0;
        const current = environment?.stages[currentStage];
        const next = environment?.stages[currentStage + 1];
        const storyReady = next ? havenStoryGateSatisfied(mergeWorld, next.storyGate) : false;
        const affordable = next ? mergeWorld.coins >= next.coinCost : false;
        const currentArt = havenHexTileSpec(characterId, currentStage);
        const nextArt = next ? havenHexTileSpec(characterId, next.stage) : null;
        return <KatchaSheet
          footer={<View style={styles.actions}>
            {next ? <View collapsable={false} ref={setRestoreButtonNode} style={styles.restoreButtonAnchor}>
              <KatchaButton
                disabled={!storyReady || !affordable}
                fullWidth
                icon="sparkles"
                label={!storyReady ? 'Continue story to unlock' : !affordable ? `${next.coinCost - mergeWorld.coins} more Coins needed` : `Restore · ${next.coinCost} Coins`}
                loading={upgrading}
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
                <ThemedText style={styles.requirement} lightColor={affordable ? '#FFE19A' : '#E8C889'} darkColor={affordable ? '#FFE19A' : '#E8C889'}>● {mergeWorld.coins} / {next.coinCost} Coins</ThemedText>
              </View>
            </> : <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">Signature Haven complete</ThemedText>}
            {upgradeError ? <ThemedText selectable style={styles.upgradeError} lightColor="#FFD2C8" darkColor="#FFD2C8">{upgradeError}</ThemedText> : null}
          </View>
        </KatchaSheet>;
      })() : null}
      {ftueStepId === 'haven.reveal' ? <KatchaSheet
        footer={<KatchaButton fullWidth icon="arrow.right" label="Continue to Merge" onPress={onFtueReveal} />}
        header={{ eyebrow: 'THE WORLD OPENS', title: 'THE HAVEN', subtitle: 'Every friend you meet brings another part of the Haven to life. A new trail is waiting back on the Merge board.' }}
        onRequestClose={() => undefined}
        showClose={false}
        surface="night">
        <View style={styles.progressCard}>
          <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">Mossprout’s little garden is only the beginning.</ThemedText>
          <ThemedText style={styles.discoveryHintText} lightColor="#D7E2D1" darkColor="#D7E2D1">Dream Mist marks the homes of friends you have not met yet.</ThemedText>
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
    left: 20,
    position: 'absolute',
    right: 82,
    zIndex: 30,
  },
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
