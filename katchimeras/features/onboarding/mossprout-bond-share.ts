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
  }[];
};

export const MOSSPROUT_BOND_SHARE_PROMPTS = [
  {
    id: 'calm',
    cardLabel: 'Share what helps me feel calm',
    icon: 'moon.stars.fill',
    prompt: 'What helps you feel calm?',
    reply: 'I’ll remember that. We can make room for it together.',
    options: [
      { id: 'quiet_time', icon: 'moon.stars.fill', label: 'Quiet time' },
      { id: 'music_stories', icon: 'music.note', label: 'Music or stories' },
      { id: 'being_outside', icon: 'leaf.fill', label: 'Being outside' },
      { id: 'someone_nearby', icon: 'person.2.fill', label: 'Someone nearby' },
    ],
  },
  {
    id: 'smile',
    cardLabel: 'Share what makes me smile',
    icon: 'face.smiling',
    prompt: 'What often makes you smile?',
    reply: 'I like knowing that about you.',
    options: [
      { id: 'something_silly', icon: 'face.smiling', label: 'Something silly' },
      { id: 'making_things', icon: 'paintbrush.fill', label: 'Making things' },
      { id: 'time_with_people', icon: 'person.2.fill', label: 'Time with people' },
      { id: 'little_surprises', icon: 'sparkles', label: 'Little surprises' },
    ],
  },
  {
    id: 'grow',
    cardLabel: 'Share what I want to grow',
    icon: 'leaf.fill',
    prompt: 'What would you like to grow?',
    reply: 'We can grow that one small step at a time.',
    options: [
      { id: 'confidence', icon: 'star.fill', label: 'Confidence' },
      { id: 'helpful_habit', icon: 'checkmark.circle.fill', label: 'A helpful habit' },
      { id: 'creativity', icon: 'paintbrush.fill', label: 'Creativity' },
      { id: 'friendship', icon: 'heart.fill', label: 'A friendship' },
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
