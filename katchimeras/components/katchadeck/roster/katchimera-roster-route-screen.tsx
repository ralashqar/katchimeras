import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import { companionBondProgress } from '@/utils/companion-bond';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests, questFor } from '@/utils/katchimera-quests';
import {
  buildKatchimeraRoster,
  reconcileKatchimeraRoster,
  type KatchimeraRosterItem,
} from '@/utils/katchimera-roster';
import { markFlowStart } from '@/utils/flow-performance';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';

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

  // Release the FlashList cell pool and its animated/image views while a
  // companion or mini-game owns the screen. A fresh mount gives every return
  // one clean entrance animation without keeping the roster alive underneath.
  return isFocused ? <FocusedKatchimeraRoster /> : null;
}

function FocusedKatchimeraRoster() {
  const router = useRouter();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  // This component is created fresh for every focus session, so its lazy
  // initializer already reads the latest persisted days. Refreshing on that
  // same initial focus would rebuild the just-mounted grid a second time.
  const { days } = useAllDays({ refreshOnFocus: false });
  const [persistentSnapshot, setPersistentSnapshot] = useState(loadRosterPersistentSnapshot);
  const hasCompletedInitialFocus = useRef(false);
  const previousItems = useRef<readonly KatchimeraRosterItem[]>([]);
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
      withDevAvailableKatchimeras(deriveKingdom(days), allKatchimerasAvailable),
      persistent.wardrobe,
    ),
    [allKatchimerasAvailable, days, persistent.wardrobe],
  );
  const hatches = useMemo<HatchRecord[]>(
    () => kingdom.creatures.map((creature, index) => ({
      creatureId: creature.creatureId,
      hatchedAt: hatchTimestamp(creature, index),
    })),
    [kingdom.creatures],
  );
  const residents = useMemo(() => deriveResidents(hatches), [hatches]);
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const background = useMemo(
    () => todayAtmosphereBackgroundForDay(today, days),
    [days, today],
  );
  const statusByCreatureId = useMemo(() => {
    const statuses: Partial<Record<string, 'active'>> = {};
    for (const creature of kingdom.creatures) {
      if (questFor(persistent.quests, creature.creatureId)) statuses[creature.creatureId] = 'active';
    }
    return statuses;
  }, [kingdom.creatures, persistent.quests]);
  const bondForCreature = useCallback(
    (creatureId: string) => companionBondProgress(persistent.bond, creatureId),
    [persistent.bond],
  );
  const items = useMemo(() => {
    const next = buildKatchimeraRoster({
      creatures: kingdom.creatures,
      residents,
      bondForCreature,
      statusByCreatureId,
    });
    const reconciled = reconcileKatchimeraRoster(previousItems.current, next);
    previousItems.current = reconciled;
    return reconciled;
  }, [bondForCreature, kingdom.creatures, residents, statusByCreatureId]);
  const openCreature = useCallback((creatureId: string) => {
    markFlowStart('katchimera-companion');
    router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId } });
  }, [router]);
  const goToday = useCallback(() => router.navigate('/today'), [router]);

  return (
    <KatchimeraRosterScreen
      background={background}
      items={items}
      onGoToday={goToday}
      onSelectCreature={openCreature}
    />
  );
}
