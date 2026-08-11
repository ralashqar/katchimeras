import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MergeWorldScreen } from '@/components/katchadeck/games/merge-world-screen';
import { CompanionGameBackdrop } from '@/components/katchadeck/world/companion-game-backdrop';
import { MergeWorldProvider } from '@/features/merge-world/merge-world-provider';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { buildOwnedGameCompanions } from '@/utils/game-hub';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { applyWardrobeToKingdom } from '@/utils/katchimera-wardrobe';
import { loadKatchimeraWardrobe } from '@/utils/katchimera-wardrobe-storage';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { todayKatchimeraExplorationBackgroundKeyForEnvironment } from '@/utils/today-exploration-backgrounds';

const FEASTLE_ART = resolveCreatureArtSource('feastle');
const FEASTLE_ENVIRONMENT = todayKatchimeraExplorationBackgroundKeyForEnvironment('feastle');

export function MergeWorldRouteScreen() {
  const { days } = useAllDays();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const persistent = useMemo(() => {
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const quests = loadCompanionQuests(resolveCompanionId);
    const bond = loadCompanionBondState(quests, resolveCompanionId, homeState);
    const kingdom = applyWardrobeToKingdom(
      withDevAvailableKatchimeras(deriveKingdom([...days]), allKatchimerasAvailable),
      loadKatchimeraWardrobe(),
    );
    return {
      characterIds: buildOwnedGameCompanions(kingdom.creatures, bond).map((companion) => companion.familyId),
      quests,
    };
  }, [allKatchimerasAvailable, days]);

  return (
    <View style={styles.screen}>
      <CompanionGameBackdrop backgroundKey={FEASTLE_ENVIRONMENT} creature={FEASTLE_ART} name="Feastle" visualKey="feastle" />
      <View style={styles.world}>
        <MergeWorldProvider characterIds={persistent.characterIds} days={days} questState={persistent.quests}>
          <MergeWorldScreen />
        </MergeWorldProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#281A12', flex: 1 },
  world: { flex: 1, position: 'relative', zIndex: 2 },
});
