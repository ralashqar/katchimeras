import type { TileColors } from "@incubator/tile-match/theme";
// Cheerlet's soft toy blocks, with a distinct red reserved for bomb warnings.
export const TILE_COLORS: TileColors = {
  ignition: {
    bright: "#DEC4FF",
    mid: "#B185EA",
    deep: "#703AA7",
    glow: "#DEC4FF",
  },
  turbo: {
    bright: "#FFE69D",
    mid: "#F8C43B",
    deep: "#C57514",
    glow: "#FFE69D",
  },
  coolant: {
    bright: "#B0EAFF",
    mid: "#39BBF2",
    deep: "#1679BE",
    glow: "#B0EAFF",
  },
  nitro: {
    bright: "#FFC1D7",
    mid: "#F370A2",
    deep: "#B72C65",
    glow: "#FFC1D7",
  },
  grip: { bright: "#D0F69B", mid: "#93DB3A", deep: "#4D8C25", glow: "#D0F69B" },
};
