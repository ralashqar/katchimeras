import { ARENA_ENABLED } from "../game/dev-tools";
import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOVES, DEFAULT_ARENA_AI } from "../data/campaign";
import { Button, Copy, Heading, styles } from "../components/ui";
import { Scene } from "../components/scene";
export default function Arena() {
  const [mechanic, setMechanic] = useState("tap");
  const [strength, setStrength] = useState("0.25");
  const [seed, setSeed] = useState("egg-snap-lab");
  const [speed, setSpeed] = useState(String(DEFAULT_ARENA_AI.actionMs));
  const [accuracy, setAccuracy] = useState(String(DEFAULT_ARENA_AI.accuracy));
  const insets = useSafeAreaInsets();
  if (!ARENA_ENABLED)
    return (
      <Scene>
        <Button onPress={() => router.replace("/")}>Return to world</Button>
      </Scene>
    );
  return (
    <Scene>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 20,
          gap: 16,
          paddingBottom: 35,
        }}
      >
        <Button secondary onPress={() => router.replace("/")}>
          ‹ World
        </Button>
        <Heading>Mechanics arena</Heading>
        <Button secondary onPress={() => router.push({pathname: '/duel', params: {
          mechanic: 'tap', strength: '1', seed: 'egg-perf-v1', speed: '600', accuracy: '.92', stress: '1',
        }})}>Performance stress duel</Button>
        <Copy>Practice has no campaign rewards.</Copy>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.values(MOVES).map((m) => (
            <Button
              key={m.id}
              secondary={m.id !== mechanic}
              onPress={() => setMechanic(m.id)}
            >
              {m.name}
            </Button>
          ))}
        </View>
        <Copy>
          Strength · higher values enable cycling bombs and tougher shields
        </Copy>
        <View style={styles.row}>
          {["0.25", "0.6", "1"].map((v) => (
            <Button
              key={v}
              secondary={v !== strength}
              onPress={() => setStrength(v)}
            >
              {v}
            </Button>
          ))}
        </View>
        <Copy>Seed</Copy>
        <TextInput
          accessibilityLabel="Seed"
          value={seed}
          onChangeText={setSeed}
          style={{
            padding: 14,
            backgroundColor: "#FFFFFF20",
            color: "#FFF8E7",
            borderRadius: 12,
          }}
        />
        <Copy>Opponent action time</Copy>
        <View style={styles.row}>
          {['1000', String(DEFAULT_ARENA_AI.actionMs), '2400'].map(v => <Button key={v} secondary={v !== speed} onPress={() => setSpeed(v)}>{Number(v)/1000}s</Button>)}
        </View>
        <Copy>Opponent accuracy</Copy>
        <View style={styles.row}>
          {['0.5', String(DEFAULT_ARENA_AI.accuracy), '1'].map(v => <Button key={v} secondary={v !== accuracy} onPress={() => setAccuracy(v)}>{Number(v)*100}%</Button>)}
        </View>
        <Button
          onPress={() =>
            router.push({
              pathname: "/duel",
              params: { mechanic, strength, seed, speed, accuracy },
            })
          }
        >
          Play test duel
        </Button>
      </ScrollView>
    </Scene>
  );
}
