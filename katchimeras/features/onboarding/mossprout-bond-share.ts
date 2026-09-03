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
    cardLabel: 'What would help',
    icon: 'leaf.fill',
    prompt: 'What would help most right now?',
    reply: 'Good. We do not have to grow a whole forest today.',
    options: [
      { id: 'progress', icon: 'leaf.fill', label: 'Making a little progress', reply: 'Then we will begin with one small, living thing.' },
      { id: 'calm', icon: 'wind', label: 'Finding a little calm', reply: 'Then let us make a little room for quiet.' },
      { id: 'feel_like_myself', icon: 'sun.max.fill', label: 'Feeling more like myself', reply: 'Then let us grow a little more light for whatever today needs.' },
    ],
  },
] as const satisfies readonly MossproutBondSharePrompt[];

export const MOSSPROUT_SUPPORT_STYLE_OPTIONS = [
  { id: 'tiny_step', icon: 'leaf.fill', label: 'Give me one small thing to try', reply: 'Small is good. Tiny roots still count.' },
  { id: 'reflect', icon: 'bubble.left.fill', label: 'Help me think it through', reply: 'Oh, good. I like thinking. Possibly too much.' },
  { id: 'push', icon: 'bolt.fill', label: 'Give me a push', reply: 'All right. I can be surprisingly stern for something this leafy.' },
  { id: 'company', icon: 'heart.fill', label: 'Mostly just keep me company', reply: 'I can do that. We do not always need to turn everything into a project.' },
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
  if (intentId === 'desired-help:calm') return { id: 'stillness', name: 'Seed of Stillness', message: 'Quiet can be something you grow, not something you wait for.' } as const;
  if (intentId === 'desired-help:feel_like_myself') return { id: 'renewal', name: 'Seed of Renewal', message: 'A little more light can help you feel like yourself again.' } as const;
  if (intentId === 'desired-help:energy') return { id: 'renewal', name: 'Seed of Renewal', message: 'Fresh starts can arrive one small unfurling at a time.' } as const;
  if (intentId === 'desired-help:good_day') return { id: 'warmth', name: 'Seed of Warmth', message: 'A good day is worth noticing while it is here.' } as const;
  if (intentId === 'desired-help:unsure') return { id: 'curiosity', name: 'Seed of Curiosity', message: 'Not knowing can still be a place to begin.' } as const;
  return { id: 'momentum', name: 'Seed of Momentum', message: 'Start small enough that starting isn’t scary.' } as const;
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
