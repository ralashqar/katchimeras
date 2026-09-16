import type { JourneyBeat, JourneyMissionDefinition } from '@/types/companion-journey-chapter';
import type { ConversationTraitTags } from '@/types/companion-conversation';
import { STEPPLING_WISPS } from '@/features/onboarding/corruption-wisps';

/**
 * Mossprout's Arc 1, Growing Again: what he says in each episode, and the
 * board the dark wisp is cleared on. Every line follows the Mist voice
 * (`docs/mist-narrative-plan.md` §1): short, present, one image, the verb of
 * power is look. Lines with variants are said to this player: what an
 * earlier answer established, what his theory of them says, what they
 * called today's weather. Ids are save data.
 */
const ask = (id: string, prompt: string, options: readonly (readonly [id: string, label: string, reply: string, traits?: ConversationTraitTags, fact?: string])[], factKey?: string): JourneyBeat => ({
  kind: 'ask', id, prompt,
  options: options.map(([optionId, label, reply, traits, fact]) => ({ id: optionId, label, reply, ...(traits ? { traits } : {}), ...(factKey ? { fact: { key: factKey, value: fact ?? label } } : {}) })),
});
const say = (id: string, text: string, variants?: Extract<JourneyBeat, { kind: 'say' }>['variants']): JourneyBeat => ({ kind: 'say', id, text, ...(variants ? { variants } : {}) });
const end = (text: string, variants?: Extract<JourneyBeat, { kind: 'end' }>['variants']): JourneyBeat => ({ kind: 'end', text, ...(variants ? { variants } : {}) });

export const MOSSPROUT_ARC_ONE_BEATS: Readonly<Record<string, readonly JourneyBeat[]>> = {
  'tiny-beginnings': [
    say('tiny.1', 'You looked, and the Mist let go of my garden. I kept thinking about that while I rested.', [
      { when: (ctx) => Boolean(ctx.today), text: 'You looked, and the Mist let go of my garden. Today you called the weather “{{today}}”. I keep that. It tells me what kind of day you carried in here.' },
    ]),
    ask('tiny.pace', 'When something new starts for you, what usually happens first?', [
      ['rush', 'Everything at once', 'Then the first days are the loud ones. I can work with loud.', { spontaneity: 1, ambition: 1 }, 'all at once'],
      ['circle', 'I circle it for a while', 'Circling is looking from every side. That is not nothing.', { caution: 1, overthinking: 1 }, 'slowly'],
      ['list', 'I make a list, then lose the list', 'The list did its job. It got you to the first step.', { planning: 1, avoidance: 1 }, 'with a list'],
    ], 'pace'),
    say('tiny.2', 'I am the same, in the soil. Nothing shows for days. Then it all shows at once.'),
    end('So. Tiny beginnings. Ours was a Seed. Let’s see what it turns into.'),
  ],
  'wrong-with-the-mist': [
    say('mist.1', 'You cleared the trail. I saw the Mist go, from here.'),
    say('mist.2', 'It came back thicker than it should, further out. Mist does not do that on its own. Something is feeding it.'),
    ask('mist.timing', 'When something goes wrong in your own patch, when do you usually notice?', [
      ['early', 'Straight away', 'Good. Early is when it is still small.', { curiosity: 1, planning: 1 }, 'early'],
      ['late', 'Once it’s a proper mess', 'A mess is honest, at least. You cannot argue with it.', { avoidance: 1, resilience: 1 }, 'late'],
      ['told', 'When someone points at it', 'Then I will point. Gently.', { social: 1, support_listen: 1 }, 'when told'],
    ], 'mess_timing'),
    end('Keep looking, then. Whatever is out there, it hates being seen.'),
  ],
  petalimp: [
    say('petal.1', 'Petalimp is home. She used to leave flowers on my path before I knew her name.'),
    say('petal.2', 'She is braver than me. She will tell anyone anything.', [
      { when: (ctx) => ctx.theory.friction === 'completion', text: 'She starts a hundred things and finishes about four. You two might have that in common.' },
      { when: (ctx) => ctx.theory.friction === 'starting', text: 'She never waits to be ready. I think you know what that costs.' },
    ]),
    ask('petal.friend', 'What do you look for in a friend, mostly?', [
      ['listen', 'Someone who listens', 'I can do that. Roots are good at it.', { support_listen: 2 }, 'listening'],
      ['push', 'Someone who pushes me', 'Petalimp is your friend, then. I will hold the ladder.', { support_fix: 1, ambition: 1 }, 'a push'],
      ['stay', 'Someone who just stays', 'Staying is the thing I am best at.', { support_stay: 2 }, 'staying'],
    ], 'friend_wants'),
    end('Then I will try to be that. I am better at staying than pushing.'),
  ],
  'old-garden': [
    say('grove.1', 'There is something behind the Garden I have not shown you. I was not sure I wanted to.'),
    say('grove.2', 'It is where I started. The Mist has had it longer than it had me.'),
    ask('grove.back', 'Would you go back to where you started, if you could?', [
      ['yes', 'Yes. I’d like to see it', 'Then we go together.', { curiosity: 1, optimism: 1 }, 'yes'],
      ['no', 'No. Forward is enough', 'Forward is fine. But I would like you to see this one.', { ambition: 1, novelty: 1 }, 'no'],
      ['with', 'Only with someone', 'You have someone.', { social: 1, support_stay: 1 }, 'with someone'],
    ], 'looks_back'),
    end('Come and look, then. It is called the Old Grove. I will show you the way.'),
  ],
  'grove-kept': [
    say('kept.1', 'I went back into the Grove after you had gone. Under the roots, the Mist had kept something of mine.'),
    say('kept.2', 'You said you would look back. So I did.', [
      { when: (ctx) => ctx.answers['old-garden.grove.back'] === 'grove.back:no', text: 'You said forward is enough. I think you would still want this one.' },
      { when: (ctx) => ctx.answers['old-garden.grove.back'] === 'grove.back:with', text: 'You said only with someone. I went in alone, but I was thinking of you.' },
    ]),
    ask('kept.thing', 'What is a thing you have kept far longer than you needed to?', [
      ['object', 'A thing in a drawer', 'Drawers are where the Mist starts. Take it out sometime.', { routine: 1, caution: 1 }, 'a thing in a drawer'],
      ['habit', 'A habit', 'A habit is a path worn by feet. Paths can be moved.', { routine: 2 }, 'a habit'],
      ['promise', 'A promise', 'Then it still matters. Kept things usually do.', { resilience: 1, support_stay: 1 }, 'a promise'],
    ], 'keeps'),
    end('Here. A seed from before the Mist. Plant it where you like; it will know what to do.'),
  ],
  'wisp-in-the-grove': [
    say('wisp.1', 'Something followed me out of the Grove. A wisp, but darker. It is sitting on the Old Grove now as if it owns it.'),
    ask('wisp.face', 'When something takes a place that is yours, what do you do?', [
      ['fight', 'Go straight back for it', 'Then go. I will be right behind you.', { spontaneity: 1, resilience: 1 }, 'go straight back'],
      ['wait', 'Wait for the right moment', 'The moment is now, I think. It is getting comfortable.', { caution: 1, planning: 1 }, 'wait'],
      ['ask', 'Get someone to come with me', 'You have. That is what this is.', { social: 1, support_stay: 1 }, 'bring someone'],
    ], 'faces'),
    end('Then come with me. Make light on the board and we will see how dark it really is.'),
  ],
  'growing-again': [
    say('again.1', 'The Grove is ours again. Both gardens, the old and the new, and nothing between them holding on.'),
    say('again.2', 'You kept coming back. I noticed that.', [
      { when: (ctx) => ctx.theory.reward === 'calm', text: 'You never made a fuss of any of it. I noticed that.' },
      { when: (ctx) => ctx.theory.reward === 'achievement', text: 'You wanted it finished, properly. I noticed that.' },
    ]),
    ask('again.next', 'What should we grow next, now there is room?', [
      ['new', 'Something new', 'New it is. I have seeds I have never dared plant.', { novelty: 1, curiosity: 1 }, 'something new'],
      ['old', 'Something from before', 'Then we bring it back slowly, the way it left.', { routine: 1, caution: 1 }, 'something from before'],
      ['nothing', 'Nothing yet. Let it rest', 'Rest is growing too. I of all things know that.', { rest: 2 }, 'nothing yet'],
    ], 'next_growth'),
    end('Growing again. That is what it has been the whole time. Thank you for looking.'),
  ],
};

/**
 * The dark wisp's board under the Old Grove: the same shape as Steppling's
 * trail board (two merges and six wakings), in the Garden's own things.
 */
export const OLD_GROVE_MISSION: JourneyMissionDefinition = {
  id: 'mission:mossprout-old-grove',
  storageKey: 'katchimeras.mist-mission.mossprout-old-grove.v1',
  required: 8,
  seed: {
    items: [
      { cell: 36, definitionId: 'nature:garden:1' },
      { cell: 37, definitionId: 'nature:garden:1' },
      { cell: 40, definitionId: 'nature:garden:1' },
    ],
    echoes: [{ cell: 38, id: 'old-grove-1', definitionId: 'nature:garden:2' }],
    veiled: [
      { cell: 31, id: 'old-grove-2', definitionId: 'nature:garden:3' },
      { cell: 24, id: 'old-grove-3', definitionId: 'nature:garden:5' },
      { cell: 30, id: 'old-grove-4', definitionId: 'nature:garden:1' },
      { cell: 23, id: 'old-grove-5', definitionId: 'nature:garden:2' },
      { cell: 22, id: 'old-grove-6', definitionId: 'nature:garden:3' },
    ],
  },
  guides: {
    firstMerge: { eyebrow: 'Under the roots', title: 'Two Seeds. Together.', body: 'Every merge strikes the wisp.' },
    wake: { eyebrow: 'Asleep under the Mist', title: 'Something under there wants {a} {name}.', body: 'Give it its match. What it was hiding comes with it.' },
    merge: { eyebrow: 'Two of a kind', title: 'Two of the same make {a} {name}.', body: 'Drag one onto the other. Every merge strikes the wisp.' },
    mergeFallbackTitle: 'Two of the same make the next one up.',
    free: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Two of the same, together.' },
  },
  wisps: STEPPLING_WISPS,
  lines: {
    firstStrike: 'It felt that. It is not used to being looked at.',
    fell: ['One gone. The Grove is breathing.', 'Two gone. It is thinning.', 'One left. The dark one.'],
    last: 'The last one falls. Look what it was sitting on.',
    reveal: 'The Mist bursts open where a sleeper woke. It cannot hold a place we are looking at.',
  },
};

export const MOSSPROUT_ARC_ONE_LINES = {
  purpose: 'Find the garden I started in, and what the Mist kept there.',
  foreshadow: 'I have more to tell you. Let me think it through first.',
  complete: 'Growing Again is told: the old garden and the new, with nothing between them. There is still more to share.',
  hints: {
    day_one_complete: 'Let’s finish our first day together first.',
    mist_cleared: 'When the trail past the Garden is clear, I will have something to tell you about the Mist.',
    friend_home: 'When Petalimp is home, I will tell you about her.',
    bond_level: 'I will tell you this one when we know each other a bit better.',
    evidence: 'Answer me a few more things first. I am still working you out.',
    interactions: 'Let’s share a few more small moments first.',
    since_previous: 'I am still thinking about the last thing I told you. Come back a little later.',
    episode_complete: 'There is something to finish before that.',
  },
} as const;
