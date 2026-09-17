import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';

test('Feastle pantry and chapter deliveries never queue removed friendship dialogue', () => {
  const stored = new Map<string, unknown>();
  const storage = loadNativeModule('utils/companion-story-storage.ts', {
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => stored.get(key) ?? fallback,
      setStoredJson: (key: string, value: unknown) => stored.set(key, value),
    },
  }, { queueMicrotask });
  for (const orderId of ['feastle:discovery:first-snack', 'feastle:chapter-1:doorstep-snacks']) {
    const result = storage.markFeastleOrderServed(orderId, 2, 100);
    assert.equal(result.pendingConversationId, null);
    assert.equal(result.unreadReturn, false);
    assert.ok(result.completedOrderIds.includes(orderId));
    storage.markFeastleOrderServed(orderId, 2, 101);
    assert.equal(storage.loadFeastleStory().completedOrderIds.filter((id: string) => id === orderId).length, 1);
  }
});
