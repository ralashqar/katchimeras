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
      prompt: 'The moss here wandered outside its patch years ago and never went back. Then the mist came down over it, and the moss stopped, mid-wander. I found it by lying down in it, which is my preferred way of finding most things.\n\nWhen you finally stop for the day, what do you reach for first?',
      fallbackOrder: order('A Soft Patch', 'Make one Plant so the moss has somewhere soft to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
      choices: [
        {
          id: 'rest-slow', label: 'Nothing, for a while', reply: 'A proper nothing. Most people rush past that part.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('A Patch for Doing Nothing', 'Make one Plant so the moss has somewhere unhurried to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'Then we begin with one plant and no plan for it. The mist can come off this patch slowly.',
          returnLine: 'One plant, and nowhere it needs to be. Set it down and the mist will let go of the rest. This first stretch is my gift.',
          resolutionLine: 'The moss spread exactly as far as it felt like. That is the only pace it knows, and it seems to work.',
        },
        {
          id: 'rest-play', label: 'Something small and silly', reply: 'Silly is wildly underrated. The mushrooms agree.',
          style: 'playful', wispAffinity: { giggle: 2 },
          order: order('A Patch That Tickles', 'Make one Plant for a patch of moss that has no idea where its edges are.', 'small', 'curiosity', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'One plant, planted slightly wrong on purpose. Let’s clear it a patch to lean in.',
          returnLine: 'It leans. I love it. Put it in the mist and see what the moss makes of it. This first bit is my gift.',
          resolutionLine: 'The moss went sideways to see what the plant was doing. Now they are both sideways. Excellent.',
        },
        {
          id: 'rest-shelter', label: 'A quiet corner of my own', reply: 'A corner. Yes. Somewhere the day cannot follow you in.',
          style: 'sheltered', wispAffinity: { sprout: 2 },
          order: order('A Corner Under the Ferns', 'Make one Plant to shade a small corner where the moss can rest.', 'small', 'comfort', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'We will clear one sheltered corner before anything else. The mist can keep the rest for now.',
          returnLine: 'Shade, and a place to put it. Plant it and the mist will give the corner back. The first stretch is my gift to you.',
          resolutionLine: 'The corner is dim and soft and nobody can see into it. I have already been in it twice.',
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
        unhurried: 'You said nothing, for a while. I tried it. The moss grew an inch while I was not looking.',
        playful: 'You chose silly. The leaning plant now has a leaning friend.',
        sheltered: 'You wanted a corner of your own. I have been guarding it, in case you need it.',
      },
      prompt: 'There are mushrooms under the old log, half in the mist still. They are very quiet neighbours and I have been trying not to be too loud near them. It turns out I am not sure how to be near anyone quietly.\n\nWhen you rest with someone else, what helps it feel restful?',
      fallbackOrder: order('The Log Hollow', 'Bring a Flower and a Sprout to make the hollow cosier for its quiet neighbours.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'near-silence', label: 'Not needing to talk', reply: 'Company without conversation. The mushrooms will be thrilled.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('A Quiet Hollow', 'Bring a Flower and a Sprout for a hollow where nobody has to say anything.', 'medium', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Then we make the hollow soft enough that silence feels like a choice, not a gap. Let’s see how far the mist will move.',
          returnLine: 'A flower and a sprout, and not a word between them. Set them by the log and the mist will make room.',
          resolutionLine: 'We sat with the mushrooms for a whole afternoon and nobody explained anything. It was perfect.',
        },
        {
          id: 'near-games', label: 'A little game to share', reply: 'A game! I know one where you count mushrooms and lose track on purpose.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Counting Hollow', 'Bring a Flower and a Sprout for a hollow with something small to play at.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will give the hollow a little something to play at. The mist is hiding at least three mushrooms I have not counted.',
          returnLine: 'Everything for the counting game is here. Plant them by the log and the mist will lose count with us.',
          resolutionLine: 'We counted to eleven mushrooms and then started again from a different eleven. Rest does not have to be still.',
        },
        {
          id: 'near-safe', label: 'Knowing I can leave', reply: 'A door that stays open. That is the whole secret of a good hollow.',
          style: 'sheltered', wispAffinity: { heartlet: 2 },
          order: order('A Hollow With a Door', 'Bring a Flower and a Sprout for a hollow that never closes behind you.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will clear the hollow with a way out that is always visible. Let’s start where the mist is thinnest.',
          returnLine: 'A flower for the door and a sprout for the way out. Set them down and the mist will leave the door alone.',
          resolutionLine: 'Nobody had to leave, but everybody could. That is why they all stayed.',
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
        unhurried: 'You said company without talking. The mushrooms have adopted the idea entirely.',
        playful: 'You taught the hollow a game. It has been losing count ever since.',
        sheltered: 'You asked for a door that stays open. I check it every evening. Still open.',
      },
      prompt: 'I spent three days tidying the ferns into neat rows so the grove would look restful. It looked like a waiting room. The vines undid all of it overnight, and the mist came back over the mess as if to say: leave it. Honestly they were both right.\n\nWhen rest starts to feel like another job, what helps you let go?',
      fallbackOrder: order('The Tangle', 'Make a Rare Flower and a Boot: one bright thing for the thicket, and one way through it.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
      choices: [
        {
          id: 'letgo-slow', label: 'Doing less on purpose', reply: 'Less. The ferns have been trying to tell me that with their whole bodies.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('The Untidied Thicket', 'Make a Rare Flower and a Boot for a thicket nobody will straighten, and a slow way through it.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'We will grow two things and then keep our hands in our pockets. The mist can decide what stays tangled.',
          returnLine: 'A rare flower and a boot, and I have not touched either of them. Set them in the thicket and the mist will do the rest.',
          resolutionLine: 'I did less, and the grove did more. I am beginning to suspect that was always the arrangement.',
        },
        {
          id: 'letgo-mess', label: 'Letting it be messy', reply: 'Messy! I prefer “enthusiastic”, but yes. Absolutely yes.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Enthusiastic Thicket', 'Make a Rare Flower and a Boot for a thicket with far too much going on and one muddy path in.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'Then we make it gloriously overgrown. Let’s see what the mist has been hiding in there.',
          returnLine: 'A rare flower and a boot, both slightly out of control. Put them in and the mist will let the thicket have its way.',
          resolutionLine: 'It is a mess. It is the most restful place I have ever been. Both things are true.',
        },
        {
          id: 'letgo-someone', label: 'Someone telling me it’s fine', reply: 'Then hear it from a fern: it is fine. It was always fine.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('The Reassuring Thicket', 'Make a Rare Flower and a Boot for a thicket that says it is fine to stop, and fine to walk on.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:3', quantity: 1 }]),
          openingConclusion: 'We will grow a thicket that says it out loud. The mist only needs to hear it once.',
          returnLine: 'Everything is here, and it is fine. Actually fine. Set them down and the mist will believe it too.',
          resolutionLine: 'Every time I doubted it, the grove said it was fine. Eventually I believed the grove.',
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
        unhurried: 'You did less on purpose. So did I. The grove has never looked better.',
        playful: 'You let it be messy. The mushrooms are glowing about it. Literally.',
        sheltered: 'You wanted someone to say it was fine. I have been practising. It is fine.',
      },
      prompt: 'Even the mushrooms are glowing now, and the last of the mist glows back at them. I think they heard there was room here to be themselves. I never planned for glowing mushrooms; I just stopped telling things what to be.\n\nWhat would you want to remember about rest, from here on?',
      fallbackOrder: order('The Glowing Grove', 'Make a Magical Plant and Hiking Gear: the grove’s glowing finish, and the long lie-down after the trail.', 'major', 'comfort', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
      choices: [
        {
          id: 'remember-slow', label: 'Rest is allowed to be slow', reply: 'Slow enough to notice the glowing. That is the whole point of it.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('The Slow Glow', 'Make a Magical Plant and Hiking Gear for a grove that glows at its own pace and a trail walked at yours.', 'major', 'ease', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'We finish slowly, then. One plant, one pack, all the time they need. The last of the mist is in no hurry either.',
          returnLine: 'A magical plant and a pack for the trail, gathered without hurry. Set them down and the last of the mist can glow itself away.',
          resolutionLine: 'The grove did not light up all at once. It glowed a little more each time we let it rest. So did I.',
        },
        {
          id: 'remember-play', label: 'Rest can be a bit ridiculous', reply: 'Glowing mushrooms are extremely ridiculous. I would not change one of them.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Ridiculous Grove', 'Make a Magical Plant and Hiking Gear for a grove that is delighted with itself and a trail that goes nowhere useful.', 'major', 'curiosity', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'One last silly, glorious task. Let’s see what the mist has been giggling about.',
          returnLine: 'The pieces are here and one of them is already glowing. Put them in and the last of the mist can finish being ridiculous.',
          resolutionLine: 'It is absurd and it is home. I promise absolutely no tidying, ever.',
        },
        {
          id: 'remember-safe', label: 'I am allowed to stop', reply: 'Allowed. Not earned, not excused—allowed. Say it with the ferns.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('A Grove That Lets You Stop', 'Make a Magical Plant and Hiking Gear for a place that never asks you to keep going, and a trail that ends in a lie-down.', 'major', 'comfort', [{ definitionId: 'nature:garden:6', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }]),
          openingConclusion: 'We finish by clearing somewhere it is safe to stop. The mist has kept that corner for last.',
          returnLine: 'Everything is here. Set it down, and the last of the mist can let the grove be what it is.',
          resolutionLine: 'I stopped. Nothing fell apart. The grove glowed, and I stayed exactly where I was.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['unhurried', 'playful', 'sheltered'],
    finalChapterWeight: 1.25,
    insightKey: 'fernip:rest-style',
    category: 'Rest & unwinding',
    revealTitle: 'Your way of resting right now',
    closingLine: 'The grove will keep glowing whether we look or not. That is what rest is for.',
    insights: {
      unhurried: {
        id: 'slow-rester', title: 'A Slow Rester', emblemId: 'fernip-rest-unhurried', matchOptionIds: [],
        reflection: 'You tend to unwind by doing less and giving things time, and rest reaches you when you stop steering it.',
        summary: 'Doing less, on purpose, is how rest finds me.',
      },
      playful: {
        id: 'playful-rester', title: 'A Playful Rester', emblemId: 'fernip-rest-playful', matchOptionIds: [],
        reflection: 'You tend to unwind through small, silly, low-stakes things, and mess does not cost you your rest.',
        summary: 'Small, silly things are how I actually unwind.',
      },
      sheltered: {
        id: 'sheltered-rester', title: 'A Sheltered Rester', emblemId: 'fernip-rest-sheltered', matchOptionIds: [],
        reflection: 'You tend to unwind once you feel safe—a door that stays open, a corner of your own, someone saying it is fine.',
        summary: 'I rest best once I know I am allowed to stop.',
      },
    },
    insightChoices: {
      unhurried: { label: 'We did less, on purpose', reply: 'We did. The grove grew into the space we left it.' },
      playful: { label: 'We let it be a bit ridiculous', reply: 'We did. The mushrooms have never been happier.' },
      sheltered: { label: 'We made it safe to stop', reply: 'We did. The door is still open, and nobody has needed it.' },
    },
  },
  copy: {
    discoveryDialogue: 'Oh. Hello. I was resting under the ferns and the mist just… thinned. Everything here is tangled and I would like to keep it that way, but the mist has it all held down. Help me lift it, a patch at a time?',
    discoveryActionLabel: 'Talk with Fernip',
    revealReactionLine: 'The mist drifts off a tangled, sleeping grove.',
    mistNextName: 'A tangled grove',
    mistDescription: 'Someone in there is still resting, and has been for a very long time.',
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
      board_open: 'Clearing the mist',
      delivery_requested: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Grove story complete',
    },
    speech: {
      available: ({ coins, cost }) => cost <= 0
        ? 'The moss is under there somewhere. No hurry.'
        : coins >= cost
          ? 'The moss is under there somewhere. Whenever you feel like it.'
          : `${coins} of ${cost} Glow so far. The ferns are in no rush.`,
      delivery_requested: () => 'This patch has done all it is going to. What the mist still holds is waiting on your board.',
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'This first stretch is mine to give. No hurry.'
        : coins >= cost
          ? 'We have enough. Whenever you feel like it.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The ferns are in no rush.`
            : 'Nearly there. The grove can wait a little longer.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is gathered. Set it down and the mist will move.`,
    fallbackResolution: (level) => level === 4
      ? 'The whole wild corner is glowing. I did not tidy a single thing.'
      : 'The grove grew a little wilder, and a little more like home.',
    wakeHandoffLine: 'Resting is not the same as being forgotten. I had confused the two. Past the ferns there is a nursery where someone keeps counting seeds. I think they would like company.',
    sleepingHint: 'Someone is resting under the ferns. They will wake once the friend before them is home.',
  },
};
