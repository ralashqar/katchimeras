import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';

test('an explicit Journey tap reopens the same unfinished conversation after returning to the dashboard', () => {
  const id = 'feastle:journey:day-2';
  let opens = 0;
  const pendingStoryConversationRef = { current: null };
  const openedStoryConversationRef = { current: id };
  const { requestStoryConversation } = loadNativeModule('components/katchadeck/world/companion-interaction-sheet.tsx', {}, {
    useCallback: (callback: unknown) => callback,
    props: { conversationSession: { definitionId: id, status: 'active' }, conversationDefinition: { id } },
    pendingStoryConversationRef, openedStoryConversationRef,
    showConversation: () => opens++, startConversation: () => assert.fail('resume must reuse the session'),
  }, 'requestStoryConversation');
  requestStoryConversation(id);
  requestStoryConversation(id);
  assert.equal(opens, 2);
});
