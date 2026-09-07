import type { Progression } from "@incubator/tile-match/engine";
import { isVarietyId } from "@incubator/tile-match/varieties";
import { snapLadder } from './progression';
import type {
  DuelDefinition,
  OpponentMoveDefinition,
  RegionDefinition,
} from "../game/types";

const stream = (slots: number): Progression => ({
  kind: "stream",
  loop: true,
  turns: [{ slots, varieties: [] }],
});
export const MOVES: Record<string, OpponentMoveDefinition> = {
  tap: {
    id: "tap",
    name: "Shell tap",
    warningMs: 5200,
    perfects: 1,
    damage: 18,
    recoveryMs: 2200,
    varieties: [],
  },
  drift: {
    id: "drift",
    name: "Forest gust",
    warningMs: 6500,
    perfects: 1,
    damage: 20,
    recoveryMs: 2200,
    varieties: [{ id: "drift", strength: 0.45 }],
  },
  armour: {
    id: "armour",
    name: "Shell shield",
    warningMs: 8500,
    perfects: 1,
    damage: 22,
    recoveryMs: 2200,
    varieties: [{ id: "armour", strength: 0.25 }],
  },
  bomb: {
    id: "bomb",
    name: "Seed trap",
    warningMs: 7000,
    perfects: 1,
    damage: 23,
    recoveryMs: 2200,
    varieties: [{ id: "bomb", strength: 0.25 }],
  },
  fuse: {
    id: "fuse",
    name: "Puzzle spell",
    warningMs: 7000,
    perfects: 1,
    damage: 22,
    recoveryMs: 2200,
    varieties: [{ id: "fuse", strength: 0.4 }],
  },
  crossed: {
    id: "crossed",
    name: "Cross-up",
    warningMs: 6500,
    perfects: 1,
    damage: 20,
    recoveryMs: 2200,
    varieties: [{ id: "crossed", strength: 0.5 }],
  },
  hues: {
    id: "hues",
    name: "Colour shift",
    warningMs: 8500,
    perfects: 1,
    damage: 20,
    recoveryMs: 2200,
    varieties: [{ id: "hues", strength: 0.45 }],
  },
};
const duel = (
  id: string,
  name: string,
  rival: string,
  skin: string,
  health: number,
  slots: number,
  move: string,
  tutorial: string,
): DuelDefinition => ({
  id,
  name,
  rival,
  skin,
  health,
  playerHealth: 100,
  regionId: "glade",
  progression: stream(slots),
  moves: [MOVES[move]],
  reward: 40,
  dialogue: [
    `${rival}: A little spark has wandered into our glade.`,
    "Show me what that sleepy shell can do.",
  ],
  tutorial,
});
export const DUELS: readonly DuelDefinition[] = [
  { ...duel(
    "glade-1",
    "A little spark",
    "Pip",
    "moss",
    300,
    1,
    "tap",
    "Match the outline to earn a Perfect and open two pieces. Keep the streak going to wake gusts, shields and other surprises. Perfects interrupt attacks!",
  ), progression: snapLadder() },
  { ...duel(
    "glade-2",
    "Both sides now",
    "Pollen",
    "honeycomb",
    370,
    2,
    "tap",
    "Start with both shapes. Keep your streak to bring back the glade’s puzzle tricks. Every completed beat sends your charged cells flying.",
  ), progression: snapLadder(true) },
  duel(
    "glade-3",
    "Catch the breeze",
    "Fern",
    "moss",
    330,
    1,
    "drift",
    "A forest gust moves the outlines. Aim where they are now. Being slow keeps an exact streak; missing a cell breaks it.",
  ),
  duel(
    "glade-4",
    "Under the shell",
    "Pebble",
    "frost",
    380,
    2,
    "armour",
    "A shielded outline needs extra drops. Chip its shield, then place the returned piece again. Chipping never breaks your streak.",
  ),
  duel(
    "glade-5",
    "A tricky seed",
    "Bramble",
    "sunset",
    400,
    2,
    "bomb",
    "The glowing red marker is a trap. Place the OTHER piece first to disarm it. Triggering a live trap destroys the whole beat.",
  ),
  {
    ...duel(
      "glade-6",
      "Keeper of the glade",
      "Elder Moss",
      "starglow",
      720,
      2,
      "tap",
      "The keeper mixes gusts, shields and traps. Complete TWO Perfect beats during each warning to interrupt.",
    ),
    boss: true,
    reward: 100,
    moves: ["drift", "armour", "bomb"].map((id) => ({
      ...MOVES[id],
      perfects: 2,
      warningMs: 10500,
      damage: 26,
    })),
    dialogue: [
      "Elder Moss: You have brought a little light to every corner of this glade.",
      "One last dance, little spark. Then the path beyond is yours.",
    ],
  },
  {
    ...duel(
      "cheerlet-1",
      "Better together",
      "Jig",
      "tide",
      380,
      1,
      "fuse",
      "Two pieces make one big shape. Match the top and bottom halves by shape. Neither piece rotates.",
    ),
    regionId: "cheerlet",
    dialogue: [
      "Jig: Welcome to the Playfields! We like our puzzles in pieces.",
      "Let us put something wonderful together.",
    ],
  },
];
export const REGIONS: readonly RegionDefinition[] = [
  {
    id: "glade",
    name: "Mossprout Glade",
    subtitle: "Where little sparks wake",
    q: 0,
    r: 0,
    environment: "mossprout",
    levels: DUELS.slice(0, 6).map((d) => d.id),
    price: 0,
    story: [
      "Beyond the mist, a sleepy glade is stirring.",
      "Meet its egg guardians. Find your spark. Open the path ahead.",
    ],
  },
  {
    id: "cheerlet",
    name: "Cheerlet Playfields",
    subtitle: "A new piece of the world",
    q: 1,
    r: 0,
    environment: "cheerlet",
    levels: ["cheerlet-1"],
    prerequisite: "glade-6",
    price: 180,
    story: [
      "The mist parts to a place full of colour.",
      "A new friend has a puzzle waiting for you.",
    ],
  },
];
export const COLLECTION = [
  {
    id: "moss",
    kind: "skin" as const,
    name: "Moss shell",
    description: "A little piece of the glade.",
    price: 60,
    discovery: "glade-2",
  },
  {
    id: "glow-wisp",
    kind: "wisp" as const,
    name: "Glade wisp",
    description: "A tiny friend for every duel.",
    price: 60,
    discovery: "glade-3",
  },
  {
    id: "starglow",
    kind: "skin" as const,
    name: "Keeper shell",
    description: "A gift from Elder Moss.",
    price: 0,
    discovery: "glade-6",
  },
];
export function getDuel(id: string) {
  const d = DUELS.find((item) => item.id === id);
  if (!d) throw new Error("Unknown duel");
  return d;
}
export function getRegion(id: string) {
  const r = REGIONS.find((item) => item.id === id);
  if (!r) throw new Error("Unknown region");
  return r;
}
export function validateCampaign() {
  if (new Set(DUELS.map((d) => d.id)).size !== DUELS.length)
    throw new Error("Duplicate duel");
  for (const region of REGIONS) {
    if (!region.levels.length) throw new Error("Empty region");
    for (const id of region.levels)
      if (getDuel(id).regionId !== region.id)
        throw new Error("Region mismatch");
  }
  for (const d of DUELS) {
    validateDuel(d);
  }
}
export function validateDuel(d: DuelDefinition) {
  if (!d.moves.length || d.health <= 0 || d.playerHealth <= 0)
    throw new Error("Invalid duel");
  for (const move of d.moves) {
    if (
      !Number.isInteger(move.perfects) ||
      move.perfects < 1 ||
      move.perfects > 3 ||
      move.damage < 0 ||
      move.warningMs <= 0 ||
      move.recoveryMs < 0
    )
      throw new Error("Invalid move");
    if (new Set(move.varieties.map((v) => v.id)).size !== move.varieties.length)
      throw new Error("Duplicate variety");
    const ids = move.varieties.map((v) => v.id);
    if (ids.includes("hues") && ids.includes("fuse"))
      throw new Error("Colour shift and jigsaw must be taught separately");
    if (d.progression.kind === "stream")
      for (const turn of d.progression.turns) {
        if ((ids.includes("hues") || ids.includes("fuse")) && turn.slots !== 1)
          throw new Error(
            "Colour shift and jigsaw need a single initial footprint",
          );
        if (ids.includes("bomb") && turn.slots < 2)
          throw new Error("Bomb encounters need a safe second piece");
      }
    for (const v of move.varieties)
      if (!isVarietyId(v.id) || v.strength < 0 || v.strength > 1)
        throw new Error("Invalid variety");
  }
}
