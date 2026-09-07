import type { TileColors } from "@incubator/tile-match/theme";
// Cheerlet's soft toy blocks, with a distinct red reserved for bomb warnings.
export const TILE_COLORS: TileColors = {
  ignition: {
    bright: "#D6C8FA",
    mid: "#AA91E8",
    deep: "#7460AD",
    glow: "#D6C8FA",
  },
  turbo: {
    bright: "#FFE39A",
    mid: "#F4BE62",
    deep: "#B46828",
    glow: "#FFE39A",
  },
  coolant: {
    bright: "#A9C8FF",
    mid: "#76A9EF",
    deep: "#3D579E",
    glow: "#A9C8FF",
  },
  nitro: {
    bright: "#FFB4D2",
    mid: "#E58DB7",
    deep: "#A93B74",
    glow: "#FFB4D2",
  },
  grip: { bright: "#9AE9DA", mid: "#70CFB5", deep: "#267B77", glow: "#9AE9DA" },
};
