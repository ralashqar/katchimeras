import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export const FERNIP_ISLAND_CAMPAIGN_ID = 'island-campaign:fernip-wildgrowth';
export const FERNIP_ISLAND_ID = 'wildgrowth-grove' as const;

export type FernipRestStyle = 'unhurried' | 'playful' | 'sheltered';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/**
 * Fernip: a quiet woodland friend who rests in tangled places. The arc is
 * about how you unwind. Every chapter plays on the docked restoration board
 * under the grove: the local pieces clear some of the mist, get stuck, and the
 * chapter's Main Board request brings what frees the rest.
 *
 * Fernip is the second friend home, so the supply is Petalimp's: Seeds from
 * the Garden Basket (its waterside branch waits for Shellio) and the Journey
 * Locker's trail chain (its travel branch waits for a later friend). The
 * boards grow a little each stage: more pieces, more misted cells, a longer bar.
 */
export const FERNIP_WILDGROWTH_CAMPAIGN: IslandCampaignDefinition<FernipRestStyle> = {
  campaignId: FERNIP_ISLAND_CAMPAIGN_ID,
  islandId: FERNIP_ISLAND_ID,
  residentSkinId: 'fernip',
  residentName: 'Fernip',
  chapterIdPrefix: 'fernip-wildgrowth',
  tags: ['island-campaign', 'fernip', 'wildgrowth-grove'],
  chapters: [
    {
      level: 1,
      title: 'Somewhere Soft to Spread',
      conversationId: 'mossprout:island:fernip:soft-spread',
      // Four Seeds make two Sprouts; one frees the misted Sprout and becomes a Plant, or both become one.
      // Either way the patch stops there: the request's Plant makes the Flower that frees the last misted cell.
      restoration: {
        rows: 3, merges: 5,
        items: [{ cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' }, { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' }],
        echoes: [{ id: 'fernip-1-sprout', cell: 24, definitionId: 'nature:garden:2' }, { id: 'fernip-1-flower', cell: 31, definitionId: 'nature:garden:4' }],
        deliveryCells: [17, 30, 19],
      },
      prompt: 'This is my grove. The Mistwisps have been sitting on it for years, and nothing can grow under that weight. Three of them are on it now.\n\nOne plant is all we can manage today. How do we start?',
      fallbackOrder: order('A Soft Patch', 'Make one Plant so the moss has somewhere soft to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
      choices: [
        {
          id: 'rest-slow', label: 'Slowly', reply: 'Slowly. They don’t notice slow.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('A Patch for Doing Nothing', 'Make one Plant so the moss has somewhere unhurried to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Every merge lifts them a little. No rush.',
          returnLine: 'Set it down. The grove does the rest. This first patch is my gift.',
          resolutionLine: 'It grew, slowly, and they lifted. The first patch of the grove is ours again.',
        },
        {
          id: 'rest-play', label: 'Somewhere they don’t expect', reply: 'Somewhere odd. They don’t like odd.',
          style: 'playful', wispAffinity: { giggle: 2 },
          order: order('A Patch That Tickles', 'Make one Plant for a patch of moss that has no idea where its edges are.', 'small', 'curiosity', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Every merge lifts them a little. Put it somewhere odd.',
          returnLine: 'Set it down, anywhere they aren’t looking. This first patch is my gift.',
          resolutionLine: 'It grew where they weren’t looking. The first patch of the grove is ours again.',
        },
        {
          id: 'rest-shelter', label: 'Somewhere out of their reach', reply: 'Out of their reach. Then it can grow in peace.',
          style: 'sheltered', wispAffinity: { sprout: 2 },
          order: order('A Corner Under the Ferns', 'Make one Plant to shade a small corner where the moss can rest.', 'small', 'comfort', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Every merge lifts them a little. Keep it out of their reach.',
          returnLine: 'Set it down, out of their reach. The grove does the rest. This first patch is my gift to you.',
          resolutionLine: 'It grew, out of their reach. The first patch of the grove is ours again.',
        },
      ],
    },
    {
      level: 2,
      title: 'Neighbours at Ankle Height',
      conversationId: 'mossprout:island:fernip:ankle-neighbours',
      // Two misted cells, a Sprout and a Plant, and a Plant already on the board: however the Seeds are paired,
      // the hollow stops at one Flower. The request's Flower and Sprout free whatever the mist still holds.
      restoration: {
        rows: 3, merges: 7,
        items: [
          { cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' },
          { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' },
          { cell: 29, definitionId: 'nature:garden:3' },
        ],
        echoes: [{ id: 'fernip-2-sprout', cell: 24, definitionId: 'nature:garden:2' }, { id: 'fernip-2-plant', cell: 31, definitionId: 'nature:garden:3' }],
        deliveryCells: [17, 30, 19],
      },
      callbackLine: {
        unhurried: 'The slow one held. So they settled further in, where the grove is oldest.',
        playful: 'The odd one held. So they settled further in, where the grove is oldest.',
        sheltered: 'The sheltered one held. So they settled further in, where the grove is oldest.',
      },
      prompt: 'They’ve settled where the grove is oldest. Everything under them has gone quiet. Four Mistwisps, sitting on it.\n\nWe take one patch back today. Which?',
      fallbackOrder: order('The Log Hollow', 'Bring a Flower and a Sprout to make the hollow cosier for its quiet neighbours.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'near-silence', label: 'The nearest one', reply: 'The nearest. No need to reach.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('A Quiet Hollow', 'Bring a Flower and a Sprout for a hollow where nobody has to say anything.', 'medium', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They lift where the light lands.',
          returnLine: 'Set them in. Watch them lift.',
          resolutionLine: 'It grew. They shifted, and more of the grove is ours.',
        },
        {
          id: 'near-games', label: 'The one they’re sitting on hardest', reply: 'Where they’re heaviest. That’s where the most is being kept.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Counting Hollow', 'Bring a Flower and a Sprout for a hollow with something small to play at.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They lift where the light lands, heaviest or not.',
          returnLine: 'Set them in where they’re heaviest. Watch them lift.',
          resolutionLine: 'It grew right under them. They shifted, and more of the grove is ours.',
        },
        {
          id: 'near-safe', label: 'The one furthest from them', reply: 'Furthest from them. Somewhere safe to grow from.',
          style: 'sheltered', wispAffinity: { heartlet: 2 },
          order: order('A Hollow With a Door', 'Bring a Flower and a Sprout for a hollow that never closes behind you.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They lift where the light lands. Start where it’s safe.',
          returnLine: 'Set them in, away from them. Watch them lift.',
          resolutionLine: 'It grew, safe from them. They shifted, and more of the grove is ours.',
        },
      ],
    },
    {
      level: 3,
      title: 'An Enthusiastic Thicket',
      conversationId: 'mossprout:island:fernip:enthusiastic-thicket',
      // Three Plants (two on the board, one from the Seeds), a misted Plant and a misted Flower: the thicket climbs
      // to a Rare Flower and stops. The request's Rare Flower is its twin; its Boot frees the misted way through.
      restoration: {
        rows: 4, merges: 8,
        items: [
          { cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' },
          { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' },
          { cell: 29, definitionId: 'nature:garden:3' }, { cell: 33, definitionId: 'nature:garden:3' },
        ],
        echoes: [
          { id: 'fernip-3-flower', cell: 24, definitionId: 'nature:garden:4' },
          { id: 'fernip-3-plant', cell: 36, definitionId: 'nature:garden:3' },
          { id: 'fernip-3-boot', cell: 38, definitionId: 'adventure:trail:3' },
        ],
        deliveryCells: [31, 37, 39],
      },
      callbackLine: {
        unhurried: 'That patch held. So they moved to the ground between.',
        playful: 'That patch held. So they moved to the ground between.',
        sheltered: 'The safe patch held. So they moved to the ground between.',
      },
      prompt: 'They’re holding the stretch between what we’ve won and what’s left. Four Mistwisps, spread along it, heavier than before.\n\nWe make a way through today. How?',
      fallbackOrder: order('The Tangle', 'Make a Rare Flower and a Boot: one bright thing for the thicket, and one way through it.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
      choices: [
        {
          id: 'letgo-slow', label: 'A little at a time', reply: 'One stretch at a time. They lift slowly, but they lift.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('The Untidied Thicket', 'Make a Rare Flower and a Boot for a thicket nobody will straighten, and a slow way through it.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They give it up one stretch at a time.',
          returnLine: 'Set them down. Watch them lift.',
          resolutionLine: 'The way through is open. They’ve nowhere left but the far end.',
        },
        {
          id: 'letgo-mess', label: 'Straight through', reply: 'Straight through. They won’t expect it.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Enthusiastic Thicket', 'Make a Rare Flower and a Boot for a thicket with far too much going on and one muddy path in.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Straight at them.',
          returnLine: 'Set them down, right in among them. Watch them lift.',
          resolutionLine: 'Straight through, and they scattered. They’ve nowhere left but the far end.',
        },
        {
          id: 'letgo-someone', label: 'Along the edge, where it’s sheltered', reply: 'Along the edge. Out of their reach the whole way.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('The Reassuring Thicket', 'Make a Rare Flower and a Boot for a thicket that says it is fine to stop, and fine to walk on.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Keep to the edge. They give it up one stretch at a time.',
          returnLine: 'Set them down along the edge. Watch them lift.',
          resolutionLine: 'The way through is open, sheltered the whole way. They’ve nowhere left but the far end.',
        },
      ],
    },
    {
      level: 4,
      title: 'Room to Be Yourself',
      conversationId: 'mossprout:island:fernip:room-to-be',
      // The last stretch: Seeds, a Plant and two Flowers climb through a misted Flower to a Rare Flower, then through the
      // misted Rare Flower to a Magical Plant, and stop. The request's Magical Plant is its twin; its Hiking Gear
      // frees the misted pair at the end of the trail.
      restoration: {
        rows: 4, merges: 9,
        items: [
          { cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' },
          { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' },
          { cell: 29, definitionId: 'nature:garden:3' }, { cell: 33, definitionId: 'nature:garden:4' }, { cell: 36, definitionId: 'nature:garden:4' },
        ],
        echoes: [
          { id: 'fernip-4-rare', cell: 24, definitionId: 'nature:garden:5' },
          { id: 'fernip-4-flower', cell: 31, definitionId: 'nature:garden:4' },
          { id: 'fernip-4-gear', cell: 38, definitionId: 'adventure:trail:4' },
        ],
        deliveryCells: [17, 37, 39],
      },
      callbackLine: {
        unhurried: 'The way through held. They’re cornered at the far end, all four.',
        playful: 'They never came back from the scatter. They’re cornered at the far end, all four.',
        sheltered: 'The way through held. They’re cornered at the far end, all four.',
      },
      prompt: 'Four of them at the far end, and nowhere left to go. Everything else is ours. Clear this, and there is nothing here left for them to sit on.\n\nLast plant. Which kind?',
      fallbackOrder: order('The Glowing Grove', 'Make a Magical Plant and Hiking Gear: the grove’s glowing finish, and the long lie-down after the trail.', 'major', 'comfort', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
      choices: [
        {
          id: 'remember-slow', label: 'The kind we started with', reply: 'The first kind again. It’s what started this.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('The Slow Glow', 'Make a Magical Plant and Hiking Gear for a grove that glows at its own pace and a trail walked at yours.', 'major', 'ease', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch. When they go this time, they go for good.',
          returnLine: 'Set it down. That’s the last of them.',
          resolutionLine: 'They’re gone. The whole grove is ours again. Now it can rest, and so can I.',
        },
        {
          id: 'remember-play', label: 'A kind this grove has never had', reply: 'Something new. Let them see what a grove does once they’re off it.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Ridiculous Grove', 'Make a Magical Plant and Hiking Gear for a grove that is delighted with itself and a trail that goes nowhere useful.', 'major', 'curiosity', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch. When they go this time, they go for good. Then we try something new.',
          returnLine: 'Set it down. That’s the last of them. Let’s see what it does.',
          resolutionLine: 'They’re gone. The whole grove is ours again, and something new growing in it. Now it can rest, and so can I.',
        },
        {
          id: 'remember-safe', label: 'The kind that grows in the shade', reply: 'One that likes the shade. It’ll be here long after them.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('A Grove That Lets You Stop', 'Make a Magical Plant and Hiking Gear for a place that never asks you to keep going, and a trail that ends in a lie-down.', 'major', 'comfort', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch. When they go this time, they go for good. Then it can grow in peace.',
          returnLine: 'Set it down in the shade. That’s the last of them.',
          resolutionLine: 'They’re gone. The whole grove is ours again, and something growing in the shade. Now it can rest, and so can I.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['unhurried', 'playful', 'sheltered'],
    finalChapterWeight: 1.25,
    insightKey: 'fernip:rest-style',
    category: 'Rest & unwinding',
    revealTitle: 'How you brought it back',
    closingLine: 'Whatever grows next, it grows here. I’ll be resting next to it.',
    insights: {
      unhurried: {
        id: 'slow-rester', title: 'The Slow Way', emblemId: 'fernip-rest-unhurried', matchOptionIds: [],
        reflection: 'One patch at a time, slowly, until the grove was whole.',
        summary: 'Slow and steady brought the grove back.',
      },
      playful: {
        id: 'playful-rester', title: 'The Bold Way', emblemId: 'fernip-rest-playful', matchOptionIds: [],
        reflection: 'Straight at them, every time. They never got used to it.',
        summary: 'Going straight at them brought the grove back.',
      },
      sheltered: {
        id: 'sheltered-rester', title: 'The Sheltered Way', emblemId: 'fernip-rest-sheltered', matchOptionIds: [],
        reflection: 'Out of their reach every time. It grew in peace.',
        summary: 'Growing out of their reach brought the grove back.',
      },
    },
    insightChoices: {
      unhurried: { label: 'We went slowly', reply: 'We did. One patch at a time.' },
      playful: { label: 'We went straight at them', reply: 'We did. They never got used to it.' },
      sheltered: { label: 'We stayed out of reach', reply: 'We did. It grew in peace.' },
    },
  },
  copy: {
    discoveryDialogue: 'Oh. Hello. You looked this way, and the Mist went thin. This is my grove. The Mistwisps have been sitting on it for years. Help me lift them off, a patch at a time?',
    discoveryActionLabel: 'Talk with Fernip',
    revealReactionLine: 'The Mist drifts off a tangled grove. Something under it stretches.',
    mistNextName: 'A tangled grove',
    mistDescription: 'Someone’s resting under there. Something heavier is resting on them.',
    returnNoteTitle: 'Meet me at Wildgrowth Grove',
    returnNoteHint: 'Return to Fernip’s grove for the next scene',
    actionLabels: {
      start_story: 'Plan with Fernip',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Fernip',
      continue_restoring: 'Back to the ferns',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the grove should grow.',
      orders_active: 'Requested in Merge',
      board_open: 'Driving off the Mist',
      delivery_requested: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Grove story complete',
    },
    speech: {
      available: ({ coins, cost }) => cost <= 0
        ? 'The next patch is under them. No hurry.'
        : coins >= cost
          ? 'The next patch is under them. Whenever you feel like it.'
          : `${coins} of ${cost} Glow so far. The grove is in no rush.`,
      delivery_requested: () => 'This patch is done. What we need next is on your board.',
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'This first stretch is mine to give. No hurry.'
        : coins >= cost
          ? 'We have enough. Whenever you feel like it.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The grove is in no rush.`
            : 'Nearly there. The grove can wait a little longer.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is gathered. Set it down and the Mist will move.`,
    fallbackResolution: (level) => level === 4
      ? 'The whole grove is ours again, and the Mist has nothing left to hold. Now it can rest, and so can I.'
      : 'The grove grew a little wilder, and a little more like home.',
    wakeHandoffLine: 'I was resting under a grove nobody could see. Then you looked. Past here there’s a nursery, still under the Mist. Someone’s in there, counting seeds.',
    sleepingHint: 'Someone is resting under the ferns, and the Mist is resting on them. They will wake once the friend before them is home.',
    wispLines: {
      firstStrike: 'It felt that. Good.',
      fell: ['One gone. The grove noticed.', 'Another gone. No hurry.', 'One left, and it looks tired.'],
      last: 'The last one goes. Look what was resting under it.',
    },
  },
};
