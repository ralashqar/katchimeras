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
      prompt: 'This used to be a Welcome Garden. Right now it is just soil and one hopeful gardener.\n\nIf you could plant one small thing here today, what would it be for?',
      fallbackOrder: order('The First Bloom', 'Make one Flower for the garden’s first small beginning.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
      choices: [
        {
          id: 'begin-small', label: 'For starting small', reply: 'One flower, then. Small enough to begin. Big enough to matter.',
          style: 'gentle', wispAffinity: { sprout: 2 },
          order: order('One Brave Bloom', 'Make one Flower so the empty garden has somewhere gentle to begin.', 'small', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'I can do one flower without asking it to carry the whole garden. Let’s make it together in Merge.',
          returnLine: 'You brought exactly enough for a beginning. The soil is ready—and the first restoration is my gift.',
          resolutionLine: 'Look at its little face reaching up. The garden is still quiet, but it is not waiting alone anymore.',
        },
        {
          id: 'begin-playful', label: 'For seeing what happens', reply: 'An experiment! If it grows sideways, we shall call that personality.',
          style: 'curious', wispAffinity: { giggle: 2 },
          order: order('A Curious Flower', 'Make one Flower for Petalimp’s first cheerful garden experiment.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'No perfect plan, then. Just one curious bloom and permission to see what happens.',
          returnLine: 'Our experiment is ready. I promised the flower it would not be graded. Let me wake the soil—this first one is my gift.',
          resolutionLine: 'It grew exactly where it wanted. That feels like the garden remembering how to surprise us.',
        },
        {
          id: 'begin-together', label: 'For someone beside me', reply: 'Then neither of us has to be brave enough for the whole patch alone.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('Our First Flower', 'Make one Flower for the place you and Petalimp are beginning together.', 'small', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
          openingConclusion: 'You bring the flower. I’ll fuss over the soil. That sounds like a beginning we can share.',
          returnLine: 'You came back. I think that matters as much as the flower. Let me do the first part—it is my gift to you.',
          resolutionLine: 'There it is—our first flower. I thought I needed a garden before I could belong here. Perhaps I only needed company.',
        },
      ],
    },
    {
      level: 2,
      title: 'Colours That Belong',
      conversationId: 'mossprout:island:petalimp:colours-belong',
      callbackLine: {
        gentle: 'Last time you said small was enough. I have been trying that on the whole garden.',
        curious: 'You told me to let the first flower experiment. It has been experimenting with the neighbours.',
        together: 'You said having someone beside you helps. I noticed I have been waiting for you at the gate.',
      },
      prompt: 'The first flower stayed. I have been arranging the next beds in perfectly matching rows, because proper gardens look as though they know the rules.\n\nWhat makes a place begin to feel like yours?',
      fallbackOrder: order('Colours That Belong', 'Bring a Flower and a Sprout for the garden’s new colour beds.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
      choices: [
        {
          id: 'belong-familiar', label: 'Something familiar', reply: 'One familiar thing can make a strange place stop feeling quite so far away.',
          style: 'gentle', wispAffinity: { breeze: 2 },
          order: order('A Familiar Corner', 'Bring a Flower and a Sprout to make one colour bed feel known and comforting.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Let’s give the garden one familiar corner before we ask it to become anything grand.',
          returnLine: 'I know where these belong. For the first time, I know where I might belong too. The colour beds are ready whenever you are.',
          resolutionLine: 'This corner feels familiar already. A home does not have to be old to give you somewhere soft to land.',
        },
        {
          id: 'belong-change', label: 'Room to change things', reply: 'No matching forever? Wonderful. The flowers may rearrange themselves whenever they please.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('Colours Without Rules', 'Bring a Flower and a Sprout for a colour bed with room to change.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'We will make beds, not boundaries. Let’s find colours that are allowed to change their minds.',
          returnLine: 'Nothing matches, and somehow all of it belongs. The new beds can take root whenever the garden has the Glow.',
          resolutionLine: 'Every colour found room without following my plan. The garden feels more like me because it was allowed to change.',
        },
        {
          id: 'belong-shared', label: 'Someone to share it with', reply: 'Then a place becomes ours through the welcome, not through the decorating.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('A Bed to Share', 'Bring a Flower and a Sprout for a colour bed that welcomes company.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
          openingConclusion: 'Let’s build a corner that looks as though it was hoping someone would visit.',
          returnLine: 'These are ready to plant side by side. When the Glow comes, the garden will make room for both.',
          resolutionLine: 'The colours look brighter together. I think welcome might be something a place learns by practising.',
        },
      ],
    },
    {
      level: 3,
      title: 'A Path at Your Pace',
      conversationId: 'mossprout:island:petalimp:wandering-walk',
      callbackLine: {
        gentle: 'You wanted the beds to feel familiar first. Now I check on them like old friends.',
        curious: 'You let the colours change their minds. They have not stopped.',
        together: 'You built a corner that hoped for visitors. Something small with wings took you up on it.',
      },
      prompt: 'I laid the first stretch of path perfectly straight, so the garden would look as if it had a plan. The butterflies ignore it completely, and I keep racing between the beds in case anyone notices I stopped.\n\nWhen life feels full, what helps you keep moving?',
      fallbackOrder: order('The Wandering Walk', 'Make a Rare Flower and a Shell for the garden path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
      choices: [
        {
          id: 'pace-next-step', label: 'One clear next step', reply: 'One stone, then the next. A path does not need to show us its whole ending.',
          style: 'gentle', wispAffinity: { sprout: 2 },
          order: order('The Next Stepping Stone', 'Make a Rare Flower and a Shell to mark one clear turn in the path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'We will build the walk one visible turn at a time. Merge can help us mark the first.',
          returnLine: 'One clear turn is ready. We do not need to solve the whole path today—just this bend, when you are ready.',
          resolutionLine: 'The path only shows us the next bend. Strangely, that makes the whole garden feel easier to cross.',
        },
        {
          id: 'pace-pause', label: 'Permission to pause', reply: 'Then the best part of the path should be somewhere it is perfectly acceptable to stop.',
          style: 'curious', wispAffinity: { breeze: 2 },
          order: order('A Place Along the Way', 'Make a Rare Flower and a Shell for a restful turn in the garden path.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'A pause can belong inside the journey. Let’s make one worth arriving at.',
          returnLine: 'Our resting turn is ready. It can join the walk whenever the garden is ready to grow.',
          resolutionLine: 'Even the butterflies stop here. The garden kept growing while we paused long enough to notice.',
        },
        {
          id: 'pace-together', label: 'Doing it together', reply: 'A path wide enough for two. And several butterflies who refuse to walk in a line.',
          style: 'together', wispAffinity: { heartlet: 2 },
          order: order('The Side-by-Side Walk', 'Make a Rare Flower and a Shell for a path meant to be shared.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'Then this path will never make anyone walk the hard part alone. Let’s shape its first turn.',
          returnLine: 'Everything is ready for a path with room for company. It will open when we bring the Glow together.',
          resolutionLine: 'There is room for both of us here. Somehow the distance feels smaller when a path expects company.',
        },
      ],
    },
    {
      level: 4,
      title: 'Room for Every Bloom',
      conversationId: 'mossprout:island:petalimp:every-bloom',
      callbackLine: {
        gentle: 'One turn at a time, you said. The path taught me to stop looking for the end of it.',
        curious: 'You gave the path a place to pause. I have used it more than I expected.',
        together: 'A path wide enough for two—you were right. Even the butterflies walk it in pairs now.',
      },
      prompt: 'Some flowers have appeared far outside their beds. I nearly moved them back—then I wondered whether the garden was showing us a better ending.\n\nWhat would you want to remember when things grow differently than planned?',
      fallbackOrder: order('The Garden Remembers', 'Make a Memory Bloom and a Magical Plant for the garden’s final welcome.', 'major', 'comfort', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
      choices: [
        {
          id: 'change-progress', label: 'Small progress still counts', reply: 'Even the wonky little bloom crossed a great deal of soil to reach us.',
          style: 'gentle', wispAffinity: { sprout: 2, heartlet: 1 },
          order: order('Every Little Bloom', 'Make a Memory Bloom and a Magical Plant to celebrate every piece of progress.', 'major', 'ease', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We will finish by honouring every small thing that made it this far.',
          returnLine: 'Every small piece is here. When the Glow comes, we can let the whole garden remember how far it has come.',
          resolutionLine: 'The garden did not become beautiful all at once. It became beautiful each time we returned and helped one more thing grow.',
        },
        {
          id: 'change-flexible', label: 'Plans can change', reply: 'Good. I am officially revising my plan to include flowers with their own opinions.',
          style: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
          order: order('The Beautiful Detour', 'Make a Memory Bloom and a Magical Plant for the garden’s unexpected ending.', 'major', 'curiosity', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'Let’s give the garden what it needs to become itself instead of my tidy first draft.',
          returnLine: 'The changed plan is ready—and much better dressed. The final bloom is only waiting on us now.',
          resolutionLine: 'It is nothing like my first plan. It is warmer, stranger, and alive. I am glad we listened when it changed.',
        },
        {
          id: 'change-help', label: 'We can ask for help', reply: 'Then the garden never has to prove it can grow alone. Neither do we.',
          style: 'together', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Garden We Share', 'Make a Memory Bloom and a Magical Plant for a welcome built together.', 'major', 'connection', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'One last shared task, then. We will finish the way we began: together.',
          returnLine: 'We have everything except the last of the Glow—and I know now that asking for that help is part of growing.',
          resolutionLine: 'Every bloom found room because this was never one creature’s garden. We made a welcome that can keep growing with us.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['gentle', 'curious', 'together'],
    finalChapterWeight: 1.25,
    insightKey: 'petalimp:growth-style',
    category: 'Growth & change',
    revealTitle: 'Your way of growing right now',
    closingLine: 'Whatever grows next, this garden can remind us that your way of growing is allowed to change too.',
    insights: {
      gentle: {
        id: 'gentle-grower', title: 'A Gentle Grower', emblemId: 'petalimp-growth-gentle', matchOptionIds: [],
        reflection: 'You often make change feel possible by finding a small, kind next step and leaving room to pause.',
        summary: 'Small steps and a gentle pace can help change feel possible for me.',
      },
      curious: {
        id: 'curious-cultivator', title: 'A Curious Cultivator', emblemId: 'petalimp-growth-curious', matchOptionIds: [],
        reflection: 'You often grow by experimenting, adapting, and letting a plan become something better than its first draft.',
        summary: 'Curiosity and flexible plans can help me grow through change.',
      },
      together: {
        id: 'companion-gardener', title: 'A Companion Gardener', emblemId: 'petalimp-growth-together', matchOptionIds: [],
        reflection: 'You often find momentum through company, shared care, and remembering that asking for help belongs in the process.',
        summary: 'Connection and shared care can help me keep growing.',
      },
    },
    insightChoices: {
      gentle: { label: 'We began with small steps', reply: 'We did. Each small return gave the next thing somewhere safe to grow.' },
      curious: { label: 'We let the plan change', reply: 'We did. The garden became more alive each time we listened instead of forcing the first plan.' },
      together: { label: 'We kept returning together', reply: 'We did. The care became easier to carry whenever neither of us carried it alone.' },
    },
  },
  copy: {
    discoveryDialogue: 'I followed one stubborn glimmer through the mist. It led me to a Welcome Garden that has forgotten how to bloom. Will you help me bring it back?',
    discoveryActionLabel: 'Talk with Petalimp',
    revealReactionLine: 'The mist lifts from a quiet, bare garden.',
    mistNextName: 'A forgotten garden',
    mistDescription: 'Someone in there is still arranging flowers for nobody.',
    returnNoteTitle: 'Meet me at Bloom Garden',
    returnNoteHint: 'Return to Petalimp’s island for the next scene',
    actionLabels: {
      start_story: 'Plan with Petalimp',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Petalimp',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the garden should grow.',
      orders_active: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Garden story complete',
    },
    speech: {
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'Everything is ready. This one is my gift.'
        : coins >= cost
          ? 'We have what we need. Whenever you are ready.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. The garden is patient.`
            : 'We are close now. A little more Glow and this part can grow.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is ready. The garden can grow whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'Every bloom found room. We restored more than a garden; we made a welcome.'
      : 'The garden changed because we came back and cared for it together.',
    wakeHandoffLine: 'I was arranging flowers for nobody. Then you noticed one. Someone else is resting in the Wildgrowth—I think they would like to meet you.',
    sleepingHint: 'Someone is resting in this garden. They will wake once the last friend is home.',
  },
};
