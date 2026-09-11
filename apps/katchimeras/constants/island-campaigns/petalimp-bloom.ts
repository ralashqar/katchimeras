import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export const PETALIMP_ISLAND_CAMPAIGN_ID = 'island-campaign:petalimp-bloom';
export const PETALIMP_ISLAND_ID = 'bloom-garden' as const;

export type PetalimpGrowthStyle = 'gentle' | 'curious' | 'together';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

export const PETALIMP_BLOOM_CAMPAIGN: IslandCampaignDefinition<PetalimpGrowthStyle> = {
  campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
  islandId: PETALIMP_ISLAND_ID,
  residentSkinId: 'petalimp',
  residentName: 'Petalimp',
  chapterIdPrefix: 'petalimp-bloom',
  tags: ['island-campaign', 'petalimp', 'bloom-garden'],
  chapters: [
    {
      level: 1,
      title: 'One Small Beginning',
      conversationId: 'mossprout:island:petalimp:first-welcome',
      // Four Seeds become one Plant that frees the misted Plant; the Flower it becomes waits for the request's twin.
      restoration: {
        rows: 3, merges: 5,
        items: [{ cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' }, { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' }],
        echoes: [{ id: 'petalimp-1-plant', cell: 24, definitionId: 'nature:garden:3' }],
        deliveryCells: [17, 31, 19],
      },
      prompt: 'This was my garden. The Mistwisps have been feeding on it for years, and there is less of it every season. Three of them are on it now.\n\nOne flower is all we can manage today. How do we start?',
      fallbackOrder: order('The First Bloom', 'Make one Flower for the garden’s first small beginning.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
      choices: [
        {
          id: 'begin-small', label: 'Start small', reply: 'Small. It’ll take root before they notice.',
          style: 'gentle', wispAffinity: { sprout: 2 },
          order: order('One Brave Bloom', 'Make one Flower so the empty garden has somewhere gentle to begin.', 'small', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Every merge pushes them back a little.',
          returnLine: 'Set it down. The first thing to grow here in years. This first patch is my gift.',
          resolutionLine: 'It took. The first patch is ours again.',
        },
        {
          id: 'begin-playful', label: 'Start fast', reply: 'Fast. They won’t know what to do with it.',
          style: 'curious', wispAffinity: { giggle: 2 },
          order: order('A Curious Flower', 'Make one Flower for Petalimp’s first cheerful garden experiment.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Every merge pushes them back a little. Quickly, if you can.',
          returnLine: 'Set it down. It’ll be up before they’ve turned round. This first patch is my gift.',
          resolutionLine: 'It came up fast, and they moved off it. The first patch is ours again.',
        },
        {
          id: 'begin-together', label: 'Start together', reply: 'Together, then. It’s easier to keep looking when there are two of us.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('Our First Flower', 'Make one Flower for the place you and Petalimp are beginning together.', 'small', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Make light on the board, the two of us. Every merge pushes them back a little.',
          returnLine: 'Set it down, and I’ll tend it. This first patch is my gift to you.',
          resolutionLine: 'We planted it together, and it took. The first patch is ours again.',
        },
      ],
    },
    {
      level: 2,
      title: 'Colours That Belong',
      conversationId: 'mossprout:island:petalimp:colours-belong',
      // Two misted cells, a Sprout and a Plant: the local Sprouts can free either; the request's Flower and Sprout finish the rest.
      restoration: {
        rows: 3, merges: 6,
        items: [{ cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' }, { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' }],
        echoes: [{ id: 'petalimp-2-plant', cell: 24, definitionId: 'nature:garden:3' }, { id: 'petalimp-2-sprout', cell: 31, definitionId: 'nature:garden:2' }],
        deliveryCells: [17, 30, 19],
      },
      callbackLine: {
        gentle: 'The small one held. So they pulled back and dug in where the garden was thickest.',
        curious: 'The fast one held. So they pulled back and dug in where the garden was thickest.',
        together: 'Our flower held. So they pulled back and dug in where the garden was thickest.',
      },
      prompt: 'They’ve been feeding on the beds past the first patch. Everything there has faded. Three of them, sitting on what’s left.\n\nWe take one bed back today. Which?',
      fallbackOrder: order('Colours That Belong', 'Bring a Flower and a Sprout for the garden’s new colour beds.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'belong-familiar', label: 'The one nearest the first', reply: 'Next to the first. Let it spread from there.',
          style: 'gentle', wispAffinity: { breeze: 2 },
          order: order('A Familiar Corner', 'Bring a Flower and a Sprout to make one colour bed feel known and comforting.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They give ground where the light lands.',
          returnLine: 'Set them in. Watch them give ground.',
          resolutionLine: 'It spread. They pulled back, and more of the garden is ours.',
        },
        {
          id: 'belong-change', label: 'The one they’re guarding hardest', reply: 'Where they’re thickest. That’s where the most is being kept.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('Colours Without Rules', 'Bring a Flower and a Sprout for a colour bed with room to change.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They give ground where the light lands, thickest or not.',
          returnLine: 'Set them in where they’re thickest. Watch them give ground.',
          resolutionLine: 'It came back stronger than it was. They pulled back, and more of the garden is ours.',
        },
        {
          id: 'belong-shared', label: 'The one you point to', reply: 'Your pick. A guest chooses. This was a Welcome Garden, once.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('A Bed to Share', 'Bring a Flower and a Sprout for a colour bed that welcomes company.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They give ground where the light lands. Your bed first.',
          returnLine: 'Set them in your bed. Watch them give ground.',
          resolutionLine: 'Your bed took. They pulled back, and more of the garden is ours.',
        },
      ],
    },
    {
      level: 3,
      title: 'A Path at Your Pace',
      conversationId: 'mossprout:island:petalimp:wandering-walk',
      // The path: local pieces free the misted Flower and stop at a Rare Flower; the request's Rare Flower and Shoe finish the walk.
      // Every request only asks for what the Main Board can make by now: Seeds from the Garden Basket
      // (its waterside branch waits for Shellio) and the Journey Locker's founding trail chain (its travel branch
      // waits for a later friend too; the engine would reroute a Travel Journal onto a Boot, so the board never asks for one).
      restoration: {
        rows: 4, merges: 7,
        items: [
          { cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' },
          { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' },
          { cell: 29, definitionId: 'nature:garden:3' },
        ],
        echoes: [{ id: 'petalimp-3-flower', cell: 24, definitionId: 'nature:garden:4' }, { id: 'petalimp-3-shoe', cell: 38, definitionId: 'adventure:trail:2' }],
        deliveryCells: [31, 37, 39],
      },
      callbackLine: {
        gentle: 'That bed held. So they moved to the ground between.',
        curious: 'That bed held. So they moved to the ground between.',
        together: 'Your bed held. So they moved to the ground between.',
      },
      prompt: 'They’re holding the stretch between what we’ve won and what’s left. Four Mistwisps, spread along it.\n\nWe make a way through today. How?',
      fallbackOrder: order('The Wandering Walk', 'Make a Rare Flower and a Shoe for the garden path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:2', quantity: 1 }]),
      choices: [
        {
          id: 'pace-next-step', label: 'A little at a time', reply: 'One stretch at a time. They give ground slowly, but they give it.',
          style: 'gentle', wispAffinity: { sprout: 2 },
          order: order('The Next Stepping Stone', 'Make a Rare Flower and a Shoe to mark one clear turn in the path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. They give it up one stretch at a time.',
          returnLine: 'Set them down. Watch them give ground.',
          resolutionLine: 'The way through is open. They’ve nowhere left but the far end.',
        },
        {
          id: 'pace-pause', label: 'Straight through', reply: 'Straight through. They won’t expect that.',
          style: 'curious', wispAffinity: { breeze: 2 },
          order: order('A Place Along the Way', 'Make a Rare Flower and a Shoe for a restful turn in the garden path.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board. Straight at them.',
          returnLine: 'Set them down, right in among them. Watch them give ground.',
          resolutionLine: 'Straight through, and they scattered. They’ve nowhere left but the far end.',
        },
        {
          id: 'pace-together', label: 'Side by side', reply: 'Side by side. Twice the light.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('The Side-by-Side Walk', 'Make a Rare Flower and a Shoe for a path meant to be shared.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'adventure:trail:2', quantity: 1 }]),
          openingConclusion: 'Make light on the board, the two of us. They give it up one stretch at a time.',
          returnLine: 'Set them down together. Watch them give ground.',
          resolutionLine: 'The way through is open, side by side. They’ve nowhere left but the far end.',
        },
      ],
    },
    {
      level: 4,
      title: 'Room for Every Bloom',
      conversationId: 'mossprout:island:petalimp:every-bloom',
      // The last patch: the local pieces climb to a Magical Plant through the misted Rare Flower; the request's Magical Plant is its twin, its Boot frees the misted pair.
      restoration: {
        rows: 4, merges: 8,
        items: [
          { cell: 16, definitionId: 'nature:garden:1' }, { cell: 18, definitionId: 'nature:garden:1' },
          { cell: 22, definitionId: 'nature:garden:1' }, { cell: 26, definitionId: 'nature:garden:1' },
          { cell: 29, definitionId: 'nature:garden:3' }, { cell: 36, definitionId: 'nature:garden:4' },
        ],
        echoes: [{ id: 'petalimp-4-rare', cell: 24, definitionId: 'nature:garden:5' }, { id: 'petalimp-4-boot', cell: 38, definitionId: 'adventure:trail:3' }],
        deliveryCells: [31, 37, 39],
      },
      callbackLine: {
        gentle: 'The way through held. They’re cornered on the last patch, all four.',
        curious: 'They never came back from the scatter. They’re cornered on the last patch, all four.',
        together: 'The way through held. They’re cornered on the last patch, all four.',
      },
      prompt: 'Four of them on the last patch, and nowhere left to go. Everything else is ours. Clear this, and they have nothing here to feed on.\n\nLast flower. Which kind?',
      fallbackOrder: order('The Garden Remembers', 'Make a Magical Plant and a Boot for the garden’s final welcome.', 'major', 'comfort', [{ definitionId: 'adventure:trail:3', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
      choices: [
        {
          id: 'change-progress', label: 'The kind we started with', reply: 'The first kind again. It’s what started this.',
          style: 'gentle', wispAffinity: { sprout: 2, heartlet: 1 },
          order: order('Every Little Bloom', 'Make a Magical Plant and a Boot to celebrate every piece of progress.', 'major', 'ease', [{ definitionId: 'adventure:trail:3', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch. When they go this time, they go for good.',
          returnLine: 'Set it down. That’s the last of them.',
          resolutionLine: 'They’re gone. The whole garden is ours again. It started with one small flower.',
        },
        {
          id: 'change-flexible', label: 'A kind this garden has never had', reply: 'Something new. Let them see what a garden does once they’re off it.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Beautiful Detour', 'Make a Magical Plant and a Boot for the garden’s unexpected ending.', 'major', 'curiosity', [{ definitionId: 'adventure:trail:3', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch. When they go this time, they go for good. Then we try something new.',
          returnLine: 'Set it down. That’s the last of them. Let’s see what it does.',
          resolutionLine: 'They’re gone. The whole garden is ours again, and something new growing in it.',
        },
        {
          id: 'change-help', label: 'The kind you’d choose', reply: 'Yours, then. It’s your garden as much as mine now.',
          style: 'together', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Garden We Share', 'Make a Magical Plant and a Boot for a welcome built together.', 'major', 'connection', [{ definitionId: 'adventure:trail:3', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'Make light on the last patch, the two of us. When they go this time, they go for good.',
          returnLine: 'Set it down together. That’s the last of them.',
          resolutionLine: 'They’re gone. The whole garden is ours again, and your flower growing in it.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['gentle', 'curious', 'together'],
    finalChapterWeight: 1.25,
    insightKey: 'petalimp:growth-style',
    category: 'Growth & change',
    revealTitle: 'How you brought it back',
    closingLine: 'Whatever grows next, it grows here. Come and see it.',
    insights: {
      gentle: {
        id: 'gentle-grower', title: 'The Small Way', emblemId: 'petalimp-growth-gentle', matchOptionIds: [],
        reflection: 'One small flower at a time, until the garden was whole.',
        summary: 'Small and steady brought the garden back.',
      },
      curious: {
        id: 'curious-cultivator', title: 'The New Way', emblemId: 'petalimp-growth-curious', matchOptionIds: [],
        reflection: 'Something new every time. They never caught up with it.',
        summary: 'Trying new things brought the garden back.',
      },
      together: {
        id: 'companion-gardener', title: 'The Together Way', emblemId: 'petalimp-growth-together', matchOptionIds: [],
        reflection: 'Two of us every time. The garden noticed.',
        summary: 'Doing it together brought the garden back.',
      },
    },
    insightChoices: {
      gentle: { label: 'We went small', reply: 'We did. One flower at a time.' },
      curious: { label: 'We tried new things', reply: 'We did. The garden has never looked like this.' },
      together: { label: 'We did it together', reply: 'We did. Every bed.' },
    },
  },
  copy: {
    discoveryDialogue: 'You looked this way, and the Mist let go of me. This was my garden. The Mistwisps have been feeding on it for years. Help me bring it back?',
    discoveryActionLabel: 'Talk with Petalimp',
    revealReactionLine: 'The Mist lifts from a bare garden. The beds are tidy. Someone kept tending it.',
    mistNextName: 'A forgotten garden',
    mistDescription: 'Something in there is still arranging flowers for nobody, and something else is making sure nobody looks.',
    returnNoteTitle: 'Meet me at Bloom Garden',
    returnNoteHint: 'Return to Petalimp’s island for the next scene',
    actionLabels: {
      start_story: 'Plan with Petalimp',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Petalimp',
      continue_restoring: 'Back to the Mist',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the garden should grow.',
      orders_active: 'Requested in Merge',
      board_open: 'Driving off the Mist',
      delivery_requested: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Garden story complete',
    },
    speech: {
      available: ({ coins, cost }) => cost <= 0
        ? 'I know just where to begin.'
        : coins >= cost
          ? 'I know just where to begin. Whenever you are ready.'
          : `${coins} of ${cost} Glow so far. The beds will keep until there is light enough.`,
      delivery_requested: () => 'This patch is spent. What we need next is on your board.',
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'Everything is ready. This one is my gift.'
        : coins >= cost
          ? 'We have what we need. Whenever you are ready.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The garden is patient.`
            : 'We are close now. A little more light and this part can grow.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is here. Set it down and the Mist has to let go.`,
    fallbackResolution: (level) => level === 4
      ? 'Every bloom found room. The Mist has nothing left here to keep.'
      : 'The garden remembered a little more, because we came back and looked at it.',
    wakeHandoffLine: 'I was tending a garden nobody could see. Then you looked. Past the beds, the Wildgrowth is still under the Mist. Someone’s resting in there.',
    sleepingHint: 'The Mist is keeping someone in this garden. They will wake once the friend before them is home.',
    wispLines: {
      firstStrike: 'Oh. It felt that.',
      fell: ['One gone. It was sitting on my beds.', 'Another gone. Look, the soil.', 'One left, and it knows.'],
      last: 'The last one goes. Look at the beds.',
    },
  },
};
