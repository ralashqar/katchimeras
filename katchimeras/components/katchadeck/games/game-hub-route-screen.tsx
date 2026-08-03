import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { GameHubScreen } from '@/components/katchadeck/games/game-hub-screen';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import { companionBondProgress } from '@/utils/companion-bond';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { buildGameHubItems, type GameHubItem, type OwnedGameCompanion } from '@/utils/game-hub';
import { companionIdResolverForHomeState, identityForCreature } from '@/utils/katchimera-identity';
import { acceptGameHubQuest, loadCompanionQuests, saveCompanionQuests } from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { resolveInteractiveQuestConfig } from '@/utils/quests/interactive-session';
import { todayKatchimeraExplorationBackgroundKeyForPresentation } from '@/utils/today-exploration-backgrounds';
import { localDayId } from '@/utils/world-identity-rules';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';

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

export function GameHubRouteScreen() {
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
  const companions = useMemo<OwnedGameCompanion[]>(() => {
    const seen = new Set<string>();
    const owned: OwnedGameCompanion[] = [];
    for (const creature of kingdom.creatures) {
      const identity = identityForCreature({ ...creature, encounterProfileId: null });
      if (!identity || seen.has(identity.familyId)) continue;
      seen.add(identity.familyId);
      owned.push({
        familyId: identity.familyId,
        creatureId: identity.companionId,
        name: katchimeraSkinById.get(identity.skinId)?.displayName ?? creature.name,
        visualKey: creature.visualKey,
        bondLevel: companionBondProgress(persistent.bond, identity.companionId).level,
      });
    }
    return owned;
  }, [kingdom.creatures, persistent.bond]);
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

  const openGame = useCallback((item: GameHubItem) => {
    if (!item.creatureId || item.locked) return;
    const latest = loadPersistentState();
    const acceptedAt = Date.now();
    const seed = `${item.creatureId}:${item.questId}:${dayId}:${acceptedAt.toString(36)}`;
    const config = resolveInteractiveQuestConfig(latest.quests, item.creatureId, item.questId, seed);
    if (!config) return;
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
    router.push({ pathname: '/game/[questId]', params: { questId: item.questId, creatureId: item.creatureId } });
  }, [dayId, router]);

  return (
    <GameHubScreen
      backgroundKey={todayBackgroundKey}
      items={items}
      onOpenGame={openGame}
      onViewKatchimeras={() => router.navigate('/katchimeras')}
    />
  );
}
