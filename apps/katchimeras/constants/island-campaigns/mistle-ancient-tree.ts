import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export type MistleMistStyle = 'gentle' | 'curious' | 'trusting';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/** Mistle: a soft-edged friend who lives where things are half-seen. The arc is about how you face not knowing. */
export const MISTLE_ANCIENT_TREE_CAMPAIGN: IslandCampaignDefinition<MistleMistStyle> = {
  campaignId: 'island-campaign:mistle-ancient-tree',
  islandId: 'ancient-tree-grove',
  residentSkinId: 'mistle',
  residentName: 'Mistle',
  chapterIdPrefix: 'mistle-ancient-tree',
  tags: ['island-campaign', 'mistle', 'ancient-tree-grove'],
  chapters: [
    {
      level: 1,
      title: 'A Soft Patch Around the Roots',
      conversationId: 'mossprout:island:mistle:soft-patch',
      prompt: 'You noticed me. Most people hurry past the mist. This tree is older than the fog, and I have been sitting at its roots trying to work out what it remembers. I have not worked it out.\n\nWhen you cannot see how something will turn out, what do you do first?',
      fallbackOrder: order('The Root Patch', 'Make one Tidepool so the roots have somewhere soft and reflective to rest.', 'small', 'comfort', [{ definitionId: 'nature:waterside:3', quantity: 1 }]),
      choices: [
        {
          id: 'unknown-small', label: 'One small thing I can see', reply: 'One small thing. A root. A puddle. The fog leaves those alone.',
          style: 'gentle', wispAffinity: { sprout: 2 },
          order: order('One Clear Puddle', 'Make one Tidepool for the one thing near the roots you can see clearly.', 'small', 'ease', [{ definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'Then we begin with the one thing we can see, and stop there for now. Merge can help.',
          returnLine: 'One tidepool, perfectly clear. Let me soften the ground around it—the first patch is my gift.',
          resolutionLine: 'A little place to rest can grow too. I did not need to see the whole tree. I needed the puddle.',
        },
        {
          id: 'unknown-look', label: 'Look closer', reply: 'Closer. The mist is only thick from far away.',
          style: 'curious', wispAffinity: { giggle: 2 },
          order: order('A Puddle to Peer Into', 'Make one Tidepool that shows a little more the longer you look.', 'small', 'curiosity', [{ definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'We make one pool and lean right over it. Let’s find the tidepool in Merge.',
          returnLine: 'One tidepool, with something moving at the bottom. Let me soften the roots around it—this first part is my gift.',
          resolutionLine: 'I looked closer and the fog had roots in it. It was never hiding the tree. It was part of it.',
        },
        {
          id: 'unknown-trust', label: 'Trust it will be all right', reply: 'Trust it. The tree has been all right for longer than either of us.',
          style: 'trusting', wispAffinity: { heartlet: 2 },
          order: order('A Puddle for Resting', 'Make one Tidepool for a patch where not knowing is allowed.', 'small', 'comfort', [{ definitionId: 'nature:waterside:3', quantity: 1 }]),
          openingConclusion: 'We start by making the roots comfortable and asking them nothing. Merge first.',
          returnLine: 'One tidepool, and no questions. Let me do the soft patch myself—it is my gift.',
          resolutionLine: 'I sat at the roots without needing them to explain anything. Something in the fog sat down beside me.',
        },
      ],
    },
    {
      level: 2,
      title: 'Doorways in the Roots',
      conversationId: 'mossprout:island:mistle:root-doorways',
      callbackLine: {
        gentle: 'You started with one small thing you could see. I have been counting them. I am up to nine.',
        curious: 'You looked closer. Now I cannot stop. The bark has faces in it.',
        trusting: 'You trusted it would be all right. I have been repeating that to the fog. It seems to agree.',
      },
      prompt: 'The roots are making little doorways, and I cannot tell where any of them go. I would like to hang a lantern in each one, but a lantern in a doorway feels like a promise about what is inside.\n\nWhen someone else is lost in the fog, what helps you help them?',
      fallbackOrder: order('The Root Lanterns', 'Bring a Pressed Leaf and a Flower to hang warm lights in the doorways.', 'medium', 'connection', [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
      choices: [
        {
          id: 'help-light', label: 'A small light, not a map', reply: 'A light, not a map. Enough to see the next root. That is all anyone ever needs.',
          style: 'gentle', wispAffinity: { sprout: 2, breeze: 1 },
          order: order('One Lantern at a Time', 'Bring a Pressed Leaf and a Flower for a single soft light in the first doorway.', 'medium', 'ease', [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'We hang one lantern, low, and promise nothing about the rest. Let’s make it in Merge.',
          returnLine: 'A pressed leaf and a flower, and one lantern that only lights the next step. The doorways are ready when you are.',
          resolutionLine: 'A welcome you can see from the path. Not the whole way—just far enough to keep walking.',
        },
        {
          id: 'help-explore', label: 'Go in with them', reply: 'Go in together. Two people lost is an expedition.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('Lanterns for an Expedition', 'Bring a Pressed Leaf and a Flower for lights that go into the doorways, not just over them.', 'medium', 'curiosity', [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'Then we carry the lanterns in ourselves. Merge can help us make them.',
          returnLine: 'A pressed leaf and a flower, and lanterns meant for carrying. When the Glow comes, we go in.',
          resolutionLine: 'We went into the first doorway together. It went to another doorway. We are still delighted.',
        },
        {
          id: 'help-stay', label: 'Stay nearby until they’re ready', reply: 'Stay nearby. The fog is much smaller when someone is standing in it with you.',
          style: 'trusting', wispAffinity: { heartlet: 2 },
          order: order('A Lantern by the Threshold', 'Bring a Pressed Leaf and a Flower for a light that waits at the door.', 'medium', 'comfort', [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'We hang a lantern that waits, and we wait with it. Let’s grow the pieces.',
          returnLine: 'A pressed leaf and a flower, and a light that is happy to wait. Whenever you are ready.',
          resolutionLine: 'Something small came out of the roots eventually. It had been watching the lantern the whole time.',
        },
      ],
    },
    {
      level: 3,
      title: 'What the Branches Remember',
      conversationId: 'mossprout:island:mistle:branches-remember',
      callbackLine: {
        gentle: 'You said a small light, not a map. Every doorway has one now, and nobody has been lost since.',
        curious: 'You went in with me. We have mapped four doorways. They all lead here.',
        trusting: 'You stayed nearby. The thing from the roots visits every evening now.',
      },
      prompt: 'I climbed the tree to ask the branches what they remember, and got so high the fog closed under me and I could not see the ground. I sat up there for an hour, certain I had ruined everything. Then the mist thinned, and the ground was exactly where I had left it.\n\nWhen the not-knowing gets frightening, what brings you back?',
      fallbackOrder: order('The Next Story', 'Make a Memory Sprig and a Water Lily to give the tree room for its next chapter.', 'medium', 'comfort', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }]),
      choices: [
        {
          id: 'back-breath', label: 'Something small and steady', reply: 'Something steady. The branch under you. It was there the whole hour.',
          style: 'gentle', wispAffinity: { sprout: 2, breeze: 1 },
          order: order('A Steady Branch', 'Make a Memory Sprig and a Water Lily for the one branch that never moves.', 'medium', 'ease', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }]),
          openingConclusion: 'We give the tree one steady place to hold, and start there. Merge can find the pieces.',
          returnLine: 'A memory sprig and a water lily, and a branch you can always feel under you. Whenever you are ready.',
          resolutionLine: 'It does remember. Look at all those leaves. I only had to hold one branch to see them.',
        },
        {
          id: 'back-wonder', label: 'Getting curious about it', reply: 'Curious. What is the fog doing up here? Where does it go? Fear hates a good question.',
          style: 'curious', wispAffinity: { giggle: 2 },
          order: order('A Branch for Looking Out', 'Make a Memory Sprig and a Water Lily for a perch high enough to wonder from.', 'medium', 'curiosity', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }]),
          openingConclusion: 'We climb back up with a question instead of a fear. Let’s grow what we need first.',
          returnLine: 'A memory sprig and a water lily, ready for the high branch. The tree can grow when the Glow comes.',
          resolutionLine: 'I went back up and asked the fog what it was doing. It was raining on the other side. I never knew.',
        },
        {
          id: 'back-voice', label: 'A voice I trust', reply: 'A voice. Yours came up through the fog, actually. I heard it before I saw the ground.',
          style: 'trusting', wispAffinity: { heartlet: 2, breeze: 1 },
          order: order('A Branch Within Earshot', 'Make a Memory Sprig and a Water Lily for a place in the tree where a voice can reach.', 'medium', 'connection', [{ definitionId: 'nature:keepsake:3', quantity: 1 }, { definitionId: 'nature:waterside:4', quantity: 1 }]),
          openingConclusion: 'We make room in the tree for a voice to carry. Merge first.',
          returnLine: 'A memory sprig and a water lily, and I can hear you from here. Whenever you are ready.',
          resolutionLine: 'The branches remember every season. Now one of them remembers a voice coming up through the mist to find me.',
        },
      ],
    },
    {
      level: 4,
      title: 'A Heart Full of Light',
      conversationId: 'mossprout:island:mistle:heart-of-light',
      callbackLine: {
        gentle: 'You gave me something steady. I climb higher now, one branch at a time.',
        curious: 'You made me curious instead of frightened. I have a list of questions for the fog.',
        trusting: 'You were the voice through the mist. I still listen for it.',
      },
      prompt: 'So many small things helped this tree grow. A pot. A path. Someone keeping a space beside it. I can see them all now, and I still cannot see where the fog ends. I think I have stopped needing to.\n\nWhat would you want to remember about not knowing, from here on?',
      fallbackOrder: order('The Heartwood', 'Make a Heartwood Sanctuary and an Ancient Tree to give the grove a heart full of light.', 'major', 'comfort', [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }, { definitionId: 'nature:garden:7', quantity: 1 }]),
      choices: [
        {
          id: 'remember-step', label: 'I only need the next step', reply: 'The next step. The fog only ever asked for that much.',
          style: 'gentle', wispAffinity: { sprout: 2, heartlet: 1 },
          order: order('A Heart Lit One Step at a Time', 'Make a Heartwood Sanctuary and an Ancient Tree for a grove that shows only what you need.', 'major', 'ease', [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }, { definitionId: 'nature:garden:7', quantity: 1 }]),
          openingConclusion: 'We finish one step at a time, the way we did all of it. Let’s make the last pieces.',
          returnLine: 'A heartwood sanctuary and an ancient tree, found one step at a time. When the Glow comes, the grove can light.',
          resolutionLine: 'Every little kindness found somewhere to grow. I never saw the whole tree. I saw the next branch, every time.',
        },
        {
          id: 'remember-wonder', label: 'Not knowing can be wonderful', reply: 'Wonderful. The fog is full of things I have not met yet. That is the best part of it.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('A Heart Full of Questions', 'Make a Heartwood Sanctuary and an Ancient Tree for a grove that keeps its mysteries.', 'major', 'curiosity', [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }, { definitionId: 'nature:garden:7', quantity: 1 }]),
          openingConclusion: 'One last mystery, then. Let’s grow the pieces in Merge.',
          returnLine: 'The sanctuary and the tree are ready. The grove is only waiting on us now.',
          resolutionLine: 'The fog did not lift. It glows now. I still do not know what is at the end of it, and I love that.',
        },
        {
          id: 'remember-held', label: 'I’m not alone in it', reply: 'Not alone. The tree, the lanterns, the voice through the mist. Not once.',
          style: 'trusting', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Heart That Waits for You', 'Make a Heartwood Sanctuary and an Ancient Tree for a grove that keeps a light on.', 'major', 'connection', [{ definitionId: 'hybrid:heartwood-sanctuary', quantity: 1 }, { definitionId: 'nature:garden:7', quantity: 1 }]),
          openingConclusion: 'We finish by keeping a light on for each other. Merge first.',
          returnLine: 'Everything is here except the last of the Glow. When it comes, the grove keeps its light on for good.',
          resolutionLine: 'The heartwood glows through the mist now, and anyone lost can see it. I was lost. Someone came. That is what the light is for.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['gentle', 'curious', 'trusting'],
    finalChapterWeight: 1.25,
    insightKey: 'mistle:mist-style',
    category: 'Not knowing',
    revealTitle: 'Your way with not knowing right now',
    closingLine: 'The fog will still be here tomorrow. So will the light in the heartwood.',
    insights: {
      gentle: {
        id: 'next-step-walker', title: 'A Next-Step Walker', emblemId: 'mistle-mist-gentle', matchOptionIds: [],
        reflection: 'You tend to face not knowing by finding one small, steady thing and taking the next step from there.',
        summary: 'When I can’t see the whole way, one steady step is enough.',
      },
      curious: {
        id: 'fog-explorer', title: 'A Fog Explorer', emblemId: 'mistle-mist-curious', matchOptionIds: [],
        reflection: 'You tend to face not knowing by getting curious about it, and a good question steadies you more than an answer.',
        summary: 'Curiosity is how I walk into what I can’t see.',
      },
      trusting: {
        id: 'held-in-fog', title: 'Held in the Fog', emblemId: 'mistle-mist-trusting', matchOptionIds: [],
        reflection: 'You tend to face not knowing by trusting it will be all right and leaning on the voices you can still hear.',
        summary: 'I can bear not knowing when I’m not alone in it.',
      },
    },
    insightChoices: {
      gentle: { label: 'We took it one branch at a time', reply: 'We did. And the tree turned out to be the whole way up.' },
      curious: { label: 'We kept asking the fog questions', reply: 'We did. It has started answering, slowly, in its own way.' },
      trusting: { label: 'We kept a light on for each other', reply: 'We did. It is still on. It will stay on.' },
    },
  },
  copy: {
    discoveryDialogue: 'You noticed me. Most people hurry past the mist. There is a tree here older than the fog, and I have been sitting at its roots wondering what it remembers. Would you sit with me a while and find out?',
    discoveryActionLabel: 'Talk with Mistle',
    revealReactionLine: 'The mist thins around an ancient tree, but never quite leaves.',
    mistNextName: 'An old tree in the fog',
    mistDescription: 'Something beyond this mist has been waiting a very long time. Clear it, slowly, and see who is there.',
    returnNoteTitle: 'Meet me at Ancient Tree Grove',
    returnNoteHint: 'Return to the ancient tree for the next scene',
    actionLabels: {
      start_story: 'Plan with Mistle',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Mistle',
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
        ? 'The first patch is my gift. The roots have been waiting.'
        : coins >= cost
          ? 'We have enough. The tree can grow whenever you are ready.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The tree has waited longer than this.`
            : 'Nearly there. The fog is thinning already.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is at the roots. The tree can grow whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'The heartwood glows through the mist. Anyone lost can see it now.'
      : 'The tree grew a little, and the fog let a little more through.',
    wakeHandoffLine: 'The last friends come and go with the weather. Keep living your days with Mossprout and they will find you.',
    sleepingHint: 'Someone is resting at the roots of the old tree. They will wake once the friend before them is home.',
  },
};
