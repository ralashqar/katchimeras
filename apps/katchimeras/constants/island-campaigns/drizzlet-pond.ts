import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export type DrizzletFeelingStyle = 'still' | 'flowing' | 'shared';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/** Drizzlet: a small rain-follower who carries weather with them. The arc is about how you hold feelings. */
export const DRIZZLET_POND_CAMPAIGN: IslandCampaignDefinition<DrizzletFeelingStyle> = {
  campaignId: 'island-campaign:drizzlet-pond',
  islandId: 'pond-sanctuary',
  residentSkinId: 'drizzlet',
  residentName: 'Drizzlet',
  chapterIdPrefix: 'drizzlet-pond',
  tags: ['island-campaign', 'drizzlet', 'pond-sanctuary'],
  chapters: [
    {
      level: 1,
      title: 'A Hollow for the Sky',
      conversationId: 'mossprout:island:drizzlet:hollow-for-sky',
      prompt: 'This hollow used to hold a little sky. Now it is dry, and I have been carrying my own rain around with nowhere to put it down.\n\nWhen a feeling arrives, what do you usually do with it first?',
      fallbackOrder: order('The Stone Pool', 'Make one Shell so the hollow can hold a little water again.', 'small', 'comfort', [{ definitionId: 'nature:waterside:2', quantity: 1 }]),
      choices: [
        {
          id: 'feel-sit', label: 'Sit with it a while', reply: 'Sit with it. Like a puddle that has not decided whether to be a pond yet.',
          style: 'still', wispAffinity: { breeze: 2 },
          order: order('A Pool for Sitting Beside', 'Make one Shell for a pool that does not need anything from you.', 'small', 'comfort', [{ definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'Then we make one small pool and simply sit beside it. Merge can find the shell.',
          returnLine: 'One shell, and a quiet place to put it. Let me fill the first pool—it is my gift.',
          resolutionLine: 'A cloud came to sit with us. Neither of us said anything. The pool did not mind.',
        },
        {
          id: 'feel-move', label: 'Let it move through me', reply: 'Let it move. Rain that stays still just turns into mud.',
          style: 'flowing', wispAffinity: { sprout: 2 },
          order: order('A Pool That Moves', 'Make one Shell for a pool the rain can pass through.', 'small', 'ease', [{ definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'We start with one pool the rain can move through. Let’s find the shell in Merge.',
          returnLine: 'One shell, one way in and one way out. Let me fill the first pool myself—my gift.',
          resolutionLine: 'The rain came, moved through, and left the pool clearer than before. That is the whole trick, I think.',
        },
        {
          id: 'feel-tell', label: 'Tell someone about it', reply: 'Tell someone. I told the pond. It has been very good about it.',
          style: 'shared', wispAffinity: { heartlet: 2 },
          order: order('A Pool for Two', 'Make one Shell for a pool with room on the edge for company.', 'small', 'connection', [{ definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'Then the first pool needs an edge wide enough for two. Merge will help us make it.',
          returnLine: 'One shell, and an edge to sit on together. Let me fill the pool—this first one is my gift.',
          resolutionLine: 'We sat on the edge and I told the pool about my rain. The pool told you. Now it belongs to all three of us.',
        },
      ],
    },
    {
      level: 2,
      title: 'Tiny Umbrellas',
      conversationId: 'mossprout:island:drizzlet:tiny-umbrellas',
      callbackLine: {
        still: 'You said sit with it. I have been sitting with the pool every evening. It is getting deeper.',
        flowing: 'You said let it move through. The pool has a current now. It did that by itself.',
        shared: 'You said tell someone. I have been telling the pool everything. It has not once interrupted.',
      },
      prompt: 'The pond wants lily pads—tiny umbrellas for very small fish. I keep making the umbrellas too big, because I want nothing to get wet ever again, which is a strange thing for rain to want.\n\nWhen a feeling is bigger than you expected, what helps you make room for it?',
      fallbackOrder: order('The Lily Pond', 'Bring a Tidepool and a Sprout for the pond’s first green islands.', 'medium', 'comfort', [{ definitionId: 'nature:waterside:3', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'room-quiet', label: 'Somewhere quiet to feel it', reply: 'A quiet corner of pond. Reeds all around. Nobody watching.',
          style: 'still', wispAffinity: { breeze: 2, sprout: 1 },
          order: order('A Sheltered Corner', 'Bring a Tidepool and a Sprout for a reedy corner where big feelings can sit.', 'medium', 'comfort', [{ definitionId: 'nature:waterside:3', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We make one sheltered corner before the rest of the pond. Let’s grow it in Merge.',
          returnLine: 'A tidepool and a sprout, tucked behind the reeds. The corner is ready whenever you are.',
          resolutionLine: 'The corner is quiet and nobody can see into it. Big feelings fit there. So do I.',
        },
        {
          id: 'room-let', label: 'Letting it be as big as it is', reply: 'As big as it is. Some rain is a whole storm. The pond can hold a storm.',
          style: 'flowing', wispAffinity: { sprout: 2, bloom: 1 },
          order: order('Room for a Storm', 'Bring a Tidepool and a Sprout for a pond that does not shrink from weather.', 'medium', 'ease', [{ definitionId: 'nature:waterside:3', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Then we make the pond bigger instead of the umbrellas. Merge can help us widen it.',
          returnLine: 'A tidepool and a sprout, and no umbrella big enough to stop the rain. The pond can grow when the Glow comes.',
          resolutionLine: 'The storm came and the pond held all of it. Afterwards, the lily pads were exactly the right size.',
        },
        {
          id: 'room-share', label: 'Someone to share the umbrella', reply: 'Two under one umbrella. That is how they are supposed to work.',
          style: 'shared', wispAffinity: { heartlet: 2 },
          order: order('An Umbrella for Two', 'Bring a Tidepool and a Sprout for a lily pad with room beneath it.', 'medium', 'connection', [{ definitionId: 'nature:waterside:3', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will make one lily pad wide enough to share. Let’s find the pieces in Merge.',
          returnLine: 'A tidepool and a sprout, side by side. The pond is ready when you are.',
          resolutionLine: 'Two very small fish share the biggest umbrella now. The feeling was not smaller. It was just shared.',
        },
      ],
    },
    {
      level: 3,
      title: 'A Little Song',
      conversationId: 'mossprout:island:drizzlet:little-song',
      callbackLine: {
        still: 'You wanted somewhere quiet to feel it. The reeds have grown taller, as if they knew.',
        flowing: 'You let it be as big as it was. The pond has not shrunk since.',
        shared: 'You shared the umbrella. The small fish still argue about who gets the middle.',
      },
      prompt: 'I tried to build the waterfall so it would sound cheerful. I moved the stones eleven times. It kept sounding like rain, because it is rain. I sat down on the twelfth stone and let it.\n\nWhen you cannot make a feeling sound how you want, what helps you listen to it anyway?',
      fallbackOrder: order('The Waterfall', 'Make a Water Lily and a Flower for a stream that sings however it sings.', 'medium', 'ease', [{ definitionId: 'nature:waterside:4', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
      choices: [
        {
          id: 'listen-still', label: 'Going quiet enough to hear it', reply: 'Quiet enough. The waterfall has been practising a little song. I nearly talked over it.',
          style: 'still', wispAffinity: { breeze: 2 },
          order: order('A Waterfall to Listen To', 'Make a Water Lily and a Flower for a stream worth going quiet for.', 'medium', 'comfort', [{ definitionId: 'nature:waterside:4', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'We build the waterfall, then we stop talking. Merge can find the water lily.',
          returnLine: 'A water lily and a flower, and I have stopped moving the stones. The stream can open whenever you are ready.',
          resolutionLine: 'We do not have to say anything. We can just listen. The song was there the whole time.',
        },
        {
          id: 'listen-flow', label: 'Letting it change as it goes', reply: 'Let it change. Rain becomes stream becomes pond. None of it stays the same sound.',
          style: 'flowing', wispAffinity: { sprout: 2, giggle: 1 },
          order: order('A Stream That Changes Tune', 'Make a Water Lily and a Flower for a stream that never sounds the same twice.', 'medium', 'curiosity', [{ definitionId: 'nature:waterside:4', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Then the stream gets to change its mind. Let’s make the pieces in Merge.',
          returnLine: 'A water lily and a flower, ready for a stream with no fixed tune. It can open when the Glow comes.',
          resolutionLine: 'The waterfall sounds different every morning. I stopped choosing the song. I just come and hear which one it is.',
        },
        {
          id: 'listen-with', label: 'Listening with someone', reply: 'Listening together. Rain sounds different when someone else is hearing it too.',
          style: 'shared', wispAffinity: { heartlet: 2, breeze: 1 },
          order: order('A Bench by the Waterfall', 'Make a Water Lily and a Flower for a place to listen side by side.', 'medium', 'connection', [{ definitionId: 'nature:waterside:4', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'We build the waterfall with somewhere for two to sit. Merge first.',
          returnLine: 'A water lily and a flower, and a place by the stream for both of us. Whenever you are ready.',
          resolutionLine: 'We listened to the waterfall together and it sounded like rain. It was the loveliest thing I have heard.',
        },
      ],
    },
    {
      level: 4,
      title: 'A Place to Pause',
      conversationId: 'mossprout:island:drizzlet:place-to-pause',
      callbackLine: {
        still: 'You went quiet enough to hear it. So did I. So, eventually, did the frogs.',
        flowing: 'You let the stream change its tune. It has a new one today. I think it is about you.',
        shared: 'You listened with me. I still sit on your side of the bench, in case.',
      },
      prompt: 'The water has made room for so much life. There is one patch of light on the pond that stays still no matter how hard it rains, and I would like to plant a lotus there.\n\nWhat would you want to remember about feelings, from here on?',
      fallbackOrder: order('The Lotus Sanctuary', 'Make a Rain Mirror and a Moonlit Cove so the pond can keep a little quiet for us.', 'major', 'comfort', [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }, { definitionId: 'nature:waterside:5', quantity: 1 }]),
      choices: [
        {
          id: 'remember-still', label: 'Feelings pass if I let them sit', reply: 'They pass. Even storms. The pond is proof.',
          style: 'still', wispAffinity: { breeze: 2, heartlet: 1 },
          order: order('A Still Patch of Light', 'Make a Rain Mirror and a Moonlit Cove for the one place the rain cannot ruffle.', 'major', 'comfort', [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }, { definitionId: 'nature:waterside:5', quantity: 1 }]),
          openingConclusion: 'We finish with the still place. One mirror, one cove, and then we sit.',
          returnLine: 'A rain mirror and a moonlit cove, both perfectly still. When the Glow comes, the lotus can open.',
          resolutionLine: 'The pond kept a little quiet for us. Every storm I carried here has passed. I am still here.',
        },
        {
          id: 'remember-flow', label: 'Feelings are weather, not me', reply: 'Weather, not you. I am rain, and even I am not only rain.',
          style: 'flowing', wispAffinity: { sprout: 2, bloom: 1 },
          order: order('A Pond for All Weather', 'Make a Rain Mirror and a Moonlit Cove for a pond that welcomes every sky.', 'major', 'ease', [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }, { definitionId: 'nature:waterside:5', quantity: 1 }]),
          openingConclusion: 'One last task, then every kind of weather has somewhere to land. Merge can grow the pieces.',
          returnLine: 'The mirror and the cove are ready. The lotus is only waiting on us now.',
          resolutionLine: 'Rain, sun, storm, mist—the pond took all of them and stayed a pond. So can I.',
        },
        {
          id: 'remember-share', label: 'I don’t have to carry them alone', reply: 'Not alone. I put my rain down here, and you helped me hold the pond.',
          style: 'shared', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Sanctuary We Share', 'Make a Rain Mirror and a Moonlit Cove for a pond that belongs to more than one.', 'major', 'connection', [{ definitionId: 'hybrid:rain-mirror', quantity: 1 }, { definitionId: 'nature:waterside:5', quantity: 1 }]),
          openingConclusion: 'We finish the way we began: together, on the edge of the water. Merge first.',
          returnLine: 'Everything is here except the last of the Glow. When it comes, the sanctuary is ours.',
          resolutionLine: 'I followed the rain here and put it down, and someone helped me. The pond has never been so clear.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['still', 'flowing', 'shared'],
    finalChapterWeight: 1.25,
    insightKey: 'drizzlet:feeling-style',
    category: 'Feelings & weather',
    revealTitle: 'Your way with feelings right now',
    closingLine: 'The lotus opens when the light is still. It will not mind if you bring rain.',
    insights: {
      still: {
        id: 'still-feeler', title: 'A Still Water', emblemId: 'drizzlet-feeling-still', matchOptionIds: [],
        reflection: 'You tend to hold feelings by sitting with them somewhere quiet and letting them pass in their own time.',
        summary: 'Feelings pass when I give them somewhere quiet to sit.',
      },
      flowing: {
        id: 'flowing-feeler', title: 'A Moving Stream', emblemId: 'drizzlet-feeling-flowing', matchOptionIds: [],
        reflection: 'You tend to let feelings move through you like weather, making room for them to be as big as they are.',
        summary: 'Feelings are weather; I let them move through.',
      },
      shared: {
        id: 'shared-feeler', title: 'A Shared Umbrella', emblemId: 'drizzlet-feeling-shared', matchOptionIds: [],
        reflection: 'You tend to hold feelings by sharing them, and a feeling told to someone becomes lighter for you.',
        summary: 'I don’t have to carry a feeling alone.',
      },
    },
    insightChoices: {
      still: { label: 'We sat with the rain', reply: 'We did. It passed, every time, and the pond stayed.' },
      flowing: { label: 'We let the weather move through', reply: 'We did. Every sky found its way into the pond and out again.' },
      shared: { label: 'We held the pond together', reply: 'We did. I have not carried my rain alone since.' },
    },
  },
  copy: {
    discoveryDialogue: 'I followed the rain here and the rain ran out. This hollow used to hold a little sky, and I have been carrying my own weather around with nowhere to put it. Would you help me fill it again?',
    discoveryActionLabel: 'Talk with Drizzlet',
    revealReactionLine: 'The mist lifts from a dry hollow that once held the sky.',
    mistNextName: 'A dry hollow',
    mistDescription: 'Something beyond this mist is waiting for rain. Clear it and find out who brought the weather.',
    returnNoteTitle: 'Meet me at Pond Sanctuary',
    returnNoteHint: 'Return to Drizzlet’s pond for the next scene',
    actionLabels: {
      start_story: 'Plan with Drizzlet',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Drizzlet',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the pond should fill.',
      orders_active: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Pond story complete',
    },
    speech: {
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'The first pool is my gift. I brought the rain for it.'
        : coins >= cost
          ? 'We have enough. The pond is ready when you are.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. Rain fills a pond one drop at a time.`
            : 'Nearly there. I can hear the water coming.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is at the water’s edge. The pond can fill whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'The pond holds the whole sky again, and a little quiet for us.'
      : 'The pond filled a little further, and the rain had somewhere to land.',
    wakeHandoffLine: 'Up in the orchard someone has been saving leaves for you. Autumn-coloured ones.',
    sleepingHint: 'Someone is resting by the dry hollow. They will wake once the friend before them is home.',
  },
};
