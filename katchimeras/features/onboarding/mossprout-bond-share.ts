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
    id: 'hard-day-help',
    cardLabel: 'What helps on a hard day?',
    icon: 'leaf.fill',
    prompt: 'What usually helps when your day isn’t going well?',
    reply: 'I’ll remember that.',
    options: [
      { id: 'getting_outside', icon: 'leaf.fill', label: 'Getting outside', reply: 'Fresh air does make things feel less stuck.' },
      { id: 'being_with_someone', icon: 'person.2.fill', label: 'Being with someone', reply: 'It’s easier when you’re not carrying everything alone.' },
      { id: 'having_time_alone', icon: 'house.fill', label: 'Having time alone', reply: 'Quiet helps some things grow.' },
      { id: 'doing_something_enjoyable', icon: 'sparkles', label: 'Doing something I enjoy', reply: 'Maybe fun is more useful than people give it credit for.' },
    ],
  },
] as const satisfies readonly MossproutBondSharePrompt[];

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
