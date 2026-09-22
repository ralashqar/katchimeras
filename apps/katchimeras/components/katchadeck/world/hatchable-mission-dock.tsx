import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { AppFontFamilies } from '@/constants/theme';
import { ENCOUNTER_LOSS, gradeLabel, outcomeLine } from '@/features/encounter/encounter-copy';
import { mechanicProgress, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { missionBoardStep } from '@/features/onboarding/steppling-mission';
import type { EncounterDockState } from '@/features/onboarding/use-mist-mission';
import type { MissionCommandResult } from '@/features/onboarding/use-opening-mission-board';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import { mergeCellCenter, mergeCellFrame } from '@/utils/merge-world/board-geometry';
import { FriendSpeechBubble } from './friend-speech-bubble';
import { MistMissionDock, type GlowLandingSource } from './kingdom-opening-merge-dock';

type HatchableMissionDockProps = {
  /** Whose mission: the board's seed, bar, guidance and mechanic come from the definition (a friend's, or a journey tile's without a camera). */
  mission: Omit<HatchableMissionDefinition, 'camera'>;
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MissionCommandResult | null;
  merges: number;
  /** Where the board's strikes stand, by its mechanic: the bar and the guidance read it. */
  mechanicState: MissionMechanicState | null;
  /** The board is an encounter: its Resolve, ability, cache and loss are shown and driven here. */
  encounter?: EncounterDockState | null;
  width: number;
  bottomInset: number;
  landings?: GlowLandingSource;
  /** A strike on the wisps: what flies is the mechanic's to say. */
  onStrike?: (from: RewardFlightPoint, strike: MissionStrike) => void;
  /** The strike that fills the bar: its item leaves the board for the mist. */
  onFinale?: (from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => void;
  /** Veiled cells that burst open because a sleeper beside them woke. */
  onReveal?: (count: number) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
};

/** Where the dock's overlay sits against the board: the board's frame in the dock's own coordinates. */
type BoardOffset = { x: number; y: number };

/**
 * A hatchable companion's mission board under their misted tile: the same
 * dock the opening used, on the companion's own board. Progress is the
 * mission store's own count, resolved by the board's mechanic, not an FTUE
 * run: the discovery story only hears about the bar filling.
 *
 * On an encounter the header shows the Resolve left and the Katchimera's
 * ability (tap it, then a plant or a spawner when it wants one); a spent
 * budget lays the loss over the board with the ways on.
 */
export const HatchableMissionDock = memo(function HatchableMissionDock({ mission, state, send, merges, mechanicState, encounter, width, bottomInset, landings, onStrike, onFinale, onReveal, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: HatchableMissionDockProps) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const boardStep = useMemo(() => missionBoardStep(mission, state, merges, mechanicState), [mechanicState, merges, mission, state]);
  const stateRef = useRef(state);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  stepRef.current = boardStep;
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const rootRef = useRef<ViewType | null>(null);
  const [boardOffset, setBoardOffset] = useState<BoardOffset | null>(null);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
    // The board's frame against the dock's root, for overlays laid over its cells.
    if (metrics && rootRef.current) rootRef.current.measureInWindow((x, y) => setBoardOffset({ x: metrics.x - x, y: metrics.y - y }));
  }, [onBoardMetrics]);
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const mechanic = resolveMechanic(mission);
  const progress = useMemo(() => mechanicState ? mechanicProgress(mechanic, mission, mechanicState) : { current: Math.max(0, Math.min(mission.required, merges)), total: mission.required }, [mechanic, mechanicState, merges, mission]);
  const dispatch = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
    const current = stateRef.current;
    if (!mergeFtueAllowsCommand(stepRef.current, current, command)) {
      onBlockedInteraction?.();
      return null;
    }
    // A mission has no Energy economy; a spawner tap (a friend's board may have one) is never refused for it.
    const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
    const result = send(effective);
    if (result) stateRef.current = result.state;
    if (result?.failureReason === 'out_of_resolve' || result?.failureReason === 'spawner_spent') onBlockedInteraction?.();
    if (result?.revealedMistCells?.length) onReveal?.(result.revealedMistCells.length);
    // A merge or a waking is a strike; the store resolved what it does by the board's mechanic.
    const strike = result?.strike ?? null;
    if (!result || !strike) return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, strike.fromCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    if (strike.finale) {
      const occupant = result.state.board[strike.fromCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, strike.resultDefinitionId, strike);
    } else {
      onStrike?.(from, strike);
    }
    return result;
  }, [onBlockedInteraction, onFinale, onReveal, onStrike, send]);

  // The ability: a tap uses it at once when it wants no target; otherwise the board's possible targets light up for a pick.
  const [picking, setPicking] = useState(false);
  const ability = encounter?.ability ?? null;
  useEffect(() => { if (!ability?.ready) setPicking(false); }, [ability?.ready]);
  const pressAbility = useCallback(() => {
    if (!ability?.ready || !encounter) return;
    if (ability.definition.targeting === 'none') { encounter.onUseAbility(null); return; }
    setPicking((value) => !value);
  }, [ability, encounter]);
  const pickTarget = useCallback((cell: number) => {
    encounter?.onUseAbility(cell);
    setPicking(false);
  }, [encounter]);
  const reduceMotion = useReducedMotion();
  const header = encounter ? <View pointerEvents="box-none" style={styles.header}>
    {encounter.speech ? <View style={styles.speechRow}><FriendSpeechBubble text={encounter.speech} reduceMotion={reduceMotion} tail="none" raise={false} /></View> : null}
    <View style={styles.headerRow}>
      <View accessibilityRole="text" accessibilityLabel={encounter.resolveLeft == null ? 'No Resolve budget' : `Resolve ${encounter.resolveLeft}`} style={[styles.pill, encounter.resolveLeft != null && encounter.resolveLeft <= 3 ? styles.pillLow : null]}>
        <Text style={styles.pillLabel}>Resolve</Text>
        <Text style={styles.pillValue}>{encounter.resolveLeft == null ? '∞' : encounter.resolveLeft}</Text>
      </View>
      {ability ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ability.ready }} accessibilityLabel={`${ability.definition.name}, ${ability.ready ? 'ready' : `${ability.charge} of ${ability.tier.chargeEvery} charged`}`}
        onPress={pressAbility} style={[styles.abilityButton, ability.ready ? styles.abilityReady : null, picking ? styles.abilityPicking : null]}>
        <Text style={styles.abilityName}>{ability.definition.name}</Text>
        <Text style={styles.abilityCharge}>{ability.ready ? (picking ? 'Choose' : 'Ready') : `${Math.min(ability.charge, ability.tier.chargeEvery)}/${ability.tier.chargeEvery}`}</Text>
      </Pressable> : null}
      {encounter.outcome?.cleared ? <View style={styles.pill}><Text style={styles.pillValue}>{gradeLabel(encounter.outcome.grade)}</Text></View> : null}
    </View>
  </View> : null;
  const overlay = encounter ? <>
    {picking && ability && boardOffset ? ability.targets.map((cell) => {
      const metrics = boardMetricsRef.current;
      if (!metrics) return null;
      const frame = mergeCellFrame(metrics.geometry, cell);
      return <Pressable key={cell} accessibilityRole="button" accessibilityLabel={`${ability.definition.name} here`} onPress={() => pickTarget(cell)}
        style={[styles.pickCell, { left: boardOffset.x + frame.bounds.left, top: boardOffset.y + frame.bounds.top, width: frame.bounds.width, height: frame.bounds.height }]} />;
    }) : null}
    {encounter.status === 'failed' ? <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 260)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.lossScrim} />
      <View style={styles.lossCard}>
        <Text style={styles.lossEyebrow}>{ENCOUNTER_LOSS.eyebrow}</Text>
        <Text style={styles.lossTitle}>{ENCOUNTER_LOSS.title}</Text>
        <Text style={styles.lossBody}>{ENCOUNTER_LOSS.body}</Text>
        <View style={styles.lossActions}>
          <KatchaButton label={ENCOUNTER_LOSS.retry} onPress={encounter.onRetry} variant="primary" fullWidth />
          <KatchaButton label={ENCOUNTER_LOSS.keepGoing} onPress={encounter.onKeepGoing} variant="secondary" fullWidth />
          {encounter.onLeave ? <KatchaButton label={ENCOUNTER_LOSS.leave} onPress={encounter.onLeave} variant="tertiary" fullWidth /> : null}
        </View>
        {encounter.outcome ? <Text style={styles.lossFootnote}>{outcomeLine('cleared', { continues: encounter.outcome.continues, rescued: encounter.outcome.rescued }) === 'Cleared.' ? '' : ''}</Text> : null}
      </View>
    </Animated.View> : null}
  </> : undefined;

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress.current} required={progress.total} barTitle={mission.barTitle}
    interactionKey={`${mission.id}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled}
    rootRef={rootRef} header={header} headerGap={encounter ? 6 : undefined} overlay={overlay} />;
});

const styles = StyleSheet.create({
  header: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  speechRow: { alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(20,40,60,0.14)' },
  pillLow: { backgroundColor: '#FFF0E6', borderColor: '#FFD9C2' },
  pillLabel: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  pillValue: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 15 },
  abilityButton: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(244,249,253,0.7)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  abilityReady: { backgroundColor: '#E6F6EA', borderColor: '#9ED8AE', boxShadow: '0 0 14px rgba(95,168,123,0.45)' },
  abilityPicking: { backgroundColor: '#FFF6D6', borderColor: '#F2D27A' },
  abilityName: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 15 },
  abilityCharge: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 11, lineHeight: 13 },
  pickCell: { position: 'absolute', borderRadius: 10, borderWidth: 3, borderColor: '#F2D27A', backgroundColor: 'rgba(255,246,214,0.35)' },
  lossScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(22,16,40,0.42)', borderRadius: 18 },
  lossCard: { position: 'absolute', left: 18, right: 18, top: '18%', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(20,40,60,0.22)' },
  lossEyebrow: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  lossTitle: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, textAlign: 'center' },
  lossBody: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  lossActions: { alignSelf: 'stretch', gap: 8 },
  lossFootnote: { height: 0 },
});
