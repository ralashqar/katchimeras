import type { HatchProfileDefinition } from '@/features/onboarding/hatch-profile';

/** The two Wisps around Feastle's Egg. No camera, diet target or food judgement. */
export const FEASTLE_HATCH_PROFILE: HatchProfileDefinition = {
  katchimeraId: 'feastle', domain: 'food', version: 2,
  questions: [
    {
      id: 'friction', dimension: 'primaryFriction', title: 'What gets in the way of a little mealtime pause?',
      options: [
        { id: 'rushed', label: 'A busy day', reply: 'Some days run past the table. We can leave a place ready.' },
        { id: 'decisions', label: 'Too many things to choose', reply: 'A long menu can be a lot. We can start with one familiar thing.' },
        { id: 'energy', label: 'Not much energy', reply: 'Then simple is a proper recipe. No grand feast required.' },
      ],
    },
    {
      id: 'support', dimension: 'supportPreference', title: 'What would make our table feel welcoming?',
      options: [
        { id: 'familiar', label: 'Something simple and familiar', reply: 'We can keep a small favourite close to the hearth.' },
        { id: 'company', label: 'A little company', reply: 'Then I will move the bench along. There is room for two.' },
        { id: 'quiet', label: 'A quiet moment of my own', reply: 'A quiet seat, just for you. The fire can do the talking.' },
      ],
    },
  ],
};
