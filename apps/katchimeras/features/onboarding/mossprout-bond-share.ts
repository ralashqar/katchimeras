import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { MOSSPROUT_WATER_OPTIONS, normalizeMossproutIntent } from './mossprout-ftue-copy';

// The name exchange starts the meter without granting a relationship rank.
// Sharing something personal completes the first 50-point Bond level.
export const MOSSPROUT_FTUE_NAME_BOND_TARGET = 20;
export const MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET = 50;
export const MOSSPROUT_FTUE_NAME_BOND_REWARD_PREVIEW = 10;
export const MOSSPROUT_FTUE_BOND_SHARE_REWARD_PREVIEW =
  MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - MOSSPROUT_FTUE_NAME_BOND_TARGET;

export type MossproutBondSharePrompt = {
  id: string;
  cardLabel: string;
  icon: IconSymbolName;
  prompt: string;
  reply: string;
  options: readonly {
    id: string;
    icon: IconSymbolName;
    label: string;
    reply?: string;
  }[];
};

export const MOSSPROUT_BOND_SHARE_PROMPTS = [
  {
    id: 'desired-help',
    cardLabel: 'Our first seed',
    icon: 'leaf.fill',
    prompt: 'One seed survived under my roots. I’ve been saving it. Though I seem to have forgotten what for.',
    reply: 'We can start with this one. Forests are rather a lot of paperwork.',
    options: [
      { id: 'progress', icon: 'leaf.fill', label: 'Then let’s find out.', reply: 'An excellent plan. Very little planning involved.' },
      { id: 'calm', icon: 'wind', label: 'Somewhere we can breathe.', reply: 'A quiet corner, then. Even brave roots need one.' },
      { id: 'feel_like_myself', icon: 'sun.max.fill', label: 'Something that feels like ours.', reply: 'Ours. Yes. I’d like to remember that word.' },
    ],
  },
] as const satisfies readonly MossproutBondSharePrompt[];

export const MOSSPROUT_SUPPORT_STYLE_OPTIONS = [
  { id: 'tiny_step', icon: 'leaf.fill', label: 'Find one small step.', reply: 'One root in front of the other. I can manage that.' },
  { id: 'reflect', icon: 'bubble.left.fill', label: 'Let’s work it out together.', reply: 'Good. You think, I’ll rustle thoughtfully. Then we’ll swap.' },
  { id: 'push', icon: 'bolt.fill', label: 'Remind me we can do this.', reply: 'We can do this. I’m practising saying it before we need it.' },
  { id: 'company', icon: 'heart.fill', label: 'Just stay beside me.', reply: 'That I can promise. Even when neither of us knows the way.' },
] as const;

export const MOSSPROUT_WATER_TOGETHER_OPTIONS = MOSSPROUT_WATER_OPTIONS;

const LEGACY_DESIRED_HELP_OPTIONS = [
  { id: 'energy', icon: 'bolt.fill', label: 'Getting some energy back', reply: 'Fresh starts can be very small.' },
  { id: 'good_day', icon: 'heart.fill', label: 'Just having a good day', reply: 'A good day is worth noticing while it is here.' },
  { id: 'unsure', icon: 'questionmark', label: 'I’m not sure yet', reply: 'That is all right. A seed does not need to know its whole shape.' },
] as const;

export function mossproutWaterTogetherReply(choiceId: string | null | undefined): string {
  return MOSSPROUT_WATER_TOGETHER_OPTIONS.find((option) => option.id === choiceId)?.reply
    ?? 'We can look after ourselves a little at a time.';
}

export function mossproutFirstSeedForIntent(intentId: string | null | undefined) {
  if (intentId) intentId = normalizeMossproutIntent(intentId);
  if (intentId === 'desired-help:calm') return { id: 'stillness', name: 'Seed of Stillness', message: 'Today, you wanted a little room to pause.' } as const;
  if (intentId === 'desired-help:feel_like_myself') return { id: 'renewal', name: 'Seed of Renewal', message: 'A little more light can help you feel like yourself again.' } as const;
  if (intentId === 'desired-help:energy') return { id: 'renewal', name: 'Seed of Renewal', message: 'Fresh starts can arrive one small unfurling at a time.' } as const;
  if (intentId === 'desired-help:good_day') return { id: 'warmth', name: 'Seed of Warmth', message: 'A good day is worth noticing while it is here.' } as const;
  if (intentId === 'desired-help:unsure') return { id: 'curiosity', name: 'Seed of Curiosity', message: 'Today, you left room to discover what feels right.' } as const;
  return { id: 'momentum', name: 'Seed of Momentum', message: 'A small beginning, grown from what you shared.' } as const;
}

export function mossproutBondSharePrompt(promptId: string | null | undefined) {
  return MOSSPROUT_BOND_SHARE_PROMPTS.find((prompt) => prompt.id === promptId) ?? null;
}

export function mossproutBondShareSelection(optionId: string | null | undefined) {
  if (!optionId) return null;
  const [promptId, answerId] = optionId.split(':');
  const prompt = mossproutBondSharePrompt(promptId);
  const answer = prompt?.options.find((option) => option.id === answerId)
    ?? (promptId === 'desired-help'
      ? LEGACY_DESIRED_HELP_OPTIONS.find((option) => option.id === answerId)
      : null)
    ?? null;
  return prompt && answer ? { answer, id: optionId, prompt } : null;
}

/** Shared by the graph and overlay; answer IDs retain their saved preference meanings. */
export const MOSSPROUT_SUPPORT_PROMPT = 'If we get lost out there—and I have an excellent history of getting lost—what should I do?';
export function mossproutSupportCallback(id: string | null | undefined): string {
  switch (id) {
    case 'tiny_step': return 'One small step, you said. That trail marker looks like a good place to start.';
    case 'reflect': return 'We’ll work it out together. I’ll think about those marks while my roots rest.';
    case 'push': return 'We can do this. See? I remembered. Even with my eyes half shut.';
    case 'company': return 'Beside you, remember? When my roots are rested, that’s where I’ll be.';
    default: return '';
  }
}
