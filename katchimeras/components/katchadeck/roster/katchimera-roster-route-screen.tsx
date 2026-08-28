import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { KatchimeraKingdomScreen } from '@/components/katchadeck/roster/katchimera-kingdom-screen';
import {
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
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
import { revealStoredHaven } from '@/utils/merge-world/repository';
import { MergeWorldProvider, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { advanceFtueActionDurably, commitFtueAction, dispatchFtueEvent, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';
import { equipEggAvatarHat } from '@/utils/egg-avatar-storage';
import { ensureMossproutFtueFirstResident, MOSSPROUT_FTUE_FIRST_RESIDENT_ID } from '@/features/onboarding/mossprout-profile';
import { completeMossproutJourneyResolution, recordMossproutFirstGardenRestored, recordMossproutMatchedCard, startMossproutJourneyDay } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { localDayId } from '@/utils/world-identity';
import { deriveTomorrowDayRecord, hydrateAllDays } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

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
export function KatchimeraRosterRouteScreen() {
  const isFocused = useIsFocused();
  return isFocused ? <FocusedKatchimeraRosterBoundary /> : null;
}

function FocusedKatchimeraRosterBoundary() {
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
      <FocusedKatchimeraRoster days={days} />
    </MergeWorldProvider>
  );
}

function FocusedKatchimeraRoster({ days }: { days: ReturnType<typeof useAllDays>['days'] }) {
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
  const eggVisual = useMemo(
    () => days.find((day) => day.isToday)?.egg ?? days[days.length - 1]?.egg ?? null,
    [days],
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
      <KatchimeraKingdomScreen
          background={background}
          eggVisual={eggVisual}
          onContentReady={() => setContentReady(true)}
          onOpenProfile={openProfile}
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
      />
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
