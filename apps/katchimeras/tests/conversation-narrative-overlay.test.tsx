import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

/**
 * The story's dialogue (Sept 2026, after Foundation: Galactic Frontier): one line at a time in a card fixed at the
 * bottom, the speaker's name on a tag at their side, the speakers standing behind it (the first left, a second right),
 * a tap for the next line, the caller's buttons with the last line, and an eased exit before the caller's action.
 */
function loadOverlay(timers: Map<number, () => void>) {
  const motion = nativeMotionHarness();
  let serial = 0;
  const builder = { delay: () => builder, duration: () => builder };
  const module = loadNativeModule('components/katchadeck/world/conversation-narrative-overlay.tsx', {
    'react-native': { ...nativeViews, Modal: 'Modal', Pressable: 'Pressable', Text: 'Text' },
    'react-native-reanimated': { ...motion.animated,
      default: { ...motion.animated.default, Text: 'AnimatedText' },
      FadeOut: builder,
      withRepeat: (child: unknown) => child,
      withTiming: (to: number, options = { duration: 180 }) => motion.animated.withTiming(to, options),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 12 }) },
    'expo-image': { Image: host('Figure') },
    '@/components/ui/icon-symbol': { IconSymbol: host('Icon') },
    '@/constants/theme': { AppFontFamilies: { fredokaBold: 'F', manrope: 'M' } },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map([['mossprout', { displayName: 'Mossprout', visualKey: 'mossprout' }], ['steppling', { displayName: 'Steppling', visualKey: 'steppling' }]]) },
    '@/game/days/visuals': { getCreatureVisual: (key: string) => ({ source: key }) },
  }, { setTimeout: (fn: () => void) => { timers.set(++serial, fn); return serial; }, clearTimeout: (id: number) => timers.delete(id) });
  return { motion, Overlay: module.ConversationNarrativeOverlay as React.ComponentType<any>, module };
}

const lineText = (tree: ReactTestRenderer) => tree.root.findAllByType(host('AnimatedText')).map((node) => node.props.children);
const tagText = (tree: ReactTestRenderer) => tree.root.findAllByType(host('Text')).map((node) => node.props.children).filter((text) => typeof text === 'string' && !['×'].includes(text));
const nextTap = (tree: ReactTestRenderer) => tree.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Next line')!;

test('one line at a time: a tap shows the next, the name tag follows the speaker, the buttons come with the last line', async () => {
  const timers = new Map<number, () => void>();
  const { Overlay } = loadOverlay(timers);
  const entries = [
    { id: 'a', speaker: 'mossprout', text: 'Hello.' },
    { id: 'b', speaker: 'steppling', text: 'Hi!' },
    { id: 'c', speaker: 'mossprout', text: 'Ready?' },
  ];
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Overlay title="Talk" entries={entries} checkpoint="one" required paced onClose={() => undefined}>{() => React.createElement(host('Continue'))}</Overlay>); });
  assert.equal(tree.root.findByType(host('Modal')).props.statusBarTranslucent, true);
  assert.deepEqual(lineText(tree), ['Hello.'], 'the first line alone');
  assert.ok(tagText(tree).includes('Mossprout'), 'the speaker is named on the tag');
  assert.equal(tree.root.findAllByType(host('Continue')).length, 0, 'the buttons wait for the last line');
  assert.equal(timers.size, 0, 'nothing moves on by itself');
  await act(async () => nextTap(tree).props.onPress());
  assert.deepEqual(lineText(tree), ['Hi!']);
  assert.ok(tagText(tree).includes('Steppling'));
  assert.equal(tree.root.findAllByType(host('Figure')).length, 2, 'the second speaker joins the first on stage');
  await act(async () => nextTap(tree).props.onPress());
  assert.deepEqual(lineText(tree), ['Ready?']);
  assert.equal(tree.root.findAllByType(host('Continue')).length, 1, 'the last line brings the buttons');
  assert.equal(nextTap(tree).props.disabled, true, 'a tap on the last line does nothing: the buttons decide');
  await act(async () => tree.unmount());
});

test('exit fades out before the caller acts, a failure comes back with an error, and a required story cannot be closed', async () => {
  const timers = new Map<number, () => void>();
  const { motion, Overlay } = loadOverlay(timers);
  let closed = 0; let acted = 0; let perform!: (action: () => unknown, exit?: boolean) => void;
  const props = { title: 'Mossprout', checkpoint: 'one', required: true, onClose: () => closed++,
    entries: [{ id: 'a', speaker: 'mossprout', text: 'Hello' }],
    children: (run: typeof perform) => { perform = run; return React.createElement(host('Continue')); },
  };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Overlay {...props} />); });
  await act(async () => tree.root.findByType(host('Modal')).props.onRequestClose());
  assert.equal(closed, 0, 'a required story has no way out but its buttons');
  await act(async () => { perform(() => { acted++; }, true); perform(() => { acted++; }, true); });
  assert.equal(acted, 0, 'the action waits for the exit');
  await act(async () => { motion.advance(220); for (const fn of timers.values()) fn(); timers.clear(); });
  assert.equal(acted, 1, 'once, after the fade');
  await act(async () => perform(() => { throw new Error('disk full'); }));
  assert.ok(tree.root.findAllByType(host('Text')).some((node) => String(node.props.children).includes('Could not save')));
  await act(async () => { tree.update(<Overlay {...props} required={false} />); });
  await act(async () => tree.root.findByType(host('Modal')).props.onRequestClose());
  await act(async () => { for (const fn of timers.values()) fn(); timers.clear(); });
  assert.equal(closed, 1, 'an optional one closes the same eased way');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Overlay {...props} inline />); });
  assert.equal(tree.root.findAllByType(host('Modal')).length, 0, 'inline messages never mount the dialogue');
  await act(async () => tree.unmount());
});

test('new lines appended (an answer and its reply) are shown from the first new one, one tap at a time', async () => {
  const timers = new Map<number, () => void>();
  const { Overlay, module } = loadOverlay(timers);
  const first = [{ id: 'q', speaker: 'mossprout', text: 'What now?' }];
  const later = [...first, { id: 'a', speaker: 'player', text: 'Onward.' }, { id: 'r', speaker: 'mossprout', text: 'Then onward.' }];
  let tree!: ReactTestRenderer;
  const node = (entries: typeof first) => <Overlay title="Talk" entries={entries} checkpoint={String(entries.length)} onClose={() => undefined}>{() => React.createElement(host('Choices'))}</Overlay>;
  await act(async () => { tree = create(node(first)); });
  assert.deepEqual(lineText(tree), ['What now?']);
  await act(async () => { tree.update(node(later)); });
  assert.deepEqual(lineText(tree), ['Onward.'], 'the answer first');
  assert.ok(tagText(tree).includes('You'), 'the player is named You');
  await act(async () => nextTap(tree).props.onPress());
  assert.deepEqual(lineText(tree), ['Then onward.']);
  await act(async () => tree.unmount());
  const { narrativeAdmittedCount, narrativeReadingDelayMs } = module as unknown as { narrativeAdmittedCount: (previous: readonly string[], entries: readonly { id: string; speaker: string }[], step: number) => number; narrativeReadingDelayMs: (text: string) => number };
  assert.equal(narrativeAdmittedCount(['q'], later, 2), 3, 'the answer and its reply are one moment');
  assert.equal(narrativeReadingDelayMs(''), 1300);
});
