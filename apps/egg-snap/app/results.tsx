import { useState, useEffect } from "react";
import { router } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RewardTokenFlight } from "@incubator/game-ui/reward-token-flight";
import { useProfile } from "../state/provider";
import { repository } from "../state/repository";
import { DUELS, getDuel } from "../data/campaign";
import { Scene } from "../components/scene";
import { Egg } from "../components/egg";
import { Button, Coins, Copy, Heading } from "../components/ui";
import { useFeedback } from "../game/feedback";
export default function Results() {
  const { profile, act, error } = useProfile();
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const r = profile?.pendingResult;
  const feedback = useFeedback(profile?.preferences?.sound === false, false);
  const attemptId = r?.attemptId;
  const won = r?.won;
  const draw = r?.outcome === "draw";
  useEffect(() => {
    if (attemptId && !draw) feedback.result(!!won);
  }, [attemptId, won, draw, feedback]);
  if (!r)
    return (
      <Scene>
        <View style={{ flex: 1, justifyContent: "center", padding: 30 }}>
          <Button onPress={() => router.dismissTo("/")}>Return to world</Button>
        </View>
      </Scene>
    );
  const adventure = profile?.adventure;
  const guided = !!adventure && !adventure.legacy && !r.practice;
  const duel = r.practice ? null : getDuel(r.levelId);
  const index = DUELS.findIndex((d) => d.id === r.levelId);
  const next = DUELS[index + 1];
  const go = async (destination: "world" | "retry" | "next") => {
    if (busy) return;
    setBusy(true);
    try {
      await act(repository.dismissResult);
      if (destination === "retry")
        router.replace(
          r.practice
            ? "/arena"
            : { pathname: "/duel", params: { level: r.levelId } },
        );
      else if (destination === "next" && next)
        router.replace({ pathname: "/duel", params: { level: next.id } });
      else router.dismissTo(r.practice ? "/arena" : "/");
    } catch {
      setBusy(false);
    }
  };
  return (
    <Scene
      environment={duel?.regionId === "cheerlet" ? "cheerlet" : "mossprout"}
    >
      <View
        style={{
          flex: 1,
          padding: 26,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ alignSelf: "flex-end" }}>
          <Coins value={profile!.coins} />
        </View>
        <View style={{ alignItems: "center", gap: 10 }}>
          <Copy style={{ letterSpacing: 3, color: "#EEDAA7" }}>
            {r.practice
              ? "PRACTICE COMPLETE"
              : r.won
                ? guided && duel?.boss && r.firstWin !== false
                  ? "CHAPTER ONE · CRACKED"
                  : "A LITTLE MORE LIGHT"
                : "EVERY SPARK STARTS SOMEWHERE"}
          </Copy>
          {!!r.won && !!duel?.victoryDialogue && <Copy>{duel.victoryDialogue}</Copy>}
          <Heading>
            {draw ? "Two bright sparks." : r.won ? "CRACKED!" : "Rest. Then rise."}
          </Heading>
          <Egg
            skin={profile!.skin} characterId={adventure?.activeEgg === 'pip' ? undefined : adventure?.activeEgg}
            size={Math.min(230, height * 0.29)}
            streak={r.won ? 10 : 0}
            face={r.won ? "grin" : "sleepy"}
            hat={adventure?.appearances[adventure.activeEgg]?.hat}
            held={adventure?.appearances[adventure.activeEgg]?.held}
            wisp={!!profile!.wisp}
          />
          <Copy
            style={{ fontFamily: "EggDisplay", fontSize: 36, color: "#F4D688" }}
          >
            {draw ? "A draw · free retry" : r.won ? `+${r.coins} coins` : "A fresh try is waiting"}
          </Copy>
          <Copy>
            {Math.round(r.accuracy * 100)}% perfect beats · Best streak{" "}
            {r.bestStreak}
          </Copy>
          {r.won && guided && r.firstWin !== false && r.levelId === 'glade-1' && <Copy>Golden Shell Fragment! Pip: “Uh… I don’t think that belonged to him.”</Copy>}
          {r.won && guided && r.firstWin !== false && r.levelId === 'glade-4' && <Copy>New egg discovered: Pollen! “About time. That banner was clashing with my shell.”</Copy>}
          {r.won && guided && r.firstWin !== false && duel?.boss && <Copy>Second Golden Shell Fragment · Golden crown · Nest upgrade gift. Captain: “This hat is clearly defective.”</Copy>}
          {r.won && !guided && duel?.boss && (
            <Copy>The Keeper shell is yours. A new region awaits.</Copy>
          )}
          {r.won && !guided && r.levelId === "glade-2" && (
            <Copy>Moss shell discovered in your collection.</Copy>
          )}
          {r.won && !guided && r.levelId === "glade-3" && (
            <Copy>A Glade wisp is waiting in your collection.</Copy>
          )}
        </View>
        <View style={{ alignSelf: "stretch", gap: 12 }}>
          {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
          {r.won && !guided && next?.regionId === duel?.regionId && !r.practice && (
            <Button disabled={busy} onPress={() => void go("next")}>
              Next duel
            </Button>
          )}
          {!r.won && (
            <Button disabled={busy} onPress={() => void go("retry")}>
              Try again
            </Button>
          )}
          <Button
            secondary={!r.won || (!!r.won && next?.regionId === duel?.regionId && !r.practice)}
            disabled={busy}
            onPress={() => void go("world")}
          >
            {r.practice
              ? "Back to arena"
              : r.won && duel?.boss
                ? "Discover the path ahead"
                : guided && r.levelId === "glade-1" ? "Home to the nest" : "Back to world"}
          </Button>
        </View>
      </View>
      {r.coins > 0 &&
        !arrived &&
        Array.from({ length: 5 }, (_, i) => (
          <RewardTokenFlight
            key={`${r.attemptId}-${i}`}
            count={5}
            index={i}
            from={{ x: width / 2, y: height * 0.62 }}
            to={{ x: width - 65, y: insets.top + 40 }}
            tokenSize={20}
            onArrive={() => {
              if (i === 4) setArrived(true);
            }}
          >
            <Copy style={{ color: "#F9D164", fontSize: 24 }}>●</Copy>
          </RewardTokenFlight>
        ))}
    </Scene>
  );
}
