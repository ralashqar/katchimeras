import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { MergeWorldScreen } from '@/components/katchadeck/games/merge-world-screen';
import { TodayExplorationBackground } from '@/components/katchadeck/home/today-exploration-background';
import { MergeWorldProvider } from '@/features/merge-world/merge-world-provider';
import { useAllDays } from '@/hooks/use-all-days';
import { homeRepository } from '@/storage/repositories/home-repository';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { deriveTomorrowDayRecord, hydrateAllDays } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { scheduleForegroundLifecycleAudit } from '@/utils/lifecycle-performance';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';

export function MergeWorldRouteScreen() {
  const isFocused = useIsFocused();
  useLocalSearchParams<{ creatureId?: string; familyId?: string }>();
  const hasPresentedBoard = useRef(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const { suppressEntranceMotion, target } = useGameScreenTransition();
  const { height, width } = useWindowDimensions();
  const { days } = useAllDays();
  const playBoardEntrance = isFocused && !hasPresentedBoard.current
    && !(target === 'merge' && suppressEntranceMotion);
  useEffect(() => {
    if (!isFocused) {
      setBackgroundReady(false);
      return;
    }
    setBackgroundReady(false);
    hasPresentedBoard.current = true;
    scheduleForegroundLifecycleAudit('merge');
  }, [isFocused]);
  const persistent = useMemo(() => {
    const now = new Date();
    const homeState = homeRepository.load();
    const profile = loadOnboardingProfile();
    // Today mutations deliberately suppress repository notifications while
    // their async write is coalesced. A mounted Games tab can therefore still
    // hold the pre-journal useAllDays snapshot when it regains focus. Read the
    // repository's current in-memory state here so journal Energy is projected
    // on the very first Merge frame, without waiting for disk persistence.
    const currentDays = isFocused ? hydrateAllDays(homeState, profile, now) : days;
    const activityDays = homeState?.tomorrow
      ? [...currentDays, deriveTomorrowDayRecord(homeState, profile, now)]
      : currentDays;
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const quests = loadCompanionQuests(resolveCompanionId);
    return {
      // Companion ownership is canonical in Merge World v11. Historical day
      // creatures are Wisps/legacy memories and must not unlock new board
      // companions. The dev availability switch remains an explicit override.
      // Mossprout is the first personal Merge World. Other companions retain
      // their own relationship systems until their worlds receive a vertical
      // slice; they no longer place foreign generators on this board.
      characterIds: ['mossprout'],
      activityDays,
      quests,
    };
  }, [days, isFocused]);

  return (
    <MergeWorldProvider active={isFocused} characterIds={persistent.characterIds} days={persistent.activityDays} featuredCharacterId="mossprout" questState={persistent.quests}>
      <View style={styles.screen}>
        {isFocused ? <>
          <TodayExplorationBackground backgroundKey="mossprout" contentFit="cover" imageSize={Math.max(height, width)} onLoad={() => setBackgroundReady(true)} />
          <View style={styles.world}>
            <MergeWorldScreen active={isFocused} backgroundReady={backgroundReady} playBoardEntrance={playBoardEntrance} />
          </View>
        </> : null}
      </View>
    </MergeWorldProvider>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55B8E9', flex: 1 },
  world: { flex: 1, position: 'relative', zIndex: 2 },
});
