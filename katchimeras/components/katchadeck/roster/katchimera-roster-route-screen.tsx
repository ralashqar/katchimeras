import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import { useAllDays } from '@/hooks/use-all-days';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import { companionBondProgress } from '@/utils/companion-bond';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests, questFor } from '@/utils/katchimera-quests';
import { buildKatchimeraRoster } from '@/utils/katchimera-roster';
import { markFlowStart } from '@/utils/flow-performance';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';

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

/**
 * The tab owns only the collection read model. Companion, journey, discovery,
 * journal, and mini-game controllers mount on their dedicated routes.
 */
export function KatchimeraRosterRouteScreen() {
  const isFocused = useIsFocused();

  return isFocused ? <FocusedKatchimeraRoster /> : <View style={{ flex: 1, backgroundColor: '#171A12' }} />;
}

function FocusedKatchimeraRoster() {
  const router = useRouter();
  const { days } = useAllDays();
  const [persistent, setPersistent] = useState(loadRosterPersistentState);

  useFocusEffect(
    useCallback(() => {
      setPersistent(loadRosterPersistentState());
    }, []),
  );

  const kingdom = useMemo(
    () => applyWardrobeToKingdom(deriveKingdom(days), persistent.wardrobe),
    [days, persistent.wardrobe],
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
  const items = useMemo(
    () => buildKatchimeraRoster({
      creatures: kingdom.creatures,
      residents,
      bondForCreature,
      statusByCreatureId,
    }),
    [bondForCreature, kingdom.creatures, residents, statusByCreatureId],
  );
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
