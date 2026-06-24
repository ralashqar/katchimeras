import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { CellDetailSheet, NotesDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import { PatchInspector } from '@/components/katchadeck/world/patch-inspector';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { DayPromptKind, HomeDayRecord } from '@/types/home';
import type { MemoryNode, PatchCellType, WorldObjectCategory, WorldPatch, WorldState } from '@/types/world';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { deriveTodayPatch } from '@/utils/today-patch-engine';
import { loadTodayPatch, saveTodayPatch } from '@/utils/today-patch-storage';
import { spiralCoord } from '@/utils/world-iso';
import { syncWorldFromDays } from '@/utils/world-engine';

// TEMP: simplify every patch to the photos chest, the notes chest, the steps
// object (which now also holds the day's places), and the creature/egg — Reflection
// + the separate Places map object + Big-Moment landmarks are hidden for now. Flip
// to false to bring the full diorama back.
const MEMORY_CHESTS_ONLY = true;
const VISIBLE_CATEGORIES = new Set(['memory', 'notes', 'journey']);
function simplifyPatch(patch: WorldPatch): WorldPatch {
  if (!MEMORY_CHESTS_ONLY) return patch;
  return {
    ...patch,
    objects: patch.objects.filter((o) => o.kind === 'creature' || (o.category && VISIBLE_CATEGORIES.has(o.category))),
    cells: (patch.cells ?? []).filter((cell) => cell.type === 'memory' || cell.type === 'journey'),
  };
}

export default function WorldScreen() {
  const router = useRouter();
  const { days } = useAllDays();
  // Drives today's live patch + the egg's prompts (the same engine Home uses, so
  // answering here feeds the very same day).
  const { timelineDays, availableDayPrompts, answerDayPrompt, answerPhotoMeaning, dailySeeds, completeSeed, addNote } =
    useHomeScreenState();

  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [focusMemory, setFocusMemory] = useState<MemoryNode | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  // A photo flying into a cell's object after a capture (in-scene mote).
  const [captureFly, setCaptureFly] = useState<{ nonce: number; cellType: PatchCellType; photoUri?: string } | null>(null);
  const captureNonce = useRef(0);
  const [selectedCell, setSelectedCell] = useState<WorldObjectCategory | null>(null);
  // The most-recently tapped cell — keeps a highlight ring under it.
  const [lastSelectedCell, setLastSelectedCell] = useState<WorldObjectCategory | null>(null);
  const feedNonce = useRef(0);
  // The commit to run when the flying mote lands in the egg (answer / seed).
  const pendingAction = useRef<(() => void) | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const autoOpenedRef = useRef(false);

  // Inline voice note (hold the add-bar mic): record → analyse → accept/discard.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recPhase, setRecPhase] = useState<'idle' | 'recording' | 'analyzing' | 'confirm'>('idle');
  const [recElapsed, setRecElapsed] = useState(0);
  const [recResult, setRecResult] = useState<InterpretedNote | null>(null);
  const [recMarkBig, setRecMarkBig] = useState(true);
  const recAudioRef = useRef<string | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  // Fold any newly-hatched days into the persisted world on focus.
  useFocusEffect(
    useCallback(() => {
      setWorld(syncWorldFromDays(days));
    }, [days])
  );

  // Returning from the camera flow (launched from the Memory Vault): the photo
  // already folded into today; here we fly it into the chest as a celebration.
  useFocusEffect(
    useCallback(() => {
      const feed = consumeCaptureFeed();
      if (!feed) return;
      captureNonce.current += 1;
      setCaptureFly({ nonce: captureNonce.current, cellType: 'memory', photoUri: feed.photoUri });
    }, [])
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
    const base = (world?.patches ?? []).map(simplifyPatch);
    if (!todayPatch) return base;
    const coord = spiralCoord(base.length);
    return [...base, simplifyPatch({ ...todayPatch, gridCol: coord.gridCol, gridRow: coord.gridRow })];
  }, [world, todayPatch]);

  const selectedPatch = useMemo(
    () => renderPatches.find((patch) => patch.id === selectedPatchId) ?? null,
    [renderPatches, selectedPatchId]
  );

  const livedCount = world?.patches.length ?? 0;
  const hasAnything = renderPatches.length > 0;

  // --- Inline voice note (hold the add-bar mic) ---
  const stopInlineRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
    } catch {
      // keep whatever we have
    }
    recAudioRef.current = uri;
    if (!uri) {
      setRecPhase('idle');
      return;
    }
    setRecPhase('analyzing');
    // Fly the captured note into the egg while it's read.
    feedNonce.current += 1;
    setEggFeed({
      nonce: feedNonce.current,
      fromX: screenW - 50,
      fromY: screenH - tabBarHeight - 110,
      toX: screenW / 2,
      toY: screenH * 0.64,
      label: '🎤',
      tint: '#7DE8CD',
    });
    try {
      const base64 = await new File(uri).base64();
      const interpreted = await interpretNote({ audioBase64: base64, mimeType: 'audio/m4a' });
      setRecResult(interpreted);
      setRecMarkBig(true);
      setRecPhase('confirm');
    } catch {
      setRecPhase('idle');
    }
  };

  const startInlineRecording = async () => {
    if (recordingRef.current || recPhase !== 'idle') return;
    recordingRef.current = true;
    setRecElapsed(0);
    setRecPhase('recording');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      recordingRef.current = false;
      setRecPhase('idle');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!recordingRef.current) return;
      await recorder.prepareToRecordAsync();
      if (!recordingRef.current) return;
      recorder.record();
    } catch {
      recordingRef.current = false;
      setRecPhase('idle');
      return;
    }
    recTimerRef.current = setInterval(() => {
      setRecElapsed((prev) => {
        if (prev + 1 >= 30) {
          void stopInlineRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const acceptInlineNote = () => {
    if (!recResult) return;
    addNote({
      kind: 'voice',
      text: recResult.transcript,
      audioUri: recAudioRef.current,
      durationMs: recElapsed * 1000,
      archetype: recResult.archetype,
      label: recResult.label,
      bigMoment: recResult.bigMoment && recMarkBig ? recResult.bigMoment : undefined,
    });
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${recResult.label} took root`);
    setRecResult(null);
    recAudioRef.current = null;
    setRecPhase('idle');
  };

  const discardInlineNote = () => {
    setRecResult(null);
    recAudioRef.current = null;
    setRecPhase('idle');
  };

  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }, []);

  // The egg's approximate on-screen spot. The view auto-centres on the patch's
  // geometric centre, and the egg now sits on the front corner — well below it.
  const eggTarget = { x: screenW / 2, y: screenH * 0.64 };

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

  // Tapping a chest opens its reader: the photos vault, the notes reader, or (when
  // enabled) Places → the full day map.
  const handleSelectCell = (cellType: WorldObjectCategory) => {
    setLastSelectedCell(cellType);
    if (cellType === 'places') {
      if (todayForming) router.push({ pathname: '/day-map/[dayId]', params: { dayId: todayForming.id } });
      return;
    }
    setSelectedCell(cellType);
  };
  const selectedCellData =
    selectedCell && selectedCell !== 'notes'
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
            captureFly={captureFly}
            hideRecenter={recPhase === 'analyzing'}
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

      {selectedCell === 'notes' && todayForming ? (
        <NotesDetailSheet
          day={todayForming}
          onClose={() => setSelectedCell(null)}
          onAddNote={() => {
            setSelectedCell(null);
            router.push('/note-capture');
          }}
        />
      ) : null}

      {selectedCell && selectedCellData && todayForming ? (
        <CellDetailSheet
          day={todayForming}
          cell={selectedCellData}
          recentAvgSteps={recentAvgSteps}
          onClose={() => setSelectedCell(null)}
          onAddPhoto={() => {
            setSelectedCell(null);
            router.push('/moment-capture');
          }}
        />
      ) : null}

      {todayForming && !promptOpen && !selectedCell && recPhase !== 'confirm' ? (
        <View style={[styles.addBar, { bottom: tabBarHeight + 70 }]}>
          <KatchaButton
            label="Add to today"
            onPress={() => setPromptOpen(true)}
            variant="primary"
            style={styles.addMain}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture a moment with the camera"
            onPress={() => router.push('/moment-capture')}
            style={styles.iconButton}>
            <IconSymbol name="camera.fill" size={20} color={Lantern.ink900} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tap to write a note, hold to record a voice note"
            onPress={() => {
              if (recPhase === 'idle') router.push('/note-capture');
            }}
            onLongPress={startInlineRecording}
            delayLongPress={250}
            onPressOut={() => {
              if (recordingRef.current) void stopInlineRecording();
            }}
            style={[styles.iconButton, recPhase === 'recording' && styles.iconButtonRec]}>
            <IconSymbol name="mic.fill" size={20} color={Lantern.ink900} />
          </Pressable>
        </View>
      ) : null}

      {recPhase !== 'idle' ? (
        <InlineVoiceNote
          phase={recPhase}
          elapsed={recElapsed}
          result={recResult}
          markBig={recMarkBig}
          onToggleBig={() => setRecMarkBig((value) => !value)}
          onAccept={acceptInlineNote}
          onDiscard={discardInlineNote}
          bottom={tabBarHeight}
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
  addBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addMain: { flex: 1 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: Lantern.ember300,
    boxShadow: '0 10px 24px rgba(255,195,107,0.32)',
  },
  iconButtonRec: { backgroundColor: '#F49AC1' },
});
