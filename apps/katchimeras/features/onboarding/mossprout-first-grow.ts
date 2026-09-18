/** First Bond scenario. Stable notice IDs preserve existing checkpoints and rewards. */
export const MOSSPROUT_GARDEN_RETURN = {
  prompt: 'Our light reached the broken marker. The old roots still know the way!',
  choices: [
    { id: 'pleased', label: '🏮 Did we just do that?', reply: 'We did. One Garden awake, one root carrying light. My impressive glowing days may not be behind me after all.' },
    { id: 'together', label: '🌳 Why did it stop there?', reply: 'The trail is broken. Steppling used to mend these paths. Three notches—that is his mark.' },
    { id: 'next', label: '🥾 Let’s follow it.', reply: 'Yes! Steppling’s trail first. Heartwood needs more than my Garden. Steppling can help its roots find our other friends.' },
  ],
  invitation: 'The light can show someone the way. We can give them a reason to stay.',
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
