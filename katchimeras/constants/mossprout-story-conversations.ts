import type { ConversationDefinition } from '@/types/companion-conversation';

function storyConversation(
  level: number,
  title: string,
  opening: string,
  choices: readonly { id: string; label: string; reply: string }[],
  resolve: string,
): ConversationDefinition {
  return {
    id: `mossprout:story:${level}`,
    version: 1,
    familyId: 'mossprout',
    title,
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    isOpener: true,
    format: 'opener',
    tags: ['story', 'mossprout', 'where-the-water-goes'],
    entryNodeId: 'opening',
    nodes: [
      {
        id: 'opening', kind: 'choice', phase: 'opening', prompt: opening,
        options: choices.map((choice) => ({ ...choice, nextNodeId: 'resolve' })),
      },
      {
        id: 'resolve', kind: 'choice', phase: 'resolve', prompt: resolve,
        options: [{ id: 'continue', label: level === 4 ? 'It’s ours.' : 'Let’s keep growing.', reply: level === 4 ? 'Ours—and ready for whoever made those footprints.' : 'Slowly, bravely, and with muddy feet.', nextNodeId: 'end' }],
      },
      { id: 'end', kind: 'end', message: level === 4 ? 'The Little Rain Garden is complete.' : 'The rain garden grows.' },
    ],
  };
}

export const mossproutStoryConversationDefinitions: readonly ConversationDefinition[] = [
  storyConversation(2, 'A Place for Rain', 'Listen—the Shell is holding one bright drop without spilling it.', [
    { id: 'tiny-pond', label: 'A tiny pond.', reply: 'Exactly. Even the smallest place can hold a whole sky.' },
    { id: 'rain-found-us', label: 'The rain found us.', reply: 'Then we should give it somewhere soft to land.' },
  ], 'A Plant beside it would make a bank for the water. Strong roots, gentle edges.'),
  storyConversation(3, 'A Bank That Holds', 'The roots are already leaning toward the Shell. They know what we are making.', [
    { id: 'garden-knows', label: 'The garden knows?', reply: 'Growing things are excellent listeners.' },
    { id: 'looks-ready', label: 'It looks ready for more.', reply: 'A Flower for colour, and a Tidepool deep enough for visitors.' },
  ], 'One last careful piece and this will be more than a patch. It will be a welcome.'),
  storyConversation(4, 'The Little Rain Garden', 'It caught the rain. Look—every leaf is shining, and the Tidepool has kept a piece of the sky.', [
    { id: 'beautiful', label: 'It’s beautiful.', reply: 'It grew from two Seeds and one shared idea.' },
    { id: 'footprints', label: 'What about the footprints?', reply: 'They stop beside the water. I think whoever made them likes it too.' },
  ], 'There. Our Little Rain Garden: a home, a memory, and a place for the next arrival to rest.'),
];
