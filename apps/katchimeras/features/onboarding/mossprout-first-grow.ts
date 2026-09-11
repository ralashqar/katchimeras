/** Authored first-use copy; the noticing prompt stays fixed across days/relaunches. */
export const MOSSPROUT_GARDEN_RETURN = {
  prompt: 'Oh. I can see the ground again. I’d half forgotten it was there. That’s what the Mist does.',
  choices: [
    { id: 'pleased', label: 'You look pleased.', reply: 'I am. I was trying to look mysterious, but pleased will do.' },
    { id: 'together', label: 'We did that.', reply: 'We did. You brought one piece of your day, and the Mist had to make room for it.' },
    { id: 'next', label: 'What happens now?', reply: 'We keep noticing little things. Every one is light, and there’s room for all of it here.' },
  ],
  invitation: 'Your turn. Look up from this for a moment.',
};
export const MOSSPROUT_FIRST_NOTICE = {
  id: 'first-notice',
  prompt: 'What’s there, around you?',
  choices: [
    { id: 'light', label: 'Some light', reply: 'An ordinary corner, looked at. The Mist never gets those. I like that you caught it.' },
    { id: 'sound', label: 'A small sound', reply: 'There’s a whole little world going on when we stop to listen. Listening counts as looking.' },
    { id: 'growing', label: 'Something growing', reply: 'A neighbour of mine, perhaps. Thank you for noticing it. Things grow better noticed.' },
  ],
};
export const MOSSPROUT_FIRST_GROW_STEPS = ['companion.water_together', 'companion.first_grow', 'companion.first_notice'] as const;
export const isMossproutFirstGrowStep = (stepId?: string | null) => MOSSPROUT_FIRST_GROW_STEPS.some((step) => step === stepId);
