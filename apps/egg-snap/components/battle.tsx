import { PerformancePanel } from "./performance-panel";
import { ARENA_ENABLED } from "../game/dev-tools";
import { CombatVolleys, type CombatVolleyData, type CombatBurstData } from "./combat-volley";
import { CELL_STAGGER_MS } from "../game/volley-presentation";
import { TileArtTheme } from "./tile-art-theme";
import { DuelHatchRewards } from './duel-hatch-rewards';
import { AppearanceGallery } from "./appearance-gallery";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Tray,
  SlotField,
  varietyFieldLayers,
  varietyBackLayers,
  type DropOutcome,
} from "@incubator/tile-match/native";
import { NO_CELL, type DropRelease } from "@incubator/tile-match/engine";
import { buildSlotBurst } from "@incubator/tile-match/timing";
import { MECHANIC_LESSONS, snapLadder } from "../data/progression";
import { impulseStrength } from "@incubator/tile-match/feedback";
import { CombatCallout } from "./combat-callout";
import { DUELS, getDuel, MOVES, mechanicSequence, DEFAULT_ARENA_AI } from "../data/campaign";
import type { CombatPresentation } from "../game/combat-presentation";
import { resultFor, riggedCells, BACKFIRE } from "../game/combat";
import { MOSSPROUT_DUEL } from "../data/duel-stages";
import { StageGuides } from "./stage-guides";
import { OpponentField } from "./opponent-field";
import { GroundedEgg } from "./grounded-egg";
import { battleLayout, opponentFieldLayout } from "../game/layout";
import { dropPreview, shouldCancelDrop } from "../game/drop-target";
import { useCombatOffset } from "../game/use-combat-offset";
import { useCombat } from "../game/use-combat";
import { useFeedback } from "../game/feedback";
import { repository } from "../state/repository";
import { useProfile } from "../state/provider";
import { canPlay } from "../state/profile";
import { Scene } from "./scene";
import { Egg } from "./egg";
import { Button, Copy, styles } from "./ui";
import { Dialogue } from "./dialogue";
const trayStyle = {
  backgroundColor: "rgba(26, 46, 37, 0.94)",
  borderColor: "#E4D3A778",
  borderTopWidth: 2,
  borderBottomWidth: 4,
  borderRadius: 28,
} as const;
function Meter({
  fraction,
  color = "#B5E59B",
}: {
  fraction: number;
  color?: string;
}) {
  return (
    <View
      style={{
        height: 7,
        backgroundColor: "#FFFFFF25",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 7,
          width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
          backgroundColor: color,
          borderRadius: 6,
        }}
      />
    </View>
  );
}
export default function BattleRoute() {
  const params = useLocalSearchParams<{
    level?: string;
    mechanic?: string;
    strength?: string;
    seed?: string;
    speed?: string;
    accuracy?: string;
    stress?: string;
    appearance?: string;
  }>();
  const { profile } = useProfile();
  const practice = ARENA_ENABLED && !!params.mechanic;
  const definition = useMemo(() => {
    const base = DUELS.find((d) => d.id === params.level) ?? getDuel("glade-1");
    if (!practice) return base;
    const mechanic = MOVES[params.mechanic!] ? params.mechanic! : "tap";
    const strength = Math.max(0, Math.min(1, Number(params.strength) || 0.25));
    const speed = Math.max(100, Math.min(10000, Number(params.speed) || DEFAULT_ARENA_AI.actionMs));
    const accuracy = params.accuracy === undefined || !Number.isFinite(Number(params.accuracy)) ? DEFAULT_ARENA_AI.accuracy : Math.max(0, Math.min(1, Number(params.accuracy)));
    return {...base, id: 'practice', name: 'Mechanics arena', health: params.stress ? 1000000 : 400,
      progression: params.mechanic === 'mixed' && !params.stress ? snapLadder(true)
        : mechanicSequence(params.stress ? ['tap', 'drift', 'armour', 'bomb', 'fuse', 'crossed', 'hues'] : [mechanic], 2, strength),
      ai: {minActionMs: Math.round(speed * .85), maxActionMs: Math.round(speed * 1.15), accuracy}};
  }, [params.level, params.mechanic, params.strength, params.speed, params.accuracy, params.stress, practice]);
  if (!profile) return null;
  if (ARENA_ENABLED && params.appearance) return <AppearanceGallery />;
  if (!practice && !canPlay(profile, definition.id))
    return (
      <Scene>
        <View style={{ padding: 35, marginTop: 120, gap: 20 }}>
          <Copy>This duel is still beyond the mist.</Copy>
          <Button onPress={() => router.replace("/")}>Return to world</Button>
        </View>
      </Scene>
    );
  return (
    <TileArtTheme clear={profile.preferences?.highReadability === true}>
      <Battle
        key={`${definition.id}:${params.mechanic}:${params.seed}:${params.speed}:${params.accuracy}`}
        definition={definition}
        seed={params.seed ?? `${definition.id}:${Date.now()}`}
        practice={practice}
        stress={practice && !!params.stress}
      />
    </TileArtTheme>
  );
}
function Battle({
  definition,
  seed,
  practice,
  stress,
}: {
  definition: ReturnType<typeof getDuel>;
  seed: string;
  practice: boolean;
  stress: boolean;
}) {
  const { profile, act } = useProfile();
  const [paused, setPaused] = useState(false);
  const [guides, setGuides] = useState(false);
  const [ready, setReady] = useState(false);
  const muted = profile?.preferences?.sound === false;
  const hapticsEnabled = profile?.preferences?.haptics !== false;
  const [lesson, setLesson] = useState<string | null>(null);
  const [story, setStory] = useState(
    !practice && !profile!.seen.includes(`duel:${definition.id}`),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const suspended = paused || story || !!lesson || !ready;
  const game = useCombat(definition, seed, suspended, practice, stress);
  const { state, ref, clock, drop, backgrounded, presentation } = game;
  useLayoutEffect(() => { if (practice) presentation.performance.commits++; });
  const run = state.run;
  useEffect(() => {
    if (practice || story || lesson || state.outcome || run.beat.status !== "placing") return;
    const unseen = run.beat.varieties.find(v => MECHANIC_LESSONS[v.id] && !profile!.seen.includes(`mechanic:${v.id}`));
    if (unseen) setLesson(unseen.id);
  }, [practice, story, lesson, state.outcome, run.beat, profile]);
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useMemo(
    () => battleLayout(width, height, insets.top, insets.bottom, definition.regionId === "glade" ? MOSSPROUT_DUEL : undefined, profile?.skin, definition.skin),
    [width, height, insets.top, insets.bottom, definition.regionId, definition.skin, profile?.skin],
  );
  const offset = useCombatOffset(run.beat, clock, state.beatStartedAt, layout.driftAmplitude, reduced);
  const rivalLayout = useMemo(() => opponentFieldLayout(layout), [layout]);
  const rivalOffset = useCombatOffset(state.opponent.run.beat, clock, state.opponent.beatStartedAt, rivalLayout.driftAmplitude, reduced);
  const fieldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.dx.value },
      { translateY: offset.dy.value },
    ],
  }));
  const [hoverTarget, setHoverTarget] = useState<{
    pieceId: string;
    index: number;
  } | null>(null);
  // Re-grade a held preview when colours, shields or filled cells change,
  // even if the finger has not crossed into a different grid cell.
  const hover = useMemo(
    () =>
      hoverTarget
        ? dropPreview(run, hoverTarget.pieceId, hoverTarget.index)
        : [],
    [run, hoverTarget],
  );
  const [bursts, setBursts] = useState<CombatBurstData[]>([]);
  const burstSequence = useRef(-1);
  const [volleys, setVolleys] = useState<CombatVolleyData[]>([]);

  const [fireKey, setFireKey] = useState(0);
  const [opponentFireKey, setOpponentFireKey] = useState(0);
  const opponentHitSignal = useSharedValue(0);
  const playerHitSignal = useSharedValue(0);
  const playerDizzySignal = useSharedValue(0);
  const playerHealth = useSharedValue(1);
  const opponentHealth = useSharedValue(1);
  useLayoutEffect(() => {
    const update = () => {
      playerHealth.value = withTiming(presentation.current.playerHp / definition.health, {duration: 180});
      opponentHealth.value = withTiming(presentation.current.opponentHp / definition.health, {duration: 180});
    };
    update();
    return presentation.subscribe(update);
  }, [presentation, definition.health, playerHealth, opponentHealth]);
  const playerHatchAt = state.outcome && state.playerHp === 0 ? state.elapsed : undefined;
  const opponentHatchAt = state.outcome && state.opponentHp === 0 ? state.elapsed : undefined;
  const [hatchFinished, setHatchFinished] = useState(false);
  const finishHatch = useCallback(() => setHatchFinished(true), []);
  const receiveSpark = useCallback(() => setFireKey(key => key + 1), []);
  const [impulse, setImpulse] = useState<{ id: number; strength: number }>();
  const feedback = useFeedback(muted, hapticsEnabled, suspended || backgrounded);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const viewRef = useRef({ layout, offset });
  viewRef.current = { layout, offset };

  const completion = useRef(false);
  useEffect(() => {
    if (backgrounded) {
      setPaused(true);
      game.acknowledgeBackground();
    }
  }, [backgrounded, game]);
  const retire = useCallback(
    (id: number) => {
      if (id < 0) setBursts(all => all.filter(v => v.id !== id));
      else setVolleys(all => all.filter(v => v.id !== id));
    },
    [],
  );
  // SlotField hides resolved cells in this commit. Mount their flying replacements
  // before paint as well: a passive effect leaves a blank frame between the two.
  useLayoutEffect(() => presentation.subscribeEvents(events => {
    for (const event of events) {
      if ((event.type === 'volley' || event.type === 'backfire') && event.run?.lastResolution) {
        const backfire = event.type === 'backfire';
        const incoming = event.side === 'opponent';
        const hitsPlayer = backfire || incoming;
        const source = incoming ? rivalLayout : layout;
        const dy = incoming ? rivalOffset.dy.value : offset.dy.value;
        const cells = buildSlotBurst(event.run.grid, source.metrics, backfire ? riggedCells(event.run) : event.run.lastResolution.clearedCells, backfire ? [] : event.run.lastGroupSizes);
        const targetBounds = hitsPlayer ? layout.stage?.player.visible : layout.stage?.rival.visible;
        const target = targetBounds ? {x: targetBounds.x + targetBounds.width / 2, y: targetBounds.y + targetBounds.height * .5} :
          {x: width / 2, y: hitsPlayer ? layout.eggY + layout.eggSize * .52 : layout.opponentY + layout.opponentSize * .52};
        const bullets = cells.map((c, i) => ({x: source.field.x + c.x + source.metrics.cell/2,
          y: source.field.y + dy + c.y + source.metrics.cell/2, colorId: c.colorId, size: source.metrics.cell, delay: (backfire ? BACKFIRE.shakeMs : 0) + i * CELL_STAGGER_MS}));
        setVolleys(v => [...v, {id: event.id, target, bullets, startAt: event.at, damage: event.damage ?? 0, shakeMs: backfire ? BACKFIRE.shakeMs : 0, quality: presentation.quality.current,
          opponentWidth: targetBounds?.width ?? (hitsPlayer ? layout.eggSize : layout.opponentSize) * .6}]);
        if (backfire) continue;
        if (incoming) setOpponentFireKey(event.id);
        else {
          setFireKey(event.id);
          if (event.run.combo > 0 || event.run.lastGroupCount >= 2) setImpulse({id: event.id,
            strength: impulseStrength(event.run.lastGroupCount, event.run.combo, event.run.beat.varieties.some(v => v.id === 'drift'))});
          feedbackRef.current.volley(cells.map(c => c.delayMs), event.run.lastGroupCount,
            event.run.lastBeatGrade === 'perfect' ? event.run.combo : 0, event.run.lastBeatPace === 'late');
        }
      }
      if (event.type === 'impact') {
        if (event.side === 'player' && event.damageTarget === 'player') playerDizzySignal.value = event.id;
        if ((event.damageTarget ?? (event.side === 'player' ? 'opponent' : 'player')) === 'opponent') opponentHitSignal.value = event.id;
        else playerHitSignal.value = event.id;
        feedbackRef.current.cue('cell-impact');
      }
      if (event.type === 'blast' && event.run) {
        const source = event.side === 'opponent' ? rivalLayout : layout;
        const dy = event.side === 'opponent' ? rivalOffset.dy.value : offset.dy.value;
        const rigged = new Set(event.side === 'player' ? riggedCells(event.run).map(c => c.index) : []);
        const cells = event.run.beat.groups.flatMap(g => g.cells.filter(i => !rigged.has(i)).map(i => ({
          x: source.field.x + source.metrics.outer + (i % event.run!.grid.cols)*source.metrics.pitch,
          y: source.field.y + dy + source.metrics.outer + Math.floor(i / event.run!.grid.cols)*source.metrics.pitch, colorId: g.colorId,
        })));
        const burstId = burstSequence.current--;
        setBursts(all => [...all, {id: burstId, kind: 'blast', startAt: event.at,
          cell: source.metrics.cell, cells, quality: presentation.quality.current}]);
        if (event.side === 'player') feedbackRef.current.cue('blast');
      }
      if (event.side === 'player' && event.type === 'chip') feedbackRef.current.cue('chip');
    }
  }), [presentation, layout, rivalLayout, offset.dy, rivalOffset.dy, width, playerHitSignal, opponentHitSignal, playerDizzySignal]);
  const save = useCallback(async () => {
    if (completion.current || !ref.current.outcome) return;
    completion.current = true;
    setSaving(true);
    try {
      await act(() => repository.result(resultFor(ref.current)));
      router.replace("/results");
    } catch {
      completion.current = false;
      setError(
        "Your result could not be saved. Try again to keep your reward.",
      );
      setSaving(false);
    }
  }, [act, ref]);
  useEffect(() => {
    if (!state.outcome || !hatchFinished || volleys.length || bursts.length || suspended || backgrounded) return;
    if (state.outcome !== "draw") feedbackRef.current.end(state.outcome === "won");
    const timer = setTimeout(() => void save(), 350);
    return () => clearTimeout(timer);
  }, [state.outcome, hatchFinished, save, volleys.length, bursts.length, suspended, backgrounded]);
  const onPickUp = useCallback(() => feedbackRef.current.cue("pickup"), []);
  const onCell = useCallback((pieceId: string, index: number) => {
    if (index !== NO_CELL) feedbackRef.current.cue("snap");
    setHoverTarget((current) =>
      index === NO_CELL
        ? current?.pieceId === pieceId
          ? null
          : current
        : { pieceId, index },
    );
  }, []);
  const onDrop = useCallback(
    (pieceId: string, release: DropRelease): DropOutcome => {
      const { layout: l } = viewRef.current;
      const before = ref.current.run;
      setHoverTarget((current) =>
        current?.pieceId === pieceId ? null : current,
      );
      if (shouldCancelDrop(before, pieceId, release, l)) return "returned";
      const piece = before.tray.find((p) => p.id === pieceId && !p.used);
      if (!piece) return "rejected";
      const next = drop(
        release.cellIndex === NO_CELL
          ? { pieceId, discard: true }
          : {
              pieceId,
              row: Math.floor(release.cellIndex / before.grid.cols),
              column: release.cellIndex % before.grid.cols,
            },
      );
      if (next.run === before) return "rejected";
      const placement = next.run.beat.placements.at(-1);
      if (placement?.absorbed) return "returned";
      if (placement && placement.grade !== "perfect" && !next.run.beat.voided) {
        const columns = Math.max(...piece.cells.map(c => c.column)) + 1;
        const rows = Math.max(...piece.cells.map(c => c.row)) + 1;
        const cells = piece.cells.filter(c => {
          if (release.cellIndex === NO_CELL) return true;
          const row = Math.floor(release.cellIndex / before.grid.cols) + c.row;
          const column = release.cellIndex % before.grid.cols + c.column;
          return !placement.filled.includes(row * before.grid.cols + column);
        }).map(c => ({
          x: release.centerX + (c.column - (columns - 1) / 2) * l.metrics.pitch - l.metrics.cell / 2,
          y: release.centerY + (c.row - (rows - 1) / 2) * l.metrics.pitch - l.metrics.cell / 2,
          colorId: piece.colorId,
        }));
        const burstId = burstSequence.current--;
        setBursts(all => [...all, {id: burstId, startAt: ref.current.elapsed,
          kind: 'miss', cells, cell: l.metrics.cell, quality: presentation.quality.current}]);
      }
      if (!next.run.beat.voided) feedbackRef.current.cue(placement?.filled.length ? "place" : "miss");
      return "consumed";
    },
    [drop, ref, presentation],
  );
  const resolved = run.beat.status === "resolved";
  const lines = useMemo(
    () => [...definition.dialogue, definition.tutorial],
    [definition],
  );
  const last = run.beat.placements.at(-1);
  const arrival = useMemo(
    () => last ? { id: run.piecesPlaced, cells: last.filled } : undefined,
    [last, run.piecesPlaced],
  );
  const callout = state.outcome
    ? state.outcome === "won"
      ? "Beautifully done!"
      : "A little rest…"
    : resolved
      ? run.beat.voided
        ? "Rigged cells backfire!"
        : run.lastBeatGrade === "perfect"
          ? run.lastBeatPace === "late"
            ? "Perfect · take your time"
            : "Perfect!"
          : "Keep your spark"
      : last?.absorbed
        ? "Shield chipped · try again"
        : last?.refused === "colour"
          ? "Match the colour, too"
          : "";
  return (
    <Scene
      environment={
        definition.regionId === "cheerlet" ? "cheerlet" : "mossprout"
      }
      stage={layout.stage}
      onReady={setReady}
      impulse={suspended ? undefined : impulse}
    >
      <View
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: layout.frame.x + 14,
          width: layout.frame.width - 28,
          backgroundColor: "#102016B8",
          borderRadius: 18,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause duel"
          onPress={() => setPaused(true)}
          style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="pause" size={22} color="#FFF1CA" />
        </Pressable>
        {layout.stage && height < 700 ? <View style={{width: 150, gap: 2}}>
          <Health presentation={presentation} side="opponent" max={definition.health} name={definition.rival} />
        </View> : <Copy style={{ fontSize: 12 }}>{definition.name}</Copy>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "Enable sound" : "Mute sound"}
          onPress={() => void act(() => repository.preferences({ sound: muted }))}
          style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={22} color="#FFF1CA" />
        </Pressable>
      </View>
      <View
        style={{
          position: "absolute",
          top: layout.opponentHudY,
          display: layout.stage && height < 700 ? 'none' : 'flex',
          left: layout.stage && height < 700 ? layout.frame.x + 12 : width / 2 - 85,
          alignItems: "center",
          width: layout.stage && height < 700 ? 96 : 170,
          ...(layout.stage ? { padding: 6, borderRadius: 12, backgroundColor: '#101B13CC', borderWidth: 1, borderColor: '#E7D9A328' } : {}),
        }}
      >
        <Copy style={{ fontWeight: "800" }}>{definition.rival}</Copy>
        <View style={{ width: 140, marginTop: 3 }}>
          <Health presentation={presentation} side="opponent" max={definition.health} />
        </View>
      </View>
      {!layout.stage && <View pointerEvents="none" style={{position: "absolute", left: (width-layout.opponentSize)/2, top: layout.opponentY}}><Egg
          skin={definition.skin}
          face={state.outcome === "won" || state.outcome === "draw" ? "surprise" : undefined} streak={state.opponent.run.combo} pulse={state.opponent.run.piecesPlaced} feedKey={opponentFireKey}
          size={layout.opponentSize}
          hitSignal={opponentHitSignal}
          health={opponentHealth} hatchAt={opponentHatchAt} clock={clock}
          paused={suspended}
        /></View>}
      <OpponentField fighter={state.opponent} layout={rivalLayout} dy={rivalOffset.dy} clock={clock}
        reduced={reduced} paused={suspended || backgrounded} hidden={!!state.outcome} />
      {layout.stage ? <>
        <GroundedEgg placement={layout.stage.rival} skin={definition.skin}
          health={opponentHealth} hatchAt={opponentHatchAt} clock={clock}
          face={state.outcome === "won" || state.outcome === "draw" ? "surprise" : undefined} streak={state.opponent.run.combo} pulse={state.opponent.run.piecesPlaced} feedKey={opponentFireKey} hitSignal={opponentHitSignal} paused={suspended} />
        <GroundedEgg placement={layout.stage.player} skin={profile!.skin} streak={run.combo}
          health={playerHealth} hatchAt={playerHatchAt} clock={clock}
          pulse={run.piecesPlaced} feedKey={fireKey} hitSignal={playerHitSignal} dizzySignal={playerDizzySignal} wisp={!!profile!.wisp} paused={suspended} />
      </> : (      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: (width - layout.eggSize) / 2,
          top: layout.eggY,
        }}
      >
        <Egg
          skin={profile!.skin}
          streak={run.combo}
          pulse={run.piecesPlaced}
          feedKey={fireKey}
          hitSignal={playerHitSignal}
          health={playerHealth} hatchAt={playerHatchAt} clock={clock}
          dizzySignal={playerDizzySignal}

          wisp={!!profile!.wisp}
          size={layout.eggSize}
          paused={suspended}
        />
      </View>
)}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: layout.field.x,
            top: layout.field.y,
            opacity: state.outcome ? 0 : 1,
            width: layout.metrics.width,
            height: layout.metrics.height,
          },
          fieldStyle,
        ]}
      >
        {!resolved &&
          varietyBackLayers.map(({ id, Layer }) => (
            <Layer
              key={id}
              metrics={layout.metrics}
              beat={run.beat}
              clock={clock}
              beatStartedAt={state.beatStartedAt}
              reduceMotion={reduced || suspended}
            />
          ))}
        <SlotField
          grid={run.grid}
          metrics={layout.metrics}
          groups={run.beat.groups}
          generation={run.trayGeneration}
          hidden={resolved || !!state.outcome}
          hoverCells={hover}
          arrival={arrival}
          reduceMotion={reduced}
        />
        {!resolved &&
          varietyFieldLayers.map(({ id, Layer }) => (
            <Layer
              key={id}
              metrics={layout.metrics}
              beat={run.beat}
              clock={clock}
              beatStartedAt={state.beatStartedAt}
              reduceMotion={reduced || suspended}
            />
          ))}

      </Animated.View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          ...(layout.stage ? { top: layout.stage.player.visible.y - (height < 700 ? 45 : 64) }
            : { bottom: height - layout.trayY + 10 }),
          left: layout.frame.x + 18,
          width: layout.frame.width - 36,
        }}
      >
        <CombatCallout
          stage={!!layout.stage}
          compact={height < 700}
          label={callout || (layout.stage ? "" : (run.combo > 1 ? `${run.combo} Perfect streak` : "Find the shape. Feel the spark."))}
          streak={run.combo}
          perfect={resolved && run.lastBeatGrade === "perfect" && !state.outcome}
          sequence={run.eventSequence}
          reduced={reduced || suspended}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left: layout.frame.x,
          width: layout.frame.width,
          top: layout.trayY,
          height: layout.trayHeight,
        }}
      >
        {layout.stage && <TrayHint placements={run.piecesPlaced} aiming={!!hoverTarget} suspended={suspended || resolved} />}
        <Tray
          style={trayStyle}
          pieces={run.tray}
          metrics={layout.metrics}
          height={layout.trayHeight}
          trayGeneration={run.trayGeneration}
          dropFrame={layout.dropFrame}
          driftY={offset.dy}
          onPickUp={onPickUp}
          onCell={onCell}
          onDropAt={onDrop}
          disabled={suspended || !!state.outcome || resolved}
          reduceMotion={reduced}
        />
      </View>
      <View
        style={{
          position: "absolute",
          top: layout.playerHudY,
          left: layout.frame.x + 24,
          width: layout.frame.width - 48,
          gap: 4,

        }}
      >
        <Health presentation={presentation} side="player" max={definition.health} compact={!!layout.stage} />
      </View>
      {__DEV__ && guides && layout.stage && <StageGuides layout={layout} />}
      <CombatVolleys volleys={volleys} bursts={bursts} clock={clock} endedAt={state.outcome ? state.elapsed : undefined} reduced={reduced} onDone={retire} />
      {state.outcome && <DuelHatchRewards clock={clock} at={state.elapsed} won={state.outcome === 'won'} onDone={finishHatch} onArrive={receiveSpark}
        from={layout.stage ? {x: layout.stage.rival.visible.x + layout.stage.rival.visible.width/2, y: layout.stage.rival.visible.y + layout.stage.rival.visible.height/2} : {x: width/2, y: layout.opponentY + layout.opponentSize/2}}
        to={layout.stage ? {x: layout.stage.player.visible.x + layout.stage.player.visible.width/2, y: layout.stage.player.visible.y + layout.stage.player.visible.height/2} : {x: width/2, y: layout.eggY + layout.eggSize/2}} />}
      {practice && <PerformancePanel presentation={presentation} volleys={volleys} bursts={bursts} paused={suspended} />}
      {story && (
        <Dialogue
          id={`duel:${definition.id}`}
          title={definition.rival}
          lines={lines}
          onDone={async () => {
            await act(() => repository.seen(`duel:${definition.id}`));
            setStory(false);
          }}
        />
      )}
      {lesson && !story && (
        <Dialogue id={`mechanic:${lesson}`} title={MECHANIC_LESSONS[lesson].title}
          lines={MECHANIC_LESSONS[lesson].lines}
          onDone={async () => {
            await act(() => repository.seen(`mechanic:${lesson}`));
            setLesson(null);
          }} />
      )}
      <Modal
        visible={paused || !!error}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!error) setPaused(false);
        }}
      >
        <ScrollView
          style={{backgroundColor: '#092018ED'}}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 30,
            paddingTop: Math.max(30, insets.top + 12),
            paddingBottom: Math.max(30, insets.bottom + 12),
            gap: 16,
          }}
        >
          <Copy style={{ fontFamily: "EggDisplay", fontSize: 38 }}>
            {error ? "Keep your spark" : "Take a breath"}
          </Copy>
          {error ? (
            <>
              <Copy>{error}</Copy>
              <Button disabled={saving} onPress={() => void save()}>
                Save result again
              </Button>
            </>
          ) : (
            <>
              <Button onPress={() => setPaused(false)}>Resume duel</Button>
              {__DEV__ && layout.stage && <Button secondary onPress={() => setGuides(v => !v)}>Stage guides: {guides ? 'on' : 'off'}</Button>}
              <Button secondary onPress={() => void act(() => repository.preferences({ sound: muted }))}>
                Sound: {muted ? "off" : "on"}
              </Button>
              <Button secondary onPress={() => void act(() => repository.preferences({ haptics: !hapticsEnabled }))}>
                Haptics: {hapticsEnabled ? "on" : "off"}
              </Button>
              <Button secondary onPress={() => void act(() => repository.preferences({ highReadability: !profile?.preferences?.highReadability }))}>
                High readability: {profile?.preferences?.highReadability ? "on" : "off"}
              </Button>
              <Button
                secondary
                onPress={() => router.replace(practice ? "/arena" : "/")}
              >
                Leave duel
              </Button>
              <Copy style={styles.muted}>
                No coins are spent. You can try again any time.
              </Copy>
            </>
          )}
        </ScrollView>
      </Modal>
    </Scene>
  );
}

/** Idle guidance has its own one-shot timer; it never repaints the combat screen. */
function TrayHint({placements, aiming, suspended}: {placements: number; aiming: boolean; suspended: boolean}) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    if (aiming || suspended) return;
    const timer = setTimeout(() => setIdle(true), 6000);
    return () => clearTimeout(timer);
  }, [placements, aiming, suspended]);
  if (aiming || suspended || (placements >= 2 && !idle)) return null;
  return <View pointerEvents="none" style={{position: 'absolute', top: -22, left: 0, right: 0}}>
    <Copy style={{textAlign: 'center', fontSize: 10, color: '#FFF1CA', letterSpacing: 2, textShadowColor: '#182B20', textShadowRadius: 4}}>DRAG PIECES</Copy>
  </View>;
}

function Health({presentation, side, max, name, compact = false}: {
  presentation: CombatPresentation; side: 'player' | 'opponent'; max: number; name?: string; compact?: boolean;
}) {
  const hp = useSyncExternalStore(presentation.subscribe, side === 'player' ? presentation.playerHp : presentation.opponentHp);
  return <View accessible accessibilityLabel={`Health ${hp} of ${max}`} style={compact ? {flexDirection: 'row', alignItems: 'center', gap: 8} : undefined}>
    {!compact && <Copy style={{fontSize: 11, textAlign: 'center'}}>{name ? `${name} · ` : ''}{hp} / {max}</Copy>}
    {compact && <Ionicons name="heart" size={14} color="#EBAAAB" />}
    <View style={compact ? {flex: 1} : undefined}><Meter fraction={hp / max} color={side === 'opponent' ? '#EDC377' : '#B5E59B'} /></View>
    {compact && <Copy style={{fontSize: 11, fontVariant: ['tabular-nums'], textShadowColor: '#10251E', textShadowRadius: 3}}>{hp} / {max}</Copy>}
  </View>;
}
