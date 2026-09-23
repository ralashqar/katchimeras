import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { AppFontFamilies } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { encounterWindow } from '@/features/encounter/create-state';
import { pulseAim, usePulseAim } from '@/features/encounter/pulse-aim';
import { pulseArea } from '@/features/encounter/pulse';
import { ENCOUNTER_LOSS, ENCOUNTER_LOSS_V2, gradeLabel, outcomeLine } from '@/features/encounter/encounter-copy';
import { mechanicProgress, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
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
/**
 * The Mist's hold on the board (territory battles): how many cells it covers against the line where the level is
 * lost. When it spreads, the bar swells with a buzz; pulled back (a merge's pulse, Keep going), it settles. Reduced
 * motion: it simply changes.
 */
const MistMeter = memo(function MistMeter({ mist, overrun, cells, turns, reduceMotion }: { mist: number; overrun: number; cells: number; turns: number; reduceMotion: boolean }) {
  const swell = useSharedValue(0);
  const was = useRef(mist);
  useEffect(() => {
    if (was.current === mist) return;
    const rose = mist > was.current;
    was.current = mist;
    if (reduceMotion || !rose) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    swell.value = 0;
    swell.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 380 }));
  }, [mist, reduceMotion, swell]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + swell.value * 0.12 }] }));
  const close = overrun - mist <= 2;
  const share = (value: number) => `${Math.max(0, Math.min(100, (value / Math.max(1, cells)) * 100))}%` as const;
  return <Animated.View accessibilityRole="text" accessibilityLabel={`Mist on ${mist} of ${cells} cells. At ${overrun} it takes over. Turn ${turns}`} style={[styles.pill, styles.meterPill, close ? styles.pillLow : null, style]}>
    <IconSymbol name="cloud.fog.fill" size={15} color={close ? '#B0567A' : '#7A6A9E'} />
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, close ? styles.meterFillClose : null, { width: share(mist) }]} />
      <View style={[styles.meterLine, { left: share(overrun) }]} />
    </View>
    <Text style={styles.pillLabel}>{`${mist}/${overrun}`}</Text>
    <Text style={styles.pillLabel}>{`Turn ${turns}`}</Text>
  </Animated.View>;
});

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
  // Territory: a piece held over its twin shows the Harmony pulse its merge would send, and rings the wisp it would strike.
  const aimWindow = useMemo(() => (encounter ? encounterWindow(encounter.definition) : null), [encounter?.definition]);
  const aimFromCell = useCallback((cell: number, source: number) => {
    const board = stateRef.current.board;
    const held = source >= 0 ? board[source]?.occupant : null;
    const under = cell >= 0 && cell !== source ? board[cell]?.occupant : null;
    const next = held?.kind === 'item' && under?.kind === 'item' && under.definitionId === held.definitionId ? MERGE_ITEMS_BY_ID.get(held.definitionId)?.nextItemId : null;
    const tier = next ? MERGE_ITEMS_BY_ID.get(next)?.tier ?? null : null;
    pulseAim.set(tier != null ? { cell, tier } : null);
  }, []);
  useEffect(() => () => pulseAim.set(null), []);
  const aim = usePulseAim();
  const pulseCells = useMemo(() => (aim && aimWindow ? pulseArea(aim.cell, aim.tier, aimWindow).cells : []), [aim, aimWindow]);
  // What a wisp took off the board without a merge (a piece it ate) puffs away on the board, never simply vanishing.
  const effectSeq = useRef(0);
  const effectCells = useMemo(() => (encounter?.effects ?? []).flatMap((effect) => (effect.kind === 'ate' ? [{ id: ++effectSeq.current, cell: effect.cell, kind: 'mist-burst' as const }] : [])), [encounter?.effects]);
  // Spores a wisp has dropped: a free cell that turns to Mist unless a piece is put on it.
  const spores = useMemo(() => (mechanicState ? wispViews(mechanic, mission, mechanicState).flatMap((view) => view.spores ?? []) : []), [mechanic, mechanicState, mission]);
  const header = encounter ? <View pointerEvents="box-none" style={styles.header}>
    {encounter.speech ? <View style={styles.speechRow}><FriendSpeechBubble text={encounter.speech} reduceMotion={reduceMotion} tail="none" raise={false} /></View> : null}
    <View style={styles.headerRow}>
      {encounter.territory ? <MistMeter mist={encounter.territory.mist} overrun={encounter.territory.overrun} cells={encounter.territory.cells} turns={encounter.turns} reduceMotion={reduceMotion} /> : <View accessibilityRole="text" accessibilityLabel={encounter.resolveLeft == null ? 'No Resolve budget' : `Resolve ${encounter.resolveLeft}`} style={[styles.pill, encounter.resolveLeft != null && encounter.resolveLeft <= 3 ? styles.pillLow : null]}>
        <Text style={styles.pillLabel}>Resolve</Text>
        <Text style={styles.pillValue}>{encounter.resolveLeft == null ? '∞' : encounter.resolveLeft}</Text>
      </View>}
      {ability ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ability.ready }} accessibilityLabel={`${ability.definition.name}, ${ability.ready ? 'ready' : `${ability.charge} of ${ability.tier.chargeEvery} charged`}`}
        onPress={pressAbility} style={[styles.abilityButton, ability.ready ? styles.abilityReady : null, picking ? styles.abilityPicking : null]}>
        <Text style={styles.abilityName}>{ability.definition.name}</Text>
        <Text style={styles.abilityCharge}>{ability.ready ? (picking ? 'Choose' : 'Ready') : `${Math.min(ability.charge, ability.tier.chargeEvery)}/${ability.tier.chargeEvery}`}</Text>
      </Pressable> : null}
      {encounter.outcome?.cleared ? <View style={styles.pill}><Text style={styles.pillValue}>{gradeLabel(encounter.outcome.grade)}</Text></View> : null}
    </View>
  </View> : null;
  const cellBox = (cell: number) => {
    const metrics = boardMetricsRef.current;
    if (!metrics || !boardOffset) return null;
    const { bounds } = mergeCellFrame(metrics.geometry, cell);
    return { left: boardOffset.x + bounds.left, top: boardOffset.y + bounds.top, width: bounds.width, height: bounds.height };
  };
  const overlay = encounter ? <>
    {pulseCells.map((cell) => { const box = cellBox(cell); return box ? <Animated.View key={`pulse:${cell}`} entering={FadeIn.duration(reduceMotion ? 60 : 140)} exiting={FadeOut.duration(reduceMotion ? 60 : 160)} pointerEvents="none" style={[styles.pulseCell, box]} /> : null; })}
    {spores.map((spore) => { const box = cellBox(spore.cell); return box ? <Animated.View key={`spore:${spore.cell}`} entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} exiting={reduceMotion ? undefined : ZoomOut.duration(220)} pointerEvents="none" accessible accessibilityLabel={`A spore. It turns to Mist in ${spore.turns} ${spore.turns === 1 ? 'turn' : 'turns'} unless a piece is put here`} style={[styles.sporeCell, box]}>
      <View style={styles.sporeDot}><Text style={styles.sporeText}>{spore.turns}</Text></View>
    </Animated.View> : null; })}
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
        <Text style={styles.lossTitle}>{encounter.territory && encounter.lossReason && encounter.lossReason !== 'resolve' ? ENCOUNTER_LOSS_V2[encounter.lossReason].title : ENCOUNTER_LOSS.title}</Text>
        <Text style={styles.lossBody}>{encounter.territory && encounter.lossReason && encounter.lossReason !== 'resolve' ? ENCOUNTER_LOSS_V2[encounter.lossReason].body : ENCOUNTER_LOSS.body}</Text>
        <View style={styles.lossActions}>
          <KatchaButton label={ENCOUNTER_LOSS.retry} onPress={encounter.onRetry} variant="primary" fullWidth />
          <KatchaButton label={encounter.territory ? ENCOUNTER_LOSS_V2.keepGoing : ENCOUNTER_LOSS.keepGoing} onPress={encounter.onKeepGoing} variant="secondary" fullWidth
            cost={encounter.keepGoingCost ? { currency: 'coins', amount: encounter.keepGoingCost } : undefined} />
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
    rootRef={rootRef} header={header} headerGap={encounter ? 6 : undefined} overlay={overlay} onHoverCell={encounter?.territory ? aimFromCell : undefined}
    animateArrivals={Boolean(encounter)} externalEffects={effectCells} />;
});

const styles = StyleSheet.create({
  header: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  speechRow: { alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(20,40,60,0.14)' },
  pillLow: { backgroundColor: '#FFF0E6', borderColor: '#FFD9C2' },
  meterPill: { alignItems: 'center' },
  meterTrack: { width: 76, height: 8, borderRadius: 4, backgroundColor: '#E3E9F0', overflow: 'visible' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: '#9C86C8' },
  meterFillClose: { backgroundColor: '#C9678F' },
  meterLine: { position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: '#5B3F86' },
  pulseCell: { position: 'absolute', borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,210,122,0.9)', backgroundColor: 'rgba(255,226,160,0.22)' },
  sporeCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sporeDot: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: 'rgba(122,92,170,0.85)', borderWidth: 1.5, borderColor: '#E8DDFB' },
  sporeText: { color: '#FFFFFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
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
