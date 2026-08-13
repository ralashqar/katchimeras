import type { ConversationDefinition } from '@/types/companion-conversation';

export const MOSSPROUT_FTUE_CONVERSATION_PREFIX = 'mossprout:ftue:first-meeting';

const openingLines: Record<string, string> = {
  outside: 'You were outside today? I think we are going to get along.',
  family: 'You spent time with your people today? I like that.',
  friends: 'Friends were part of today? That sounds like good growing weather.',
  relaxing: 'A quiet day can still grow into something lovely.',
  work: 'You have already been working today. Let us make something small together.',
  tired: 'Sounds like today took a bit out of you. We can start small.',
  rough: 'That sounds like a hard day. We can start gently.',
  home: 'Home sounds like a good place for us to begin.',
  default: 'I felt those little pieces of your day. I think this is a good place to begin.',
};

function definition(key: string, opening: string): ConversationDefinition {
  return {
    id: `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key}`,
    version: 1,
    familyId: 'mossprout',
    title: 'A little place to begin',
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    isOpener: true,
    format: 'opener',
    tags: ['ftue', 'story', 'first-meeting'],
    entryNodeId: 'remembered',
    nodes: [
      { id: 'remembered', kind: 'choice', phase: 'opening', prompt: opening, options: [{ id: 'hello', label: 'Hello, Mossprout', reply: 'Hello. I am glad you found me.', nextNodeId: 'arrived' }] },
      { id: 'arrived', kind: 'choice', phase: 'explore', prompt: 'I came through with almost nothing…', options: [{ id: 'ask', label: 'What do you need?', reply: 'Maybe just one small thing to start.', nextNodeId: 'plant' }] },
      { id: 'plant', kind: 'choice', phase: 'resolve', prompt: 'Think we could find something to plant?', options: [{ id: 'merge', label: 'Let’s look', reply: 'A little place to begin. That is all we need.', nextNodeId: 'end' }] },
      { id: 'end', kind: 'end', message: 'I will meet you at the garden.' },
    ],
  };
}

export const mossproutFtueConversationDefinitions: readonly ConversationDefinition[] = Object.entries(openingLines)
  .map(([key, opening]) => definition(key, opening));

export function mossproutFtueConversationDefinitionId(key: string) {
  return `${MOSSPROUT_FTUE_CONVERSATION_PREFIX}:${key in openingLines ? key : 'default'}`;
}
