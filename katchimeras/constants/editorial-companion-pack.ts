import type { AuthoredCompanionContentSeed } from '@/constants/steppling-companion-content';

export type EditorialOptions = readonly (readonly [id: string, label: string])[];
export type EditorialCompanionProfile = {
  companionName: string;
  focusName: string;
  momentName: string;
  kinds: EditorialOptions;
  effects: EditorialOptions;
  supports: EditorialOptions;
  barriers: EditorialOptions;
  details: EditorialOptions;
  fit: EditorialOptions;
  next: EditorialOptions;
  conditions: EditorialOptions;
  limits: EditorialOptions;
  learning: EditorialOptions;
  keep: EditorialOptions;
  adapt: EditorialOptions;
};

export type EditorialCompanionPack = {
  pulses: readonly AuthoredCompanionContentSeed[];
  reviews: readonly AuthoredCompanionContentSeed[];
  returns: readonly AuthoredCompanionContentSeed[];
  bonds: Readonly<Record<2 | 3 | 4, AuthoredCompanionContentSeed>>;
};

function q(title: string, prompt: string, helperText: string, options: EditorialOptions): AuthoredCompanionContentSeed {
  return { title, prompt, helperText, options: options.map(([id, label]) => ({ id, label })) };
}

export function createEditorialCompanionPack(profile: EditorialCompanionProfile): EditorialCompanionPack {
  const { companionName, focusName, momentName } = profile;
  return {
    pulses: [
      q('Notice what was present', `What kind of ${momentName} was present today?`, 'Choose the closest lived moment. No moment is useful information too.', profile.kinds),
      q('Notice the effect', `What did one ${momentName} give you today?`, 'There does not need to have been a positive effect.', profile.effects),
      q('See what helped', `What made ${focusName} easier today?`, 'Notice the conditions around it rather than judging your effort.', profile.supports),
      q('Respect the friction', `What made ${focusName} harder today?`, 'A limit, barrier, or change of mind is useful information.', profile.barriers),
      q('Keep one detail', `What detail from ${momentName} stayed with you?`, 'Choose what you genuinely remember, even if it seems ordinary.', profile.details),
      q('Check the fit', `How well did ${focusName} fit your capacity today?`, 'This is about fit, not performance.', profile.fit),
      q('Choose what suits you', `What kind of ${momentName} would suit the next few days?`, 'Choose what feels realistic now. You do not need to stretch.', profile.next),
      q('Read the conditions', `Which condition most shaped ${focusName} today?`, 'The surrounding conditions often matter more than intention.', profile.conditions),
      q('Notice a limit', `Where did a limit matter for ${focusName}?`, 'Stopping, adapting, or choosing something else can be the right response.', profile.limits),
      q('Learn from the pattern', `What are you learning about ${focusName}?`, 'Choose the clearest pattern so far, including that it varies.', profile.learning),
      q('Keep what works', `What is most worth keeping from recent ${momentName}s?`, 'Keep one useful part rather than turning it into a rule.', profile.keep),
      q('Make it kinder', `What would make this ${companionName} Focus kinder to live with?`, 'Changing, reducing, or pausing the Focus is always valid.', profile.adapt),
    ],
    reviews: [
      q('See what supports it', `Across recent ${momentName}s, what has supported you most?`, 'This is a review of conditions, not a score.', profile.supports),
      q('Notice what changed', `What has changed since you chose this ${companionName} Focus?`, 'A clearer preference or barrier counts as change.', profile.learning),
      q('Make the Focus fit', `What would make ${focusName} more realistic now?`, 'Reduce, adapt, or pause it to fit your life.', profile.adapt),
      q('Choose what continues', 'What would you most like to carry into the next week?', 'Keep one useful thread. You do not need to repeat everything.', profile.keep),
    ],
    returns: [
      q('Does this still fit?', `Does your current ${companionName} Focus still fit your life?`, 'An earlier choice can be useful and still need to change.', [['fits', 'It still fits'], ['adjust', 'I want to adjust it'], ['pause', 'I want to pause it'], ['complete', 'It feels complete'], ['unsure', 'I am not sure']]),
      q('Check what you want', `Do you still want the same thing from ${focusName}?`, 'Choose what is true now, not what you previously hoped for.', [['same', 'Yes, the same thing'], ['partly', 'Partly'], ['different', 'I want something different'], ['less', 'It matters less now'], ['unsure', 'I am not sure']]),
      q('Check the barrier', `Is the same thing still making ${focusName} difficult?`, 'The conditions may have changed.', [['same', 'Yes, much the same'], ['different', 'Something different'], ['easier', 'It has become easier'], ['varies', 'It varies'], ['unclear', 'There is no clear pattern']]),
      q('Choose what happens next', `What would you like to do with this ${companionName} Focus?`, 'Continuing, changing, pausing, and finishing are all valid.', [['continue', 'Continue as it is'], ['reshape', 'Reshape it'], ['smaller', 'Make it smaller'], ['pause', 'Pause it'], ['complete', 'Mark it complete']]),
    ],
    bonds: {
      2: q('You know each other better', `How would you like ${companionName} to support you?`, 'Choose a style of support, not another target.', [['gentle', 'Keep encouragement gentle'], ['patterns', 'Help me notice patterns'], ['small', 'Offer small ideas'], ['choice', 'Let me set the pace']]),
      3: q('A pattern between you', `What has ${companionName} helped you learn about yourself?`, 'Choose the pattern that has become clearest.', profile.learning),
      4: q('A shared history', `What should ${companionName} carry forward?`, 'Choose what future invitations should remember.', profile.keep),
    },
  };
}
