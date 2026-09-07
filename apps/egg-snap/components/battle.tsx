import { TileMatchTheme } from "@incubator/tile-match/theme";

import { TILE_COLORS } from "../data/tile-theme";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { router, useLocalSearchParams } from "expo-router";

import { Modal, Pressable, View, useWindowDimensions } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, {

  useAnimatedStyle,

  useReducedMotion,

  type SharedValue,

} from "react-native-reanimated";

import {

  Tray,

  SlotField,

  useVarietyOffset,

  varietyFieldLayers,

  varietyBackLayers,

  type DropOutcome,

} from "@incubator/tile-match/native";

import { NO_CELL, type DropRelease } from "@incubator/tile-match/engine";

import { buildSlotBurst } from "@incubator/tile-match/timing";

import {

  Bullets,

  buildVolley,

  ClearBurstSkia,

  SlotBlastSkia,

  SlotMissSkia,

  type BulletVolley,

  type MissCell,

} from "@incubator/tile-match/effects";

import { cellOrigin } from "@incubator/tile-match/geometry";

import { MECHANIC_LESSONS } from "../data/progression";
import { impulseStrength } from "@incubator/tile-match/feedback";
import { CombatCallout } from "./combat-callout";

import { DUELS, getDuel, MOVES } from "../data/campaign";

import { currentMove, resultFor } from "../game/combat";

import { battleLayout } from "../game/layout";

import { dropPreview, shouldCancelDrop } from "../game/drop-target";

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

  backgroundColor: "rgba(23, 52, 43, 0.94)",

  borderColor: "#D7E9BA40",

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

function AttackClock({

  clock,

  deadline,

  duration,

}: {

  clock: SharedValue<number>;

  deadline: number;

  duration: number;

}) {

  const bar = useAnimatedStyle(() => ({

    width:

      `${Math.max(0, Math.min(1, (deadline - clock.value) / duration)) * 100}%` as `${number}%`,

  }));

  return (

    <View

      style={{

        height: 4,

        backgroundColor: "#FFFFFF20",

        overflow: "hidden",

        borderRadius: 4,

      }}

    >

      <Animated.View style={[{ height: 4, backgroundColor: "#F5BF7C" }, bar]} />

    </View>

  );

}

export default function BattleRoute() {

  const params = useLocalSearchParams<{

    level?: string;

    mechanic?: string;

    strength?: string;

    seed?: string;

    attack?: string;

  }>();

  const { profile } = useProfile();

  const practice = __DEV__ && !!params.mechanic;

  const definition = useMemo(() => {

    const base = DUELS.find((d) => d.id === params.level) ?? getDuel("glade-1");

    if (!practice) return base;

    const mechanic = MOVES[params.mechanic!] ? params.mechanic! : "tap";

    const strength = Math.max(0, Math.min(1, Number(params.strength) || 0.25));

    const move = {

      ...MOVES[mechanic],

      damage: params.attack === "gentle" ? 5 : 20,

      varieties: MOVES[mechanic].varieties.map((v) => ({ ...v, strength })),

    };

    return {

      ...base,

      id: "practice",

      name: "Mechanics arena",

      health: 400,

      progression: {

        kind: "stream" as const,

        loop: true,

        turns: [

          {

            slots: mechanic === "fuse" || mechanic === "hues" ? 1 : 2,

            varieties: [],

          },

        ],

      },

      moves: [move],

    };

  }, [params.level, params.mechanic, params.strength, params.attack, practice]);

  if (!profile) return null;

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

    <TileMatchTheme colors={TILE_COLORS}>

      <Battle

        key={`${definition.id}:${params.mechanic}:${params.seed}`}

        definition={definition}

        seed={params.seed ?? `${definition.id}:${Date.now()}`}

        practice={practice}

      />

    </TileMatchTheme>

  );

}

function Battle({

  definition,

  seed,

  practice,

}: {

  definition: ReturnType<typeof getDuel>;

  seed: string;

  practice: boolean;

}) {

  const { profile, act } = useProfile();

  const [paused, setPaused] = useState(false);

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

  const game = useCombat(definition, seed, suspended, practice);

  const { state, ref, clock, drop, backgrounded } = game;

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

    () => battleLayout(width, height, insets.top, insets.bottom),

    [width, height, insets.top, insets.bottom],

  );

  const offset = useVarietyOffset(run.beat, {

    driftAmplitude: layout.driftAmplitude,

    reduceMotion: reduced,

    paused: suspended,

  });

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

  const [miss, setMiss] = useState<{ id: number; cells: MissCell[] } | null>(

    null,

  );

  const [volleys, setVolleys] = useState<BulletVolley[]>([]);

  const [hurt, setHurt] = useState(false);
  const [impulse, setImpulse] = useState<{ id: number; strength: number }>();
  const feedback = useFeedback(muted, hapticsEnabled, suspended || backgrounded);

  const feedbackRef = useRef(feedback);

  feedbackRef.current = feedback;

  const viewRef = useRef({ layout, offset });

  viewRef.current = { layout, offset };

  const seenEvent = useRef(0);

  const completion = useRef(false);

  useEffect(() => {

    if (backgrounded) {

      setPaused(true);

      game.acknowledgeBackground();

    }

  }, [backgrounded, game]);

  const retire = useCallback(

    (id: number) => setVolleys((all) => all.filter((v) => v.id !== id)),

    [],

  );

  useEffect(() => {

    const events = state.events.filter((e) => e.id > seenEvent.current);

    seenEvent.current = state.eventSequence;

    for (const event of events) {

      if (event.type === "volley" && event.run?.lastResolution) {

        const cells = buildSlotBurst(

          event.run.grid,

          layout.metrics,

          event.run.lastResolution.clearedCells,

          event.run.lastGroupSizes,

        );

        const volley = buildVolley({

          id: event.id,

          cells,

          boardOrigin: {

            x: layout.field.x,

            y: layout.field.y + offset.dy.value,

          },

          cellSize: layout.metrics.cell,

          target: {

            x: width / 2,

            y: layout.opponentY + layout.opponentSize * 0.52,

          },

        });

        if (!reduced) setVolleys((v) => [...v.slice(-4), volley]);
        if (event.run.combo > 0 || event.run.lastGroupCount >= 2)
          setImpulse({ id: event.id, strength: impulseStrength(event.run.lastGroupCount, event.run.combo,
            event.run.beat.varieties.some(v => v.id === 'drift')) });
        feedbackRef.current.volley(cells.map(c => c.delayMs), event.run.lastGroupCount,

          event.run.lastBeatGrade === "perfect" ? event.run.combo : 0, event.run.lastBeatPace === "late");

      }

      if (event.type === "hit") {

        setHurt(true);

        feedbackRef.current.cue("hit");

      }

      if (event.type === "blast") feedbackRef.current.cue("blast");

      if (event.type === "interrupt") feedbackRef.current.cue("interrupt");

      if (event.type === "end") feedbackRef.current.end(state.outcome === "won");

      if (event.type === "chip") feedbackRef.current.cue("chip");

    }

  }, [state.eventSequence, state.events, state.outcome, layout, offset.dy, reduced, width]);

  useEffect(() => {

    if (!hurt) return;

    const timer = setTimeout(() => setHurt(false), 420);

    return () => clearTimeout(timer);

  }, [hurt]);

  useEffect(() => {

    if (!miss) return;

    const timer = setTimeout(() => setMiss(null), 750);

    return () => clearTimeout(timer);

  }, [miss]);

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

    if (!state.outcome) return;

    const timer = setTimeout(() => void save(), reduced ? 300 : 1100);

    return () => clearTimeout(timer);

  }, [state.outcome, save, reduced]);

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

        setMiss({ id: Date.now(), cells });

      }

      if (!next.run.beat.voided) feedbackRef.current.cue(placement?.filled.length ? "place" : "miss");

      return "consumed";

    },

    [drop, ref],

  );

  const resolved = run.beat.status === "resolved";

  const move = currentMove(state);

  const burst = useMemo(

    () =>

      run.lastResolution

        ? buildSlotBurst(

            run.grid,

            layout.metrics,

            run.lastResolution.clearedCells,

            run.lastGroupSizes,

          )

        : [],

    [run.lastResolution, run.grid, run.lastGroupSizes, layout.metrics],

  );

  const blasted = useMemo(

    () =>

      run.beat.voided

        ? run.beat.groups.flatMap((g) =>

            g.cells.map((index) => ({

              ...cellOrigin(

                layout.metrics,

                Math.floor(index / run.grid.cols),

                index % run.grid.cols,

              ),

              colorId: g.colorId,

            })),

          )

        : [],

    [run.beat, run.grid.cols, layout.metrics],

  );

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

        ? "Trap triggered!"

        : run.lastBeatGrade === "perfect"

          ? run.lastBeatPace === "late"

            ? "Perfect · take your time"

            : "Perfect!"

          : "Keep your spark"

      : last?.absorbed

        ? "Shield chipped · try again"

        : last?.refused === "colour"

          ? "Match the colour, too"

          : state.events.at(-1)?.type === "interrupt"

            ? "Interrupted!"

            : "";

  return (

    <Scene

      environment={

        definition.regionId === "cheerlet" ? "cheerlet" : "mossprout"

      }

      onReady={setReady}

      impact={hurt && !suspended}
      impulse={suspended ? undefined : impulse}
    >

      <View

        style={{

          position: "absolute",

          top: insets.top + 10,

          left: 20,

          right: 20,

          flexDirection: "row",

          justifyContent: "space-between",

          alignItems: "center",

        }}

      >

        <Pressable

          accessibilityRole="button"

          accessibilityLabel="Pause duel"

          onPress={() => setPaused(true)}

          style={{ padding: 12 }}

        >

          <Copy>Ⅱ</Copy>

        </Pressable>

        <Copy style={{ fontSize: 12 }}>{definition.name}</Copy>

        <Pressable

          accessibilityRole="button"

          accessibilityLabel={muted ? "Enable sound" : "Mute sound"}

          onPress={() => void act(() => repository.preferences({ sound: muted }))}

          style={{ padding: 12 }}

        >

          <Copy>{muted ? "♪ off" : "♪"}</Copy>

        </Pressable>

      </View>

      <View

        style={{

          position: "absolute",

          top: layout.opponentY - 12,

          alignSelf: "center",

          alignItems: "center",

          width: 170,

        }}

      >

        <Copy style={{ fontWeight: "800" }}>{definition.rival}</Copy>

        <View style={{ width: 140, marginTop: 5 }}>

          <Meter

            fraction={state.opponentHp / definition.health}

            color="#EDC377"

          />

        </View>

        <Egg

          skin={definition.skin}

          face={state.outcome === "won" ? "surprise" : "determined"}

          size={layout.opponentSize}

          pulse={state.resolvedSequence}

          paused={suspended}

        />

        <Copy style={{ fontSize: 11 }}>

          {state.opponentHp} / {definition.health}

        </Copy>

      </View>

      <View

        style={{

          position: "absolute",

          top: layout.opponentY + layout.opponentSize + 37,

          left: 55,

          right: 55,

          gap: 5,

        }}

      >

        <Copy style={{ textAlign: "center", color: "#FFE0A0", fontSize: 12 }}>

          {state.phase === "warning" && !state.outcome

            ? `${move.name} · ${Math.max(0, move.perfects - state.perfects)} Perfect${move.perfects - state.perfects === 1 ? "" : "s"} to interrupt`

            : "A moment to shine"}

        </Copy>

        {state.phase === "warning" && !state.outcome && (

          <AttackClock

            clock={clock}

            deadline={state.attackAt}

            duration={move.warningMs}

          />

        )}

      </View>

      <View

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

          hurt={hurt}

          wisp={!!profile!.wisp}

          size={layout.eggSize}

          paused={suspended}

        />

      </View>

      <Animated.View

        pointerEvents="none"

        style={[

          {

            position: "absolute",

            left: layout.field.x,

            top: layout.field.y,

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

          hidden={resolved}

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

        {resolved && run.beat.voided ? (

          <SlotBlastSkia

            key={`blast-${run.eventSequence}`}

            cells={blasted}

            width={layout.metrics.width}

            height={layout.metrics.height}

            cell={layout.metrics.cell}

            reduceMotion={reduced}

          />

        ) : (

          resolved && (

            <ClearBurstSkia

              key={`burst-${run.eventSequence}`}

              cells={burst}

              width={layout.metrics.width}

              height={layout.metrics.height}

              cell={layout.metrics.cell}

              pitch={layout.metrics.pitch}

              reduceMotion={reduced}

            />

          )

        )}

      </Animated.View>

      <View

        pointerEvents="none"

        style={{

          position: "absolute",

          bottom: height - layout.trayY + 8,

          left: 15,

          right: 15,

        }}

      >

        <CombatCallout

          label={callout || (run.combo > 1 ? `${run.combo} Perfect streak` : "Find the shape. Feel the spark.")}

          streak={run.combo}

          perfect={resolved && run.lastBeatGrade === "perfect" && !state.outcome}

          sequence={run.eventSequence}

          reduced={reduced || suspended}

        />

      </View>

      <View

        style={{

          position: "absolute",

          left: 0,

          right: 0,

          top: layout.trayY,

          height: layout.trayHeight,

        }}

      >

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

          bottom: insets.bottom + 10,

          left: 34,

          right: 34,

          gap: 4,

        }}

      >

        <View style={styles.row}>

          <Copy style={{ fontSize: 10 }}>YOUR SPARK</Copy>

          <Copy style={{ fontSize: 10 }}>

            {state.playerHp} / {definition.playerHealth}

          </Copy>

        </View>

        <Meter fraction={state.playerHp / definition.playerHealth} />

      </View>

      {miss && (

        <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>

          <SlotMissSkia

            key={miss.id}

            cells={miss.cells}

            width={width}

            height={height}

            cell={layout.metrics.cell}

            reduceMotion={reduced}

          />

        </View>

      )}

      {volleys.map((v) => (

        <Bullets key={v.id} volley={v} onDone={retire} />

      ))}

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

        <View

          style={{

            flex: 1,

            justifyContent: "center",

            backgroundColor: "#092018DD",

            padding: 30,

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

              <Button secondary onPress={() => void act(() => repository.preferences({ sound: muted }))}>

                Sound: {muted ? "off" : "on"}

              </Button>

              <Button secondary onPress={() => void act(() => repository.preferences({ haptics: !hapticsEnabled }))}>

                Haptics: {hapticsEnabled ? "on" : "off"}

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

        </View>

      </Modal>

    </Scene>

  );

}
