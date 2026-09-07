import { LayeredAvatar } from "@incubator/avatar/layered-avatar";
import { EggEnergy } from "@incubator/avatar/energy";
import { useEggExpressionPlayer } from "@incubator/avatar/expressions";
import { Image } from "expo-image";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { BODIES, FACES, WISP } from "../data/art";

export function Egg({
  skin = "classic",
  streak = 0,
  size = 160,
  face,
  pulse = 0,
  hurt = false,
  wisp = false,
  paused = false,
}: {
  skin?: string;
  streak?: number;
  size?: number;
  face?: string;
  pulse?: number;
  hurt?: boolean;
  wisp?: boolean;
  paused?: boolean;
}) {
  const body = BODIES[skin] ?? BODIES.classic;
  const baseFaceId = hurt
    ? "surprise"
    : (face ??
      (streak >= 10
        ? "heroic"
        : streak >= 3
          ? "determined"
          : streak >= 1
            ? "curious"
            : "sleepy"));
  const expression = useEggExpressionPlayer({ baseFaceId });
  const reduceMotion = useReducedMotion();
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={`${body.name} egg`}
    >
      <EggEnergy
        energy={Math.min(1, streak / 10)}
        pulseKey={pulse}
        hurt={hurt}
        reduceMotion={reduceMotion}
        paused={paused}
      >
        <LayeredAvatar
          bodySource={body.source}
          faceSource={(FACES[expression.faceId] ?? FACES.sleepy).source}
          bodyPresentation={body.presentation}
          hatPresentation={{ scale: 1, offsetX: 0, offsetY: 0 }}
          faceTransitionDuration={expression.transitionMs}
        />
      </EggEnergy>
      {wisp && (
        <Image
          source={WISP}
          contentFit="contain"
          style={{
            position: "absolute",
            right: -size * 0.08,
            top: size * 0.15,
            width: size * 0.3,
            height: size * 0.3,
          }}
        />
      )}
    </View>
  );
}
