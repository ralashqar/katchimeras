import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOVES } from "../data/campaign";
import { Button, Copy, Heading, styles } from "../components/ui";
import { Scene } from "../components/scene";
export default function Arena() {
  const [mechanic, setMechanic] = useState("tap");
  const [strength, setStrength] = useState("0.25");
  const [seed, setSeed] = useState("egg-snap-lab");
  const [attack, setAttack] = useState("normal");
  const insets = useSafeAreaInsets();
  if (!__DEV__)
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
        <View style={styles.row}>
          {["gentle", "normal"].map((v) => (
            <Button
              key={v}
              secondary={v !== attack}
              onPress={() => setAttack(v)}
            >
              {v} attacks
            </Button>
          ))}
        </View>
        <Button
          onPress={() =>
            router.push({
              pathname: "/duel",
              params: { mechanic, strength, seed, attack },
            })
          }
        >
          Play test duel
        </Button>
      </ScrollView>
    </Scene>
  );
}
