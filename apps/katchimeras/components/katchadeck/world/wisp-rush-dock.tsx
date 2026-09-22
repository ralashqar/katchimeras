import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { Image } from 'expo-image';
import { MERGE_WORLD_UI_ART } from '@/constants/merge-world-ui-art';
import { AppFontFamilies } from '@/constants/theme';
import type { HeatSpec } from '@/features/time-trial/heat';
import { heatMissionStrike, type RushLive } from '@/features/time-trial/heat-mechanic';
import { useWispRushHeat } from '@/features/time-trial/use-wisp-rush-heat';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MergeWorldCommand, MergeWorldCommandResult } from '@/types/merge-world';
import type { MissionStrike } from '@/types/mission-mechanic';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock, type GlowLandingSource } from './kingdom-opening-merge-dock';

const EMPTY_IDS: ReadonlySet<string> = new Set();
export const formatHeatClock = (ms: number) => { const seconds = Math.ceil(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };

/** The countdown: it owns its own timer, so the board never re-renders for it. The last ten seconds turn warm. */
const HeatClock = memo(function HeatClock({ remainingMs, running, score, goal }: { remainingMs: () => number; running: boolean; score: number; goal: number }) {
  const [shown, setShown] = useState(() => remainingMs());
  useEffect(() => {
    setShown(remainingMs());
    if (!running) return;
    const timer = setInterval(() => setShown(remainingMs()), 100);
    return () => clearInterval(timer);
  }, [remainingMs, running]);
  return <View style={styles.clock} accessible accessibilityLabel={`${formatHeatClock(shown)} left. ${score} of ${goal} wisps`}>
    <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={MERGE_WORLD_UI_ART.rushTimer} style={styles.clockArt} transition={0} />
    <Text style={[styles.clockText, shown <= 10_000 && styles.clockLate]}>{formatHeatClock(shown)}</Text>
    <Text style={[styles.clockScore, score >= goal && styles.clockMade]}>{score} / {goal}</Text>
  </View>;
});

/**
 * A Wisp Rush heat, docked under its tile like any friend's board: the game's own mini board and bar
 * (`MistMissionDock`), driven by the heat bridge. A merge is a strike; it leaves the board as the same Glow flight
 * every mission uses, aimed at the wisp nearest to it, and the wisps themselves are the Kingdom's wisp layer over the
 * tile (told of each new wisp through `live`). Pieces arrive on their own and pop in with the board's own entrance.
 * What a time trial adds is its clock: it starts on the first move, and when it runs out the score is what fell.
 */
export const WispRushDock = memo(function WispRushDock({ spec, goal, title, live, width, bottomInset, landings, onStrike, onBoardMetrics, onBlockedInteraction, onEntranceSettled, onFinished, onVoided, onClose }: {
  spec: HeatSpec;
  /** Wisps to strike down for the run to count (the bar). */
  goal: number;
  title: string;
  live?: RushLive;
  width: number; bottomInset: number;
  landings?: GlowLandingSource;
  onStrike?: (from: RewardFlightPoint, strike: MissionStrike) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
  onFinished: (score: number) => void; onVoided: () => void; onClose: () => void;
}) {
  const run = useWispRushHeat(spec);
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const { finished, voided, score } = run;
  const heat = run.board.heat;
  // Leaving with the clock running throws the run away: ask first. Before the first move, or once it is over, just go.
  const running = run.started && !finished && !voided;
  const leave = useCallback(() => {
    if (!running) { onClose(); return; }
    Alert.alert('Leave the run?', 'The clock is running. If you leave now, this heat does not count and you run it again from the start.', [
      { text: 'Keep running', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onClose },
    ]);
  }, [onClose, running]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => subscription.remove();
  }, [leave]);
  useEffect(() => { live?.publish(heat); }, [heat, live]);
  useEffect(() => { if (finished) onFinished(score); }, [finished, onFinished, score]);
  useEffect(() => { if (voided) onVoided(); }, [onVoided, voided]);

  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
  }, [onBoardMetrics]);
  const { dispatch: send } = run;
  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const moved = send(command);
    if (!moved) return null;
    const cell = moved.result.mergedCell;
    const made = cell == null ? null : moved.result.state.board[cell]?.occupant;
    const metrics = boardMetricsRef.current;
    if (!moved.strike || cell == null || made?.kind !== 'item' || !metrics) return moved.result;
    const strike = heatMissionStrike(moved.strike, cell, made.definitionId);
    if (strike.wasted) return moved.result;
    const center = mergeCellCenter(metrics.geometry, cell);
    onStrike?.({ x: metrics.x + center.x, y: metrics.y + center.y }, strike);
    return moved.result;
  }, [onStrike, send]);

  return <MistMissionDock
    state={run.board.world} boardStep={null} progress={Math.min(goal, score)} required={Math.max(1, goal)}
    barTitle={run.started ? title : `${title} · the clock starts on your first move`}
    interactionKey={`wisp-rush:${spec.id}`} sessionId={sessionRef.current.id} hiddenItemIds={EMPTY_IDS} animateArrivals
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled}
    onClose={leave} closeLabel="Leave the run"
    header={<View style={styles.header}><HeatClock remainingMs={run.remainingMs} running={running} score={score} goal={goal} /></View>} headerGap={8} />;
});

const styles = StyleSheet.create({
  header: { alignItems: 'center', alignSelf: 'stretch' },
  clock: { alignItems: 'center', backgroundColor: 'rgba(22,16,40,0.62)', borderRadius: 18, flexDirection: 'row', gap: 10, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 5 },
  clockArt: { width: 28, height: 28 },
  clockText: { color: '#FFF6E2', fontFamily: AppFontFamilies.fredokaBold, fontSize: 26, fontVariant: ['tabular-nums'] },
  clockLate: { color: '#FFB37A' },
  clockScore: { color: '#CFC4E6', fontFamily: AppFontFamilies.fredokaBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  clockMade: { color: '#F2D58A' },
});
