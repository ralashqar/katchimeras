import type { CompanionDailyConfig, CompanionNoticePrompt, CompanionPhotoFollowUp } from '@/types/companion-daily';

/**
 * Mossprout's daily activities: water, a photo of something growing, and
 * noticing one small thing, behind his "Grow with Mossprout" card. The first
 * daily config; every string and rule the shared card, store and camera
 * needed for him lives here.
 */

export const NATURE_PHOTO_CHOICES: readonly CompanionPhotoFollowUp[] = [
  { id: 'colour', label: 'Its colour', reply: 'A little colour can make a familiar corner worth another look.' },
  { id: 'shape', label: 'Its shape', reply: 'Leaves and branches have such different ways of reaching out.' },
  { id: 'place', label: 'Where it’s growing', reply: 'I like finding a little life in an unexpected place. Thank you for showing me.' },
];

export const MOSSPROUT_NOTICE_PROMPTS: readonly CompanionNoticePrompt[] = [
  { id: 'light', prompt: 'Find a patch of sunlight. What do you notice there?', choices: [
    { id: 'warmth', label: 'A little warmth', reply: 'A warm patch, just sitting there. I’m glad you found it.' },
    { id: 'shadow', label: 'An interesting shadow', reply: 'Even a familiar leaf can draw a new shape in the light.' },
    { id: 'soft-light', label: 'Soft light through clouds', reply: 'Clouds have their own way of sharing the light.' },
  ] },
  { id: 'sound', prompt: 'Pause and listen for a natural sound. What can you hear?', choices: [
    { id: 'birds', label: 'A bird or another animal', reply: 'A little neighbour carrying on with their day. We got to listen in.' },
    { id: 'wind', label: 'Wind or rustling leaves', reply: 'A sound that changes as you listen. Leaves never quite repeat themselves.' },
    { id: 'water', label: 'Rain or moving water', reply: 'A few drops can give a whole place its own rhythm.' },
  ] },
  { id: 'change', prompt: 'Look for a small sign of change. What caught your attention?', choices: [
    { id: 'growth', label: 'Something growing', reply: 'A new leaf, a longer stem—small changes still count as growing.' },
    { id: 'weather', label: 'Different light or weather', reply: 'The same view can feel quite different when the sky changes.' },
    { id: 'seasons', label: 'A sign of the season', reply: 'A little clue to where we are in the year. Let’s keep that one.' },
  ] },
];

export const MOSSPROUT_DAILY: CompanionDailyConfig = {
  chapterTitle: 'Our Garden',
  restingLine: 'Mossprout is resting. A little quiet, a little growing.',
  idleLine: 'Our chapter is remembered. There is still more to share.',
  questionSubtitle: 'One quick scene. The village answers too.',
  presentation: 'menu',
  menu: { title: 'Grow with Mossprout', subtitle: 'Water, a nature photo, or a quiet moment.', artKey: 'mossprout:plant-care' },
  savingLine: 'Let’s keep this little moment.',
  water: true,
  photo: {
    category: 'nature',
    title: 'Show Mossprout something growing',
    subtitle: 'A plant, tree, or flower. A windowsill plant counts.',
    artKey: 'today:photo',
    camera: {
      icon: 'leaf.fill',
      title: 'Show Mossprout something growing',
      subtitle: 'A plant, tree, or flower. A windowsill plant counts.',
      permissionTitle: 'Something growing, just for Mossprout',
      permissionBody: 'Show Mossprout a plant, tree, or flower near you. A windowsill plant counts.',
      analysingLine: 'Looking for something growing…',
    },
    match: { qualityIds: ['nature.plants', 'nature.flowers', 'nature.blossom', 'place.garden', 'place.forest'] },
    lines: {
      unsure: 'I’m not quite sure what I can see. What did you find?',
      question: 'A little green neighbour! What caught your eye?',
      noMatch: 'I couldn’t find something growing in that photo. A plant, tree, or flower would be lovely.',
      thanks: ['Thank you for showing me.'],
    },
    confirm: [
      { id: 'plant', label: 'A plant or tree', qualityId: 'nature.plants', subject: 'A plant or tree' },
      { id: 'flowers', label: 'Flowers', qualityId: 'nature.flowers', subject: 'Flowers' },
    ],
    followUps: NATURE_PHOTO_CHOICES,
    keepPhoto: { directory: 'mossprout-memories', memoryArchetype: 'nature', memoryLabel: (answer) => `With Mossprout: ${answer}` },
  },
  notice: { title: 'Notice one small thing', artKey: 'mossprout:nature-observation', prompts: MOSSPROUT_NOTICE_PROMPTS },
  polls: [],
};
