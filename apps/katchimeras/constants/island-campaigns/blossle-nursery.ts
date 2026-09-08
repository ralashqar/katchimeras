import type { MergeOrder } from '@/types/merge-world';
import type { IslandCampaignChapterOrder, IslandCampaignDefinition } from './types';

export type BlossleBeginningStyle = 'patient' | 'hopeful' | 'tender';

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: IslandCampaignChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): IslandCampaignChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

/** Blossle: a hopeful nursery-keeper who can almost see things in bloom. The arc is about how you begin. */
export const BLOSSLE_NURSERY_CAMPAIGN: IslandCampaignDefinition<BlossleBeginningStyle> = {
  campaignId: 'island-campaign:blossle-nursery',
  islandId: 'seed-nursery',
  residentSkinId: 'blossle',
  residentName: 'Blossle',
  chapterIdPrefix: 'blossle-nursery',
  tags: ['island-campaign', 'blossle', 'seed-nursery'],
  chapters: [
    {
      level: 1,
      title: 'A Pot Saved for Something Brave',
      conversationId: 'mossprout:island:blossle:brave-pot',
      prompt: 'I have been keeping one empty pot on the shelf for something brave. I check it every morning. It is still a pot.\n\nWhen you are about to begin something new, what do you need first?',
      fallbackOrder: order('The First Bed', 'Grow two Sprouts so the empty pot finally has company.', 'small', 'curiosity', [{ definitionId: 'nature:garden:2', quantity: 2 }]),
      choices: [
        {
          id: 'begin-time', label: 'A little time to get ready', reply: 'Seeds agree with you. They spend ages in the dark before anyone sees them.',
          style: 'patient', wispAffinity: { sprout: 2 },
          order: order('Two Slow Sprouts', 'Grow two Sprouts that took their time coming up.', 'small', 'ease', [{ definitionId: 'nature:garden:2', quantity: 2 }]),
          openingConclusion: 'Then we begin without rushing the pot. Two sprouts, whenever they are ready. Merge will help.',
          returnLine: 'Two sprouts, and neither of them was hurried. Let me wake the seed bed myself—the first one is my gift.',
          resolutionLine: 'The brave pot has a neighbour now. It only needed a little time, the way beginnings usually do.',
        },
        {
          id: 'begin-picture', label: 'A picture of how it could go', reply: 'Oh, I have so many pictures. I can almost see this whole shelf in bloom.',
          style: 'hopeful', wispAffinity: { bloom: 2 },
          order: order('Two Sprouts for the Picture', 'Grow two Sprouts to start the shelf I keep imagining.', 'small', 'curiosity', [{ definitionId: 'nature:garden:2', quantity: 2 }]),
          openingConclusion: 'We begin by making the first corner of the picture real. Two sprouts, in Merge.',
          returnLine: 'Two sprouts, exactly where I pictured them. Let me wake the bed around them—this first part is my gift.',
          resolutionLine: 'The picture was right about the first corner. I am trying not to get ahead of myself. I am getting ahead of myself.',
        },
        {
          id: 'begin-gentle', label: 'Permission to do it badly', reply: 'Badly is how every seed starts. Crooked, then green.',
          style: 'tender', wispAffinity: { heartlet: 2 },
          order: order('Two Crooked Sprouts', 'Grow two Sprouts that are allowed to come up crooked.', 'small', 'comfort', [{ definitionId: 'nature:garden:2', quantity: 2 }]),
          openingConclusion: 'Then nothing in this nursery has to be perfect on the first try. Let’s grow two sprouts and see.',
          returnLine: 'Two sprouts, both a little crooked, both perfectly alive. I will wake the bed for them—my gift.',
          resolutionLine: 'The bed is uneven and green and nobody minds. Beginning badly turned out to be beginning.',
        },
      ],
    },
    {
      level: 2,
      title: 'Probably a Leaf',
      conversationId: 'mossprout:island:blossle:probably-a-leaf',
      callbackLine: {
        patient: 'You said you needed time. I stopped checking the pot every morning. It bloomed the day I forgot.',
        hopeful: 'You asked for a picture. I have drawn the whole shelf now. Twice.',
        tender: 'You wanted permission to do it badly. The crooked sprouts are the tallest ones.',
      },
      prompt: 'The sprouts have outgrown their corner, so I labelled everything. One label just says “probably a leaf”. It is the most honest thing in the nursery.\n\nWhen you cannot tell yet what something will become, how do you keep going?',
      fallbackOrder: order('The Sprout Shelves', 'Bring a Flower and a Shell for shelves where every sprout gets a place.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
      choices: [
        {
          id: 'unknown-wait', label: 'I wait and see', reply: 'Waiting is a skill. Seeds are experts. I am a student.',
          style: 'patient', wispAffinity: { sprout: 2, breeze: 1 },
          order: order('Shelves for Waiting', 'Bring a Flower and a Shell for shelves where sprouts can take their time.', 'medium', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'We will build shelves that do not ask anything to hurry. Let’s find the pieces in Merge.',
          returnLine: 'A flower and a shell, ready and unhurried. The shelves can go up whenever you are.',
          resolutionLine: '“Probably a leaf” turned out to be a flower. It just needed a shelf and a while.',
        },
        {
          id: 'unknown-imagine', label: 'I imagine the best version', reply: 'The best version! In my head it is already a whole meadow.',
          style: 'hopeful', wispAffinity: { bloom: 2, giggle: 1 },
          order: order('Shelves for the Meadow', 'Bring a Flower and a Shell for shelves built for what the sprouts might become.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'Then we build shelves big enough for the meadow in our heads. Merge first.',
          returnLine: 'A flower and a shell, and room on the shelf for everything they might be. Whenever the Glow comes.',
          resolutionLine: 'Not everything became the best version. One became a better one I had not imagined at all.',
        },
        {
          id: 'unknown-care', label: 'I just keep it watered', reply: 'Keep it watered. That is the whole job, most days.',
          style: 'tender', wispAffinity: { heartlet: 2 },
          order: order('Shelves for Watering', 'Bring a Flower and a Shell for shelves where every sprout gets looked after.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
          openingConclusion: 'We will build shelves for looking after, not for knowing. Let’s grow the pieces.',
          returnLine: 'A flower and a shell, both watered. The shelves are ready when you are.',
          resolutionLine: 'I never found out what “probably a leaf” was going to be. I looked after it anyway, and it is thriving.',
        },
      ],
    },
    {
      level: 3,
      title: 'Something to Lean On',
      conversationId: 'mossprout:island:blossle:something-to-lean-on',
      callbackLine: {
        patient: 'You said wait and see. I saw. It was worth the wait.',
        hopeful: 'You imagined the best version. The shelf is nearly as good as the drawing now.',
        tender: 'You said keep it watered. I have not missed a day.',
      },
      prompt: 'I built a trellis for the shoot that kept leaning, and made it so tall and perfect that the shoot could not reach it. It leaned on a neighbouring pot instead. I have been feeling a bit silly about the trellis.\n\nWhen a beginning wobbles, what helps you hold steady?',
      fallbackOrder: order('The Trellis', 'Make a Rare Flower and a Plant for a trellis the shoots can actually reach.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 }]),
      choices: [
        {
          id: 'wobble-slow', label: 'Slowing right down', reply: 'Slow enough for the shoot to catch up. Perhaps for me to catch up, too.',
          style: 'patient', wispAffinity: { sprout: 2 },
          order: order('A Trellis at Shoot Height', 'Make a Rare Flower and a Plant for a trellis built one rung at a time.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'We rebuild it one rung at a time, at the shoot’s pace. Merge can help us start.',
          returnLine: 'A rare flower and a plant, and a trellis that starts where the shoot is. Whenever you are ready.',
          resolutionLine: 'The shoot reached the first rung this morning. Nobody was rushing it, so it just did.',
        },
        {
          id: 'wobble-hope', label: 'Remembering why I started', reply: 'Why we started. A nursery full of things that made it. Yes.',
          style: 'hopeful', wispAffinity: { bloom: 2 },
          order: order('A Trellis Worth Reaching', 'Make a Rare Flower and a Plant for a trellis the shoots want to climb.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'We make a trellis that looks like somewhere worth going. Let’s grow it in Merge.',
          returnLine: 'A rare flower and a plant, both pointed upwards. The trellis can go in when the Glow comes.',
          resolutionLine: 'Every shoot is climbing now. I think they wanted somewhere to go more than they wanted a perfect ladder.',
        },
        {
          id: 'wobble-lean', label: 'Leaning on someone', reply: 'The shoot chose a neighbour over my perfect trellis. Perhaps it knew something.',
          style: 'tender', wispAffinity: { heartlet: 2, sprout: 1 },
          order: order('A Trellis Between Neighbours', 'Make a Rare Flower and a Plant for a trellis that connects the pots.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:garden:3', quantity: 1 }]),
          openingConclusion: 'We build the trellis between the pots, so nothing has to climb alone. Merge first.',
          returnLine: 'A rare flower and a plant, leaning on each other already. The trellis is ready when you are.',
          resolutionLine: 'Up you go. We have you. The shoots say it to each other now; I only had to say it once.',
        },
      ],
    },
    {
      level: 4,
      title: 'More Seedlings Than Pots',
      conversationId: 'mossprout:island:blossle:more-than-pots',
      callbackLine: {
        patient: 'You slowed right down. The trellis is full and I never once hurried it.',
        hopeful: 'You remembered why we started. So did every shoot on the trellis.',
        tender: 'You leaned on someone. The whole nursery leans on each other now.',
      },
      prompt: 'We have more seedlings than empty pots. It is the loveliest problem I have ever had, and I keep wanting to keep every single one here where I can see it.\n\nWhat would you want to remember about beginnings, when it is time to let one go?',
      fallbackOrder: order('The Propagation Haven', 'Make a Memory Bloom and a Magical Plant so the nursery can share what it grew.', 'major', 'connection', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
      choices: [
        {
          id: 'letgo-time', label: 'Beginnings take the time they take', reply: 'They do. This one took a whole shelf’s worth of mornings.',
          style: 'patient', wispAffinity: { sprout: 2, breeze: 1 },
          order: order('A Haven With No Hurry', 'Make a Memory Bloom and a Magical Plant for a nursery that shares at its own pace.', 'major', 'ease', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish the way we began: unhurried. One bloom, one plant, then we let them go.',
          returnLine: 'A memory bloom and a magical plant, grown in their own time. When the Glow comes, the nursery can share them.',
          resolutionLine: 'Something small from here became a beginning somewhere else. It took exactly as long as it needed.',
        },
        {
          id: 'letgo-hope', label: 'Every seed is a whole garden', reply: 'A whole garden, folded up small. I can see all of them from here.',
          style: 'hopeful', wispAffinity: { bloom: 2, giggle: 1 },
          order: order('A Haven Full of Gardens', 'Make a Memory Bloom and a Magical Plant for a nursery that sends whole gardens out.', 'major', 'curiosity', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'One last shelf, then the seedlings go and become gardens. Let’s make the pieces.',
          returnLine: 'The bloom and the plant are ready to travel. The haven is only waiting on us now.',
          resolutionLine: 'I let the seedlings go and imagined every one of them blooming. For once I did not get ahead of myself. They did.',
        },
        {
          id: 'letgo-love', label: 'Caring for it was the point', reply: 'The watering was the point. The blooming was just the thank-you.',
          style: 'tender', wispAffinity: { heartlet: 2, bloom: 1 },
          order: order('A Haven That Says Thank You', 'Make a Memory Bloom and a Magical Plant for a nursery that shares what it loved.', 'major', 'comfort', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
          openingConclusion: 'We finish by giving away the things we cared for. Merge can grow the last two.',
          returnLine: 'Everything is here except the last of the Glow. When it comes, the nursery can give its seedlings away.',
          resolutionLine: 'The pots are empty again and I am not sad. Every one of them was watered. That was the whole job.',
        },
      ],
    },
  ],
  payoff: {
    styles: ['patient', 'hopeful', 'tender'],
    finalChapterWeight: 1.25,
    insightKey: 'blossle:beginning-style',
    category: 'Beginnings',
    revealTitle: 'Your way of beginning right now',
    closingLine: 'There is one empty pot back on the shelf. I am saving it for something brave.',
    insights: {
      patient: {
        id: 'patient-beginner', title: 'A Patient Beginner', emblemId: 'blossle-beginning-patient', matchOptionIds: [],
        reflection: 'You tend to begin by giving things time to root, and you hold steady by slowing down rather than pushing.',
        summary: 'I begin best when I let things take the time they take.',
      },
      hopeful: {
        id: 'hopeful-beginner', title: 'A Hopeful Beginner', emblemId: 'blossle-beginning-hopeful', matchOptionIds: [],
        reflection: 'You tend to begin with a picture of how it could go, and that picture carries you through the unknown parts.',
        summary: 'Imagining how it could go is what gets me started.',
      },
      tender: {
        id: 'tender-beginner', title: 'A Tender Beginner', emblemId: 'blossle-beginning-tender', matchOptionIds: [],
        reflection: 'You tend to begin by looking after the thing rather than judging it, and you let beginnings be crooked.',
        summary: 'Caring for something, even badly, is how I begin.',
      },
    },
    insightChoices: {
      patient: { label: 'We let things take their time', reply: 'We did. Every shelf filled up in its own season.' },
      hopeful: { label: 'We kept picturing it in bloom', reply: 'We did. And most of it bloomed, one way or another.' },
      tender: { label: 'We kept everything watered', reply: 'We did. Even the crooked ones. Especially the crooked ones.' },
    },
  },
  copy: {
    discoveryDialogue: 'You found the nursery! I can almost see this whole place in bloom—shelves, trellises, a hundred small beginnings. Right now it is mostly empty pots. Would you help me fill the first one?',
    discoveryActionLabel: 'Talk with Blossle',
    revealReactionLine: 'The mist lifts from rows of empty, hopeful pots.',
    mistNextName: 'A shelf of empty pots',
    mistDescription: 'Someone beyond this mist has been saving a pot for something brave. Clear it and meet them.',
    returnNoteTitle: 'Meet me at Seed Nursery',
    returnNoteHint: 'Return to Blossle’s nursery for the next scene',
    actionLabels: {
      start_story: 'Plan with Blossle',
      open_merge: 'Open Merge',
      continue_return: 'Talk to Blossle',
      continue_resolution: 'See what grew',
    },
    stateLabels: {
      available: 'Choose how this part of the nursery should grow.',
      orders_active: 'Requested in Merge',
      return_ready: 'Request complete',
      restoration_ready: 'Request complete · Ready to restore',
      resolution_ready: 'Restored · Story waiting',
      complete: 'Nursery story complete',
    },
    speech: {
      restoration_ready: ({ coins, cost }) => cost <= 0
        ? 'The first bed is my gift. I have been saving it.'
        : coins >= cost
          ? 'We have what we need. I can almost see it already.'
          : coins < cost / 2
            ? `${coins} of ${cost} Glow so far. Seeds start in the dark, too.`
            : 'Nearly enough. I keep picturing it.',
    },
    fallbackReturn: (chapterTitle) => `Everything for ${chapterTitle} is on the shelf. The nursery can grow whenever we have the Glow.`,
    fallbackResolution: (level) => level === 4
      ? 'The nursery sent its seedlings out into the world. I saved one pot for something brave.'
      : 'The nursery grew a little fuller, and a little more like the picture in my head.',
    wakeHandoffLine: 'Down at the pond, someone has been listening for rain. Go and say hello for me.',
    sleepingHint: 'Someone is resting among the empty pots. They will wake once the friend before them is home.',
  },
};
