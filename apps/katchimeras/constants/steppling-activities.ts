import type { ConversationDefinition } from '@/types/companion-conversation';
export const STEPPLING_STEP_MILESTONES = [
  { steps: 500, bond: 1 }, { steps: 2000, bond: 2 }, { steps: 4000, bond: 3 },
  { steps: 6000, bond: 4 }, { steps: 10000, bond: 5 },
] as const;

export const STEPPLING_TRAIL_CHATS = [
  { id: 'pocket-route', title: 'Pick a pocket adventure', question: 'We have ten minutes and a very small map. Where are we going?', options: [
    { id: 'new', label: 'A street I’ve never tried', reply: 'An unexplored corner! Our quest can be as small as finding one new thing.', insight: 'A little novelty makes movement more inviting.' },
    { id: 'familiar', label: 'My favourite familiar loop', reply: 'Excellent. A route that already feels like ours. What would you stop to enjoy?', insight: 'Familiar places can make it easier to get moving.' },
  ] },
  { id: 'walking-power', title: 'Choose your walking power', question: 'Your shoes gain one magical power. Which would you choose?', options: [
    { id: 'quiet', label: 'Turn down noisy thoughts', reply: 'Quiet soles! We don’t have to solve anything on this walk. Just notice what is around us.', insight: 'You would like movement to offer some headspace.' },
    { id: 'company', label: 'Summon good company', reply: 'Two pairs of footsteps, one wandering conversation. Who would you invite?', insight: 'Company can make movement feel more appealing.' },
  ] },
  { id: 'tiny-start', title: 'The reluctant-shoe challenge', question: 'My shoes are hiding under the bed. What’s our smallest possible adventure?', options: [
    { id: 'door', label: 'Just reach the doorway', reply: 'A doorway counts as a beginning. Once we’re there, we can decide whether to go further.', insight: 'A tiny first step can make starting feel easier.' },
    { id: 'errand', label: 'Give the walk a purpose', reply: 'A tiny delivery quest! The destination can do the motivating while we enjoy the way there.', insight: 'A useful destination can help you start moving.' },
  ] },
  { id: 'trail-treasure', title: 'Find our trail treasure', question: 'No gold on this trail today. What would make the walk worth keeping?', options: [
    { id: 'notice', label: 'Something I almost missed', reply: 'A determined weed? A cloud shaped like a boot? Small discoveries deserve a place on our map.', insight: 'Noticing small details can make an ordinary route rewarding.' },
    { id: 'feeling', label: 'How I feel afterwards', reply: 'Then we’ll check in with ourselves at the end. No required feeling—just see what changed.', insight: 'You are curious about how movement leaves you feeling.' },
  ] },
] as const;


/** Authored content for the existing conversation engine, not a separate chat UI. */
export const STEPPLING_TRAIL_CONVERSATIONS: readonly ConversationDefinition[] = STEPPLING_TRAIL_CHATS.map((chat) => ({
  id: `steppling:trail-chat:${chat.id}`, version: 1, familyId: 'steppling', title: chat.title, actionTitle: chat.title,
  trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3650, contextualOnly: true,
  format: 'narrative', purpose: 'learned_insight', returnTarget: 'character_home', repeatPolicy: 'once_ever',
  topicKey: chat.id, tags: ['steppling', 'trail-chat'], entryNodeId: 'question',
  nodes: [
    { id: 'question', kind: 'choice', prompt: chat.question, options: chat.options.map((option) => ({ id: option.id, label: option.label, reply: option.reply, nextNodeId: 'insight' })) },
    { id: 'insight', kind: 'insight_reveal', title: 'A little discovery for our trail', insightKey: `steppling:trail-chat:${chat.id}`, category: 'Movement', allowSecondary: false,
      results: chat.options.map((option) => ({ id: option.id, title: chat.title, reflection: option.reply, summary: option.insight, emblemId: 'steppling-trail', matchOptionIds: [option.id] })), nextNodeId: 'finish' },
    { id: 'finish', kind: 'end', message: 'One more little thing we know about our path. Let’s take it with us.' },
  ],
}));
