import { companionConversationDefinitionById, companionConversationDefinitionsForFamily, explicitCompanionConversation } from '@/constants/companion-conversations-v2';
import { conversationUsesNarrativeOverlay } from '@/utils/conversation-presentation';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalEventPilot } from '@/features/live-ops/local-catalog';
import { worldEventActions, worldEventConversation } from '@/features/live-ops/world-event-presentation';
import { reduceLocalEvent } from '@/features/live-ops/local-runtime';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { validateConversationDefinitions } from '@/utils/companion-conversation';
import { hatchableAvailable } from '@/utils/merge-world/glow-discovery-policy';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { normalizeContentPack } from '@/features/content-packs/normalize-content-pack';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';

const now = Date.parse('2026-10-02T00:00:00Z');
const catalog = () => createLocalEventPilot().liveEvents!.map(event => ({ ...event, enabled: true }));
const harmony = { version: 1 as const, points: 100, milestones: {} };
const restored = () => { const world = createInitialMergeWorldState(now); world.haven.tileStages.mossprout = 1; return world; };

test('world action becomes a contextual hosted narrative and persists until acknowledged', () => {
  let world = restored();
  const events = catalog();
  const action = worldEventActions(world, harmony, events, now)[0];
  assert.equal(action.phase, 'opening');
  const conversation = worldEventConversation(action, 'opening');
  assert.deepEqual(validateConversationDefinitions([conversation]), []);
  assert.equal(conversation.contextualOnly, true);
  assert.equal(conversationUsesNarrativeOverlay(conversation), true);
  companionConversationDefinitionById.set(conversation.id, conversation);
  assert.equal(explicitCompanionConversation('mossprout', conversation.id), conversation);
  assert.equal(explicitCompanionConversation('steppling', conversation.id), null);
  assert.equal(companionConversationDefinitionsForFamily('mossprout').some(d => d.id === conversation.id), false);
  assert.equal(conversation.familyId, 'mossprout');
  world = reduceLocalEvent(world, { type: 'join', eventId: action.event.id }, harmony, events, now).world;
  assert.equal(worldEventActions(JSON.parse(JSON.stringify(world)), harmony, [], now)[0].phase, 'opening');
  world = reduceLocalEvent(world, { type: 'begin', eventId: action.event.id, nodeId: action.encounter.id }, harmony, [], now).world;
  const resumed = worldEventActions(world, harmony, [], now)[0];
  assert.equal(resumed.phase, 'order');
  assert.equal(resumed.encounter.actionTitle, 'Help with the silver leaves');
  assert.equal(worldEventActions(world, harmony, [], now + 10 * 86400000).length, 0);
});

test('updates do not replace a pinned narrative and locked events cannot introduce themselves', () => {
  const events = catalog();
  const world = reduceLocalEvent(restored(), { type: 'join', eventId: events[0].id }, harmony, events, now).world;
  const replacement = { ...events[0], encounters: events[0].encounters!.map(n => ({ ...n, opening: 'Changed' })) };
  assert.notEqual(worldEventActions(world, harmony, [replacement], now)[0].encounter.opening, 'Changed');
  assert.equal(worldEventActions(createInitialMergeWorldState(now), harmony, events, now).length, 0);
  assert.equal(worldEventActions(restored(), { ...harmony, points: 0 }, events, now).length, 0);
});

test('event-introduced hex uses regular availability and remains available after the event ends', () => {
  const events = catalog();
  const tile: HatchableCompanionDefinition = { ...STEPPLING_HATCHABLE, availability: { kind: 'event_joined', eventId: events[0].id } };
  let world = restored();
  assert.equal(hatchableAvailable(world, tile), false);
  world = reduceLocalEvent(world, { type: 'join', eventId: events[0].id }, harmony, events, now).world;
  assert.equal(hatchableAvailable(world, tile), true);
  world = reduceLocalEvent(world, { type: 'refresh' }, harmony, [], now + 20 * 86400000).world;
  assert.equal(hatchableAvailable(world, tile), true);
});

test('world event targeting rejects wrong tiles and requires a capable client', () => {
  const pack = createLocalEventPilot();
  assert.equal(normalizeContentPack(pack).issues.length, 0);
  const oldClient = { ...pack, contentSchemaVersion: 3 };
  assert.ok(normalizeContentPack(oldClient).issues.some(issue => issue.includes('schema 4')));
  const badTarget = structuredClone(pack);
  badTarget.liveEvents![0].encounters![0].hexId = 'missing-tile';
  assert.ok(normalizeContentPack(badTarget).issues.some(issue => issue.includes('tile does not belong')));
});


test('a designer-authored companion release can bind its complete hex arc to an event', async () => {
  const { newCompanionDraft, compileNewCompanion } = await import('@/features/content-authoring/new-companion');
  const result = compileNewCompanion(newCompanionDraft('bedrotte'), {
    'tile:bedrotte-home:full': { url: 'https://example.test/tile.webp', alphaBounds: { left: 10, top: 10, right: 1000, bottom: 1000 } },
    'cutout:bedrotte': { url: 'https://example.test/cutout.webp' },
  });
  assert.deepEqual(result.issues, []);
  const pack = result.pack!;
  pack.contentSchemaVersion = 4;
  pack.liveEvents = catalog();
  pack.hatchables![0].availability = { kind: 'event_joined', eventId: pack.liveEvents[0].id };
  assert.deepEqual(normalizeContentPack(pack).issues, []);
  pack.hatchables![0].availability = { kind: 'event_joined', eventId: 'missing-event' };
  assert.ok(normalizeContentPack(pack).issues.some(issue => issue.includes('event availability')));
});


test('event dialogue cannot create a daily reward on completion or repeated re-entry', async () => {
  const { loadNativeModule } = await import('./helpers/native-motion-harness');
  const mocks: Record<string, unknown> = {};
  for (const name of [
    '@/constants/katchimera-skins', '@/storage/repositories/relationship-progression-repository',
    '@/game/katchimeras/mossprout-home', '@/game/katchimeras/relationship-progression',
    '@/game/katchimeras/action-runtime', '@/utils/companion-bond', '@/utils/companion-bond-storage',
    '@/storage/repositories/home-repository', '@/utils/katchimera-identity', '@/utils/katchimera-quests',
    '@/features/content-flow/content-flow-director',
  ]) mocks[name] = {};
  mocks['@/storage/repositories/relationship-progression-repository'] = {
    relationshipProgressionRepository: { update: () => { throw new Error('Event dialogue must not write the daily deck'); } },
  };
  const { commitKatchimeraActionCompletion } = loadNativeModule('game/katchimeras/action-completion.ts', mocks);
  const definition = worldEventConversation(worldEventActions(restored(), harmony, catalog(), now)[0], 'resolution');
  const input = { definition, session: { definitionId: definition.id, familyId: 'mossprout', status: 'completed', completedAt: now } };
  for (let entry = 0; entry < 4; entry++) {
    const result = (commitKatchimeraActionCompletion as Function)(input);
    assert.equal(result.completion, null);
    assert.equal(result.rewardReceipt, null);
  }
});

test('existing duplicate event outros are dismissed on reload without removing earned records or ordinary cards', async () => {
  const { actionCommandFromOrigin, commitActionCompletion, createActionBoardSnapshot } = await import('@/game/katchimeras/action-runtime');
  const { emptyRelationshipProgressState, normalizeRelationshipProgressState } = await import('@/game/katchimeras/relationship-progression');
  let state = emptyRelationshipProgressState();
  for (const [sequence, actionId] of ['mossprout:conversation:world-event:moon:opening', 'mossprout:conversation:world-event:moon:resolution', 'mossprout:conversation:ordinary-chat'].entries()) {
    state = commitActionCompletion(state, actionCommandFromOrigin({
      dayId: '2026-10-02', familyId: 'mossprout', actionId, instanceId: `instance:${sequence}`,
      sourceSlotId: 'together', slotId: 'together', sequence, kind: 'fun_chat', title: 'A chat', subtitle: '',
      icon: 'bubble.left.fill', artworkDefinitionIds: [], reward: { kind: 'bond', amount: 4 },
      rotationEffect: 'consume', presentation: 'action_card',
    }, now));
  }
  const repaired = normalizeRelationshipProgressState(JSON.parse(JSON.stringify(state)));
  assert.equal(repaired.actionCompletions.length, 3);
  assert.equal(repaired.actionPresentations.filter(p => p.status === 'dismissed').length, 2);
  assert.equal(createActionBoardSnapshot('2026-10-02', [], repaired.actionPresentations).presentations.length, 1);
  assert.deepEqual(normalizeRelationshipProgressState(repaired), repaired);
  assert.equal(state.actionPresentations.every(p => p.status === 'pending'), true);
});
