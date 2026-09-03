import type { IconSymbolName } from '@/components/ui/icon-symbol';

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
    id: 'growth-intent',
    cardLabel: 'What we’ll grow',
    icon: 'leaf.fill',
    prompt: 'Is it something you want more of… or something you’re trying to fix?',
    reply: 'Good. I don’t need to know everything today. We can grow it bit by bit.',
    options: [
      { id: 'want_to_grow', icon: 'sparkles', label: 'Something I want to grow', reply: 'Then we’ll begin with one small, living thing.' },
      { id: 'want_to_improve', icon: 'puzzlepiece.fill', label: 'Something I want to improve', reply: 'We can make it better without asking it to become perfect.' },
      { id: 'not_sure_yet', icon: 'questionmark', label: 'I’m not really sure yet', reply: 'That’s all right. A seed doesn’t need to know its whole shape.' },
    ],
  },
] as const satisfies readonly MossproutBondSharePrompt[];

export const MOSSPROUT_WATER_TOGETHER_OPTIONS = [
  { id: 'could_use_water', icon: 'drop.fill', label: 'I could probably use some water', reply: 'Then let’s both have a drink today. Nothing grand—just one little watering.' },
  { id: 'already_good', icon: 'checkmark.circle.fill', label: 'I’m good', reply: 'Look at you, already watered. I’ll try to keep up.' },
  { id: 'dont_start', icon: 'face.smiling.fill', label: 'Mossprout, don’t start', reply: 'Ha! All right, all right. I’ll tend my roots and mind my leaves.' },
] as const;

export function mossproutWaterTogetherReply(choiceId: string | null | undefined): string {
  return MOSSPROUT_WATER_TOGETHER_OPTIONS.find((option) => option.id === choiceId)?.reply
    ?? 'We can look after ourselves a little at a time.';
}

export function mossproutFirstSeedForIntent(intentId: string | null | undefined) {
  if (intentId === 'growth-intent:want_to_improve') return {
    id: 'seed-of-patience',
    name: 'Seed of Patience',
    message: 'Make one small thing kinder than it was yesterday.',
  };
  if (intentId === 'growth-intent:not_sure_yet') return {
    id: 'seed-of-curiosity',
    name: 'Seed of Curiosity',
    message: 'Notice what gives you a little more life.',
  };
  return {
    id: 'seed-of-momentum',
    name: 'Seed of Momentum',
    message: 'Start small enough that starting isn’t scary.',
  };
}

export function mossproutBondSharePrompt(promptId: string | null | undefined) {
  return MOSSPROUT_BOND_SHARE_PROMPTS.find((prompt) => prompt.id === promptId) ?? null;
}

export function mossproutBondShareSelection(optionId: string | null | undefined) {
  if (!optionId) return null;
  const [promptId, answerId] = optionId.split(':');
  const prompt = mossproutBondSharePrompt(promptId);
  const answer = prompt?.options.find((option) => option.id === answerId) ?? null;
  return prompt && answer ? { answer, id: optionId, prompt } : null;
}
