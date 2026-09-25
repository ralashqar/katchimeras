import { useHatchableRuns } from '@/features/onboarding/hatchable-runtime';
import { glowDiscoveryResumeWorld } from '@/features/onboarding/glow-discovery-flow';
import { useCompanionCameraCover } from '@/hooks/use-companion-camera-cover';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { sharedWorldIncludesCompanion } from '@/constants/shared-world';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { useStableCallback } from '@/hooks/use-stable-callback';
import { StyleSheet, View, type View as ViewType } from 'react-native';

import {
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { todayAtmosphereBackgroundForDay, todayAtmosphereBackgroundForScene } from '@/utils/day-background-scene';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests, questFor } from '@/utils/katchimera-quests';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { kingdomCompanionHexSlots, type KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { MergeWorldProvider, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { advanceFtueActionDurably, commitFtueAction, ftueWispForRun, updateFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { GUARDIAN_ACTION_ID, GUARDIAN_STEP_ID } from '@/features/onboarding/last-clearing';
import { installMossproutOnboardingMergeWorld } from '@/utils/merge-world/repository';
import { gameNow } from '@/utils/game-clock';
import { homeSoloForStep, OPENING_SKY_SCENE_ID } from '@/features/onboarding/opening-mist';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';
import { ftueLocksSurfaceNavigation } from '@/features/onboarding/ftue-navigation-policy';
import { deriveTomorrowDayRecord, hydrateAllDays } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';
import { mossproutWorldUsesEggRenderer, type WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
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
// Mossprout's world is the game's top level: its bundle is fetched as soon as this route's module is, not on a tap.
void loadKatchimeraKingdomScreenModule();

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
  };
}

type RosterPersistentState = ReturnType<typeof loadRosterPersistentState>;

function rosterPersistentFingerprint(state: RosterPersistentState): string {
  const activeQuestOwners = state.quests.quests
    .filter((quest) => !quest.completedAt)
    .map((quest) => quest.creatureId)
    .sort();
  return JSON.stringify([state.bond.events, activeQuestOwners]);
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
  cameraSnapshots?: Partial<Record<KatchimeraFamilyId, KingdomCameraSnapshot>>;
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
  const cameraCovered = useCompanionCameraCover('/katchimeras');
  return isFocused || cameraCovered ? (
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
  // The Last Clearing has no Egg: Mossprout has been holding the clearing all along, so its record is in the world
  // from the first frame of a fresh session (once per run; the flag is the run's own).
  const installingMossproutRef = useRef(false);
  useEffect(() => {
    if (ftueRun?.status !== 'active' || ftueRun.mergeInstalled || installingMossproutRef.current) return;
    installingMossproutRef.current = true;
    void installMossproutOnboardingMergeWorld(gameNow(), ftueWispForRun(ftueRun), { preserveHaven: true, basketParcel: true })
      .then(() => updateFtueRun({ mergeInstalled: true }))
      .catch((error) => console.warn('Could not bring Mossprout into the clearing', error))
      .finally(() => { installingMossproutRef.current = false; });
  }, [ftueRun]);
  // Any hatchable companion's live discovery or garden lesson keeps the shared world on screen.
  const hatchableRuns = useHatchableRuns();
  const glowReady = hatchableRuns.ready;
  const glowRun = Object.values(hatchableRuns.discovery).find((run) => run && run.status !== 'completed') ?? null;
  const stepplingLesson = { ready: hatchableRuns.ready, active: Object.values(hatchableRuns.lessons).some((run) => run && run.status !== 'completed') };
  const requiredWorldFamilyId = glowDiscoveryResumeWorld(glowRun) ?? (stepplingLesson.active ? 'mossprout' : null);
  const { transitionTo } = useGameScreenTransition();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const discovery = useCompanionDiscoveryRecords();
  // This component is created fresh for every focus session, so its lazy
  // initializer already reads the latest persisted days. Refreshing on that
  // same initial focus would rebuild the just-mounted grid a second time.
  const [persistentSnapshot, setPersistentSnapshot] = useState(loadRosterPersistentSnapshot);
  const [contentReady, setContentReady] = useState(false);
  // Mossprout's world is the game's top level: the Haven selector that used to sit above it (a tile per friend) is
  // gone, so the world is always the one on screen and nothing of the selector's is built or drawn.
  const cameraSnapshotRef = useRef<KingdomCameraSnapshot | null>(worldSession.cameraSnapshot);
  const cameraSnapshotsRef = useRef(worldSession.cameraSnapshots ?? (worldSession.activeWorldFamilyId && worldSession.cameraSnapshot ? { [worldSession.activeWorldFamilyId]: worldSession.cameraSnapshot } : {}));
  const publishedWorldFamilyRef = useRef<KatchimeraFamilyId | null>(worldSession.activeWorldFamilyId);
  const publishWorldSession = useCallback((familyId: KatchimeraFamilyId | null, snapshot = familyId ? cameraSnapshotsRef.current[familyId] ?? null : null) => {
    const nextSnapshot = familyId ? snapshot : null;
    if (publishedWorldFamilyRef.current === familyId && cameraSnapshotsEqual(cameraSnapshotRef.current, nextSnapshot)) return;
    publishedWorldFamilyRef.current = familyId;
    cameraSnapshotRef.current = nextSnapshot;
    if (familyId && nextSnapshot) cameraSnapshotsRef.current[familyId] = nextSnapshot;
    onWorldSessionChange?.({ activeWorldFamilyId: familyId, cameraSnapshot: nextSnapshot, cameraSnapshots: { ...cameraSnapshotsRef.current } });
  }, [onWorldSessionChange]);
  const markContentReady = useCallback(() => {
    setContentReady(true);
  }, []);
  const publishMossproutCameraSnapshot = useCallback((snapshot: KingdomCameraSnapshot) => {
    publishWorldSession('mossprout', snapshot);
  }, [publishWorldSession]);
  const { state: mergeWorld } = useMergeWorldState();
  const relationshipTileStages = useHavenTileStages();
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

  // A friend on the map is always their own art: skins are cards kept from friends' arcs, never a swap of the friend.
  const kingdom = useMemo(
    () => withDevAvailableKatchimeras(
      withDiscoveredKatchimeras(deriveKingdom(days), discovery.records),
      allKatchimerasAvailable,
    ),
    [allKatchimerasAvailable, days, discovery.records],
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
  const eggVisible = mossproutWorldUsesEggRenderer(
    ftueRun?.status === 'active' ? ftueRun.stepId : null,
    worldSubjectPresentation,
  );
  const homeFamilies = useMemo(() => new Set<string>(discovery.records.map((record) => record.characterId)), [discovery.records]);
  const discoveryCompanionSlots = useMemo<KingdomHexCompanionSlot[]>(() => {
    const stepId = ftueRun?.status === 'active' ? ftueRun.stepId : null;
    if (!stepId) return companionSlots;
    // Keep the revealed-Egg renderer only for the terminal hatch-to-creature
    // handoff. Post-hatch dialogue must use the durable owned Mossprout slot.
    // Previously those later steps stayed typed as `revealed_egg`, so a brief
    // null presentation while the hosted interaction mounted exposed a
    // sleeping Egg in Mossprout's place.
    return companionSlots.map((slot) => {
      const base = { id: slot.id, coord: slot.coord, familyId: slot.familyId };
      if (eggVisible && slot.familyId === 'mossprout') {
        return { ...base, kind: 'revealed_egg' as const, havenStage: 0 as const, eggSkinId: 'moss' as const };
      }
      // A friend rescued during the first session (Steppling, as his tile clears) is home: they stand on their tile
      // from that moment. Only friends not yet home stay locked, however established the profile.
      if (slot.familyId === 'mossprout' || (slot.kind === 'owned' && homeFamilies.has(slot.familyId))) return slot;
      return { ...base, kind: 'locked' as const };
    });
  }, [
    homeFamilies,
    companionSlots,
    ftueRun?.status,
    ftueRun?.stepId,
    eggVisible,
  ]);
  const mossproutWorldCompanionSlots = useMemo(
    () => discoveryCompanionSlots.filter((slot) => sharedWorldIncludesCompanion(slot.familyId)),
    [discoveryCompanionSlots],
  );
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  // The opening plays under a twilight sky until the hatch; the day's own sky returns with the world.
  const openingSky = ftueRun?.status === 'active' && homeSoloForStep(ftueRun.stepId);
  const background = useMemo(
    () => openingSky ? todayAtmosphereBackgroundForScene(OPENING_SKY_SCENE_ID) : todayAtmosphereBackgroundForDay(today, days),
    [days, openingSky, today],
  );
  const statusByCreatureId = useMemo(() => {
    const statuses: Partial<Record<string, KingdomResidentStatusGlyph>> = {};
    for (const creature of kingdom.creatures) {
      if (questFor(persistent.quests, creature.creatureId)) statuses[creature.creatureId] = 'active';
    }
    return statuses;
  }, [kingdom.creatures, persistent.quests]);
  const havenNavigationLocked = Boolean(requiredWorldFamilyId) || ftueLocksSurfaceNavigation(ftueRun, 'haven');
  useEffect(() => { publishWorldSession('mossprout'); }, [publishWorldSession]);
  useGameSurfaceReadiness('katchimeras', {
    background: true,
    data: discovery.ready && glowReady && stepplingLesson.ready,
    foreground: contentReady,
    layout: contentReady,
  });
  const openFtueGarden = useCallback(async () => {
    if (ftueRun?.status !== 'active' || !['world.garden_handoff', 'world.seed_planted'].includes(ftueRun.stepId)) return;
    transitionTo({
      announcement: "Opening Mossprout's Garden",
      target: 'merge',
      navigate: async () => {
        const result = await advanceFtueActionDurably({
          expectedStepId: ftueRun.stepId,
          actionId: ftueRun.stepId === 'world.seed_planted' ? 'world.acknowledge_seed_dormant' : 'world.open_garden',
          evidenceRef: 'mossprout-world:garden-button',
        });
        // The campaign pivot: the Merge page is gone; the step is advanced and the player stays on the Haven.
        void result;
      },
    });
  }, [ftueRun, router, transitionTo]);
  // Stable for the memoised Kingdom: the bodies read the live run through the callback's ref.
  const handleFtueInspect = useStableCallback(() => {
    const stepId = ftueRun?.status === 'active' ? ftueRun.stepId : null;
    if (stepId === 'world.mist_open') {
      commitFtueAction({ actionId: 'world.look_closer', evidenceRef: 'mossprout-world:look-closer' });
    } else if (stepId === GUARDIAN_STEP_ID) {
      commitFtueAction({ actionId: GUARDIAN_ACTION_ID, evidenceRef: 'mossprout-world:guardian-met' });
    } else if (stepId === 'world.egg_intro') {
      commitFtueAction({ actionId: 'world.inspect_mossprout_egg', evidenceRef: 'mossprout-world:egg-intro-seen' });
    } else if (stepId === 'world.seed_planted') {
      // The planted memory is the first light: no Merge visit, straight on to the offer.
      void advanceFtueActionDurably({ expectedStepId: 'world.seed_planted', actionId: 'world.acknowledge_seed_dormant', evidenceRef: 'mossprout-world:seed-planted' }).catch(() => {});
    } else if (stepId === 'companion.meditating') {
      void advanceFtueActionDurably({ expectedStepId: 'companion.meditating', actionId: 'companion.tend_garden' }).catch(() => {});
    }
  });
  const handleFtueOpenGarden = useStableCallback(() => { void openFtueGarden(); });
  return discovery.ready && glowReady && stepplingLesson.ready && presentationMergeWorld ? (
    <View style={styles.screen}>
      <Suspense fallback={<View style={styles.worldMountFallback} />}><LazyKatchimeraKingdomScreen
          background={background}
          initialCameraSnapshot={cameraSnapshotRef.current}
          interactionRequest={interactionRequest}
          onInteractionRequestConsumed={onInteractionRequestConsumed}
          onCameraSnapshotChange={publishMossproutCameraSnapshot}
          onContentReady={markContentReady}
          navigationLocked={havenNavigationLocked}
          residentStatusGlyphs={statusByCreatureId}
          companionSlots={mossproutWorldCompanionSlots}
          mergeWorld={presentationMergeWorld}
          ftueStepId={ftueRun?.status === 'active' ? ftueRun.stepId : undefined}
          onFtueInspect={handleFtueInspect}
          onFtueOpenGarden={handleFtueOpenGarden}
          worldEggTargetRef={worldEggTargetRef}
          worldSubjectPresentation={worldSubjectPresentation}
      /></Suspense>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  selectorHud: { left: 12, position: 'absolute', right: 12, zIndex: 20 },
  worldMountFallback: { backgroundColor: '#55A9E2', flex: 1 },
});
