import type { TileColors } from "@incubator/tile-match/theme";
// Cheerlet's soft toy blocks, with a distinct red reserved for bomb warnings.
export const TILE_COLORS: TileColors = {
  ignition: {
    bright: "#FFB19D",
    mid: "#EF796B",
    deep: "#A84149",
    glow: "#FFB19D",
  },
  turbo: {
    bright: "#FFE39A",
    mid: "#F4B855",
    deep: "#B46828",
    glow: "#FFE39A",
  },
  coolant: {
    bright: "#A9C8FF",
    mid: "#719BE8",
    deep: "#3D579E",
    glow: "#A9C8FF",
  },
  nitro: {
    bright: "#FFB4D2",
    mid: "#F273AA",
    deep: "#A93B74",
    glow: "#FFB4D2",
  },
  grip: { bright: "#9AE9DA", mid: "#52C6B6", deep: "#267B77", glow: "#9AE9DA" },
};
