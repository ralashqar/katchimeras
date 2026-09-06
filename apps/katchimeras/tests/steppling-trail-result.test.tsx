import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import { STEPPLING_TRAIL_CONVERSATIONS } from '../constants/steppling-activities';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('trail insight waits for Continue and returns home once without a timed completion screen', async () => {
  for (const reduceMotion of [false, true]) {
    const timers = new Map<number, () => void>();
    let nextTimer = 0;
    const module = loadNativeModule('features/companion/use-companion-conversation-flow.ts', {
      'react-native': { AccessibilityInfo: { isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove() {} }) } },
      '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
      '@/utils/companion-conversation': { conversationNode: (definition: typeof STEPPLING_TRAIL_CONVERSATIONS[number], id: string) => definition.nodes.find((node) => node.id === id) },
    }, { setTimeout: (fn: () => void) => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: (id: number) => timers.delete(id) });
    const definition = STEPPLING_TRAIL_CONVERSATIONS.find((item) => item.id.endsWith('trail-treasure'))!;
    let exits = 0;
    let dismissals = 0;
    let flow: { advance: () => void; requiresManualAdvance: boolean };
    function Harness() {
      const [session, setSession] = React.useState({ id: 'trail', status: 'active', currentNodeId: 'finish', outcomePresentation: { id: 'insight', title: 'Treasure', message: 'A small discovery.' } as object | undefined });
      flow = module.useCompanionConversationFlow({ definition, session, reduceMotion,
        onCommitInsight() {}, onCommitMemory() {}, onContinue() { assert.fail('no extra end beat'); },
        onComplete() { exits++; }, onDismissOutcome() {
          dismissals++;
          setSession((current) => ({ ...current, status: 'completed', outcomePresentation: undefined }));
        },
      });
      return null;
    }
    let tree: ReactTestRenderer;
    await act(async () => { tree = create(<Harness />); });
    assert.equal(flow!.requiresManualAdvance, true);
    assert.equal(timers.size, 0, 'result has no auto-dismiss timer');
    assert.equal(exits, 0);
    await act(async () => flow!.advance());
    assert.equal(dismissals, 1);
    assert.equal(exits, 1, 'completion returns straight to the dashboard');
    assert.equal(timers.size, 0);
    await act(async () => tree!.unmount());
  }
});
