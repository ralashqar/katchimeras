export type AuthoredCompanionContentSeed = {
  title?: string;
  prompt: string;
  helperText: string;
  options: readonly { id: string; label: string }[];
};

export const STEPPLING_DAILY_PULSES: readonly AuthoredCompanionContentSeed[] = [
  {
    title: 'Check in with today',
    prompt: 'What was walking like for you today?',
    helperText: 'A short walk, a practical journey, or no walk at all are all useful answers.',
    options: [
      { id: 'no-walk', label: 'I did not walk today' },
      { id: 'brief-walk', label: 'I fitted in a short walk' },
      { id: 'made-time', label: 'I chose to make time for it' },
      { id: 'longer-walk', label: 'I walked more than usual' },
      { id: 'felt-difficult', label: 'Walking felt difficult today' },
    ],
  },
  {
    title: 'Find where it fits',
    prompt: 'When did walking fit most naturally today?',
    helperText: 'Think about what already fitted into your day without much effort.',
    options: [
      { id: 'everyday-journey', label: 'During an everyday journey' },
      { id: 'short-break', label: 'During a short break' },
      { id: 'around-routine', label: 'Before or after something else' },
      { id: 'time-set-aside', label: 'When I set time aside' },
      { id: 'did-not-fit', label: 'It did not fit today' },
    ],
  },
  {
    title: 'Notice the after-effect',
    prompt: 'What did you notice after walking?',
    helperText: 'There does not need to be a positive change. Choose what came closest.',
    options: [
      { id: 'more-headspace', label: 'I had more headspace' },
      { id: 'more-energy', label: 'I had a little more energy' },
      { id: 'calmer', label: 'I felt calmer' },
      { id: 'tired-uncomfortable', label: 'I felt tired or uncomfortable' },
      { id: 'no-change', label: 'I did not notice a clear change' },
    ],
  },
  {
    title: 'Notice what helped',
    prompt: 'What made it easier to start walking today?',
    helperText: 'The conditions around a walk often matter more than willpower.',
    options: [
      { id: 'clear-reason', label: 'I had a clear reason to go' },
      { id: 'easy-route', label: 'The route was easy to use' },
      { id: 'enough-time', label: 'I had enough time' },
      { id: 'company', label: 'Someone came with me' },
      { id: 'nothing-helped', label: 'Nothing made it easier today' },
    ],
  },
  {
    title: 'Notice the friction',
    prompt: 'What made walking harder today?',
    helperText: 'This is information, not a judgement about effort.',
    options: [
      { id: 'time', label: 'I did not have enough time' },
      { id: 'surroundings', label: 'The weather or surroundings' },
      { id: 'body-needed-rest', label: 'My body needed rest' },
      { id: 'hard-to-start', label: 'It was hard to get started' },
      { id: 'nothing-harder', label: 'Nothing made it harder' },
    ],
  },
  {
    title: 'Keep one detail',
    prompt: 'What held your attention while you walked?',
    helperText: 'Choose the part of the walk you remember most clearly.',
    options: [
      { id: 'surroundings', label: 'What was around me' },
      { id: 'thoughts', label: 'My thoughts' },
      { id: 'body-pace', label: 'My body or pace' },
      { id: 'destination', label: 'Where I was going' },
      { id: 'nothing-specific', label: 'Nothing in particular' },
    ],
  },
  {
    title: 'Choose what suits you',
    prompt: 'What kind of walk would suit your next few days?',
    helperText: 'Choose what feels realistic now. You do not need to stretch yourself.',
    options: [
      { id: 'very-short', label: 'A very short walk' },
      { id: 'practical', label: 'A walk with a practical purpose' },
      { id: 'familiar', label: 'A familiar, unhurried route' },
      { id: 'new-place', label: 'Somewhere a little different' },
      { id: 'none-now', label: 'No walk for now' },
    ],
  },
  {
    title: 'Find your pace',
    prompt: 'How did your walking pace feel?',
    helperText: 'This is about comfort and experience, not speed.',
    options: [
      { id: 'comfortable', label: 'Comfortable' },
      { id: 'rushed', label: 'More rushed than I wanted' },
      { id: 'slow-good', label: 'Slower, in a good way' },
      { id: 'varied', label: 'It changed as I went' },
      { id: 'not-sure', label: 'I am not sure' },
    ],
  },
  {
    title: 'Make returning easier',
    prompt: 'What makes a walk easier for you to repeat?',
    helperText: 'Look for support you can use again, rather than a rule to follow.',
    options: [
      { id: 'routine', label: 'A familiar time or routine' },
      { id: 'purpose', label: 'Having somewhere to go' },
      { id: 'enjoyable-route', label: 'A route I enjoy' },
      { id: 'company', label: 'Walking with someone' },
      { id: 'flexibility', label: 'Keeping it flexible' },
    ],
  },
  {
    title: 'Read the pattern',
    prompt: 'When does walking seem to work best for you?',
    helperText: 'A loose pattern is enough. It does not need to become a schedule.',
    options: [
      { id: 'morning', label: 'In the morning' },
      { id: 'middle-day', label: 'In the middle of the day' },
      { id: 'evening', label: 'Later in the day' },
      { id: 'weekend', label: 'On less structured days' },
      { id: 'no-pattern', label: 'There is no clear pattern yet' },
    ],
  },
  {
    title: 'Keep what works',
    prompt: 'What is most worth keeping from your recent walks?',
    helperText: 'Choose the part that made walking easier or more worthwhile.',
    options: [
      { id: 'time', label: 'The time of day' },
      { id: 'route', label: 'A route I liked' },
      { id: 'reason', label: 'The reason for going' },
      { id: 'pace', label: 'A comfortable pace' },
      { id: 'adapt', label: 'The freedom to adapt' },
    ],
  },
  {
    title: 'Make it kinder',
    prompt: 'What would make your walking Focus easier to live with?',
    helperText: 'Changing the plan is part of learning what fits.',
    options: [
      { id: 'smaller', label: 'Make the aim smaller' },
      { id: 'flexible', label: 'Make it more flexible' },
      { id: 'different-time', label: 'Try a different time' },
      { id: 'different-route', label: 'Try a different route' },
      { id: 'pause', label: 'Pause it for now' },
    ],
  },
];

export const STEPPLING_PROGRESS_REVIEWS: readonly AuthoredCompanionContentSeed[] = [
  {
    title: 'See what is helping',
    prompt: 'Across your recent walks, what has helped most?',
    helperText: 'This is a review, not a score. Choose the support you noticed most often.',
    options: [
      { id: 'regular-time', label: 'A regular time' },
      { id: 'useful-reason', label: 'A useful reason to walk' },
      { id: 'good-route', label: 'A route I like' },
      { id: 'keeping-short', label: 'Keeping walks short' },
      { id: 'not-sure', label: 'I am not sure yet' },
    ],
  },
  {
    title: 'Notice what changed',
    prompt: 'What has changed since you chose this walking Focus?',
    helperText: 'Small changes and clearer barriers both count as progress in understanding.',
    options: [
      { id: 'more-often', label: 'I walk more often' },
      { id: 'easier-start', label: 'Starting feels easier' },
      { id: 'notice-benefit', label: 'I notice what walking gives me' },
      { id: 'know-barriers', label: 'I understand what gets in the way' },
      { id: 'no-change', label: 'Nothing has clearly changed yet' },
    ],
  },
  {
    title: 'Make the Focus fit',
    prompt: 'What would make your walking Focus more realistic now?',
    helperText: 'You can reduce, change, or pause the Focus. All are valid choices.',
    options: [
      { id: 'smaller', label: 'A smaller aim' },
      { id: 'flexible', label: 'More flexibility' },
      { id: 'different-time', label: 'A different time' },
      { id: 'different-route', label: 'A different kind of route' },
      { id: 'pause', label: 'A pause for now' },
    ],
  },
  {
    title: 'Choose what continues',
    prompt: 'What would you most like to carry into the next week?',
    helperText: 'Keep one useful part. You do not need to repeat everything.',
    options: [
      { id: 'short-walks', label: 'Short walks that are easy to start' },
      { id: 'useful-journeys', label: 'Walking for everyday journeys' },
      { id: 'headspace', label: 'Walking for headspace' },
      { id: 'exploration', label: 'Noticing or exploring nearby' },
      { id: 'rest', label: 'More room for rest and flexibility' },
    ],
  },
];

export const STEPPLING_RETURN_CONVERSATIONS: readonly AuthoredCompanionContentSeed[] = [
  {
    title: 'Does this still fit?',
    prompt: 'Does your current walking Focus still fit your life?',
    helperText: 'An earlier choice can be useful and still need to change.',
    options: [
      { id: 'still-fits', label: 'It still fits' },
      { id: 'adjust', label: 'I want to adjust it' },
      { id: 'pause', label: 'I want to pause it' },
      { id: 'complete', label: 'It feels complete' },
      { id: 'not-sure', label: 'I am not sure yet' },
    ],
  },
  {
    title: 'Check the reason',
    prompt: 'Do you still want the same thing from walking?',
    helperText: 'Your reason for walking may change as your life changes.',
    options: [
      { id: 'same', label: 'Yes, the same thing' },
      { id: 'partly', label: 'Partly, but not completely' },
      { id: 'changed', label: 'No, what I want has changed' },
      { id: 'unsure', label: 'I am not sure yet' },
    ],
  },
  {
    title: 'Check what gets in the way',
    prompt: 'Is the same thing still making walking difficult?',
    helperText: 'Choose what is true now, even if it differs from your earlier answer.',
    options: [
      { id: 'same-barrier', label: 'Yes, it is much the same' },
      { id: 'different-barrier', label: 'Something different gets in the way' },
      { id: 'less-difficult', label: 'Walking has become easier' },
      { id: 'varies', label: 'It varies from day to day' },
      { id: 'unsure', label: 'I am not sure yet' },
    ],
  },
  {
    title: 'Choose what happens next',
    prompt: 'What would you like to do with this walking Focus now?',
    helperText: 'Continuing, changing, pausing, and finishing are all valid choices.',
    options: [
      { id: 'continue', label: 'Continue as it is' },
      { id: 'reshape', label: 'Change the Focus' },
      { id: 'pause', label: 'Pause it for now' },
      { id: 'complete', label: 'Mark it complete' },
      { id: 'later', label: 'Decide another day' },
    ],
  },
];

export const STEPPLING_BOND_MOMENTS: Readonly<Record<2 | 3 | 4, AuthoredCompanionContentSeed>> = {
  2: {
    title: 'You know each other better',
    prompt: 'How would you like Steppling to support your walking?',
    helperText: 'This shapes the tone of later invitations. It is not another target.',
    options: [
      { id: 'gentle-encouragement', label: 'Encourage me gently' },
      { id: 'notice-patterns', label: 'Help me notice patterns' },
      { id: 'small-suggestions', label: 'Offer small, practical ideas' },
      { id: 'set-my-pace', label: 'Let me set the pace' },
    ],
  },
  3: {
    title: 'A pattern between you',
    prompt: 'What has walking helped you understand about yourself?',
    helperText: 'Choose what feels clearest from the time you have spent with Steppling.',
    options: [
      { id: 'energy', label: 'How walking affects my energy' },
      { id: 'headspace', label: 'How it affects my headspace' },
      { id: 'routines', label: 'Which routines support me' },
      { id: 'barriers', label: 'What makes walking difficult' },
      { id: 'surroundings', label: 'How much I notice around me' },
    ],
  },
  4: {
    title: 'A shared history',
    prompt: 'What would you most like Steppling to carry forward?',
    helperText: 'Think about what should remain part of future walks and invitations.',
    options: [
      { id: 'habit', label: 'A walking habit I built' },
      { id: 'self-knowledge', label: 'What I learned about myself' },
      { id: 'routes', label: 'Routes and places that mattered' },
      { id: 'gentler-approach', label: 'A gentler approach to movement' },
      { id: 'curiosity', label: 'The habit of noticing as I go' },
    ],
  },
};
