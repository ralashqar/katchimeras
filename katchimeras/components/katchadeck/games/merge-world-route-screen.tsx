import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { MergeWorldScreen } from '@/components/katchadeck/games/merge-world-screen';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
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

export function MergeWorldRouteScreen() {
  const effectsPaused = useSharedValue(0);
  const { height, width } = useWindowDimensions();
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
      <TodayExplorationBackground backgroundKey="home" imageSize={Math.max(height, width)} />
      <View style={styles.world}>
        <MergeWorldProvider characterIds={persistent.characterIds} days={days} questState={persistent.quests}>
          <MergeWorldScreen effectsPaused={effectsPaused} />
        </MergeWorldProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55B8E9', flex: 1 },
  world: { flex: 1, position: 'relative', zIndex: 2 },
});
