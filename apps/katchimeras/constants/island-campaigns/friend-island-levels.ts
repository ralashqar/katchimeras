import type { EncounterMistCell } from '@/types/encounter';
import { waves, type IslandLaneSpec, type IslandLevelSpec } from './island-levels';

/**
 * The later friends' islands, written out by hand (cozy 4X v2, Sept 2026): every level a Lanes battle, each island
 * with its own idea, its levels built up around it, and its own boss at the end. The board window is five columns by
 * five rows (cells 15-19, 22-26, 29-33, 36-40, 43-47); wisps come down from over the top row.
 *
 * - Fernip's Wildgrowth: the undergrowth. Plants start caught in it, creepers leave Mist on every cell they pass,
 *   nibblers knock plants down a size. The Overgrowth waits at the heart of it.
 * - Blossle's Seed Nursery: swarms. Many small, quick wisps, and Seeds come faster to meet them. The Seed Caller.
 * - Drizzlet's Pond: the rain. Every wisp spits Mist down its column, over and over. The Rainmaker.
 * - Amberleaf's Orchard: the heavy harvest. A few big, slow wardens, fast ones running beside them. The Hungry Harvest.
 * - Mistle's Ancient Grove: all of it at once, the oldest wisps of all. The Forgotten Keeper.
 */
const light = (cell: number): EncounterMistCell => ({ cell, type: 'light' });
const dense = (cell: number): EncounterMistCell => ({ cell, type: 'dense' });
const rooted = (cell: number): EncounterMistCell => ({ cell, type: 'root' });
const nibbler = (id: string, column: number, at: number, hp: number, step = 4.2): IslandLaneSpec => ({ id, column, at, hp, step, look: 'nibbler', strike: 5 });
const creeper = (id: string, column: number, at: number, hp: number, step = 4.4): IslandLaneSpec => ({ id, column, at, hp, step, drop: 1, look: 'creeper' });
const quick = (id: string, column: number, at: number, hp: number, step = 2.8): IslandLaneSpec => ({ id, column, at, hp, step, look: 'snuffer' });
const warden = (id: string, column: number, at: number, hp: number, step = 6, spit?: number): IslandLaneSpec => ({ id, column, at, hp, step, drop: 2, look: 'warden', ...(spit ? { spit } : {}) });

/** The usual front line: Seeds along the bottom, one asleep in the middle, a few more under the Mist. */
const FRONT = { pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [44, 1], [46, 1]] as const, sleepers: [[38, 1]] as const, veiled: [[31, 1], [30, 1], [32, 1], [24, 2], [29, 2], [33, 2]] as const };

const BOSS_REWARD = { glow: 60, xp: 36 };

export const FERNIP_LANES_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'Into the Undergrowth', objective: 'Your plants are caught in the undergrowth. Merge beside them to free them, then get them under the wisps.', difficulty: 'calm',
      pieces: [[36, 1], [38, 1], [40, 1], [44, 1], [46, 1]], bound: [[37, 1], [39, 1], [31, 2]], mist: [light(30), light(32)], seeds: { every: 3 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 9, hp: 4, step: 4.8, grow: 1, drop: 3 }, [[3], [2], [4], [1, 5]]),
    },
    {
      title: 'Creepers', objective: 'Creepers leave Mist on every cell they pass. Bring them down before they cover your plants.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 3 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 9, hp: 4, step: 4.6, grow: 1, drop: 3 }, [[2], [4], [1, 5]]), creeper('creeper', 3, 10, 6, 5)],
    },
  ],
  2: [
    {
      title: 'Thorns', objective: 'Nibblers knock the plant under them down a size. Merge it back up and keep shooting.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], bound: [[31, 1], [23, 2]], mist: [light(30), light(32)], seeds: { every: 3.2 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 8, hp: 5, step: 4.2, grow: 1, drop: 2 }, [[1], [5], [2, 4], [1, 5]]), nibbler('nibbler-a', 3, 9, 6), creeper('creeper', 2, 18, 6)],
    },
    {
      title: 'The Tangle Thickens', objective: 'Two creepers cover the board while the rest come down. Keep room to merge.', difficulty: 'thick',
      ...FRONT, mist: [rooted(22), rooted(26)], seeds: { every: 3.2 }, wisps: [],
      lanes: [creeper('creeper-a', 2, 3, 6), creeper('creeper-b', 4, 9, 6), ...waves('wisp', { first: 14, gap: 7, hp: 5, step: 4, grow: 1, drop: 2 }, [[3], [1, 5], [2, 4]])],
    },
  ],
  3: [
    {
      title: 'Root and Branch', objective: 'The roots bind whatever they touch. Free what they hold and cover every column.', difficulty: 'thick',
      pieces: [[36, 2], [38, 1], [40, 2], [44, 1], [46, 1]], bound: [[37, 1], [39, 1], [29, 1], [33, 1]], mist: [rooted(23), rooted(25), light(31)], seeds: { every: 3.2 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 7, hp: 6, step: 4, grow: 1, drop: 2 }, [[2], [4], [1, 3], [5, 2], [4, 1]]), nibbler('nibbler', 5, 12, 7)],
    },
    {
      title: 'Nothing Grows Here', objective: 'Nibblers on both sides, creepers down the middle. Keep your biggest plants away from the nibblers.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.4 }, wisps: [],
      lanes: [nibbler('nibbler-a', 1, 4, 7), nibbler('nibbler-b', 5, 10, 7), creeper('creeper', 3, 6, 8), ...waves('wisp', { first: 16, gap: 6, hp: 6, step: 3.6, grow: 1, drop: 2 }, [[2, 4], [1, 5], [3, 2]])],
    },
  ],
  4: [
    {
      title: 'The Deep Wood', objective: 'Everything the Wildgrowth has, all at once. Free your plants, clear the Mist, cover every lane.', difficulty: 'dark',
      pieces: [[36, 2], [38, 1], [40, 2], [44, 1], [46, 1]], bound: [[37, 1], [39, 1]], mist: [rooted(22), light(24), rooted(26)], seeds: { every: 3.6 }, wisps: [],
      lanes: [creeper('creeper-a', 2, 3, 8), creeper('creeper-b', 4, 7, 8), nibbler('nibbler', 3, 12, 8), ...waves('wisp', { first: 16, gap: 6, hp: 7, step: 3.4, grow: 1, drop: 2 }, [[1, 5], [2, 4], [3, 1, 5]])],
    },
    {
      title: 'The Overgrowth', objective: 'The heart of the Wildgrowth has woken. It comes down the middle, burying everything in Mist, and its creepers come with it.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.8 }, wisps: [],
      lanes: [
        { id: 'overgrowth', column: 3, at: 3, hp: 26, step: 6, drop: 1, look: 'overgrowth', spit: 6 },
        creeper('creeper-a', 1, 9, 7), creeper('creeper-b', 5, 15, 7),
        ...waves('escort', { first: 12, gap: 8, hp: 6, step: 3.6, grow: 1, drop: 2 }, [[2], [4], [1, 5], [2, 4]]),
        nibbler('nibbler', 4, 20, 7),
      ],
      rewards: BOSS_REWARD,
    },
  ],
};

export const BLOSSLE_LANES_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'The Seed Beds', objective: 'Small wisps, and lots of them. Seeds come quickly here too: merge fast.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 2.6 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 6, hp: 3, step: 4.4, drop: 3 }, [[3], [1], [5], [2, 4], [3], [1, 5]]),
    },
    {
      title: 'Seedfall', objective: 'They come two and three at a time now. A Sprout under each is enough for these.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 2.6 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 8, hp: 3, step: 4.4, drop: 3 }, [[2], [4], [1, 5], [3], [2, 4]]),
    },
  ],
  2: [
    {
      title: 'The Quick Ones', objective: 'Quick little wisps race down the edges. Keep a plant under the outside lanes.', difficulty: 'thick',
      ...FRONT, mist: [light(23), light(25)], seeds: { every: 2.8 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 6, hp: 4, step: 4, grow: 1, drop: 2 }, [[3], [2, 4], [3], [2, 4]]), quick('quick-a', 1, 8, 4), quick('quick-b', 5, 14, 4), quick('quick-c', 1, 22, 5)],
    },
    {
      title: 'A Swarm in the Nursery', objective: 'A swarm, every column at once. Spread your plants wide rather than tall.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1], [46, 1]], mist: [light(30), light(32)], seeds: { every: 2.8 }, wisps: [],
      lanes: waves('swarm', { first: 2, gap: 8, hp: 3, step: 3.8, grow: 1, drop: 3 }, [[1, 3, 5], [2, 4], [1, 3, 5], [2, 4, 3]]),
    },
  ],
  3: [
    {
      title: 'Empty Pots', objective: 'The Mist has taken the pots. Clear it, merge in the gaps, and keep up with the swarm.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [44, 1], [46, 1]], sleepers: [[38, 1]], mist: [dense(30), dense(32), light(23), light(25)], seeds: { every: 2.8 }, wisps: [],
      lanes: [...waves('swarm', { first: 2, gap: 7, hp: 4, step: 3.8, grow: 1, drop: 2 }, [[2, 4], [1, 5], [3], [2, 4], [1, 3, 5]]), quick('quick', 3, 18, 5)],
    },
    {
      title: 'Nowhere to Hide', objective: 'Quick ones between every wave. Every lane needs a plant, all the time.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3 }, wisps: [],
      lanes: [...waves('swarm', { first: 2, gap: 7, hp: 5, step: 3.6, grow: 1, drop: 2 }, [[1, 5], [3], [2, 4], [1, 5, 3]]), quick('quick-a', 2, 6, 5), quick('quick-b', 4, 13, 5), quick('quick-c', 3, 20, 6)],
    },
  ],
  4: [
    {
      title: 'Every Last Seed', objective: 'Swarms, quick ones and a nibbler among them. Merge fast and never leave a lane empty.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3 }, wisps: [],
      lanes: [...waves('swarm', { first: 2, gap: 7, hp: 5, step: 3.5, grow: 1, drop: 2 }, [[2, 4], [1, 3, 5], [2, 4], [1, 5, 3]]), quick('quick-a', 1, 9, 6), nibbler('nibbler', 5, 15, 7)],
    },
    {
      title: 'The Seed Caller', objective: 'It calls the swarm down around it, wave after wave. Bring it down in the middle while you hold the edges.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.2 }, wisps: [],
      lanes: [
        { id: 'caller', column: 3, at: 3, hp: 24, step: 6.2, drop: 2, look: 'caller', spit: 6 },
        ...waves('swarm', { first: 8, gap: 7, hp: 4, step: 3.4, grow: 1, drop: 3 }, [[1, 5], [2, 4], [1, 5], [2, 4], [1, 5]]),
        quick('quick', 2, 18, 6),
      ],
      rewards: BOSS_REWARD,
    },
  ],
};

export const DRIZZLET_LANES_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'First Rain', objective: 'These spit Mist down their column while they fall. Merge beside the Mist to wash it off your plants.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 3 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 9, hp: 4, step: 4.8, grow: 1, drop: 3, spit: 9 }, [[3], [2], [4], [1, 5]]),
    },
    {
      title: 'Puddles', objective: 'More rain, more Mist. Keep the bottom rows clear so you can keep merging.', difficulty: 'calm',
      ...FRONT, mist: [light(22), light(26)], seeds: { every: 3 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 8, hp: 4, step: 4.6, grow: 1, drop: 3, spit: 8 }, [[2], [4], [1, 5], [3], [2, 4]]),
    },
  ],
  2: [
    {
      title: 'The Still Water', objective: 'The Pond is thick with Mist already. Clear a way, then meet them.', difficulty: 'thick',
      pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [44, 1], [46, 1]], sleepers: [[38, 1]], mist: [light(29), dense(31), light(33), light(23), light(25)], seeds: { every: 3.2 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 8, hp: 5, step: 4.2, grow: 1, drop: 2, spit: 7 }, [[1], [5], [2, 4], [3], [1, 5]]),
    },
    {
      title: 'Downpour', objective: 'A big cloud in the middle spits Mist on everything under it. Bring it down fast.', difficulty: 'thick',
      ...FRONT, mist: [], seeds: { every: 3.2 }, wisps: [],
      lanes: [warden('cloud', 3, 4, 12, 5.4, 4), ...waves('wisp', { first: 10, gap: 7, hp: 5, step: 4, grow: 1, drop: 2, spit: 7 }, [[1], [5], [2, 4], [1, 5]])],
    },
  ],
  3: [
    {
      title: 'Rain on Every Row', objective: 'Every wisp spits, all the time. Merge where the Mist lands, or it will close over you.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.2 }, wisps: [],
      lanes: waves('wisp', { first: 2, gap: 7, hp: 6, step: 4, grow: 1, drop: 2, spit: 6 }, [[2], [4], [1, 5], [3, 2], [4, 1, 5]]),
    },
    {
      title: 'The Flood', objective: 'Two clouds and quick ones between them. Keep a strong plant in every lane.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.4 }, wisps: [],
      lanes: [warden('cloud-a', 2, 3, 12, 5.4, 5), warden('cloud-b', 4, 10, 12, 5.4, 5), quick('quick-a', 1, 14, 5), quick('quick-b', 5, 18, 5), ...waves('wisp', { first: 22, gap: 6, hp: 6, step: 3.6, grow: 1, spit: 7 }, [[3], [1, 5]])],
    },
  ],
  4: [
    {
      title: 'Grey Skies', objective: 'Everything spits. Everything. Wash the board, merge big, and hold every lane.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.6 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 7, hp: 6, step: 3.9, grow: 1, drop: 2, spit: 6 }, [[2, 4], [1, 5], [3], [2, 4]]), nibbler('nibbler', 3, 15, 7)],
    },
    {
      title: 'The Rainmaker', objective: 'It has kept the Pond grey for years. It comes down the middle, spitting Mist on every row, and the rain comes with it.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.6 }, wisps: [],
      lanes: [
        { id: 'rainmaker', column: 3, at: 3, hp: 26, step: 6, drop: 1, look: 'shrouder', spit: 4 },
        ...waves('rain', { first: 8, gap: 8, hp: 6, step: 3.6, grow: 1, drop: 2, spit: 6 }, [[1], [5], [2, 4], [1, 5], [2, 4]]),
      ],
      rewards: BOSS_REWARD,
    },
  ],
};

export const AMBERLEAF_LANES_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'Windfall', objective: 'One big, slow wisp in the middle. Build your biggest plant under it.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 3 }, wisps: [],
      lanes: [warden('big', 3, 3, 10, 6.4), ...waves('wisp', { first: 10, gap: 9, hp: 4, step: 4.6, drop: 3 }, [[2], [4], [1, 5]])],
    },
    {
      title: 'The Gleaners', objective: 'Quick ones run down the edges beside the big ones. Watch the outside lanes.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 3 }, wisps: [],
      lanes: [warden('big', 2, 3, 9, 6.6), quick('quick-a', 5, 9, 3, 3.4), quick('quick-b', 1, 18, 3, 3.4), ...waves('wisp', { first: 22, gap: 9, hp: 4, step: 4.6, drop: 3 }, [[4], [3]])],
    },
  ],
  2: [
    {
      title: 'Heavy Branches', objective: 'Two big ones, one after the other. Merge up, not out.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.2 }, wisps: [],
      lanes: [warden('big-a', 2, 3, 13, 6), warden('big-b', 4, 12, 13, 6), ...waves('wisp', { first: 6, gap: 8, hp: 5, step: 4.2, grow: 1, drop: 2 }, [[5], [1], [3], [5, 1]])],
    },
    {
      title: 'Bitter Fruit', objective: 'A nibbler hides among the big ones. Keep your big plants out of its lane.', difficulty: 'thick',
      ...FRONT, mist: [light(22), light(26)], seeds: { every: 3.2 }, wisps: [],
      lanes: [warden('big', 3, 3, 14, 6), nibbler('nibbler', 1, 8, 6), quick('quick', 5, 14, 5), ...waves('wisp', { first: 18, gap: 7, hp: 5, step: 4, grow: 1, drop: 2 }, [[2, 4], [1, 5]])],
    },
  ],
  3: [
    {
      title: 'The Long Rows', objective: 'Big ones in three lanes. Spread your biggest plants to meet them.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.4 }, wisps: [],
      lanes: [warden('big-a', 1, 3, 12, 6), warden('big-b', 5, 8, 12, 6), warden('big-c', 3, 15, 14, 6), ...waves('wisp', { first: 10, gap: 8, hp: 5, step: 4, grow: 1, drop: 2 }, [[2], [4], [2, 4]])],
    },
    {
      title: 'Storm in the Orchard', objective: 'Big ones spitting Mist, quick ones running through. Hold on.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.4 }, wisps: [],
      lanes: [warden('big-a', 2, 3, 14, 5.8, 7), warden('big-b', 4, 9, 14, 5.8, 7), quick('quick-a', 1, 13, 6), quick('quick-b', 5, 17, 6), quick('quick-c', 3, 22, 6)],
    },
  ],
  4: [
    {
      title: 'The Last Tree Standing', objective: 'The biggest yet, with nibblers at its side. Keep your plants big and out of the nibblers’ way.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.6 }, wisps: [],
      lanes: [warden('big', 3, 3, 18, 6), nibbler('nibbler-a', 1, 8, 7), nibbler('nibbler-b', 5, 14, 7), ...waves('wisp', { first: 12, gap: 7, hp: 6, step: 3.8, grow: 1, drop: 2 }, [[2], [4], [2, 4]])],
    },
    {
      title: 'The Hungry Harvest', objective: 'It has been feeding on the Orchard for years. Slow, huge and hard to move, and the quick ones run beside it.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.6 }, wisps: [],
      lanes: [
        { id: 'harvest', column: 3, at: 3, hp: 30, step: 6.6, drop: 1, look: 'mender', spit: 6 },
        quick('quick-a', 1, 8, 6), quick('quick-b', 5, 13, 6),
        ...waves('escort', { first: 16, gap: 8, hp: 6, step: 3.8, grow: 1, drop: 2 }, [[2], [4], [1, 5], [2, 4]]),
      ],
      rewards: BOSS_REWARD,
    },
  ],
};

export const MISTLE_LANES_SPECS: Readonly<Record<1 | 2 | 3 | 4, readonly IslandLevelSpec[]>> = {
  1: [
    {
      title: 'The Oldest Path', objective: 'Nobody has walked here in a long time. The wisps here are old ones: watch what each one does.', difficulty: 'calm',
      ...FRONT, mist: [light(22), light(26)], seeds: { every: 3 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 9, hp: 4, step: 4.6, grow: 1, drop: 3, spit: 9 }, [[3], [2], [4]]), creeper('creeper', 1, 20, 5, 5)],
    },
    {
      title: 'Whispers', objective: 'Quick ones and creepers together. Cover every lane and keep the board clear.', difficulty: 'calm',
      ...FRONT, mist: [], seeds: { every: 3 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 9, hp: 4, step: 4.6, grow: 1, drop: 3 }, [[2], [4], [1, 5]]), quick('quick', 3, 12, 4, 3), creeper('creeper', 5, 22, 5, 5)],
    },
  ],
  2: [
    {
      title: 'Where the Light Went', objective: 'Big ones, spitting ones and nibblers. Everything you have learned, all at once.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 1], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.2 }, wisps: [],
      lanes: [warden('big', 3, 3, 12, 6, 7), nibbler('nibbler', 1, 9, 6), ...waves('wisp', { first: 6, gap: 8, hp: 5, step: 4.2, grow: 1, drop: 2, spit: 8 }, [[5], [2], [4, 1]])],
    },
    {
      title: 'Roots of the Old Tree', objective: 'The old roots hold your plants. Free them before the creepers bury the rest.', difficulty: 'thick',
      pieces: [[36, 1], [38, 2], [40, 1], [44, 1], [46, 1]], bound: [[37, 1], [39, 1], [31, 1]], mist: [rooted(23), rooted(25)], seeds: { every: 3.2 }, wisps: [],
      lanes: [creeper('creeper-a', 2, 3, 7), creeper('creeper-b', 4, 9, 7), ...waves('wisp', { first: 12, gap: 7, hp: 5, step: 4, grow: 1, drop: 2 }, [[1, 5], [3], [2, 4]])],
    },
  ],
  3: [
    {
      title: 'The Grey Heart', objective: 'Swarms from above, big ones in the middle. Wide and strong at once.', difficulty: 'thick',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3 }, wisps: [],
      lanes: [warden('big', 3, 3, 14, 6), ...waves('swarm', { first: 5, gap: 7, hp: 4, step: 3.6, grow: 1, drop: 2 }, [[1, 5], [2, 4], [1, 5], [2, 4]])],
    },
    {
      title: 'Nothing Remembers', objective: 'The oldest wisps of all: quick, spitting, striking. Keep every lane covered and every plant big.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(23), light(25)], seeds: { every: 3.4 }, wisps: [],
      lanes: [...waves('wisp', { first: 2, gap: 7, hp: 6, step: 3.6, grow: 1, drop: 2, spit: 7 }, [[2, 4], [1, 5], [3], [2, 4]]), quick('quick-a', 1, 10, 6), nibbler('nibbler', 5, 16, 7), quick('quick-b', 3, 22, 6)],
    },
  ],
  4: [
    {
      title: 'At the Foot of the Oldest Tree', objective: 'Everything the Mist has left, all at once. This is the last of it before the heart.', difficulty: 'dark',
      pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.6 }, wisps: [],
      lanes: [warden('big', 3, 3, 16, 6, 7), creeper('creeper', 1, 8, 7), nibbler('nibbler', 5, 13, 8), ...waves('wisp', { first: 16, gap: 7, hp: 6, step: 3.6, grow: 1, drop: 2, spit: 8 }, [[2, 4], [1, 5]])],
    },
    {
      title: 'The Forgotten Keeper', objective: 'It kept the oldest tree before the Mist, and forgot why. It comes down the middle, and every old wisp comes with it.', difficulty: 'boss',
      pieces: [[36, 1], [37, 1], [38, 2], [39, 1], [40, 1], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.6 }, wisps: [],
      lanes: [
        { id: 'keeper', column: 3, at: 3, hp: 30, step: 6.4, drop: 1, look: 'keeper', spit: 5 },
        creeper('creeper', 1, 9, 7),
        ...waves('escort', { first: 12, gap: 8, hp: 6, step: 3.6, grow: 1, drop: 2, spit: 7 }, [[5], [2, 4], [1, 5], [2, 4]]),
        nibbler('nibbler', 4, 22, 7),
      ],
      rewards: BOSS_REWARD,
    },
  ],
};
