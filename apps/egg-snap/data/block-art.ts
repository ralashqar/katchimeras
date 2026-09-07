import type { TileAppearance } from "@incubator/tile-match/theme";
export const BLOCK_IMAGES: TileAppearance["cells"] = {
  ignition: require("../assets/blocks/ignition.png"),
  turbo: require("../assets/blocks/turbo.png"),
  coolant: require("../assets/blocks/coolant.png"),
  nitro: require("../assets/blocks/nitro.png"),
  grip: require("../assets/blocks/grip.png"),
};
export const CLEAR_BLOCK_IMAGES: TileAppearance["cells"] = {
  ignition: require("../assets/blocks/ignition-clear.png"),
  turbo: require("../assets/blocks/turbo-clear.png"),
  coolant: require("../assets/blocks/coolant-clear.png"),
  nitro: require("../assets/blocks/nitro-clear.png"),
  grip: require("../assets/blocks/grip-clear.png"),
};
export const BLOCK_SYMBOLS: TileAppearance["cells"] = {
  ignition: require("../assets/blocks/ignition-symbol.png"),
  turbo: require("../assets/blocks/turbo-symbol.png"),
  coolant: require("../assets/blocks/coolant-symbol.png"),
  nitro: require("../assets/blocks/nitro-symbol.png"),
  grip: require("../assets/blocks/grip-symbol.png"),
};
export const BLOCK_ATLAS = require("../assets/blocks/atlas.png");
export const CLEAR_BLOCK_ATLAS = require("../assets/blocks/atlas-clear.png");
