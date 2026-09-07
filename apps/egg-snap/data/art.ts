import classic from "@incubator/art-egg-avatars/catalog/body/classic";
import moss from "@incubator/art-egg-avatars/catalog/body/moss";
import honeycomb from "@incubator/art-egg-avatars/catalog/body/honeycomb";
import frost from "@incubator/art-egg-avatars/catalog/body/frost";
import sunset from "@incubator/art-egg-avatars/catalog/body/sunset";
import starglow from "@incubator/art-egg-avatars/catalog/body/starglow";
import tide from "@incubator/art-egg-avatars/catalog/body/tide";
import sleepy from "@incubator/art-egg-avatars/catalog/face/sleepy";
import curious from "@incubator/art-egg-avatars/catalog/face/curious";
import determined from "@incubator/art-egg-avatars/catalog/face/determined";
import heroic from "@incubator/art-egg-avatars/catalog/face/heroic-glint";
import surprise from "@incubator/art-egg-avatars/catalog/face/big-surprise";
import grin from "@incubator/art-egg-avatars/catalog/face/big-grin";
export const BODIES: Record<string, typeof classic> = {
  classic,
  moss,
  honeycomb,
  frost,
  sunset,
  starglow,
  tide,
};
export const FACES: Record<string, typeof sleepy> = {
  sleepy,
  curious,
  determined,
  heroic,
  surprise,
  grin,
};
export const WISP = require("@incubator/art-wisps/fern.webp");
export const BACKGROUNDS = {
  mossprout: {
    source: require("@incubator/art-world/backgrounds/mossprout-exploration-v1.png"),
    recyclingKey: "egg-snap-mossprout",
  },
  cheerlet: {
    source: require("@incubator/art-world/backgrounds/cheerlet-exploration-v1.png"),
    recyclingKey: "egg-snap-cheerlet",
  },
};
export const HEX_ART = {
  glade: require("@incubator/art-world/hex/floating_neighborhood_v2_mossprout_haven_stage_3_hex_tile_512.webp"),
  cheerlet: require("@incubator/art-world/hex/floating_neighborhood_v2_cheerlet_hex_tile_512.webp"),
};
