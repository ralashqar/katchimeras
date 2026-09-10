import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export type FernipRestStyle = 'unhurried' | 'playful' | 'sheltered';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/** Fernip: a quiet woodland friend who rests in tangled places. The arc is about how you unwind. */
export const FERNIP_WILDGROWTH_CAMPAIGN: IslandCampaignDefinition<FernipRestStyle> = {
  campaignId: 'island-campaign:fernip-wildgrowth',
  islandId: 'wildgrowth-grove',
  residentSkinId: 'fernip',
  residentName: 'Fernip',
  chapterIdPrefix: 'fernip-wildgrowth',
  tags: ['island-campaign', 'fernip', 'wildgrowth-grove'],
  chapters: [
    {
      level: 1,
      title: 'Somewhere Soft to Spread',
      conversationId: 'mossprout:island:fernip:soft-spread',
      prompt: 'The moss here wandered outside its patch years ago and never went back. I found it by lying down in it, which is my preferred way of finding most things.\n\nWhen you finally stop for the day, what do you reach for first?',
      fallbackOrder: order('A Soft Patch', 'Make one Plant so the moss has somewhere soft to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
      choices: [
        {
          id: 'rest-slow', label: 'Nothing, for a while', reply: 'A proper nothing. Most people rush past that part.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('A Patch for Doing Nothing', 'Make one Plant so the moss has somewhere unhurried to spread.', 'small', 'ease', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'Then we begin with one plant and no plan for it. Let’s make it in Merge.',
          returnLine: 'One plant, and nowhere it needs to be. I will wake the moss myself—the first stretch is my gift.',
          resolutionLine: 'It spread exactly as far as it felt like. That is the only pace the moss knows, and it seems to work.',
        },
        {
          id: 'rest-play', label: 'Something small and silly', reply: 'Silly is wildly underrated. The mushrooms agree.',
          style: 'playful', wispAffinity: { giggle: 2 },
          order: order('A Patch That Tickles', 'Make one Plant for a patch of moss that has no idea where its edges are.', 'small', 'curiosity', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'One plant, planted slightly wrong on purpose. Let’s go and make it.',
          returnLine: 'It leans. I love it. Let me wake the moss around it—this first bit is my gift.',
          resolutionLine: 'The moss went sideways to see what the plant was doing. Now they are both sideways. Excellent.',
        },
        {
          id: 'rest-shelter', label: 'A quiet corner of my own', reply: 'A corner. Yes. Somewhere the day cannot follow you in.',
          style: 'sheltered', wispAffinity: { sprout: 2 },
          order: order('A Corner Under the Ferns', 'Make one Plant to shade a small corner where the moss can rest.', 'small', 'comfort', [{ definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'We will make one sheltered corner before anything else. Merge can help us grow it.',
          returnLine: 'Shade, and a place to put it. I will do the first stretch of moss—it is my gift to you.',
          resolutionLine: 'The corner is dim and soft and nobody can see into it. I have already been in it twice.',
        },
      ],
    },
    {
      level: 2,
      title: 'Neighbours at Ankle Height',
      conversationId: 'mossprout:island:fernip:ankle-neighbours',
      callbackLine: {
        unhurried: 'You said nothing, for a while. I tried it. The moss grew an inch while I was not looking.',
        playful: 'You chose silly. The leaning plant now has a leaning friend.',
        sheltered: 'You wanted a corner of your own. I have been guarding it, in case you need it.',
      },
      prompt: 'There are mushrooms under the old log. They are very quiet neighbours and I have been trying not to be too loud near them. It turns out I am not sure how to be near anyone quietly.\n\nWhen you rest with someone else, what helps it feel restful?',
      fallbackOrder: order('The Log Hollow', 'Bring a Flower and a Sprout to make the hollow cosier for its quiet neighbours.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'near-silence', label: 'Not needing to talk', reply: 'Company without conversation. The mushrooms will be thrilled.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('A Quiet Hollow', 'Bring a Flower and a Sprout for a hollow where nobody has to say anything.', 'medium', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Then we make the hollow soft enough that silence feels like a choice, not a gap.',
          returnLine: 'A flower and a sprout, and not a word between them. The hollow is ready whenever you are.',
          resolutionLine: 'We sat with the mushrooms for a whole afternoon and nobody explained anything. It was perfect.',
        },
        {
          id: 'near-games', label: 'A little game to share', reply: 'A game! I know one where you count mushrooms and lose track on purpose.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Counting Hollow', 'Bring a Flower and a Sprout for a hollow with something small to play at.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will give the hollow a little something to play at. Merge can grow the pieces.',
          returnLine: 'Everything for the counting game is here. The hollow can open when the garden is ready.',
          resolutionLine: 'We counted to eleven mushrooms and then started again from a different eleven. Rest does not have to be still.',
        },
        {
          id: 'near-safe', label: 'Knowing I can leave', reply: 'A door that stays open. That is the whole secret of a good hollow.',
          style: 'sheltered', wispAffinity: { heartlet: 2 },
          order: order('A Hollow With a Door', 'Bring a Flower and a Sprout for a hollow that never closes behind you.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will build the hollow with a way out that is always visible. Let’s grow it in Merge.',
          returnLine: 'A flower by the door and a sprout by the exit. The hollow is ready when you are.',
          resolutionLine: 'Nobody had to leave, but everybody could. That is why they all stayed.',
        },
      ],
    },
    {
      level: 3,
      title: 'An Enthusiastic Thicket',
      conversationId: 'mossprout:island:fernip:enthusiastic-thicket',
      callbackLine: {
        unhurried: 'You said company without talking. The mushrooms have adopted the idea entirely.',
        playful: 'You taught the hollow a game. It has been losing count ever since.',
        sheltered: 'You asked for a door that stays open. I check it every evening. Still open.',
      },
      prompt: 'I spent three days tidying the ferns into neat rows so the grove would look restful. It looked like a waiting room. The vines undid all of it overnight and honestly they were right.\n\nWhen rest starts to feel like another job, what helps you let go?',
      fallbackOrder: order('The Tangle', 'Make a Rare Flower and a Tidepool for a thicket that grows however it likes.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }]),
      choices: [
        {
          id: 'letgo-slow', label: 'Doing less on purpose', reply: 'Less. The ferns have been trying to tell me that with their whole bodies.',
          style: 'unhurried', wispAffinity: { breeze: 2 },
          order: order('The Untidied Thicket', 'Make a Rare Flower and a Tidepool for a thicket nobody will straighten.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'We will grow two things and then keep our hands in our pockets. Merge first.',
          returnLine: 'A rare flower and a tidepool, and I have not touched either of them. The thicket can grow when you are ready.',
          resolutionLine: 'I did less, and the grove did more. I am beginning to suspect that was always the arrangement.',
        },
        {
          id: 'letgo-mess', label: 'Letting it be messy', reply: 'Messy! I prefer “enthusiastic”, but yes. Absolutely yes.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Enthusiastic Thicket', 'Make a Rare Flower and a Tidepool for a thicket with far too much going on.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'Then we make it gloriously overgrown. Let’s find the pieces in Merge.',
          returnLine: 'A rare flower and a tidepool, both slightly out of control. The thicket will grow when the garden is ready.',
          resolutionLine: 'It is a mess. It is the most restful place I have ever been. Both things are true.',
        },
        {
          id: 'letgo-someone', label: 'Someone telling me it’s fine', reply: 'Then hear it from a fern: it is fine. It was always fine.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('The Reassuring Thicket', 'Make a Rare Flower and a Tidepool for a thicket that says it is fine to stop.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'We will grow a thicket that says it out loud. Merge can help us start.',
          returnLine: 'Everything is here, and it is fine. Actually fine. The thicket can grow whenever you like.',
          resolutionLine: 'Every time I doubted it, the grove said it was fine. Eventually I believed the grove.',
        },
      ],
    },
    {
      level: 4,
      title: 'Room to Be Yourself',
      conversationId: 'mossprout:island:fernip:room-to-be',
      callbackLine: {
        unhurried: 'You did less on purpose. So did I. The grove has never looked better.',
        playful: 'You let it be messy. The mushrooms are glowing about it. Literally.',
        sheltered: 'You wanted someone to say it was fine. I have been practising. It is fine.',
      },
      prompt: 'Even the mushrooms are glowing now. I think they heard there was room here to be themselves. I never planned for glowing mushrooms; I just stopped telling things what to be.\n\nWhat would you want to remember about rest, from here on?',
      fallbackOrder: order('The Glowing Grove', 'Make a Memory Bloom and a Magical Plant so the whole wild corner can shine.', 'major', 'comfort', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
      choices: [
        {
          id: 'remember-slow', label: 'Rest is allowed to be slow', reply: 'Slow enough to notice the glowing. That is the whole point of it.',
          style: 'unhurried', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('The Slow Glow', 'Make a Memory Bloom and a Magical Plant for a grove that glows at its own pace.', 'major', 'ease', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish slowly, then. One bloom, one plant, all the time they need.',
          returnLine: 'A memory bloom and a magical plant, gathered without hurry. When the Glow comes, the grove can shine.',
          resolutionLine: 'The grove did not light up all at once. It glowed a little more each time we let it rest. So did I.',
        },
        {
          id: 'remember-play', label: 'Rest can be a bit ridiculous', reply: 'Glowing mushrooms are extremely ridiculous. I would not change one of them.',
          style: 'playful', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Ridiculous Grove', 'Make a Memory Bloom and a Magical Plant for a grove that is delighted with itself.', 'major', 'curiosity', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'One last silly, glorious task. Let’s make the pieces in Merge.',
          returnLine: 'The pieces are here and one of them is already glowing. The grove is only waiting on us.',
          resolutionLine: 'It is absurd and it is home. I promise absolutely no tidying, ever.',
        },
        {
          id: 'remember-safe', label: 'I am allowed to stop', reply: 'Allowed. Not earned, not excused—allowed. Say it with the ferns.',
          style: 'sheltered', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('A Grove That Lets You Stop', 'Make a Memory Bloom and a Magical Plant for a place that never asks you to keep going.', 'major', 'comfort', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish by building somewhere it is safe to stop. Merge can grow the last pieces.',
          returnLine: 'Everything is here except the last of the Glow. When it comes, the grove can finally shine.',
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
    discoveryDialogue: 'Oh. Hello. I was resting under the ferns and the mist just… thinned. Everything here is tangled and I would like to keep it that way, but it needs a little help to be lived in.',
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
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the grove should grow.',
      orders_active: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Grove story complete',
    },
    speech: {
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'This first stretch is mine to give. No hurry.'
        : coins >= cost
          ? 'We have enough. Whenever you feel like it.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The ferns are in no rush.`
            : 'Nearly there. The grove can wait a little longer.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is gathered. The grove can grow whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'The whole wild corner is glowing. I did not tidy a single thing.'
      : 'The grove grew a little wilder, and a little more like home.',
    wakeHandoffLine: 'Resting is not the same as being forgotten. I had confused the two. Past the ferns there is a nursery where someone keeps counting seeds. I think they would like company.',
    sleepingHint: 'Someone is resting under the ferns. They will wake once the friend before them is home.',
  },
};
