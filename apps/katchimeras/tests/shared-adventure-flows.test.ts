import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentFlowEffects } from '@incubator/story/effects';
import { createContentFlowCatalog } from '@incubator/story/catalog';
import { ADVENTURE_FLOWS } from '@/features/shared-adventure/definitions';
import { loadNativeModule } from './helpers/native-motion-harness';

test('bootstrap and repeated adventure panel mounts share one working commit handler', async () => {
  const effects = createContentFlowEffects();
  const catalog = createContentFlowCatalog();
  const commands: unknown[] = [];
  const { registerAdventureFlows } = loadNativeModule('features/shared-adventure/flows.ts', {
    '@/features/content-flow/story-capability-registry': { registerStoryCapability: () => {} },
    '@/features/content-flow/content-flow-catalog': catalog,
    '@/features/content-flow/content-flow-capabilities': effects,
    '@/utils/merge-world/repository': { applyStoredAdventure: async (command: unknown) => {
      commands.push(command);
      return { state: { revision: 7 } };
    } },
    './definitions': { ADVENTURE_FLOWS },
  });

  registerAdventureFlows(); // App bootstrap.
  const handler = effects.contentFlowEffectHandler('shared.adventure.commit')!;
  registerAdventureFlows(); // First post-FTUE panel.
  registerAdventureFlows(); // Panel reopened.
  assert.equal(effects.contentFlowEffectHandler('shared.adventure.commit'), handler);
  assert.equal(catalog.registeredContentFlowDefinitions().length, ADVENTURE_FLOWS.length);
  const result = await handler({ run: { variables: { promise: 'friends' } } as never, payload: { beatId: 'wish' }, effectKey: 'test:commit' });
  assert.equal((result as { revision: number }).revision, 7);
  assert.equal(JSON.stringify(commands), JSON.stringify([{ type: 'acknowledge', beatId: 'wish', promise: 'friends' }]));
  assert.throws(() => effects.registerContentFlowEffect('shared.adventure.commit', async () => ({})), /already has a handler/, 'conflicting handlers must still be rejected');
});
