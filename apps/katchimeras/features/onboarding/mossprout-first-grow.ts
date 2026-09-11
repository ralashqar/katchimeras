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
  prompt: 'Quick, before the Mist notices. What’s one thing near you it would love you to forget?',
  choices: [
    { id: 'light', label: 'A small good thing', reply: 'A small good thing, looked at. That is exactly what the Mist can’t take.' },
    { id: 'sound', label: 'A sound I’d miss', reply: 'A sound you’d miss. Listening counts as looking.' },
    { id: 'growing', label: 'Something alive', reply: 'Something alive. A neighbour of mine, perhaps. Things grow better noticed.' },
  ],
};
export const MOSSPROUT_FIRST_GROW_STEPS = ['companion.water_together', 'companion.first_grow', 'companion.first_notice'] as const;
export const isMossproutFirstGrowStep = (stepId?: string | null) => MOSSPROUT_FIRST_GROW_STEPS.some((step) => step === stepId);
