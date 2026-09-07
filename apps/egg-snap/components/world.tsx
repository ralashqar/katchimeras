import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { createHexProjection } from "@incubator/environments/hex";
import { createHexTileRenderer } from "@incubator/environments/hex-tile";
import { createSeamlessWorldImage } from "@incubator/environments/seamless-image";
import { REGIONS, getDuel } from "../data/campaign";
import { HEX_ART } from "../data/art";
import { useProfile } from "../state/provider";
import { repository } from "../state/repository";
import { canPlay } from "../state/profile";
import { Scene } from "./scene";
import { Button, Coins, Copy, Heading, styles } from "./ui";
import { Dialogue } from "./dialogue";

const projection = createHexProjection(
  {
    width: 180,
    projectionTilt: 0.78,
    lipWidthRatio: 0.15,
    layoutProfiles: { campaign: { horizontalSpacing: 1, verticalSpacing: 1 } },
  },
  "campaign",
);
const SeamlessWorldImage = createSeamlessWorldImage({ imageCrossfadeMs: 300 });
const { KingdomTileArt } = createHexTileRenderer<
  {
    frame: { left: number; top: number; width: number; height: number };
    source: number;
  },
  "map"
>({
  SeamlessWorldImage,
  sourceForLod: (layer) => layer.source,
  overlayForLod: () => null,
});
export default function World() {
  const { profile, error, refresh, act } = useProfile();
  const [selected, setSelected] = useState("glade");
  const [story, setStory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (profile?.pendingResult) router.replace("/results");
  }, [profile?.pendingResult]);
  useEffect(() => {
    if (profile && !profile.seen.includes("region:glade")) setStory("glade");
  }, [profile]);
  if (!profile)
    return (
      <Scene>
        <View style={{ flex: 1, justifyContent: "center", padding: 30 }}>
          <Heading>Egg Snap</Heading>
          <Copy>{error ?? "Waking the glade…"}</Copy>
          {error && (
            <Button onPress={() => void refresh().catch(() => {})}>
              Try again
            </Button>
          )}
        </View>
      </Scene>
    );
  const region = REGIONS.find((r) => r.id === selected)!;
  const unlocked = profile.regions.includes(region.id);
  const available =
    !region.prerequisite || profile.completed.includes(region.prerequisite);
  const mapWidth = Math.min(width, 560);
  const tileWidth = Math.min(180, mapWidth * 0.44);
  const scale = tileWidth / 180;
  const purchaseRegion = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await act(() => repository.purchase(region.id));
      setStory(region.id);
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const storyRegion = REGIONS.find((r) => r.id === story);
  return (
    <Scene environment={unlocked ? region.environment : "mossprout"}>
      <View
        style={{ paddingTop: insets.top + 16, paddingHorizontal: 24, gap: 8 }}
      >
        <View style={styles.row}>
          <Copy style={{ letterSpacing: 3, fontSize: 11, color: "#E7D99E" }}>
            A WORLD WAITING TO WAKE
          </Copy>
          <Coins value={profile.coins} />
        </View>
        <Heading>Egg Snap</Heading>
        <Copy style={{ color: "#E3EAD8" }}>
          Find your spark. Follow the mist.
        </Copy>
      </View>
      <View
        style={{
          flex: 1,
          minHeight: 190,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: mapWidth, height: 205 }}>
          {REGIONS.map((r) => {
            const point = projection.hexToWorld(r);
            const known = profile.regions.includes(r.id);
            const eligible =
              !r.prerequisite || profile.completed.includes(r.prerequisite);
            const x = mapWidth / 2 - tileWidth + point.x * scale;
            const y = 5 + point.y * scale;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${known ? "open" : eligible ? `${r.price} coins to discover` : "locked"}`}
                onPress={() => setSelected(r.id)}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: tileWidth,
                  height: tileWidth,
                  opacity: known ? 1 : 0.6,
                }}
              >
                <Animated.View
                  entering={FadeIn.duration(reduced ? 0 : 500)}
                  style={{ flex: 1 }}
                >
                  <KingdomTileArt
                    priority="high"
                    source={HEX_ART[r.id as keyof typeof HEX_ART]}
                    fallbackSource={null}
                    overlaySource={null}
                    frame={{
                      left: 0,
                      top: 0,
                      width: tileWidth,
                      height: tileWidth,
                    }}
                    focusAnchorX={tileWidth / 2}
                    focusAnchorY={tileWidth / 2}
                    focusScale={r.id === selected ? 1.08 : 1}
                  />
                  {!known && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        inset: 20,
                        borderRadius: 90,
                        backgroundColor: "rgba(215,236,214,0.48)",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Copy style={{ color: "#193B2B", fontSize: 25 }}>
                        {eligible ? "✦" : "⌁"}
                      </Copy>
                    </View>
                  )}
                  <Copy
                    style={{
                      position: "absolute",
                      top: tileWidth * 0.76,
                      alignSelf: "center",
                      fontSize: 11,
                      fontWeight: "800",
                      backgroundColor: "rgba(18,43,32,0.88)",
                      paddingHorizontal: 10,
                      borderRadius: 12,
                    }}
                  >
                    {known
                      ? `${r.levels.filter((id) => profile.completed.includes(id)).length}/${r.levels.length}`
                      : eligible
                        ? `${r.price} coins`
                        : "Beyond the mist"}
                  </Copy>
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View
        style={[
          styles.panel,
          {
            maxHeight: height * 0.49,
            paddingBottom: Math.max(18, insets.bottom),
          },
        ]}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Heading small>{region.name}</Heading>
            <Copy style={styles.muted}>{region.subtitle}</Copy>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open collection"
            onPress={() => router.push("/collection")}
            style={{ padding: 10 }}
          >
            <Copy style={{ color: "#F4D98C" }}>Collection ›</Copy>
          </Pressable>
        </View>
        {error && (
          <Copy accessibilityRole="alert" style={{ color: "#FFD0AF" }}>
            {error}
          </Copy>
        )}
        {unlocked ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {region.levels.map((id, index) => {
              const d = getDuel(id);
              const playable = canPlay(profile, id);
              const won = profile.completed.includes(id);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.name}${won ? ", replay" : ""}`}
                  disabled={!playable}
                  onPress={() =>
                    router.push({ pathname: "/duel", params: { level: id } })
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 11,
                    gap: 13,
                    opacity: playable ? 1 : 0.4,
                    borderBottomColor: "#FFFFFF13",
                    borderBottomWidth: 1,
                  }}
                >
                  <View
                    style={{
                      width: 35,
                      height: 35,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: won ? "#6F9764" : "#FFFFFF12",
                    }}
                  >
                    <Copy>{won ? "✓" : index + 1}</Copy>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Copy style={{ fontWeight: "700" }}>{d.name}</Copy>
                    <Copy style={styles.muted}>
                      {d.boss ? "REGION KEEPER" : d.rival}
                    </Copy>
                  </View>
                  <Copy style={{ color: "#E9CB7C" }}>
                    {playable ? (won ? "Replay ›" : "Play ›") : "—"}
                  </Copy>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <>
            <Copy>
              {available
                ? "A new rival, a new puzzle, a new piece of the world."
                : "Defeat Elder Moss to open the path to the Playfields."}
            </Copy>
            <Button
              disabled={!available || busy || profile.coins < region.price}
              onPress={() => void purchaseRegion()}
            >
              {available
                ? `Discover · ${region.price} coins`
                : "Defeat the keeper"}
            </Button>
          </>
        )}
        {__DEV__ && (
          <Pressable
            onPress={() => router.push("/arena")}
            accessibilityRole="button"
          >
            <Copy style={[styles.muted, { textAlign: "center" }]}>
              Mechanics arena
            </Copy>
          </Pressable>
        )}
      </View>
      {storyRegion && (
        <Dialogue
          id={`region:${storyRegion.id}`}
          title={storyRegion.name}
          lines={storyRegion.story}
          onDone={async () => {
            await act(() => repository.seen(`region:${storyRegion.id}`));
            setStory(null);
          }}
        />
      )}
    </Scene>
  );
}
