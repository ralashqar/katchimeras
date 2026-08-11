import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { GameHubScreen } from '@/components/katchadeck/games/game-hub-screen';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { buildGameHubItems, buildOwnedGameCompanions, selectTodayCareGame, type GameHubItem } from '@/utils/game-hub';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { acceptGameHubQuest, loadCompanionQuests, saveCompanionQuests } from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { resolveInteractiveQuestConfig } from '@/utils/quests/interactive-session';
import { todayKatchimeraExplorationBackgroundKeyForPresentation } from '@/utils/today-exploration-backgrounds';
import { localDayId } from '@/utils/world-identity-rules';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { markFlowStart } from '@/utils/flow-performance';
import {
  cancelTodayCareGameRound,
  consumeTodayCareGameRoundLaunch,
} from '@/utils/today-care-game-round';

function loadPersistentState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const quests = loadCompanionQuests(resolveCompanionId);
  return {
    homeState,
    quests,
    bond: loadCompanionBondState(quests, resolveCompanionId, homeState),
    wardrobe: loadKatchimeraWardrobe(),
  };
}

export function GameHubRouteScreen({ legacy = false }: { legacy?: boolean } = {}) {
  const router = useRouter();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const { days } = useAllDays({ refreshOnFocus: false });
  const [persistent, setPersistent] = useState(loadPersistentState);
  const hasFocused = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!hasFocused.current) {
      hasFocused.current = true;
      return;
    }
    setPersistent(loadPersistentState());
  }, []));

  const kingdom = useMemo(
    () => applyWardrobeToKingdom(
      withDevAvailableKatchimeras(deriveKingdom(days), allKatchimerasAvailable),
      persistent.wardrobe,
    ),
    [allKatchimerasAvailable, days, persistent.wardrobe]
  );
  const companions = useMemo(
    () => buildOwnedGameCompanions(kingdom.creatures, persistent.bond),
    [kingdom.creatures, persistent.bond],
  );
  const dayId = localDayId();
  const items = useMemo(
    () => buildGameHubItems({ companions, questState: persistent.quests, dayId }),
    [companions, dayId, persistent.quests]
  );
  const todayBackgroundKey = useMemo(() => {
    const today = days.find((day) => day.isToday) ?? null;
    if (!today || today.state !== 'hatched' || !today.creature) return 'home' as const;
    return todayKatchimeraExplorationBackgroundKeyForPresentation({
      creature: today.creature,
      environmentVisualKey: today.card?.scene?.environment?.visualKey,
    }) ?? 'home';
  }, [days]);

  const openGame = useCallback((item: GameHubItem, fromTodayCare = false): boolean => {
    if (!item.creatureId || item.locked) return false;
    const latest = loadPersistentState();
    const acceptedAt = Date.now();
    const seed = `${item.creatureId}:${item.questId}:${dayId}:${acceptedAt.toString(36)}`;
    const config = resolveInteractiveQuestConfig(latest.quests, item.creatureId, item.questId, seed);
    if (!config) return false;
    const accepted = acceptGameHubQuest(latest.quests, {
      questId: item.questId,
      creatureId: item.creatureId,
      title: item.title,
      hint: item.description,
      dayId,
      offerSeed: seed,
      resolvedConfig: config,
    }, acceptedAt);
    saveCompanionQuests(accepted.state);
    markFlowStart('game-hub-game');
    router.push({
      pathname: '/game/[questId]',
      params: {
        questId: item.questId,
        creatureId: item.creatureId,
        companionName: item.displayCompanionName,
        visualKey: item.displayVisualKey ?? undefined,
        todayCareRound: fromTodayCare ? '1' : undefined,
      },
    });
    return true;
  }, [dayId, router]);

  useFocusEffect(useCallback(() => {
    const launch = consumeTodayCareGameRoundLaunch();
    if (!launch) return;
    const requestedQuestId = launch.action.destination.kind === 'mini_game'
      ? launch.action.destination.questId
      : null;
    const next = items.find((item) => item.questId === requestedQuestId && !item.locked && item.creatureId)
      ?? selectTodayCareGame(items, dayId);
    if (next && openGame(next, true)) return;
    cancelTodayCareGameRound();
    router.navigate('/today');
  }, [dayId, items, openGame, router]));

  return (
    <GameHubScreen
      backgroundKey={todayBackgroundKey}
      items={items}
      onClose={legacy ? () => router.back() : undefined}
      onOpenGame={openGame}
      onViewKatchimeras={() => router.navigate('/katchimeras')}
    />
  );
}
