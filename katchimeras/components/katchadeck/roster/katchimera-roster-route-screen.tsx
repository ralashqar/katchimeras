import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { BackHandler, Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HavenHexSelectorCanvas,
  IMPLEMENTED_KATCHIMERA_WORLDS,
  type HavenWorldMarker,
} from '@/components/katchadeck/world/haven-hex-selector-canvas';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import {
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { todayAtmosphereBackgroundForDay, type TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests, questFor } from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { kingdomCompanionHexSlots, type KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { MergeWorldProvider, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { advanceFtueActionDurably, commitFtueAction, completeFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { ftueLocksSurfaceNavigation } from '@/features/onboarding/ftue-navigation-policy';
import { loadWorldIdentity } from '@/utils/world-identity';
import { deriveTomorrowDayRecord, hydrateAllDays } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { readyMergeOrderIds } from '@/utils/merge-world/engine';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import type { MossproutWorldInteractionRequest } from '@/components/katchadeck/world/mossprout-world-interaction';

type KatchimeraKingdomScreenModule = typeof import('@/components/katchadeck/roster/katchimera-kingdom-screen');

let katchimeraKingdomScreenModulePromise: Promise<KatchimeraKingdomScreenModule> | null = null;

function loadKatchimeraKingdomScreenModule() {
  katchimeraKingdomScreenModulePromise ??= import('@/components/katchadeck/roster/katchimera-kingdom-screen');
  return katchimeraKingdomScreenModulePromise;
}

const LazyKatchimeraKingdomScreen = lazy(async () => {
  const module = await loadKatchimeraKingdomScreenModule();
  return { default: module.KatchimeraKingdomScreen };
});

function cameraSnapshotsEqual(left: KingdomCameraSnapshot | null, right: KingdomCameraSnapshot | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return Math.abs(left.tx - right.tx) < 0.01
    && Math.abs(left.ty - right.ty) < 0.01
    && Math.abs(left.scale - right.scale) < 0.0001;
}

function hatchTimestamp(creature: KingdomCreature, index: number): number {
  const time = Date.parse(`${creature.isoDate}T00:00:00`);
  return Number.isFinite(time) ? time + index : index;
}

function loadRosterPersistentState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const quests = loadCompanionQuests(resolveCompanionId);
  return {
    bond: loadCompanionBondState(quests, resolveCompanionId, homeState),
    quests,
    wardrobe: loadKatchimeraWardrobe(),
  };
}

type RosterPersistentState = ReturnType<typeof loadRosterPersistentState>;

function rosterPersistentFingerprint(state: RosterPersistentState): string {
  const activeQuestOwners = state.quests.quests
    .filter((quest) => !quest.completedAt)
    .map((quest) => quest.creatureId)
    .sort();
  const equippedSkins = Object.entries(state.wardrobe.equippedByFamily)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([state.bond.events, activeQuestOwners, equippedSkins]);
}

function loadRosterPersistentSnapshot() {
  const state = loadRosterPersistentState();
  return { fingerprint: rosterPersistentFingerprint(state), state };
}

/**
 * The tab owns only the collection read model. Companion, journey, discovery,
 * journal, and mini-game controllers mount on their dedicated routes.
 */
export type KatchimeraWorldSession = {
  activeWorldFamilyId: KatchimeraFamilyId | null;
  cameraSnapshot: KingdomCameraSnapshot | null;
};

type KatchimeraRosterRouteScreenProps = {
  interactionRequest?: MossproutWorldInteractionRequest | null;
  onInteractionRequestConsumed?: () => void;
  onWorldSessionChange?: (session: KatchimeraWorldSession) => void;
  worldEggTargetRef?: RefObject<ViewType | null>;
  worldSession?: KatchimeraWorldSession;
  worldSubjectPresentation?: WorldFtueSubjectPresentation | null;
};

const EMPTY_WORLD_SESSION: KatchimeraWorldSession = { activeWorldFamilyId: null, cameraSnapshot: null };

export function KatchimeraRosterRouteScreen({
  interactionRequest = null,
  onInteractionRequestConsumed,
  onWorldSessionChange,
  worldEggTargetRef,
  worldSession = EMPTY_WORLD_SESSION,
  worldSubjectPresentation = null,
}: KatchimeraRosterRouteScreenProps = {}) {
  const isFocused = useIsFocused();
  return isFocused ? (
    <FocusedKatchimeraRosterBoundary
      interactionRequest={interactionRequest}
      onInteractionRequestConsumed={onInteractionRequestConsumed}
      onWorldSessionChange={onWorldSessionChange}
      worldEggTargetRef={worldEggTargetRef}
      worldSession={worldSession}
      worldSubjectPresentation={worldSubjectPresentation}
    />
  ) : null;
}

function FocusedKatchimeraRosterBoundary({ interactionRequest, onInteractionRequestConsumed, onWorldSessionChange, worldEggTargetRef, worldSession, worldSubjectPresentation }: Required<Pick<KatchimeraRosterRouteScreenProps, 'worldSession'>> & Pick<KatchimeraRosterRouteScreenProps, 'interactionRequest' | 'onInteractionRequestConsumed' | 'onWorldSessionChange' | 'worldEggTargetRef' | 'worldSubjectPresentation'>) {
  const { days } = useAllDays({ refreshOnFocus: false });
  const mergePersistent = useMemo(() => {
    const now = new Date();
    const homeState = homeRepository.load();
    const profile = loadOnboardingProfile();
    const hydratedDays = hydrateAllDays(homeState, profile, now);
    const currentDays = hydratedDays.length > 0 ? hydratedDays : days;
    const activityDays = homeState?.tomorrow
      ? [...currentDays, deriveTomorrowDayRecord(homeState, profile, now)]
      : currentDays;
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    return {
      activityDays,
      characterIds: ['mossprout'],
      quests: loadCompanionQuests(resolveCompanionId),
    };
  }, [days]);

  return (
    <MergeWorldProvider
      active
      characterIds={mergePersistent.characterIds}
      days={mergePersistent.activityDays}
      featuredCharacterId="mossprout"
      questState={mergePersistent.quests}>
      <FocusedKatchimeraRoster days={days} interactionRequest={interactionRequest} onInteractionRequestConsumed={onInteractionRequestConsumed} onWorldSessionChange={onWorldSessionChange} worldEggTargetRef={worldEggTargetRef} worldSession={worldSession} worldSubjectPresentation={worldSubjectPresentation} />
    </MergeWorldProvider>
  );
}

function FocusedKatchimeraRoster({ days, interactionRequest, onInteractionRequestConsumed, onWorldSessionChange, worldEggTargetRef, worldSession, worldSubjectPresentation }: {
  days: ReturnType<typeof useAllDays>['days'];
  interactionRequest?: MossproutWorldInteractionRequest | null;
  onInteractionRequestConsumed?: () => void;
  onWorldSessionChange?: (session: KatchimeraWorldSession) => void;
  worldEggTargetRef?: RefObject<ViewType | null>;
  worldSession: KatchimeraWorldSession;
  worldSubjectPresentation?: WorldFtueSubjectPresentation | null;
}) {
  const router = useRouter();
  const ftueRun = useFtueRun();
  const { transitionTo } = useGameScreenTransition();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const discovery = useCompanionDiscoveryRecords();
  // This component is created fresh for every focus session, so its lazy
  // initializer already reads the latest persisted days. Refreshing on that
  // same initial focus would rebuild the just-mounted grid a second time.
  const [persistentSnapshot, setPersistentSnapshot] = useState(loadRosterPersistentSnapshot);
  const [contentReady, setContentReady] = useState(false);
  const [activeWorldFamilyId, setActiveWorldFamilyId] = useState<KatchimeraFamilyId | null>(
    worldSession.activeWorldFamilyId ?? (ftueRun?.status === 'active' || interactionRequest ? 'mossprout' : null),
  );
  const cameraSnapshotRef = useRef<KingdomCameraSnapshot | null>(worldSession.cameraSnapshot);
  const publishedWorldFamilyRef = useRef<KatchimeraFamilyId | null>(worldSession.activeWorldFamilyId);
  const publishWorldSession = useCallback((familyId: KatchimeraFamilyId | null, snapshot = cameraSnapshotRef.current) => {
    const nextSnapshot = familyId ? snapshot : null;
    if (publishedWorldFamilyRef.current === familyId && cameraSnapshotsEqual(cameraSnapshotRef.current, nextSnapshot)) return;
    publishedWorldFamilyRef.current = familyId;
    cameraSnapshotRef.current = nextSnapshot;
    onWorldSessionChange?.({ activeWorldFamilyId: familyId, cameraSnapshot: nextSnapshot });
  }, [onWorldSessionChange]);
  const markContentReady = useCallback(() => {
    setContentReady(true);
  }, []);
  const publishMossproutCameraSnapshot = useCallback((snapshot: KingdomCameraSnapshot) => {
    publishWorldSession('mossprout', snapshot);
  }, [publishWorldSession]);
  const { state: mergeWorld } = useMergeWorldState();
  const relationshipTileStages = useHavenTileStages();
  const worldIdentity = useMemo(loadWorldIdentity, []);
  const hasCompletedInitialFocus = useRef(false);
  const persistent = persistentSnapshot.state;

  useFocusEffect(
    useCallback(() => {
      if (!hasCompletedInitialFocus.current) {
        hasCompletedInitialFocus.current = true;
        return;
      }
      const next = loadRosterPersistentSnapshot();
      setPersistentSnapshot((current) => (
        current.fingerprint === next.fingerprint ? current : next
      ));
    }, []),
  );
  useEffect(() => {
    if (!interactionRequest || activeWorldFamilyId === 'mossprout') return;
    setContentReady(false);
    setActiveWorldFamilyId('mossprout');
    publishWorldSession('mossprout');
  }, [activeWorldFamilyId, interactionRequest, publishWorldSession]);

  const kingdom = useMemo(
    () => applyWardrobeToKingdom(
      withDevAvailableKatchimeras(
        withDiscoveredKatchimeras(deriveKingdom(days), discovery.records),
        allKatchimerasAvailable,
      ),
      persistent.wardrobe,
    ),
    [allKatchimerasAvailable, days, discovery.records, persistent.wardrobe],
  );
  const hatches = useMemo<HatchRecord[]>(
    () => kingdom.creatures.map((creature, index) => ({
      creatureId: creature.creatureId,
      hatchedAt: hatchTimestamp(creature, index),
    })),
    [kingdom.creatures],
  );
  const residents = useMemo(() => deriveResidents(hatches), [hatches]);
  const presentationMergeWorld = useMemo(() => mergeWorld ? {
    ...mergeWorld,
    haven: { ...mergeWorld.haven, tileStages: relationshipTileStages },
  } : null, [mergeWorld, relationshipTileStages]);
  const companionSlots = useMemo(
    () => kingdomCompanionHexSlots(residents, kingdom.creatures, relationshipTileStages as Partial<Record<KatchimeraFamilyId, 0 | 1 | 2 | 3 | 4>>),
    [kingdom.creatures, relationshipTileStages, residents],
  );
  // A first-session restart must still look like a first discovery when the
  // developer keeps an established profile and past days.
  const discoveryCompanionSlots = useMemo<KingdomHexCompanionSlot[]>(() => {
    const stepId = ftueRun?.status === 'active' ? ftueRun.stepId : null;
    if (!stepId) return companionSlots;
    const eggVisible = stepId === 'world.egg_intro'
      || stepId === 'egg.opening'
      || stepId === 'egg.context'
      || stepId === 'egg.mind'
      || stepId === 'egg.ready'
      || stepId === 'companion.first_meeting'
      || stepId === 'companion.bond_spotlight'
      || stepId === 'companion.day_one_action'
      || stepId === 'companion.garden_intro'
      || stepId === 'companion.order_preview';
    return companionSlots.map((slot) => {
      const base = { id: slot.id, coord: slot.coord, familyId: slot.familyId };
      if (eggVisible && slot.familyId === 'mossprout') {
        return { ...base, kind: 'revealed_egg' as const, havenStage: 0 as const, eggSkinId: 'moss' as const };
      }
      return slot.familyId === 'mossprout' ? slot : { ...base, kind: 'locked' as const };
    });
  }, [companionSlots, ftueRun?.status, ftueRun?.stepId]);
  const mossproutWorldCompanionSlots = useMemo(
    () => discoveryCompanionSlots.filter((slot) => slot.familyId === 'mossprout'),
    [discoveryCompanionSlots],
  );
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const background = useMemo(
    () => todayAtmosphereBackgroundForDay(today, days),
    [days, today],
  );
  const statusByCreatureId = useMemo(() => {
    const statuses: Partial<Record<string, KingdomResidentStatusGlyph>> = {};
    for (const creature of kingdom.creatures) {
      if (questFor(persistent.quests, creature.creatureId)) statuses[creature.creatureId] = 'active';
    }
    return statuses;
  }, [kingdom.creatures, persistent.quests]);
  const worldMarkers = useMemo<readonly HavenWorldMarker[]>(() => {
    const world = presentationMergeWorld ?? mergeWorld;
    if (!world) return [];
    const readyOrderIds = readyMergeOrderIds(world);
    const readyFamilies = new Set(
      world.activeOrders
        .filter((order) => readyOrderIds.has(order.id))
        .map((order) => order.characterId),
    );
    return discoveryCompanionSlots.flatMap((slot) => {
      if (slot.kind !== 'owned') return [];
      const family = katchimeraFamilyById.get(slot.familyId);
      if (!family) return [];
      const haven = deriveHavenTilePresentation({
        characterId: slot.familyId as MergeCharacterId,
        creatureId: slot.creature.creatureId,
        creatureName: family.displayName,
        mergeWorld: world,
      });
      const notification: HavenWorldMarker['notification'] = readyFamilies.has(slot.familyId as MergeCharacterId)
        ? 'ready'
        : haven.hudState === 'affordable'
          ? 'upgrade'
          : statusByCreatureId[slot.creature.creatureId]
            ? 'active'
            : null;
      return [{
        displayName: family.displayName,
        enterable: IMPLEMENTED_KATCHIMERA_WORLDS.has(slot.familyId),
        familyId: slot.familyId,
        notification,
        portraitSource: resolveCreatureArtSource(slot.creature.visualKey, { lod: 'thumb', stage: 'grown' }),
        restorationMaximum: 4,
        restorationStage: slot.havenStage,
      }];
    });
  }, [discoveryCompanionSlots, mergeWorld, presentationMergeWorld, statusByCreatureId]);
  const havenNavigationLocked = ftueLocksSurfaceNavigation(ftueRun, 'haven');
  useEffect(() => {
    if (ftueRun?.status !== 'active') return;
    if (
      ftueRun.stepId === 'world.egg_intro'
      || ftueRun.stepId.startsWith('egg.')
      || ftueRun.stepId === 'world.garden_arrival'
      || ftueRun.stepId === 'world.garden_handoff'
      || ftueRun.stepId === 'world.first_bloom_restore'
      || ftueRun.stepId === 'companion.meditating'
    ) {
      setActiveWorldFamilyId('mossprout');
      publishWorldSession('mossprout');
    }
  }, [ftueRun?.status, ftueRun?.stepId, publishWorldSession]);
  const closeWorld = useCallback(() => {
    if (havenNavigationLocked) return;
    transitionTo({
      announcement: 'Returning to all Havens',
      target: 'katchimeras',
      navigate: () => {
        setContentReady(false);
        setActiveWorldFamilyId(null);
        publishWorldSession(null);
      },
    });
  }, [havenNavigationLocked, publishWorldSession, transitionTo]);
  useEffect(() => {
    if (!activeWorldFamilyId || havenNavigationLocked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeWorld();
      return true;
    });
    return () => subscription.remove();
  }, [activeWorldFamilyId, closeWorld, havenNavigationLocked]);
  useGameSurfaceReadiness('katchimeras', {
    background: true,
    data: discovery.ready,
    foreground: contentReady,
    layout: contentReady,
  });
  const openProfile = useCallback(() => {
    transitionTo({
      announcement: 'Opening You',
      target: 'you',
      navigate: () => router.push('/you'),
    });
  }, [router, transitionTo]);
  const openFamilyWorld = useCallback((familyId: KatchimeraFamilyId) => {
    if (familyId !== 'mossprout') return;
    // Start resolving the focused-world bundle while the universal curtain is
    // moving down. The destination mounts only once the curtain is opaque.
    void loadKatchimeraKingdomScreenModule();
    transitionTo({
      announcement: "Opening Mossprout's Haven",
      target: 'katchimeras',
      navigate: () => {
        setContentReady(false);
        setActiveWorldFamilyId('mossprout');
        publishWorldSession('mossprout');
      },
    });
  }, [publishWorldSession, transitionTo]);
  const openFtueGarden = useCallback(async () => {
    if (ftueRun?.status !== 'active' || ftueRun.stepId !== 'world.garden_handoff') return;
    transitionTo({
      announcement: "Opening Mossprout's Garden",
      target: 'merge',
      navigate: async () => {
        const result = await advanceFtueActionDurably({
          expectedStepId: 'world.garden_handoff',
          actionId: 'world.open_garden',
          evidenceRef: 'mossprout-world:garden-button',
        });
        if (result.run?.status !== 'active' || result.step?.surface !== 'merge') {
          throw new Error('Mossprout Garden did not accept FTUE ownership');
        }
        router.push({
          pathname: '/katchimera/[creatureId]/activity',
          params: { creatureId: 'companion:mossprout' },
        });
      },
    });
  }, [ftueRun, router, transitionTo]);
  return discovery.ready && presentationMergeWorld ? (
    <View style={styles.screen}>
      {activeWorldFamilyId === 'mossprout' ? <Suspense fallback={<View style={styles.worldMountFallback} />}><LazyKatchimeraKingdomScreen
          background={background}
          initialCameraSnapshot={cameraSnapshotRef.current}
          interactionRequest={interactionRequest}
          onInteractionRequestConsumed={onInteractionRequestConsumed}
          onCameraSnapshotChange={publishMossproutCameraSnapshot}
          onContentReady={markContentReady}
          onBackToHavenSelector={closeWorld}
          navigationLocked={havenNavigationLocked}
          residentStatusGlyphs={statusByCreatureId}
          companionSlots={mossproutWorldCompanionSlots}
          mergeWorld={presentationMergeWorld}
          ftueStepId={ftueRun?.status === 'active' ? ftueRun.stepId : undefined}
          onFtueInspect={() => {
            const stepId = ftueRun?.status === 'active' ? ftueRun.stepId : null;
            if (stepId === 'world.egg_intro') {
              commitFtueAction({ actionId: 'world.inspect_mossprout_egg', evidenceRef: 'mossprout-world:egg-intro-seen' });
            } else if (stepId === 'world.garden_arrival') {
              commitFtueAction({ actionId: 'world.acknowledge_garden', evidenceRef: 'mossprout-world:garden-arrival' });
            } else if (stepId === 'companion.meditating') {
              commitFtueAction({ actionId: 'companion.tend_garden', evidenceRef: 'mossprout-world:ftue-complete' });
              // A replayed terminal receipt is intentionally a no-op. Always
              // release FTUE ownership so interrupted prior presses cannot
              // leave Garden navigation locked after the ending disappears.
              completeFtueRun();
            }
          }}
          onFtueOpenGarden={() => void openFtueGarden()}
          worldEggTargetRef={worldEggTargetRef}
          worldSubjectPresentation={worldSubjectPresentation}
      /></Suspense> : <HavenSelectorPresentation
        background={background}
        companionSlots={discoveryCompanionSlots}
        highlightedFamilyId={null}
        identity={worldIdentity}
        mergeWorld={presentationMergeWorld}
        onContentReady={markContentReady}
        onOpenProfile={openProfile}
        onSelectFamily={openFamilyWorld}
        onSelectHome={() => {}}
        worldMarkers={worldMarkers}
      />}
    </View>
  ) : null;
}

function HavenSelectorPresentation({
  background,
  companionSlots,
  highlightedFamilyId,
  identity,
  mergeWorld,
  onContentReady,
  onOpenProfile,
  onSelectFamily,
  onSelectHome,
  worldMarkers,
}: {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  highlightedFamilyId: KatchimeraFamilyId | null;
  identity: ReturnType<typeof loadWorldIdentity>;
  mergeWorld: MergeWorldState;
  onContentReady: () => void;
  onOpenProfile: () => void;
  onSelectFamily: (familyId: KatchimeraFamilyId) => void;
  onSelectHome: () => void;
  worldMarkers: readonly HavenWorldMarker[];
}) {
  const insets = useSafeAreaInsets();
  const avatar = useEggAvatar();
  return <View style={styles.screen}>
    <HavenHexSelectorCanvas
      background={background}
      companionSlots={companionSlots}
      highlightedFamilyId={highlightedFamilyId}
      identity={identity}
      onContentReady={onContentReady}
      onSelectFamily={onSelectFamily}
      onSelectHome={onSelectHome}
      recenterBottom={Math.max(insets.bottom, 12) + 68}
      worldMarkers={worldMarkers}
    />
    <View pointerEvents="box-none" style={[styles.selectorHud, { top: insets.top + 3 }]}>
      <GameHudBar
        content={<GameCurrencyHud balances={[{ art: GAME_CURRENCY_ART.coins, id: 'coins', value: mergeWorld.coins }]} tone="glass" />}
        density="compact"
        tone="glass"
        trailing={<Pressable
          accessibilityHint="Opens your avatar and cosmetics"
          accessibilityLabel="Open You"
          accessibilityRole="button"
          onPress={onOpenProfile}
          style={({ pressed }) => [styles.selectorProfileButton, pressed && styles.selectorProfileButtonPressed]}>
          <EggAvatar faceId={avatar.equippedFaceId} hatId={avatar.equippedHatId} heldAccessoryId={avatar.equippedHeldAccessoryId} presentation="button" size={42} skinId={avatar.equippedSkinId} />
        </Pressable>}
      />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  selectorHud: { left: 12, position: 'absolute', right: 12, zIndex: 20 },
  selectorProfileButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,249,231,0.96)',
    borderColor: 'rgba(255,255,255,0.92)',
    borderCurve: 'continuous',
    borderRadius: 25,
    borderWidth: 2,
    boxShadow: '0 4px 14px rgba(27,72,111,0.3)',
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
  selectorProfileButtonPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  worldMountFallback: { backgroundColor: '#55A9E2', flex: 1 },
});
