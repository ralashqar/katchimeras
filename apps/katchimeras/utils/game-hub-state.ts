import type { HomeDayRecord } from '@/types/home';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { buildGameHubItems, buildOwnedGameCompanions, type GameHubItem } from '@/utils/game-hub';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';

export function loadGameHubItemsForDays(input: {
  allKatchimerasAvailable: boolean;
  dayId: string;
  days: readonly HomeDayRecord[];
}): GameHubItem[] {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const quests = loadCompanionQuests(resolveCompanionId);
  const bond = loadCompanionBondState(quests, resolveCompanionId, homeState);
  const kingdom = applyWardrobeToKingdom(
    withDevAvailableKatchimeras(deriveKingdom([...input.days]), input.allKatchimerasAvailable),
    loadKatchimeraWardrobe(),
  );
  return buildGameHubItems({
    companions: buildOwnedGameCompanions(kingdom.creatures, bond),
    dayId: input.dayId,
    questState: quests,
  });
}
