/** First Bond scenario. Stable notice IDs preserve existing checkpoints and rewards. */
export const MOSSPROUT_GARDEN_RETURN = {
  prompt: 'Wait. Beyond the trees. Did that light move?',
  choices: [
    { id: 'pleased', label: 'Please tell me that was you.', reply: 'My impressive glowing days are mostly behind me. That came from farther away.' },
    { id: 'together', label: 'It flashed when ours did.', reply: 'Just when the roots lit up? Then perhaps this Garden reaches farther than I remember.' },
    { id: 'next', label: 'Could someone be out there?', reply: 'I used to know every light in these trees. I would very much like one of them to be a friend.' },
  ],
  invitation: 'If someone is out there, we’d better make this place worth finding.',
};
export const MOSSPROUT_FIRST_NOTICE = {
  id: 'first-notice',
  prompt: 'A lost friend follows that light to our Garden. What’s the first thing you’d offer them?',
  choices: [
    { id: 'light', label: '🏮 A trail of tiny lanterns', reply: 'So they never have to wonder which way is home. I like how you think.' },
    { id: 'sound', label: '🍵 A warm drink and a seat', reply: 'A seat without thorns, ideally. I’m still learning what other people find comfortable.' },
    { id: 'growing', label: '🌱 A garden patch of their own', reply: 'Their very own corner? Then they wouldn’t just be visiting. They’d belong here.' },
  ],
};
export const MOSSPROUT_FIRST_GROW_STEPS = ['companion.water_together', 'companion.first_grow', 'companion.first_notice'] as const;
export const isMossproutFirstGrowStep = (stepId?: string | null) => MOSSPROUT_FIRST_GROW_STEPS.some((step) => step === stepId);
