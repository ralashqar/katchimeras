import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export type AmberleafSeasonStyle = 'keeping' | 'letting-go' | 'sharing';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/** Amberleaf: an autumn keeper who saves proof that things changed. The arc is about how you hold change. */
export const AMBERLEAF_ORCHARD_CAMPAIGN: IslandCampaignDefinition<AmberleafSeasonStyle> = {
  campaignId: 'island-campaign:amberleaf-orchard',
  islandId: 'orchard-grove',
  residentSkinId: 'amberleaf',
  residentName: 'Amberleaf',
  chapterIdPrefix: 'amberleaf-orchard',
  tags: ['island-campaign', 'amberleaf', 'orchard-grove'],
  chapters: [
    {
      level: 1,
      title: 'Below Watering-Can Height',
      conversationId: 'mossprout:island:amberleaf:watering-can-height',
      prompt: 'There is one sapling here, smaller than my watering can. I have pressed a leaf from every season it survived. That is three leaves. I would like there to be more.\n\nWhen something in your life is changing, what do you tend to hold on to?',
      fallbackOrder: order('The Sheltered Sapling', 'Make one Flower to shelter the smallest tree in the orchard.', 'small', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
      choices: [
        {
          id: 'hold-keep', label: 'A small keepsake of before', reply: 'A keepsake. I have a whole box. Some of them are just leaves. All of them are proof.',
          style: 'keeping', wispAffinity: { heartlet: 2 },
          order: order('A Flower to Press', 'Make one Flower worth keeping a petal from.', 'small', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Then the first thing we grow here will be worth pressing. Merge can help us find it.',
          returnLine: 'One flower, and a petal already in my box. Let me shelter the sapling myself—the first season is my gift.',
          resolutionLine: 'The sapling has four leaves in my box now. It is still small. It is also still here.',
        },
        {
          id: 'hold-nothing', label: 'As little as I can', reply: 'Travel light. The sapling drops every leaf each autumn and comes back anyway.',
          style: 'letting-go', wispAffinity: { breeze: 2 },
          order: order('A Flower for the Wind', 'Make one Flower that does not mind losing its petals.', 'small', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'We begin with one flower and no promise to keep it. Let’s grow it in Merge.',
          returnLine: 'One flower, already shedding a petal. Let me shelter the sapling for you—the first season is my gift.',
          resolutionLine: 'The flower lost its petals and the sapling gained a season. Nothing was kept, and nothing was lost.',
        },
        {
          id: 'hold-people', label: 'The people around me', reply: 'People. Yes. A sapling does better with neighbours, and so, I suspect, do you.',
          style: 'sharing', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('A Flower for a Neighbour', 'Make one Flower to keep the sapling company.', 'small', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'The sapling gets a neighbour before anything else. Merge first.',
          returnLine: 'One flower, planted close enough to lean on. Let me shelter them both—my gift.',
          resolutionLine: 'We can sit nearby while it takes its time. That is what the flower is doing. That is what I am doing.',
        },
      ],
    },
    {
      level: 2,
      title: 'Counting Very Generously',
      conversationId: 'mossprout:island:amberleaf:counting-generously',
      callbackLine: {
        keeping: 'You keep small things from before. I pressed the first petal you gave me. It is on the top of the box.',
        'letting-go': 'You hold on to as little as you can. I let one leaf blow away on purpose. It was harder than it sounds.',
        sharing: 'You hold on to people. The sapling has three neighbours now, and I count you as one of them.',
      },
      prompt: 'There are berries on the little bush. Six. Enough to share, if we count very generously, which I am prepared to do.\n\nWhen something good is small, how do you keep it from feeling like not enough?',
      fallbackOrder: order('The Berry Bush', 'Make a Rare Flower and a Pressed Leaf for the bush’s first small harvest.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:2', quantity: 1 }]),
      choices: [
        {
          id: 'small-record', label: 'I write it down', reply: 'Six berries, written down, is six berries forever. That is the maths of keepsakes.',
          style: 'keeping', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Harvest Worth Noting', 'Make a Rare Flower and a Pressed Leaf so the first six berries get remembered.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:2', quantity: 1 }]),
          openingConclusion: 'Then the bush gets a leaf pressed beside it and a note in the box. Let’s grow the pieces.',
          returnLine: 'A rare flower and a pressed leaf, both labelled “six berries”. The bush can grow whenever you are ready.',
          resolutionLine: 'The bush has a page in the box now. Six berries, then nine, then a number I stopped writing because I was eating them.',
        },
        {
          id: 'small-enough', label: 'I decide it’s enough', reply: 'Enough is a decision. Six berries agreed to it immediately.',
          style: 'letting-go', wispAffinity: { breeze: 2, giggle: 1 },
          order: order('An Enough-Sized Harvest', 'Make a Rare Flower and a Pressed Leaf for a bush that is already enough.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:2', quantity: 1 }]),
          openingConclusion: 'We give the bush a few leafy neighbours and stop counting. Merge can help.',
          returnLine: 'A rare flower and a pressed leaf. I have decided that is enough, and so it is. Whenever the Glow comes.',
          resolutionLine: 'I stopped counting the berries. There are more now, but that is not why it feels like enough.',
        },
        {
          id: 'small-share', label: 'I share it anyway', reply: 'Share six berries and you have a picnic. Keep six berries and you have six berries.',
          style: 'sharing', wispAffinity: { heartlet: 2 },
          order: order('A Harvest to Split', 'Make a Rare Flower and a Pressed Leaf for a bush whose berries are meant for two.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:keepsake:2', quantity: 1 }]),
          openingConclusion: 'We grow the bush its neighbours and split whatever it gives us. Merge first.',
          returnLine: 'A rare flower and a pressed leaf, and three berries each. The bush is ready when you are.',
          resolutionLine: 'The basket is small. The invitation is not. Three berries each was a feast.',
        },
      ],
    },
    {
      level: 3,
      title: 'A Basket for the Baskets',
      conversationId: 'mossprout:island:amberleaf:basket-for-baskets',
      callbackLine: {
        keeping: 'You wrote the six berries down. I read the page when the branches feel too heavy.',
        'letting-go': 'You decided six was enough. I have been practising the word. Enough. It gets easier.',
        sharing: 'You split the berries. The bush noticed, and made more.',
      },
      prompt: 'The branches are heavy now and I panicked and brought baskets. Then a basket for the baskets. Then I sat under the tree, surrounded by baskets, and realised I had not picked a single thing because I was so busy preparing to keep it all.\n\nWhen there is more than you can hold, what helps you choose?',
      fallbackOrder: order('The Harvest Shelf', 'Make a Memory Sprig and a Rare Flower for a proper place to bring the harvest.', 'medium', 'ease', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:garden:5', quantity: 1 }]),
      choices: [
        {
          id: 'choose-keep-one', label: 'I keep one perfect thing', reply: 'One perfect thing. One apple, pressed—no, that does not work. One leaf from the best branch.',
          style: 'keeping', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('One Leaf From the Best Branch', 'Make a Memory Sprig and a Rare Flower so one perfect thing gets kept.', 'medium', 'comfort', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:garden:5', quantity: 1 }]),
          openingConclusion: 'We build the shelf for one perfect keepsake and let the rest be harvest. Let’s make the pieces.',
          returnLine: 'A memory sprig and a rare flower, and one leaf chosen out of all of them. The shelf can go up whenever you are ready.',
          resolutionLine: 'I kept one leaf and ate the rest of the harvest. The leaf is enough to remember all of it by.',
        },
        {
          id: 'choose-let-fall', label: 'I let the rest fall', reply: 'Let it fall. Windfalls feed the roots. Nothing wasted, just not held.',
          style: 'letting-go', wispAffinity: { breeze: 2 },
          order: order('A Shelf With Empty Space', 'Make a Memory Sprig and a Rare Flower for a shelf that does not try to hold everything.', 'medium', 'ease', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:garden:5', quantity: 1 }]),
          openingConclusion: 'We build a small shelf on purpose and let the orchard keep the rest. Merge first.',
          returnLine: 'A memory sprig and a rare flower, and a shelf with room left over. It can go up when the Glow comes.',
          resolutionLine: 'Half the harvest fell and fed the roots. I put the baskets away. I kept one.',
        },
        {
          id: 'choose-give', label: 'I give most of it away', reply: 'Give it away. A basket for the baskets makes a great deal more sense as a gift.',
          style: 'sharing', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Shelf for Giving', 'Make a Memory Sprig and a Rare Flower for a shelf where the harvest waits to be shared.', 'medium', 'connection', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:garden:5', quantity: 1 }]),
          openingConclusion: 'We build the shelf as a giving-place. Let’s grow the pieces in Merge.',
          returnLine: 'A memory sprig and a rare flower, ready for a shelf that empties itself into other people. Whenever you are ready.',
          resolutionLine: 'There is enough here to save someone a little for later. Most of it went to someones. I kept the baskets.',
        },
      ],
    },
    {
      level: 4,
      title: 'A Picnic Roof',
      conversationId: 'mossprout:island:amberleaf:picnic-roof',
      callbackLine: {
        keeping: 'You kept one perfect thing. It is on the shelf, and I look at it more than the whole box.',
        'letting-go': 'You let the rest fall. The roots have never been fatter.',
        sharing: 'You gave most of it away. People keep coming back with empty baskets and full hands.',
      },
      prompt: 'The trees have made us a whole picnic roof. I want to leave a space under it for anyone arriving late, and I want to keep a leaf from this exact afternoon, and I am not sure the two wishes fit in one box.\n\nWhat would you want to remember about change, from here on?',
      fallbackOrder: order('The Orchard in Full', 'Make a Field Journal and a Magical Plant to fill the grove with blossom and fruit.', 'major', 'comfort', [{ definitionId: 'nature:keepsake:4', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
      choices: [
        {
          id: 'remember-proof', label: 'Keeping proof that it changed', reply: 'Proof it changed. Every garden should. Every person too, probably.',
          style: 'keeping', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('The Season Journal', 'Make a Field Journal and a Magical Plant so this afternoon gets a page.', 'major', 'comfort', [{ definitionId: 'nature:keepsake:4', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish with a journal for the whole orchard and one last plant. Let’s make them.',
          returnLine: 'A field journal and a magical plant. The afternoon has its page. When the Glow comes, the orchard can bloom.',
          resolutionLine: 'Three pressed leaves became a whole journal. I kept proof of every season, and the orchard kept growing anyway.',
        },
        {
          id: 'remember-seasons', label: 'Seasons end so others can start', reply: 'They end. That is not the sad part. That is the part that makes the next one.',
          style: 'letting-go', wispAffinity: { breeze: 2, bloom: 1 },
          order: order('The Turning Orchard', 'Make a Field Journal and a Magical Plant for a grove that lets every season go.', 'major', 'ease', [{ definitionId: 'nature:keepsake:4', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'One last season, then we let it turn. Merge can grow the pieces.',
          returnLine: 'The journal and the plant are ready. The orchard is only waiting on us now.',
          resolutionLine: 'Autumn came and I did not try to stop it. The orchard is bare and beautiful and next spring is already in the roots.',
        },
        {
          id: 'remember-room', label: 'Leaving room for who’s coming', reply: 'Room for who is coming. Under the picnic roof, there is always one more place.',
          style: 'sharing', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('The Open Picnic', 'Make a Field Journal and a Magical Plant for a grove with a place kept for latecomers.', 'major', 'connection', [{ definitionId: 'nature:keepsake:4', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish by setting one more place at the picnic. Merge first.',
          returnLine: 'Everything is here except the last of the Glow. When it comes, the orchard will have room for everyone.',
          resolutionLine: 'I will stay for another season. Or several. There is a space under the roof for anyone arriving late, and one for you.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['keeping', 'letting-go', 'sharing'],
    finalChapterWeight: 1.25,
    insightKey: 'amberleaf:season-style',
    category: 'Change & seasons',
    revealTitle: 'Your way with change right now',
    closingLine: 'The orchard will turn again. I will press one leaf, and leave the rest to the roots.',
    insights: {
      keeping: {
        id: 'season-keeper', title: 'A Season Keeper', emblemId: 'amberleaf-season-keeping', matchOptionIds: [],
        reflection: 'You tend to move through change by keeping small proof of what came before, and a keepsake lets you let the rest go.',
        summary: 'Keeping one small proof of before helps me move on.',
      },
      'letting-go': {
        id: 'season-turner', title: 'A Season Turner', emblemId: 'amberleaf-season-letting-go', matchOptionIds: [],
        reflection: 'You tend to move through change by travelling light and deciding what is enough, trusting the next season to come.',
        summary: 'Letting seasons end is how I make room for the next.',
      },
      sharing: {
        id: 'harvest-sharer', title: 'A Harvest Sharer', emblemId: 'amberleaf-season-sharing', matchOptionIds: [],
        reflection: 'You tend to move through change by sharing what you have and keeping a place for the people around you.',
        summary: 'Sharing what I have is how I get through change.',
      },
    },
    insightChoices: {
      keeping: { label: 'We kept proof of every season', reply: 'We did. A whole journal of small, pressed befores.' },
      'letting-go': { label: 'We let the seasons turn', reply: 'We did. And every one of them came back a little fuller.' },
      sharing: { label: 'We kept a place for everyone', reply: 'We did. The picnic roof has never had an empty spot for long.' },
    },
  },
  copy: {
    discoveryDialogue: 'I have been keeping a leaf from every season this orchard survived. There are three. The mist took the rest of the years. Would you help me give it a fourth season worth pressing?',
    discoveryActionLabel: 'Talk with Amberleaf',
    revealReactionLine: 'The mist lifts from an orchard with a single small sapling.',
    mistNextName: 'A sleeping orchard',
    mistDescription: 'Beyond this mist, someone has been counting seasons. Clear it and see what they kept.',
    returnNoteTitle: 'Meet me at Orchard Grove',
    returnNoteHint: 'Return to Amberleaf’s orchard for the next scene',
    actionLabels: {
      start_story: 'Plan with Amberleaf',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Amberleaf',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the orchard should grow.',
      orders_active: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Orchard story complete',
    },
    speech: {
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'The first season is my gift. I will press a leaf from it.'
        : coins >= cost
          ? 'We have enough. This season can turn whenever you like.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. Seasons are not hurried, and neither is this.`
            : 'Nearly there. I have the journal open already.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is in the basket. The orchard can grow whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'The orchard has a picnic roof and a journal full of seasons. I am staying.'
      : 'The orchard turned one more season, and I pressed a leaf from it.',
    wakeHandoffLine: 'Beneath the old tree there is a friend who hides in the mist. Look slowly; they are shy.',
    sleepingHint: 'Someone is resting under the sapling. They will wake once the friend before them is home.',
  },
};
