import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { CellDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { PatchInspector } from '@/components/katchadeck/world/patch-inspector';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { DayPromptKind, HomeDayRecord } from '@/types/home';
import type { MemoryNode, PatchCellType, WorldState } from '@/types/world';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { deriveTodayPatch } from '@/utils/today-patch-engine';
import { loadTodayPatch, saveTodayPatch } from '@/utils/today-patch-storage';
import { spiralCoord } from '@/utils/world-iso';
import { syncWorldFromDays } from '@/utils/world-engine';

export default function WorldScreen() {
  const router = useRouter();
  const { days } = useAllDays();
  // Drives today's live patch + the egg's prompts (the same engine Home uses, so
  // answering here feeds the very same day).
  const { timelineDays, availableDayPrompts, answerDayPrompt, answerPhotoMeaning, dailySeeds, completeSeed } =
    useHomeScreenState();

  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [focusMemory, setFocusMemory] = useState<MemoryNode | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [selectedCell, setSelectedCell] = useState<PatchCellType | null>(null);
  // The most-recently tapped cell — keeps a highlight ring under it.
  const [lastSelectedCell, setLastSelectedCell] = useState<PatchCellType | null>(null);
  const feedNonce = useRef(0);
  // The commit to run when the flying mote lands in the egg (answer / seed).
  const pendingAction = useRef<(() => void) | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isFocused = useIsFocused();
  const autoOpenedRef = useRef(false);

  // Fold any newly-hatched days into the persisted world on focus.
  useFocusEffect(
    useCallback(() => {
      setWorld(syncWorldFromDays(days));
    }, [days])
  );

  // Today, while it is still forming, is the live patch the egg sits on.
  const todayForming = useMemo(() => {
    const today = timelineDays.find((day) => day.kind === 'day' && day.isToday) as
      | HomeDayRecord
      | undefined;
    return today && today.state !== 'hatched' ? today : null;
  }, [timelineDays]);

  // Re-derive the live patch only when the day's inputs actually change.
  const todaySignature = todayForming
    ? [
        todayForming.id,
        todayForming.state,
        todayForming.moments.length,
        todayForming.promptAnswers?.length ?? 0,
        todayForming.capturedMeanings?.length ?? 0,
        todayForming.stepsCount,
        todayForming.newPlaceCount,
        todayForming.seedCompletions?.length ?? 0,
        todayForming.egg.intensity,
      ].join('|')
    : null;
  const todayPatch = useMemo(() => {
    if (!todayForming) return null;
    const stored = loadTodayPatch();
    const prev = stored && stored.dayId === todayForming.id ? stored : null;
    return deriveTodayPatch(todayForming, prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySignature]);

  // Persist each growth so placements carry across re-renders, and so the patch
  // lands on the same spiral cell the canonical tile gets when the day hatches.
  useEffect(() => {
    if (todayPatch) saveTodayPatch(todayPatch);
  }, [todayPatch]);

  // Render the hatched world plus today's live patch, placed on the next free
  // spiral cell — exactly where buildWorld will seat it once it hatches.
  const renderPatches = useMemo(() => {
    const base = world?.patches ?? [];
    if (!todayPatch) return base;
    const coord = spiralCoord(base.length);
    return [...base, { ...todayPatch, gridCol: coord.gridCol, gridRow: coord.gridRow }];
  }, [world, todayPatch]);

  const selectedPatch = useMemo(
    () => renderPatches.find((patch) => patch.id === selectedPatchId) ?? null,
    [renderPatches, selectedPatchId]
  );

  const livedCount = world?.patches.length ?? 0;
  const hasAnything = renderPatches.length > 0;

  // The egg's approximate on-screen spot (the view auto-centres on its patch, so
  // it sits a little below centre). The chosen mote flies here, then lands.
  const eggTarget = { x: screenW / 2, y: screenH * 0.54 };

  // Fly the tapped choice as a glowing mote into the egg (same comet flight as
  // Home), deferring the real commit until it lands so the growth lands with it.
  const flyToEgg = (from: FeedSourceRect, label: string, commit: () => void) => {
    setPromptOpen(false);
    feedNonce.current += 1;
    pendingAction.current = commit;
    setEggFeed({
      nonce: feedNonce.current,
      fromX: from.x + from.w / 2,
      fromY: from.y + from.h / 2,
      toX: eggTarget.x,
      toY: eggTarget.y,
      label,
      tint: '#7DE8CD',
    });
  };

  const handleEggFeedArrive = () => {
    setEggFeed(null);
    const commit = pendingAction.current;
    pendingAction.current = null;
    commit?.();
  };

  const handleAnswer = (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => {
    const isPhotoMeaning = kind === 'meaning' && !!todayForming?.heroPhoto;
    flyToEgg(from, '✨', () => {
      if (isPhotoMeaning) {
        answerPhotoMeaning({ choiceIds });
      } else {
        answerDayPrompt({ kind, choiceIds });
      }
      setEggFeedKey((key) => key + 1);
    });
  };

  const handleSelectHeroPhoto = (photo: DayPromptPhotoCandidate, _from: FeedSourceRect) => {
    // Reading a photo's meaning happens full-screen (same flow as Home), which
    // then feeds the day and marks the hero photo.
    setPromptOpen(false);
    router.push({
      pathname: '/photo-essence',
      params: {
        assetId: photo.assetId,
        thumbnailUri: photo.thumbnailUri ?? '',
        capturedAt: photo.capturedAt,
        target: 'today',
      },
    });
  };

  const handleCompleteSeed = (seedId: string, from: FeedSourceRect) => {
    const seed = dailySeeds.find((candidate) => candidate.id === seedId);
    flyToEgg(from, seed?.emoji ?? '🌱', () => {
      completeSeed(seedId);
      setEggFeedKey((key) => key + 1);
      if (seed) setMicrocopy(`${seed.reward.label} took root`);
    });
  };

  // Auto-surface the "things that could shape today" sheet ONCE, the first time
  // the World is entered on a forming day. We deliberately do NOT reset on blur,
  // so returning from a pushed screen (e.g. a cell's Day Map) doesn't re-open it.
  useEffect(() => {
    if (!isFocused) return;
    if (todayForming && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setPromptOpen(true);
    }
  }, [isFocused, todayForming]);

  // Auto-dismiss the growth microcopy after a beat.
  useEffect(() => {
    if (!microcopy) return;
    const id = setTimeout(() => setMicrocopy(null), 2400);
    return () => clearTimeout(id);
  }, [microcopy]);

  // How "formed" today's capsule reads — the mean fill across its four cells.
  const completionPct = todayPatch?.cells?.length
    ? Math.round((todayPatch.cells.reduce((sum, cell) => sum + cell.level, 0) / (todayPatch.cells.length * 4)) * 100)
    : 0;

  // The Journey cell compares to the recent average — non-judgmentally.
  const recentAvgSteps = useMemo(() => {
    const withSteps = days.filter((day) => day.state === 'hatched' && (day.stepsCount ?? 0) > 0);
    if (withSteps.length === 0) return null;
    const recent = withSteps.slice(-7);
    return Math.round(recent.reduce((sum, day) => sum + (day.stepsCount ?? 0), 0) / recent.length);
  }, [days]);

  // Tapping a cell opens its time-capsule reader; Places routes to the full map.
  const handleSelectCell = (cellType: PatchCellType) => {
    setLastSelectedCell(cellType);
    if (cellType === 'places') {
      if (todayForming) router.push({ pathname: '/day-map/[dayId]', params: { dayId: todayForming.id } });
      return;
    }
    setSelectedCell(cellType);
  };
  const selectedCellData = selectedCell
    ? todayPatch?.cells?.find((cell) => cell.type === selectedCell) ?? null
    : null;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(125,232,205,0.12)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      {!hasAnything ? (
        <View style={styles.empty}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Your world
          </ThemedText>
          <ThemedText type="hero" style={styles.emptyTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            It begins with your first hatch.
          </ThemedText>
          <ThemedText type="bodyLarge" style={styles.emptyBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Each day you hatch becomes a patch of land — its creature, its memories, its place in a world that grows
            with your life.
          </ThemedText>
        </View>
      ) : (
        <>
          <WorldCanvas
            patches={renderPatches}
            eggPatchId={todayPatch?.id ?? null}
            eggVisual={todayPatch?.eggVisual ?? null}
            eggReady={todayForming?.state === 'ready_to_hatch'}
            eggFeedKey={eggFeedKey}
            highlightedCell={lastSelectedCell}
            onPressEgg={() => setPromptOpen(true)}
            onSelectCell={handleSelectCell}
            onSelectPatch={(id) => {
              setFocusMemory(null);
              setSelectedPatchId(id);
            }}
            onSelectMemory={(memory, patchId) => {
              setFocusMemory(memory);
              setSelectedPatchId(patchId);
            }}
          />
          <View pointerEvents="none" style={styles.header}>
            <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Your world
            </ThemedText>
            <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {todayPatch ? `Today · ${completionPct}% formed` : `${livedCount} ${livedCount === 1 ? 'day' : 'days'} lived`}
            </ThemedText>
          </View>

          {microcopy ? (
            <Animated.View
              key={microcopy}
              entering={FadeInDown.duration(260)}
              exiting={FadeOut.duration(220)}
              pointerEvents="none"
              style={styles.microcopy}>
              <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {microcopy}
              </ThemedText>
            </Animated.View>
          ) : null}
        </>
      )}

      {selectedPatch ? (
        <PatchInspector patch={selectedPatch} focusMemory={focusMemory} onClose={() => setSelectedPatchId(null)} />
      ) : null}

      {promptOpen ? (
        <MomentPromptSheet
          prompts={availableDayPrompts}
          seeds={dailySeeds}
          onCompleteSeed={handleCompleteSeed}
          onAnswer={handleAnswer}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onClose={() => setPromptOpen(false)}
        />
      ) : null}

      {selectedCell && selectedCellData && todayForming ? (
        <CellDetailSheet
          day={todayForming}
          cell={selectedCellData}
          recentAvgSteps={recentAvgSteps}
          onClose={() => setSelectedCell(null)}
        />
      ) : null}

      <EggFeedOverlay feed={eggFeed} onArrive={handleEggFeedArrive} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  header: { position: 'absolute', top: 64, left: 24 },
  kicker: { marginBottom: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyTitle: { textAlign: 'center', marginTop: 10 },
  emptyBody: { textAlign: 'center', marginTop: 14 },
  microcopy: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.4)',
  },
  microcopyText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
});
