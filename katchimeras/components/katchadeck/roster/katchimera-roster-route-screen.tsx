import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
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
import { markFlowStart } from '@/utils/flow-performance';
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
import { revealStoredHaven } from '@/utils/merge-world/repository';
import { MergeWorldProvider, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { advanceFtueActionDurably, commitFtueAction, dispatchFtueEvent, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { ftueLocksSurfaceNavigation } from '@/features/onboarding/ftue-navigation-policy';
import { loadWorldIdentity, localDayId } from '@/utils/world-identity';
import { equipEggAvatarHat } from '@/utils/egg-avatar-storage';
import { ensureMossproutFtueFirstResident, MOSSPROUT_FTUE_FIRST_RESIDENT_ID } from '@/features/onboarding/mossprout-profile';
import { completeMossproutJourneyResolution, recordMossproutFirstGardenRestored, recordMossproutMatchedCard, startMossproutJourneyDay } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { deriveTomorrowDayRecord, hydrateAllDays } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { readyMergeOrderIds } from '@/utils/merge-world/engine';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';

const LazyKatchimeraKingdomScreen = lazy(async () => {
  const module = await import('@/components/katchadeck/roster/katchimera-kingdom-screen');
  return { default: module.KatchimeraKingdomScreen };
});

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
  onWorldSessionChange?: (session: KatchimeraWorldSession) => void;
  worldSession?: KatchimeraWorldSession;
};

const EMPTY_WORLD_SESSION: KatchimeraWorldSession = { activeWorldFamilyId: null, cameraSnapshot: null };

export function KatchimeraRosterRouteScreen({
  onWorldSessionChange,
  worldSession = EMPTY_WORLD_SESSION,
}: KatchimeraRosterRouteScreenProps = {}) {
  const isFocused = useIsFocused();
  return isFocused ? (
    <FocusedKatchimeraRosterBoundary
      onWorldSessionChange={onWorldSessionChange}
      worldSession={worldSession}
    />
  ) : null;
}

function FocusedKatchimeraRosterBoundary({ onWorldSessionChange, worldSession }: Required<Pick<KatchimeraRosterRouteScreenProps, 'worldSession'>> & Pick<KatchimeraRosterRouteScreenProps, 'onWorldSessionChange'>) {
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
      <FocusedKatchimeraRoster days={days} onWorldSessionChange={onWorldSessionChange} worldSession={worldSession} />
    </MergeWorldProvider>
  );
}

function FocusedKatchimeraRoster({ days, onWorldSessionChange, worldSession }: {
  days: ReturnType<typeof useAllDays>['days'];
  onWorldSessionChange?: (session: KatchimeraWorldSession) => void;
  worldSession: KatchimeraWorldSession;
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
  const [activeWorldFamilyId, setActiveWorldFamilyId] = useState<KatchimeraFamilyId | null>(worldSession.activeWorldFamilyId);
  const cameraSnapshotRef = useRef<KingdomCameraSnapshot | null>(worldSession.cameraSnapshot);
  const publishWorldSession = useCallback((familyId: KatchimeraFamilyId | null, snapshot = cameraSnapshotRef.current) => {
    cameraSnapshotRef.current = familyId ? snapshot : null;
    onWorldSessionChange?.({ activeWorldFamilyId: familyId, cameraSnapshot: familyId ? snapshot : null });
  }, [onWorldSessionChange]);
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
    const openingMapStep = stepId === 'haven.home_notice'
      || stepId === 'haven.mossprout_focus'
      || stepId === 'haven.mossprout_reveal';
    if (!openingMapStep) return companionSlots;
    return companionSlots.map((slot) => {
      const base = { id: slot.id, coord: slot.coord, familyId: slot.familyId };
      if (stepId === 'haven.mossprout_reveal' && slot.familyId === 'mossprout') {
        return { ...base, kind: 'revealed_egg' as const, havenStage: 0 as const, eggSkinId: 'moss' as const };
      }
      return { ...base, kind: 'locked' as const };
    });
  }, [companionSlots, ftueRun?.status, ftueRun?.stepId]);
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
      ftueRun.stepId === 'haven.mossprout_reveal'
      || ftueRun.stepId === 'haven.mossprout.restore'
      || ftueRun.stepId === 'haven.first_bloom'
      || ftueRun.stepId === 'haven.reveal'
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
  const openCreature = useCallback((creatureId: string) => {
    markFlowStart('katchimera-companion');
    transitionTo({
      announcement: 'Opening your Katchimera',
      target: 'companion',
      navigate: () => router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId } }),
    });
  }, [router, transitionTo]);
  const openProfile = useCallback(() => {
    transitionTo({
      announcement: 'Opening You',
      target: 'you',
      navigate: () => router.push('/you'),
    });
  }, [router, transitionTo]);
  const openFamilyWorld = useCallback((familyId: KatchimeraFamilyId) => {
    if (familyId !== 'mossprout') return;
    if (ftueRun?.status === 'active' && ftueRun.stepId === 'haven.mossprout_focus') {
      commitFtueAction({ actionId: 'haven.reveal_mossprout_grove', evidenceRef: 'haven:mossprout:mist-cleared' });
    }
    transitionTo({
      announcement: "Opening Mossprout's Haven",
      target: 'katchimeras',
      navigate: () => {
        setContentReady(false);
        setActiveWorldFamilyId('mossprout');
        publishWorldSession('mossprout');
      },
    });
  }, [ftueRun?.status, ftueRun?.stepId, publishWorldSession, transitionTo]);
  const continueFirstBloomToResident = useCallback(async () => {
    const now = Date.now();
    ensureMossproutFtueFirstResident();
    relationshipProgressionRepository.update((current) => {
      let journey = [...current.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
      let next = current;
      if (!journey) {
        const dayId = localDayId(new Date(now));
        const started = startMossproutJourneyDay(current, dayId, now, 0, true);
        next = recordMossproutFirstGardenRestored(started.state, dayId, 'ftue:first-bloom-recovery', now);
        next = completeMossproutJourneyResolution(next, dayId, now);
        journey = [...next.journeyDays].reverse().find((candidate) => candidate.familyId === 'mossprout') ?? null;
      }
      return journey ? recordMossproutMatchedCard(next, journey.dayId, MOSSPROUT_FTUE_FIRST_RESIDENT_ID) : next;
    });
    const result = await advanceFtueActionDurably({
      expectedStepId: 'haven.first_bloom',
      actionId: 'haven.continue_to_resident',
      evidenceRef: 'haven:first-bloom-seen',
    });
    if (result.run?.stepId !== 'companion.resident_parcel_ready') return;
    markFlowStart('katchimera-companion');
    transitionTo({
      announcement: 'Returning to Mossprout',
      target: 'companion',
      navigate: () => router.push({
        pathname: '/katchimera/[creatureId]',
        params: { creatureId: 'companion:mossprout', ftue: '1' },
      }),
    });
  }, [router, transitionTo]);
  return discovery.ready && presentationMergeWorld ? (
    <View style={styles.screen}>
      {activeWorldFamilyId === 'mossprout' ? <Suspense fallback={<View accessibilityLabel="Loading Mossprout's Haven" style={styles.worldLoading}><ActivityIndicator color="#FFF0CE" /></View>}><LazyKatchimeraKingdomScreen
          background={background}
          initialCameraSnapshot={cameraSnapshotRef.current}
          onCameraSnapshotChange={(snapshot) => publishWorldSession('mossprout', snapshot)}
          onContentReady={() => setContentReady(true)}
          onBackToHavenSelector={closeWorld}
          navigationLocked={havenNavigationLocked}
          onSelectCreature={openCreature}
          residentStatusGlyphs={statusByCreatureId}
          companionSlots={discoveryCompanionSlots}
          mergeWorld={presentationMergeWorld}
          ftueStepId={ftueRun?.status === 'active' ? ftueRun.stepId : undefined}
          onFtueInspect={() => {
            const stepId = ftueRun?.status === 'active' ? ftueRun.stepId : null;
            if (stepId === 'haven.home_notice') {
              commitFtueAction({ actionId: 'haven.notice_glow', evidenceRef: 'haven:home:noticed-glow' });
            } else if (stepId === 'haven.mossprout_focus') {
              commitFtueAction({ actionId: 'haven.reveal_mossprout_grove', evidenceRef: 'haven:mossprout:mist-cleared' });
            } else if (stepId === 'haven.mossprout_reveal') {
              commitFtueAction({ actionId: 'haven.inspect_mossprout_egg', evidenceRef: 'haven:mossprout:egg-inspected' });
            } else if (stepId === 'haven.first_bloom') {
              void continueFirstBloomToResident();
            }
          }}
          onFtueRestore={() => {
            dispatchFtueEvent({
              type: 'haven_upgrade_completed',
              characterId: 'mossprout',
              stage: 1,
              revision: presentationMergeWorld.revision,
            }, 'haven:mossprout:stage-1');
          }}
          onFtueReveal={() => {
            equipEggAvatarHat('moss-sprout');
            void revealStoredHaven().then(() => {
              commitFtueAction({ actionId: 'haven.reveal_world', evidenceRef: 'haven:revealed' });
            });
          }}
      /></Suspense> : <HavenSelectorPresentation
        background={background}
        companionSlots={discoveryCompanionSlots}
        highlightedFamilyId={ftueRun?.status === 'active' && ftueRun.stepId === 'haven.mossprout_focus' ? 'mossprout' : null}
        identity={worldIdentity}
        mergeWorld={presentationMergeWorld}
        onContentReady={() => setContentReady(true)}
        onOpenProfile={openProfile}
        onSelectFamily={openFamilyWorld}
        onSelectHome={() => {
          if (ftueRun?.status === 'active' && ftueRun.stepId === 'haven.home_notice') {
            commitFtueAction({ actionId: 'haven.notice_glow', evidenceRef: 'haven:home:noticed-glow' });
          }
        }}
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
  worldLoading: { alignItems: 'center', backgroundColor: '#55A9E2', flex: 1, justifyContent: 'center' },
});
