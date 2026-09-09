import { characterForEncounter } from './characters';
import type { Progression } from '@incubator/tile-match/engine';
import { isVarietyId } from '@incubator/tile-match/varieties';
import { snapLadder } from './progression';
import type { AiProfile, DuelDefinition, OpponentMoveDefinition, RegionDefinition } from '../game/types';

/** Puzzle mechanics only. Opponents no longer have timed attacks or fixed damage. */
export const MOVES: Record<string, OpponentMoveDefinition> = {
  tap: {id: 'tap', name: 'Simple shapes', varieties: []},
  drift: {id: 'drift', name: 'Forest gust', varieties: [{id: 'drift', strength: .55}]},
  armour: {id: 'armour', name: 'Shell shield', varieties: [{id: 'armour', strength: .25}]},
  bomb: {id: 'bomb', name: 'Seed trap', varieties: [{id: 'bomb', strength: .25}]},
  fuse: {id: 'fuse', name: 'Puzzle spell', varieties: [{id: 'fuse', strength: .4}]},
  crossed: {id: 'crossed', name: 'Cross-up', varieties: [{id: 'crossed', strength: .5}]},
  hues: {id: 'hues', name: 'Colour shift', varieties: [{id: 'hues', strength: .45}]},
  spin: {id: 'spin', name: 'Turnabout', varieties: [{id: 'spin', strength: .3}]},
};
export function mechanicSequence(mechanics: readonly string[], slots = 2, strength?: number): Progression {
  return {kind: 'stream', loop: true, turns: mechanics.map(id => ({
    slots: id === 'fuse' || id === 'hues' ? 1 : slots,
    ...(id === 'fuse' ? {minShapeHeight: 2} : {}),
    varieties: MOVES[id].varieties.map(v => ({...v, strength: strength ?? v.strength})),
  }))};
}
export const DEFAULT_ARENA_AI = {actionMs: 1500, accuracy: .85} as const;

const ai = (minActionMs: number, maxActionMs: number, accuracy: number): AiProfile => ({minActionMs, maxActionMs, accuracy});
const duel = (id: string, name: string, rival: string, skin: string, health: number, opponent: AiProfile, progression: Progression, tutorial: string): DuelDefinition => ({
  id, name, rival, skin, health, ai: opponent, progression, regionId: 'glade', reward: 40,
  dialogue: [`${rival}: A little spark has wandered into our glade.`, 'The same shapes, two little sparks. Let us play!'], tutorial,
});
const ORIGINAL_DUELS: readonly DuelDefinition[] = [
  duel('glade-1', 'A little spark', 'Pip', 'moss', 300, ai(1530,2070,.75), snapLadder(),
    'We get the same shapes in the same order. Match the first outline; two pieces arrive next. Completed cells fly at your rival. Play accurately to build a stronger streak!'),
  duel('glade-2', 'Both sides now', 'Pollen', 'honeycomb', 370, ai(1350,1890,.81), snapLadder(true),
    'Both eggs play at their own pace. Fill your shapes to send cells flying. Watch your rival’s little outlines charging too.'),
  duel('glade-3', 'Catch the breeze', 'Fern', 'moss', 330, ai(1260,1800,.85), mechanicSequence(['drift'],1),
    'The same breeze visits each egg’s puzzle. Aim where your outlines are now. Exact matches keep your streak, even when you take your time.'),
  duel('glade-4', 'Under the shell', 'Pebble', 'frost', 380, ai(1170,1710,.89), mechanicSequence(['armour']),
    'We both chip our shields before filling the shapes. The piece returns for another try; chipping never breaks your streak.'),
  duel('glade-5', 'A tricky seed', 'Bramble', 'sunset', 400, ai(1080,1620,.92), mechanicSequence(['bomb']),
    'Play the OTHER piece first to disarm the red-marked trap. A triggered trap cancels your volley and sends its cells back at you for a little damage.'),
  {...duel('glade-6', 'Keeper of the glade', 'Elder Moss', 'starglow', 720, ai(765,1215,.97), mechanicSequence(['drift','armour','bomb']),
    'The keeper plays quickly and carefully. You share the same gusts, shields and traps. Keep your aim steady and your streak bright.'), boss: true, reward: 100,
    dialogue: ['Elder Moss: You have brought a little light to every corner of this glade.', 'One last dance, little spark. Then the path beyond is yours.']},
  {...duel('cheerlet-1', 'Better together', 'Jig', 'tide', 380, ai(1125,1665,.90), mechanicSequence(['fuse']),
    'Two pieces make one big shape. Both eggs assemble the same puzzle. Match both halves before your cells fly.'), regionId: 'cheerlet',
    dialogue: ['Jig: Welcome to the Playfields! We like our puzzles in pieces.', 'Let us put something wonderful together.']},
];
export const DUELS: readonly DuelDefinition[] = [...ORIGINAL_DUELS,
  {...duel('cheerlet-2', 'Picnic emergency', 'Cinder', 'sunset', 300, ai(2300,3300,.78), mechanicSequence(['tap','bomb','tap','tap','drift','tap']), 'Clear the safe shape before the rigged shape.'), regionId: 'cheerlet', reward: 60},
  {...duel('cheerlet-3', 'A crooked boundary', 'Prism', 'frost', 300, ai(2200,3200,.8), mechanicSequence(['tap','armour','tap','bomb','tap','drift','tap']), 'Use the mechanics you already know.'), regionId: 'cheerlet', boss: true, reward: 100},
].map(d => {
  if (d.id === 'cheerlet-1') d = {...d, health: 300, ai: ai(2400,3400,.78), progression: mechanicSequence(['tap','drift','tap','tap','armour','tap']), tutorial: 'Watch the moving outline and keep your aim steady.'};
  const c = characterForEncounter(d.id);
  return c ? {...d, characterId: c.id, rival: c.name, name: c.title, dialogue: [c.before], victoryDialogue: c.after} : d;
});
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
    levels: ["cheerlet-1", "cheerlet-2", "cheerlet-3"],
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
  if (d.opponentHealth !== undefined && (!Number.isFinite(d.opponentHealth) || d.opponentHealth <= 0)) throw new Error('Invalid opponent health');
  if (!Number.isFinite(d.health) || d.health <= 0 || d.ai.minActionMs < 100 || !Number.isFinite(d.ai.minActionMs) || !Number.isFinite(d.ai.maxActionMs) || d.ai.maxActionMs < d.ai.minActionMs || !Number.isFinite(d.ai.accuracy) || d.ai.accuracy < 0 || d.ai.accuracy > 1) throw new Error('Invalid duel');
  if (d.progression.kind !== 'stream' || !d.progression.turns.length) throw new Error('Duels require a beat-indexed sequence');
  for (const turn of d.progression.turns) {
    const ids = turn.varieties.map(v => v.id);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate variety');
    if (ids.includes('hues') && (ids.includes('fuse') || ids.includes('crossed'))) throw new Error('Colour shift must be taught separately');
    if ((ids.includes('hues') || ids.includes('fuse')) && turn.slots !== 1) throw new Error('Colour shift and jigsaw need a single initial footprint');
    for (const v of turn.varieties) if (!isVarietyId(v.id) || !Number.isFinite(v.strength) || v.strength < 0 || v.strength > 1) throw new Error('Invalid variety');
  }
}
