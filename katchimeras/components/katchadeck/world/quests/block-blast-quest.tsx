import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOutUp, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';
import {
  BLOCK_BLAST_PACK,
  BLOCK_BLAST_RULESET,
  BLOCK_BLAST_TRAY_ALGORITHM_VERSION,
  blockBlastClearCascadePhase,
  blockBlastReducer,
  blockBlastStreakWord,
  createBlockBlastState,
  type BlockBlastCell,
  type BlockBlastResolution,
  type BlockBlastState,
} from '@/utils/quests/experiences/block-blast';
import {
  finishBlockBlastSession,
  flushBlockBlastProfileSave,
  loadBlockBlastProfile,
  recordBlockBlastRun,
  saveBlockBlastActiveRun,
  type BlockBlastProfile,
} from '@/utils/quests/experiences/block-blast-storage';
import type { QuestResult } from '@/utils/quests/experiences/types';
import {
  BlockBlastBoard,
  BLOCK_BLAST_LOSS_OUTRO_MS,
  DraggableBlockBlastPiece,
  blockBlastBoardMetrics,
  type WindowFrame,
} from './block-blast-board';
import {
  createBlockBlastSoundPlayers,
  disposeBlockBlastSoundPlayers,
  playBlockBlastSound,
  type BlockBlastSound,
} from './block-blast-sounds';
import { QuestExperiencePreview } from './quest-experience-ui';

type Config = {
  packId: typeof BLOCK_BLAST_PACK;
  rulesetId: typeof BLOCK_BLAST_RULESET;
  boardSize?: 8;
  mode?: 'endless';
};

type Props = {
  config: Config;
  seed: string;
  onAttemptStart: (config: Record<string, unknown>) => string;
  onAttemptCancel: (id: string) => void;
  onComplete: (id: string, result: QuestResult) => void;
  onRequestExit?: () => void;
  onRunningChange: (running: boolean, id?: string | null) => void;
};

const CHEERLET = require('../../../../assets/images/katchimeras/cutouts/cheerlet.png');
const CONTROLLED_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CLEAR_HAPTIC_MAX_PER_SECOND = 20;
const CLEAR_HAPTIC_INTERVAL_MS = Math.ceil(1000 / CLEAR_HAPTIC_MAX_PER_SECOND);
const CLEAR_HAPTIC_VISUAL_OFFSET_MS = 170;
const STREAK_VISIBLE_MS = 1_150;
const STREAK_BOUNCE_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.72 }] },
  48: { opacity: 1, transform: [{ translateY: -2 }, { scale: 1.12 }] },
  72: { opacity: 1, transform: [{ translateY: 0 }, { scale: 0.97 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(360);

type StreakCallout = { id: number; combo: number };

export function BlockBlastQuest({ config, seed, onAttemptStart, onAttemptCancel, onComplete, onRequestExit, onRunningChange }: Props) {
  const loadedProfile = useMemo(loadBlockBlastProfile, []);
  const [profile, setProfile] = useState<BlockBlastProfile>(loadedProfile);
  const profileRef = useRef<BlockBlastProfile>(loadedProfile);
  const [game, setGame] = useState<BlockBlastState | null>(loadedProfile.activeRun);
  const [started, setStarted] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [hover, setHover] = useState<BlockBlastCell | null>(null);
  const [boardFrame, setBoardFrame] = useState<WindowFrame | null>(null);
  const [lastPersonalBest, setLastPersonalBest] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [streakCallout, setStreakCallout] = useState<StreakCallout | null>(null);
  const attempt = useRef<string | null>(null);
  const gameRef = useRef<BlockBlastState | null>(game);
  const boardRef = useRef<View>(null);
  const clearHapticTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const nextClearHapticAt = useRef(0);
  const streakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const players = useMemo(createBlockBlastSoundPlayers, []);
  const commitTimers = useDisposableTimers('block-blast-commit');
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const boardSize = Math.max(248, Math.min(width - 34, 390, height - 315));
  const metrics = useMemo(() => blockBlastBoardMetrics(boardSize), [boardSize]);
  const selectedPiece = game?.tray.find((piece) => piece.id === selectedPieceId && !piece.used) ?? null;
  const currentRunIsPersonalBest = Boolean(game && profile.bestRun?.seed === game.seed && profile.bestRun.score === game.score);

  useEffect(() => () => {
    disposeBlockBlastSoundPlayers(players);
    void flushBlockBlastProfileSave();
  }, [players]);

  useEffect(() => {
    if (!game || (game as Partial<BlockBlastState>).trayAlgorithmVersion === BLOCK_BLAST_TRAY_ALGORITHM_VERSION) return;
    const next = started ? createBlockBlastState(`${seed}:${Date.now()}:${profile.totalRuns}:tray-v2`) : null;
    setGame(next);
    gameRef.current = next;
    setSelectedPieceId(null);
    setHover(null);
    setProfile((current) => saveBlockBlastActiveRun(current, next));
  }, [game, profile.totalRuns, seed, started]);

  useEffect(() => () => {
    clearHapticTimers.current.forEach((timer) => clearTimeout(timer));
    clearHapticTimers.current.clear();
    if (streakTimer.current) clearTimeout(streakTimer.current);
  }, []);

  useEffect(() => {
    if (game?.status !== 'lost') {
      setResultReady(false);
      return;
    }
    const timeout = setTimeout(() => setResultReady(true), reduceMotion ? 90 : BLOCK_BLAST_LOSS_OUTRO_MS);
    return () => clearTimeout(timeout);
  }, [game?.status, game?.seed, reduceMotion]);

  gameRef.current = game;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const activeRun = gameRef.current;
      if (activeRun) {
        const nextProfile = saveBlockBlastActiveRun(profileRef.current, activeRun);
        profileRef.current = nextProfile;
        setProfile(nextProfile);
        void flushBlockBlastProfileSave();
      }
    });
    return () => subscription.remove();
  }, []);

  profileRef.current = profile;

  const play = useCallback((sound: BlockBlastSound) => {
    if (profile.soundEnabled) playBlockBlastSound(players, sound);
  }, [players, profile.soundEnabled]);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setBoardFrame({ x, y, width: measuredWidth, height: measuredHeight });
    });
  }, []);

  const createRun = useCallback(() => {
    const next = createBlockBlastState(`${seed}:${Date.now()}:${profile.totalRuns}`);
    setGame(next);
    setSelectedPieceId(null);
    setHover(null);
    setLastPersonalBest(false);
    setResultReady(false);
    setStreakCallout(null);
    if (streakTimer.current) clearTimeout(streakTimer.current);
    setProfile((current) => saveBlockBlastActiveRun(current, next));
    return next;
  }, [profile.totalRuns, seed]);

  const start = () => {
    const next = game ?? createRun();
    attempt.current = onAttemptStart({ ...config, rulesetId: BLOCK_BLAST_RULESET, runSeed: next.seed });
    setStarted(true);
    onRunningChange(true, attempt.current);
  };

  const haptic = (kind: 'pick' | 'hover' | 'place' | 'invalid' | 'game_over') => {
    if (process.env.EXPO_OS !== 'ios') return;
    if (kind === 'pick' || kind === 'hover') void Haptics.selectionAsync();
    else if (kind === 'place') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'invalid') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const scheduleClearCascadeHaptics = (resolution: BlockBlastResolution, combo: boolean) => {
    if (process.env.EXPO_OS !== 'ios') return;
    const startedAt = Date.now();
    const phases = [...new Set(resolution.clearedCells.map((cell) => (
      blockBlastClearCascadePhase(cell.index, resolution.clearedRows, resolution.clearedColumns)
    )))].sort((left, right) => left - right);
    phases.forEach((phase) => {
      const visualTime = startedAt + CLEAR_HAPTIC_VISUAL_OFFSET_MS + Math.min(phase * 24, 220);
      const fireAt = Math.max(visualTime, nextClearHapticAt.current);
      nextClearHapticAt.current = fireAt + CLEAR_HAPTIC_INTERVAL_MS;
      const timer = setTimeout(() => {
        clearHapticTimers.current.delete(timer);
        if (combo) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else void Haptics.selectionAsync();
      }, Math.max(0, fireAt - Date.now()));
      clearHapticTimers.current.add(timer);
    });
  };

  const place = (pieceId: string, row: number, column: number) => {
    if (!game) return false;
    const next = blockBlastReducer(game, { type: 'place', pieceId, row, column });
    if (next === game) {
      haptic('invalid');
      return false;
    }
    const cleared = (next.lastResolution?.clearedRows.length ?? 0) + (next.lastResolution?.clearedColumns.length ?? 0);
    if (cleared > 0 && next.lastResolution) {
      const callout = { id: next.lastResolution.id, combo: next.combo };
      if (streakTimer.current) clearTimeout(streakTimer.current);
      setStreakCallout(callout);
      streakTimer.current = setTimeout(() => {
        setStreakCallout((current) => current?.id === callout.id ? null : current);
        streakTimer.current = null;
      }, reduceMotion ? 650 : STREAK_VISIBLE_MS);
    } else {
      if (streakTimer.current) clearTimeout(streakTimer.current);
      streakTimer.current = null;
      setStreakCallout(null);
    }
    setGame(next);
    gameRef.current = next;
    setSelectedPieceId(null);
    setHover(null);
    commitTimers.schedule(() => {
      let nextProfile = saveBlockBlastActiveRun(profileRef.current, next);
      if (cleared > 0) {
        const combo = next.combo > 1;
        if (next.lastResolution) scheduleClearCascadeHaptics(next.lastResolution, combo);
        play(combo ? 'combo' : 'clear');
        void AccessibilityInfo.announceForAccessibility(`${cleared} ${cleared === 1 ? 'line' : 'lines'} cleared. Score ${next.score}.`);
      } else {
        haptic('place');
        play('place');
      }
      if (next.status === 'lost') {
        const recorded = recordBlockBlastRun(nextProfile, next);
        nextProfile = recorded.profile;
        setLastPersonalBest(recorded.personalBest);
        haptic('game_over');
        play('game_over');
        void AccessibilityInfo.announceForAccessibility(`No moves remain. Final score ${next.score}.${recorded.personalBest ? ' New personal best.' : ''}`);
      }
      profileRef.current = nextProfile;
      setProfile(nextProfile);
    }, 0);
    return true;
  };
  const placeRef = useRef(place);
  const selectedPieceRef = useRef(selectedPiece);
  placeRef.current = place;
  selectedPieceRef.current = selectedPiece;
  const pressBoardCell = useCallback((row: number, column: number) => {
    const piece = selectedPieceRef.current;
    if (piece) placeRef.current(piece.id, row, column);
  }, []);

  const saveAndLeave = () => {
    if (game) {
      const nextProfile = saveBlockBlastActiveRun(profileRef.current, game);
      profileRef.current = nextProfile;
      setProfile(nextProfile);
    }
    void flushBlockBlastProfileSave();
    if (attempt.current) onAttemptCancel(attempt.current);
    attempt.current = null;
    setStarted(false);
    onRunningChange(false);
  };

  const finish = () => {
    const summary = profile.sessionBest;
    if (!summary || !attempt.current) return;
    const result: QuestResult = {
      kind: 'block_blast',
      success: true,
      rulesetId: BLOCK_BLAST_RULESET,
      packId: BLOCK_BLAST_PACK,
      score: summary.score,
      linesCleared: summary.linesCleared,
      piecesPlaced: summary.piecesPlaced,
      maxCombo: summary.maxCombo,
      durationMs: summary.durationMs,
      seed: summary.seed,
      personalBest: summary.score === profile.highScore,
    };
    const id = attempt.current;
    attempt.current = null;
    const nextProfile = finishBlockBlastSession(profileRef.current);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    void flushBlockBlastProfileSave();
    onRunningChange(false);
    onComplete(id, result);
  };

  if (!started) {
    return (
      <QuestExperiencePreview
        eyebrow="Cheerlet"
        title="Cheerlet’s Block Party"
        body="Fit the party pieces, clear complete rows and columns, and keep the celebration going as long as you can."
        media={<BlockPartyPreview />}
        mediaLabel="Cheerlet beside a colourful block party board"
        meta={game ? `Saved run · ${formatScore(game.score)} points` : profile.highScore ? `Personal best · ${formatScore(profile.highScore)}` : 'Endless · three pieces at a time'}
        actionLabel={game ? 'Resume run' : 'Start the party'}
        onAction={start}
      />
    );
  }

  if (!game) return null;

  if (game.status === 'lost' && resultReady) {
    const displayBest = Math.max(profile.highScore, game.score);
    return (
      <Animated.View entering={FadeInUp.duration(reduceMotion ? 100 : 260).easing(CONTROLLED_EASE)} accessibilityLiveRegion="polite" style={styles.resultRoot}>
        <View style={styles.resultCard}>
          <View style={styles.resultCopy}>
            <View style={styles.resultEyebrowPill}>
              <IconSymbol name="sparkles" size={12} color="#C94F79" />
              <ThemedText style={styles.resultEyebrow} lightColor="#C94F79" darkColor="#C94F79">{lastPersonalBest || currentRunIsPersonalBest ? 'NEW PERSONAL BEST' : 'BOARD FULL'}</ThemedText>
            </View>
          </View>
          <View style={styles.scoreStage}>
            <ThemedText style={styles.scoreStageLabel} lightColor="#9A6A48" darkColor="#9A6A48">FINAL SCORE</ThemedText>
            <ThemedText style={styles.finalScore} lightColor={lastPersonalBest || currentRunIsPersonalBest ? '#C94F79' : '#5D351F'} darkColor={lastPersonalBest || currentRunIsPersonalBest ? '#C94F79' : '#5D351F'}>{formatScore(game.score)}</ThemedText>
            <ThemedText style={styles.finalLabel} lightColor="#8A5A3A" darkColor="#8A5A3A">BEST · {formatScore(displayBest)}</ThemedText>
          </View>
        </View>
        <View style={styles.resultActions}>
          <ResultAction label="New run" onPress={createRun} primary />
          <ResultAction label="Finish with Cheerlet" onPress={finish} />
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <KatchimeraBackButton
          accessibilityHint={onRequestExit ? 'Asks before leaving this round' : 'Saves this run and returns to Cheerlet'}
          accessibilityLabel="Back"
          onPress={onRequestExit ?? saveAndLeave}
        />
        <View style={styles.topLine}>
          <View style={styles.scoreCenter}>
            <ThemedText style={styles.scoreLabel} lightColor="#8A5A3A" darkColor="#8A5A3A">SCORE</ThemedText>
            <AnimatedScore reduceMotion={reduceMotion} value={game.score} />
          </View>
        </View>
        <View pointerEvents="none" style={styles.topBarBalance} />
      </View>

      {streakCallout ? (
        <Animated.View
          key={streakCallout.id}
          entering={reduceMotion ? FadeIn.duration(80) : STREAK_BOUNCE_IN}
          exiting={FadeOutUp.duration(reduceMotion ? 80 : 220).easing(CONTROLLED_EASE)}
          pointerEvents="none"
          style={styles.streakOverlay}
        >
          <StreakWordmark combo={streakCallout.combo} />
        </Animated.View>
      ) : null}

      <View style={styles.boardFrame}>
        <View ref={boardRef} onLayout={measureBoard} style={styles.boardShell}>
          <View pointerEvents="none" style={[styles.boardRim, { height: boardSize + 14, width: boardSize + 14 }]} />
          <BlockBlastBoard
            state={game}
            size={boardSize}
            selectedPiece={selectedPiece}
            hover={hover}
            reduceMotion={reduceMotion}
            onCellPress={pressBoardCell}
          />
        </View>
      </View>

      <View key={game.trayGeneration} style={styles.tray}>
        <View pointerEvents="none" style={styles.traySheen} />
        {game.tray.map((piece, index) => (
          <Animated.View key={piece.id} entering={reduceMotion ? FadeIn.delay(game.trayGeneration > 0 ? 80 : 0).duration(60) : FadeInUp.delay((game.trayGeneration > 0 ? 220 : 0) + index * 55).duration(220).easing(CONTROLLED_EASE)} style={[styles.traySlot, piece.used && styles.traySlotUsed, selectedPieceId === piece.id && styles.traySlotActive]}>
            {piece.used ? <View style={styles.usedDot} /> : (
              <DraggableBlockBlastPiece
                piece={piece}
                board={game.board}
                boardFrame={boardFrame}
                metrics={metrics}
                selected={selectedPieceId === piece.id}
                reduceMotion={reduceMotion}
                onPick={() => { measureBoard(); setSelectedPieceId(piece.id); haptic('pick'); }}
                onHover={setHover}
                onValidHoverChange={() => haptic('hover')}
                onPlace={(row, column) => place(piece.id, row, column)}
                onInvalid={() => haptic('invalid')}
              />
            )}
          </Animated.View>
        ))}
      </View>

    </View>
  );
}

function BlockPartyPreview() {
  return (
    <View style={styles.previewMedia}>
      <View style={styles.previewBoard}>
        {Array.from({ length: 25 }, (_, index) => <View key={index} style={[styles.previewCell, [1, 2, 6, 10, 11, 12, 16, 17, 21].includes(index) && styles.previewCellFilled]} />)}
      </View>
      <Image source={CHEERLET} contentFit="contain" style={styles.previewCheerlet} />
    </View>
  );
}

function AnimatedScore({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentValue = useRef(value);

  useEffect(() => {
    const target = Math.max(0, Math.round(value));
    const start = currentValue.current;
    if (reduceMotion || target <= start) {
      currentValue.current = target;
      setDisplayValue(target);
      return;
    }

    const startedAt = Date.now();
    const duration = Math.min(520, 260 + Math.log10(Math.max(10, target - start)) * 80);
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(start + (target - start) * eased);
      currentValue.current = next;
      setDisplayValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, value]);

  return <ThemedText selectable style={styles.score} lightColor="#5D351F" darkColor="#5D351F">{formatScore(displayValue)}</ThemedText>;
}

function streakColor(combo: number): string {
  if (combo >= 9) return '#FFF1A8';
  if (combo >= 7) return '#FFB4D2';
  if (combo >= 5) return Lantern.ember300;
  if (combo >= 3) return Lantern.auroraRose;
  return Lantern.auroraTeal;
}

function StreakWordmark({ combo }: { combo: number }) {
  const word = blockBlastStreakWord(combo);
  const label = `${word} ×${combo}`;
  const tone = streakColor(combo);
  const fontSize = word.length >= 9 ? 31 : word.length >= 7 ? 35 : 43;
  const sizing = { fontSize, lineHeight: fontSize + 10 };

  return (
    <View style={styles.streakWordmark}>
      <ThemedText
        accessible={false}
        style={[styles.streakDisplayText, sizing, styles.streakGlow, { color: tone, textShadowColor: tone }]}
      >
        {label}
      </ThemedText>
      <ThemedText
        accessible={false}
        style={[styles.streakDisplayText, sizing, styles.streakExtrusion]}
        lightColor="#241130"
        darkColor="#241130"
      >
        {label}
      </ThemedText>
      <ThemedText
        accessible={false}
        style={[styles.streakDisplayText, sizing, styles.streakKeyline]}
        lightColor="#10091C"
        darkColor="#10091C"
      >
        {label}
      </ThemedText>
      <ThemedText
        accessibilityLabel={`${word}, streak ${combo}`}
        numberOfLines={1}
        style={[styles.streakDisplayText, sizing, styles.streakFace, { color: tone }]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

function ResultAction({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <KatchaButton onPress={onPress} icon={primary ? 'arrow.right' : 'heart.fill'} variant={primary ? 'primary' : 'secondary'} label={(label)} />
  );
}

function formatScore(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-GB');
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8, justifyContent: 'space-between', minHeight: 0, padding: 4 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  topBarBalance: { height: 44, width: 44 },
  topLine: { alignItems: 'center', backgroundColor: 'rgba(255,244,214,0.97)', borderColor: 'rgba(151,96,49,0.28)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, boxShadow: '0 6px 16px rgba(81,46,28,0.22), inset 0 2px 0 rgba(255,255,255,0.72)', justifyContent: 'center', minHeight: 56, minWidth: 158, paddingHorizontal: 24 },
  scoreCenter: { alignItems: 'center', justifyContent: 'center' },
  scoreLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.7, lineHeight: 9 },
  score: { fontSize: 34, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: -1, lineHeight: 38, textAlign: 'center' },
  streakOverlay: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: '36%', zIndex: 200 },
  streakWordmark: { alignItems: 'center', justifyContent: 'center', maxWidth: '94%' },
  streakDisplayText: { fontFamily: AppFontFamilies.fredokaBold, fontVariant: ['tabular-nums'], letterSpacing: 0.1, textAlign: 'center' },
  streakGlow: { opacity: 0.34, position: 'absolute', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18, transform: [{ scale: 1.055 }] },
  streakExtrusion: { position: 'absolute', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 3, transform: [{ translateY: 6 }, { scale: 1.018 }] },
  streakKeyline: { position: 'absolute', transform: [{ scaleX: 1.035 }, { scaleY: 1.075 }] },
  streakFace: { textShadowColor: 'rgba(255,255,255,0.72)', textShadowOffset: { width: 0, height: -2 }, textShadowRadius: 1.5 },
  boardFrame: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0, position: 'relative' },
  boardShell: { position: 'relative' },
  boardRim: { backgroundColor: 'rgba(255,240,201,0.97)', borderColor: 'rgba(142,84,41,0.34)', borderCurve: 'continuous', borderRadius: 30, borderWidth: 1, boxShadow: '0 10px 24px rgba(74,41,24,0.28), inset 0 2px 0 rgba(255,255,255,0.75)', left: -7, position: 'absolute', top: -7 },
  tray: { alignItems: 'center', backgroundColor: 'rgba(255,244,214,0.96)', borderColor: 'rgba(151,96,49,0.30)', borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: '0 10px 24px rgba(74,41,24,0.24), inset 0 2px 0 rgba(255,255,255,0.74)', flexDirection: 'row', height: 90, justifyContent: 'space-between', marginBottom: 14, overflow: 'visible', paddingHorizontal: 6, position: 'relative' },
  traySheen: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 99, height: 1, left: 18, position: 'absolute', right: 18, top: 1 },
  traySlot: { alignItems: 'center', flex: 1, height: 84, justifyContent: 'center', overflow: 'visible' },
  traySlotActive: { zIndex: 50 },
  traySlotUsed: { opacity: 0.48 },
  usedDot: { backgroundColor: 'rgba(124,76,43,0.22)', borderRadius: 99, height: 5, width: 5 },
  previewMedia: { height: 128, position: 'relative', width: 144 },
  previewBoard: { backgroundColor: '#111326', borderColor: '#3B3B61', borderCurve: 'continuous', borderRadius: 15, borderWidth: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 2, height: 94, left: 0, padding: 7, position: 'absolute', top: 15, transform: [{ rotate: '-5deg' }], width: 94 },
  previewCell: { backgroundColor: '#252846', borderRadius: 3, height: 13, width: 13 },
  previewCellFilled: { backgroundColor: '#F18AB7', borderColor: '#FFC2DA', borderWidth: 0.5 },
  previewCheerlet: { bottom: -4, height: 114, position: 'absolute', right: -18, width: 94 },
  resultRoot: { flex: 1, gap: 12, justifyContent: 'center', minHeight: 0, padding: 4 },
  resultCard: { backgroundColor: 'rgba(255,244,214,0.97)', borderColor: 'rgba(151,96,49,0.30)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 14px 32px rgba(73,40,23,0.28), inset 0 2px 0 rgba(255,255,255,0.76)', gap: 16, padding: 18 },
  resultCopy: { alignItems: 'center', paddingHorizontal: 8 },
  resultEyebrowPill: { alignItems: 'center', backgroundColor: 'rgba(244,154,193,0.14)', borderRadius: 999, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  resultEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.95 },
  scoreStage: { alignItems: 'center', backgroundColor: '#FFE9B9', borderColor: 'rgba(151,96,49,0.26)', borderCurve: 'continuous', borderRadius: 23, borderWidth: 1, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.62)', gap: 3, justifyContent: 'center', padding: 14 },
  scoreStageLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.25 },
  finalScore: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 52, fontVariant: ['tabular-nums'], letterSpacing: -1.4, lineHeight: 57 },
  finalLabel: { fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 0.65 },
  resultActions: { gap: 8 },
});
