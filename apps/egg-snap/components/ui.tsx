import {
  Text,
  Pressable,
  StyleSheet,
  View,
  type TextProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { createGameTheme } from "@incubator/game-ui/theme";
import { createGameSurfaces } from "@incubator/game-ui/game-surface";
import { createGamePrimitives } from "@incubator/game-ui/game-primitives";
import type { ReactNode } from "react";

export const theme = createGameTheme({
  fredokaBold: "EggDisplay",
  manrope: "EggBody",
});
export function Copy({ style, ...props }: TextProps) {
  const custom = StyleSheet.flatten(style);
  // Larger labels must not inherit the 14px body copy's 21px line box.
  const lineBox = custom?.fontSize !== undefined && custom.lineHeight === undefined
    ? { lineHeight: Math.ceil(custom.fontSize * 1.3) } : undefined;
  return <Text {...props} style={[styles.copy, lineBox, style]} />;
}
const Icon = ({
  name,
  color,
  size = 18,
}: {
  name: string;
  color: string;
  size?: number;
}) => (
  <Text style={{ color, fontSize: size }}>
    {name === "chevron.left" ? "‹" : "✦"}
  </Text>
);
export const { GameSurface } = createGameSurfaces({
  GameUI: theme,
  ThemedText: Copy,
  IconSymbol: Icon,
});
export const { GamePanel } = createGamePrimitives({
  GameUI: theme,
  ThemedText: Copy,
  IconSymbol: Icon,
  GameSurface,
});
export function Button({
  children,
  onPress,
  disabled,
  secondary,
  style,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (typeof children === "string" ? children : undefined)
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        style,
      ]}
    >
      <Copy
        style={[styles.buttonText, secondary && { color: theme.color.cream }]}
      >
        {children}
      </Copy>
    </Pressable>
  );
}
export function Heading({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <Copy
      style={{
        fontFamily: "EggDisplay",
        fontSize: small ? 30 : 48,
        lineHeight: small ? 34 : 50,
        color: theme.color.cream,
      }}
    >
      {children}
    </Copy>
  );
}
export function Coins({ value }: { value: number }) {
  return (
    <View style={styles.coins}>
      <Copy style={{ color: theme.color.gold, fontWeight: "800" }}>
        ● {value}
      </Copy>
    </View>
  );
}
export const styles = StyleSheet.create({
  copy: {
    fontFamily: "EggBody",
    fontSize: 14,
    lineHeight: 21,
    color: theme.color.cream,
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: theme.color.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "rgba(255,248,231,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,248,231,0.23)",
  },
  buttonText: { color: theme.color.goldInk, fontFamily: "EggDisplay", fontWeight: "400", fontSize: 16 },
  coins: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    backgroundColor: "rgba(24,35,26,0.75)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panel: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#20392F",
    padding: 24,
    gap: 14,
  },
  muted: { color: "#C4D1BF", fontSize: 12 },
});
