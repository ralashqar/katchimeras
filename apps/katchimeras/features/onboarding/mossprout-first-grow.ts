/** Authored first-use copy; the noticing prompt stays fixed across days/relaunches. */
export const MOSSPROUT_GARDEN_RETURN = {
  prompt: 'Oh. I can see the ground again. I was beginning to think this garden was made entirely of fog.',
  choices: [
    { id: 'pleased', label: 'You look pleased.', reply: 'I am. I was trying to look mysterious, but pleased will do.' },
    { id: 'together', label: 'We did that.', reply: 'We did. You brought the first little piece of your day, and we gave it somewhere to grow.' },
    { id: 'next', label: 'What happens now?', reply: 'We keep finding little things worth paying attention to. There’s room for them here.' },
  ],
  invitation: 'The garden’s had some attention. Let’s save a little for your world, too.',
};
export const MOSSPROUT_FIRST_NOTICE = {
  id: 'first-notice',
  prompt: 'Take a look around you. What catches your attention?',
  choices: [
    { id: 'light', label: 'Some light', reply: 'It can make an ordinary corner look like somewhere new. I like that you caught it.' },
    { id: 'sound', label: 'A small sound', reply: 'There’s a whole little world going on when we stop to listen.' },
    { id: 'growing', label: 'Something growing', reply: 'A neighbour of mine, perhaps. Thank you for noticing it.' },
  ],
};
export const MOSSPROUT_FIRST_GROW_STEPS = ['companion.water_together', 'companion.first_grow', 'companion.first_notice'] as const;
export const isMossproutFirstGrowStep = (stepId?: string | null) => MOSSPROUT_FIRST_GROW_STEPS.some((step) => step === stepId);
