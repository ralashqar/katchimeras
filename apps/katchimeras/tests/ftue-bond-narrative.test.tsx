import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as copy from '@/features/onboarding/mossprout-bond-share';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<any>;
test('FTUE Bond restores visible history and does not trigger support reward until final exit', async () => {
  const saved = new Map(); let fail = false; let exits = 0;
  const Overlay = ({ children, ...props }: any) => React.createElement(host('Overlay'), props, children((action: () => unknown, exit: boolean) => { if (exit) exits++; return action(); }));
  const module = loadNativeModule('components/katchadeck/world/ftue-bond-narrative.tsx', {
    '@/features/onboarding/ftue-narrative-history': { saveFtueNarrativeHistory: () => undefined },
    './conversation-narrative-overlay': { ConversationNarrativeOverlay: Overlay },
    './companion-choice-list': { CompanionChoiceList: host('Choices') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/features/onboarding/mossprout-bond-share': copy,
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => saved.get(key) ?? fallback,
      setStoredJson: (key: string, value: unknown) => { if (fail) throw new Error('disk full'); saved.set(key, JSON.parse(JSON.stringify(value))); } },
  });
  const Bond = module.FtueBondNarrative as React.ComponentType<any>;
  const committed: string[] = [];
  const props = { runId: 'test', onContinue: (id: string) => committed.push(id) };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Bond {...props} />); });
  assert.equal(tree.root.findByType(host('Overlay')).props.required, true);
  await act(async () => tree.root.findByType(host('Choices')).props.onSelect('calm'));
  assert.deepEqual(committed, ['desired-help:calm']);
  assert.equal(tree.root.findByType(host('Overlay')).props.entries.length, 4);
  assert.equal(tree.root.findAllByType(host('Button')).length, 0, 'next choices appear without Continue');
  fail = true;
  assert.throws(() => tree.root.findByType(host('Choices')).props.onSelect('company'), /disk full/);
  assert.equal(tree.root.findByType(host('Overlay')).props.entries.length, 4);
  fail = false;
  await act(async () => tree.root.findByType(host('Choices')).props.onSelect('company'));
  assert.deepEqual(committed, ['desired-help:calm'], 'support choice is persisted as dialogue without awarding Bond');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Bond {...props} />); });
  assert.equal(tree.root.findByType(host('Overlay')).props.entries.length, 6);
  await act(async () => tree.root.findByType(host('Button')).props.onPress());
  assert.deepEqual(committed, ['desired-help:calm', 'company']);
  assert.equal(exits, 1);
  await act(async () => tree.unmount());
});
