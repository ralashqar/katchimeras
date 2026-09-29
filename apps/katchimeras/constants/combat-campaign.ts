import { islandLevel, type IslandLevelSpec, type IslandLaneSpec } from './island-campaigns/island-levels';
import type { CombatTerrain, SecondaryGenerator } from '@/features/mission-mechanics/combat-rules';

/** Twenty-four distinct lessons/remixes, shared by frontier and seeded expeditions. */
const LESSONS = [
  ['First light', 'Cover both lanes, then merge to concentrate your fire.'],
  ['Crossed sparks', 'Spark plants strike across lanes. Keep them near the danger.'],
  ['Shield garden', 'Bulwarks protect neighbouring plants. Put one ahead of your shooters.'],
  ['A warning shot', 'Move out of the Gunner’s marked cell before its shot lands.'],
  ['Dew after rain', 'Dew heals nearby plants. Keep your injured plants within reach.'],
  ['Pierce the line', 'Lanterns hit several enemies in a lane. Line up your strongest shot.'],
  ['The bomb garden', 'A Bomber marks a cross. Spread your plants or shield the centre.'],
  ['Beneath the roots', 'Burrowers announce where they will surface. Move your defence to meet them.'],
  ['Mirror morning', 'Mirrors reflect ordinary shots while shining. Use Spark or merge bursts.'],
  ['Sunlit ground', 'Plants on sunny ground fire faster. Protect that position.'],
  ['A narrow path', 'Stone blocks planting. Cover its lane from further back.'],
  ['Mist vents', 'Vents pulse Mist every twelve seconds. Keep valuable plants off them.'],
  ['Water and lightning', 'Puddles slow enemies; Spark strikes harder from wet ground.'],
  ['An echo of growth', 'Merge on echo ground to send a stronger burst.'],
  ['Guard and mend', 'Take down the healer before the guarded formation overwhelms you.'],
  ['Frost and fire', 'Dew cleanses frozen neighbours from tier three.'],
  ['Split decision', 'Splitters leave small threats behind. Keep a second lane covered.'],
  ['Two warnings', 'Gunfire and bombs overlap. Save an ability for the crowded moment.'],
  ['Behind the shield', 'Pierce the formation or focus its guardian. Shields reduce damage by half.'],
  ['Restless roots', 'Burrowers and runners attack different positions. Keep room to move.'],
  ['The mirror choir', 'Use Spark and merge bursts while the mirrors shine.'],
  ['Storm front', 'Heal between attacks, shield your shooters, and clear the marked ground.'],
  ['Last preparation', 'Three waves test your whole garden. Rearrange between waves.'],
  ['Sanctuary stand', 'Hold every lane. Stronger heroes and buildings give your strategy room to work.'],
] as const;
export const COMBAT_LESSONS = LESSONS;
const SECONDARY: SecondaryGenerator[] = ['storm-pot', 'storm-pot', 'ward-planter', 'ward-planter', 'dew-well', 'lantern-post'];
const THREATS: IslandLaneSpec['attack'][] = [undefined, undefined, undefined, 'gunner', undefined, undefined, 'bomber', 'burrower', 'mirror'];

export function combatLessonSpec(index: number, level = 1): IslandLevelSpec {
  const n = Math.max(0, Math.min(23, Math.floor(index)));
  const [title, objective] = LESSONS[n]!;
  const recommendedLevel = Math.max(1, Math.min(10, level));
  const scale = Math.pow(1.28, recommendedLevel - 1);
  const waveCount = n < 2 ? 1 : n < 16 ? 2 : 3;
  const lanes: IslandLaneSpec[] = [];
  for (let wave = 0; wave < waveCount; wave++) {
    const columns = wave % 2 ? [1, 3, 5] : [2, 4, 3];
    for (let slot = 0; slot < (n < 3 ? 3 : n < 16 ? 4 : 5); slot++) {
      const attack = slot === 0 ? (THREATS[n] ?? (n >= 17 ? (['gunner', 'bomber', 'burrower', 'mirror'] as const)[(n + wave) % 4] : undefined)) : undefined;
      lanes.push({ id: `wave-${wave}-${slot}`, wave, column: columns[slot % columns.length]!, at: 1 + slot * 6, hp: Math.round((4 + n * 0.18 + wave) * scale), step: Math.max(3.8, 5.5 - n * 0.045), look: attack ?? (n < 2 ? 'snuffer' : slot % 3 === 0 ? 'shrouder' : slot % 3 === 1 ? 'gunner' : 'snuffer'), ...(attack ? { attack } : { weapon: n < 2 ? 'bullet' : slot % 3 === 0 ? 'zap' : slot % 3 === 1 ? 'skirmisher' : 'bullet' }),
        ...(n === 14 && slot === 1 ? { mend: { every: 7 }, look: 'mender' } : {}),
        ...(n === 15 && slot === 0 ? { frost: 7, look: 'frost' } : {}),
        ...(n === 16 && slot === 0 ? { splits: 2, look: 'splitter' } : {}),
        ...(n === 18 && slot === 1 ? { shield: true, look: 'bulwark' } : {}),
      });
    }
  }
  const terrain: CombatTerrain[] = [];
  if (n >= 9) terrain.push({ cell: 38, kind: 'sunny' });
  if (n === 10 || n === 22) terrain.push({ cell: 25, kind: 'stone' });
  if (n === 11 || n === 21) terrain.push({ cell: 31, kind: 'vent' });
  if (n === 12 || n === 19) terrain.push({ cell: 24, kind: 'puddle' });
  if (n === 13 || n === 23) terrain.push({ cell: 32, kind: 'echo' });
  return { title, objective, combatV2: true, recommendedLevel, difficulty: recommendedLevel >= 7 || n >= 18 ? 'dark' : recommendedLevel >= 3 || n >= 6 ? 'thick' : 'calm', rows: 5,
    pieces: [[36, 2], [37, 1], [39, 1], [40, 2], [44, 1], [46, 1]], mist: [], wisps: [], seeds: { every: 3.2 }, stormPot: {},
    requiredChains: n === 2 ? ['bulwark'] : n === 4 || n === 15 ? ['dew'] : n === 5 || n === 18 ? ['lantern'] : n === 12 || n === 19 ? ['storm'] : n >= 21 ? ['bulwark', 'dew'] : undefined,
    secondaryGenerator: SECONDARY[n] ?? (n === 15 || n === 21 ? 'dew-well' : n === 18 ? 'lantern-post' : 'storm-pot'), terrain, lanes,
    rewards: { glow: 24 + recommendedLevel * 6, xp: 14 + recommendedLevel * 4 } };
}

export const COMBAT_BOSSES = ['bramble-sentinel', 'stormglass-matron', 'hollow'] as const;
export function combatBossSpec(boss: number, difficulty = 0): IslandLevelSpec {
  difficulty = Math.max(0, Math.min(2, Math.floor(difficulty)));
  const kind = ((boss % 3) + 3) % 3;
  const level = [3, 6, 9][Math.max(0, Math.min(2, difficulty))]!;
  const spec = combatLessonSpec(23, level);
  const name = ['Bramble Sentinel', 'Stormglass Matron', 'Hollow Heart'][kind]!;
  const hp = 32 * Math.pow(1.75, difficulty);
  return { ...spec, title: name, difficulty: 'boss', objective: `${name} changes tactics twice. A boss breach takes all three hearts.`,
    secondaryGenerator: kind === 0 ? 'ward-planter' : kind === 1 ? 'storm-pot' : 'lantern-post',
    lanes: [
      { id: 'shell', wave: 0, column: 3, at: 2, hp, step: 7, look: COMBAT_BOSSES[kind], breachDamage: 3, ...(kind === 0 ? { strike: 7 } : { attack: 'gunner' }) },
      { id: 'root-left', wave: 0, column: 1, at: 8, hp: 5 + level, step: 5 },
      { id: 'root-right', wave: 0, column: 5, at: 14, hp: 5 + level, step: 5 },
      { id: 'awakened', wave: 1, column: 3, at: 1, hp: hp * 1.1, step: 6.5, look: COMBAT_BOSSES[kind], breachDamage: 3, attack: kind === 1 ? 'mirror' : 'bomber' },
      { id: 'escort', wave: 1, column: 2, at: 8, hp: 8 + level, step: 6, look: 'mender', mend: { every: 8 } },
      { id: 'heart', wave: 2, column: 3, at: 1, hp: hp * 1.2, step: 6, look: COMBAT_BOSSES[kind], breachDamage: 3, attack: 'burrower', calls: { every: 10, count: 2, hp: 4 } },
    ], rewards: { glow: 70 + difficulty * 35, xp: 40 + difficulty * 20 } };
}
export const combatLessonMission = (index: number, level = 1) => islandLevel('combat', String(index + 1), combatLessonSpec(index, level));
