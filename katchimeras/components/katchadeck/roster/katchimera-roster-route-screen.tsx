import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchimeraKingdomScreen } from '@/components/katchadeck/roster/katchimera-kingdom-screen';
import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import {
  type KingdomResidentStatusGlyph,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { homeTabBarHeight } from '@/constants/home-loop-layout';
import { AppFontFamilies } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useCompanionDiscoveryRecords } from '@/hooks/use-companion-discovery-records';
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
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { kingdomCompanionHexSlots } from '@/utils/katchimera-kingdom-slots';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import type { MergeWorldState } from '@/types/merge-world';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { loadMergeWorldState, revealStoredHaven, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import { commitFtueAction, dispatchFtueEvent, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';

type KatchimeraViewMode = 'grid' | 'haven';

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
  const ftueRun = useFtueRun();
  const [viewMode, setViewMode] = useState<KatchimeraViewMode>('grid');
  useEffect(() => {
    if (ftueRun?.status === 'active' && mossproutFtueStep(ftueRun.stepId)?.surface === 'haven') setViewMode('haven');
  }, [ftueRun?.status, ftueRun?.stepId]);
  const toggleViewMode = useCallback(() => {
    setViewMode((current) => current === 'grid' ? 'haven' : 'grid');
  }, []);

  // Release the active grid or Kingdom canvas while a companion or mini-game
  // owns the screen. The view-mode state remains here so Back restores the
  // surface the player came from without retaining its heavy render tree.
  return isFocused ? <FocusedKatchimeraRoster onToggleViewMode={toggleViewMode} viewMode={viewMode} /> : null;
}

function FocusedKatchimeraRoster({
  onToggleViewMode,
  viewMode,
}: {
  onToggleViewMode: () => void;
  viewMode: KatchimeraViewMode;
}) {
  const router = useRouter();
  const ftueRun = useFtueRun();
  const insets = useSafeAreaInsets();
  const { transitionTo } = useGameScreenTransition();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const discovery = useCompanionDiscoveryRecords();
  // This component is created fresh for every focus session, so its lazy
  // initializer already reads the latest persisted days. Refreshing on that
  // same initial focus would rebuild the just-mounted grid a second time.
  const { days } = useAllDays({ refreshOnFocus: false });
  const [persistentSnapshot, setPersistentSnapshot] = useState(loadRosterPersistentSnapshot);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [mergeWorld, setMergeWorld] = useState<MergeWorldState | null>(null);
  const relationshipTileStages = useHavenTileStages();
  const hasCompletedInitialFocus = useRef(false);
  const previousItems = useRef<readonly KatchimeraRosterItem[]>([]);
  const persistent = persistentSnapshot.state;

  useEffect(() => {
    let active = true;
    void loadMergeWorldState().then((state) => { if (active) setMergeWorld(state); });
    const unsubscribe = subscribeMergeWorldSnapshots((state) => { if (active) setMergeWorld(state); });
    return () => { active = false; unsubscribe(); };
  }, []);

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
  useGameSurfaceReadiness('katchimeras', {
    background: viewMode === 'haven' || backgroundReady,
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
  const goToday = useCallback(() => transitionTo({
    announcement: 'Opening Today',
    target: 'today',
    navigate: () => router.navigate('/today'),
  }), [router, transitionTo]);

  const toggleView = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggleViewMode();
  }, [onToggleViewMode]);

  return discovery.ready && presentationMergeWorld ? (
    <View style={styles.screen}>
      {viewMode === 'grid' ? (
        <KatchimeraRosterScreen
          background={background}
          items={items}
          onBackgroundReady={() => setBackgroundReady(true)}
          onContentReady={() => setContentReady(true)}
          onGoToday={goToday}
          onSelectCreature={openCreature}
        />
      ) : (
        <KatchimeraKingdomScreen
          background={background}
          daysHatched={kingdom.totals.daysHatched}
          eggVisual={eggVisual}
          onContentReady={() => setContentReady(true)}
          onSelectCreature={openCreature}
          residentStatusGlyphs={statusByCreatureId}
          companionSlots={companionSlots}
          mergeWorld={presentationMergeWorld}
          ftueStepId={ftueRun?.status === 'active' ? ftueRun.stepId : undefined}
          onFtueRestore={() => {
            dispatchFtueEvent({
              type: 'haven_upgrade_completed',
              characterId: 'mossprout',
              stage: 1,
              revision: presentationMergeWorld.revision,
            }, 'haven:mossprout:stage-1');
          }}
          onFtueReveal={() => {
            void revealStoredHaven().then(() => {
              commitFtueAction({ actionId: 'haven.reveal_world', evidenceRef: 'haven:revealed' });
            });
          }}
        />
      )}
      <Pressable
        accessibilityHint={`Switch to the ${viewMode === 'grid' ? 'Haven' : 'grid'} view`}
        accessibilityLabel={viewMode === 'grid' ? 'Show Haven view' : 'Show Katchimera grid'}
        accessibilityRole="button"
        accessibilityState={{ selected: viewMode === 'haven' }}
        onPress={toggleView}
        style={({ pressed }) => [
          styles.viewToggle,
          { bottom: homeTabBarHeight(insets.bottom) + 14 },
          pressed && styles.viewTogglePressed,
        ]}>
        <IconSymbol
          color="#FFF6DC"
          name={viewMode === 'grid' ? 'map.fill' : 'circle.grid.2x2.fill'}
          size={20}
        />
        <ThemedText style={styles.viewToggleLabel} lightColor="#FFF6DC" darkColor="#FFF6DC">
          {viewMode === 'grid' ? 'Haven' : 'Grid'}
        </ThemedText>
      </Pressable>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  viewToggle: {
    alignItems: 'center',
    backgroundColor: 'rgba(24,22,31,0.92)',
    borderColor: 'rgba(255,246,220,0.2)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 7px 18px rgba(13,10,21,0.32)',
    flexDirection: 'row',
    gap: 7,
    height: 48,
    paddingHorizontal: 15,
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  viewTogglePressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  viewToggleLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
});
