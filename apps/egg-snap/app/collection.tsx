import { useState } from "react";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLLECTION } from "../data/campaign";
import { WISP } from "../data/art";
import { useProfile } from "../state/provider";
import { repository } from "../state/repository";
import { Scene } from "../components/scene";
import { Egg } from "../components/egg";
import { Button, Coins, Copy, Heading, styles } from "../components/ui";
export default function Collection() {
  const { profile, act, error } = useProfile();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const action = async (id: string, kind: "skin" | "wisp", owned: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await act(() =>
        owned
          ? repository.equip(
              kind,
              kind === "wisp" && profile.wisp === id ? null : id,
            )
          : repository.purchase(id),
      );
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <Scene>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 25,
          gap: 20,
        }}
      >
        <View style={styles.row}>
          <Button secondary onPress={() => router.back()}>
            ‹ World
          </Button>
          <Coins value={profile.coins} />
        </View>
        <Heading>Your little spark</Heading>
        <Copy>Shells and small friends, collected along the way.</Copy>
        <View style={{ alignItems: "center" }}>
          <Egg
            skin={profile.skin}
            streak={6}
            wisp={!!profile.wisp}
            size={220}
          />
        </View>
        {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
        <Button
          secondary
          disabled={profile.skin === "classic"}
          onPress={() => void action("classic", "skin", true)}
        >
          {profile.skin === "classic"
            ? "Classic shell equipped"
            : "Equip classic shell"}
        </Button>
        {COLLECTION.map((item) => {
          const owned = (
            item.kind === "skin" ? profile.skins : profile.wisps
          ).includes(item.id);
          const discovered = profile.completed.includes(item.discovery);
          const equipped =
            item.kind === "skin"
              ? profile.skin === item.id
              : profile.wisp === item.id;
          return (
            <View
              key={item.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: "#FFFFFF25",
                paddingTop: 18,
                gap: 12,
              }}
            >
              <View style={styles.row}>
                {item.kind === "skin" ? (
                  <Egg skin={item.id} size={90} face="grin" />
                ) : (
                  <Image source={WISP} style={{ width: 90, height: 90 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Heading small>{item.name}</Heading>
                  <Copy style={styles.muted}>{item.description}</Copy>
                </View>
              </View>
              <Button
                secondary={owned}
                disabled={
                  busy ||
                  !discovered ||
                  (equipped && item.kind === "skin") ||
                  (!owned && profile.coins < item.price)
                }
                onPress={() => void action(item.id, item.kind, owned)}
              >
                {!discovered
                  ? "Discover in the campaign"
                  : equipped
                    ? item.kind === "wisp"
                      ? "Unequip wisp"
                      : "Equipped"
                    : owned
                      ? "Equip"
                      : `${item.price} coins`}
              </Button>
            </View>
          );
        })}
      </ScrollView>
    </Scene>
  );
}
