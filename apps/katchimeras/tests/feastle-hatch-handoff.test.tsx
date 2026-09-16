import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FEASTLE_HATCHABLE as feastle } from '@/constants/hatchable-companions/feastle';
import { HATCH_PROFILES } from '@/features/onboarding/hatch-profile';
import * as eggPolicy from '@/features/onboarding/hatchable-egg-policy';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { companionConversationDefinitionById, companionConversationDefinitionsForFamily } from '@/constants/companion-conversations-v2';
import { createConversationSession, answerConversation, continueConversation } from '@/utils/companion-conversation';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';
import { createContentFlowRun, reduceContentFlow, contentFlowEffectKey } from '@/features/content-flow/content-flow-interpreter';
import { gardenHandoffPendingFor } from '@/utils/steppling-day-one-session';
import type { ContentFlowCommand, ContentFlowRun } from '@/types/content-flow';
import type { ConversationSession } from '@/types/companion-conversation';
import { loadNativeModule } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('saved Feastle hatch opens the real first narrative, settles one pantry parcel, and resumes its Garden handoff', async () => {
  const now = Date.UTC(2026, 8, 17, 12);
  let world = createInitialMergeWorldState(now);
  world.worldUnlocks = { [feastle.tile.unlockId]: { destination: 'feastle', unlockedAt: now, paid: 60, transferredAt: null, hatchedAt: null } };
  const send = (action: eggPolicy.HatchableEggAction) => { world = eggPolicy.reduceHatchableEgg(world, feastle, action, now).state; };
  send({ kind: 'begin', sourceDayId: '2026-09-17' });
  for (const question of HATCH_PROFILES.feastle.questions) send({ kind: 'answer', questionId: question.id, answer: question.options[0].id });
  send({ kind: 'hatch' }); send({ kind: 'finish' });
  world = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), now);
  assert.equal(eggPolicy.hatchableEggProgress(world, feastle)?.hatchedAt, now);
  assert.ok(world.companionDiscovery.records.some((record) => record.characterId === 'feastle'));

  let content: { conversationSessions: ConversationSession[] } = { conversationSessions: [] };
  let run: ContentFlowRun | null = null;
  let grants = 0;
  let lessonReady = false;
  const flow = hatchableFlows(feastle).dayOne;
  const runtime = loadNativeModule('features/companion/use-steppling-day-one.ts', {
    '@/features/onboarding/hatchable-runtime': { ensureGardenLesson: async () => { lessonReady = true; }, hatchableForCompanion: () => feastle },
    '@/utils/steppling-day-one-session': { gardenHandoffPendingFor },
    '@/utils/companion-life-recording': { recordLifeFlow() {} },
    '@/utils/world-identity': { localDayId: () => '2026-09-17' },
    '@/utils/companion-content-storage': { loadCompanionContentState: () => content, saveCompanionContentState: (next: typeof content) => { content = next; } },
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => world },
    '@/features/content-flow/content-flow-bootstrap': { bootstrapContentFlowCatalog() {} },
    '@/features/content-flow/content-flow-catalog': { contentFlowDefinition: () => flow },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => run },
    '@/features/content-flow/content-flow-director': {
      startContentFlow: async () => { run = createContentFlowRun(flow, { runId: feastle.dayOne.flow.runId, now }); return run; },
      dispatchContentFlowCommand: async (_id: string, command: ContentFlowCommand) => {
        run = reduceContentFlow(flow, run!, command).run;
        if (run.nodeId === 'parcel') {
          grants++;
          run = reduceContentFlow(flow, run, { type: 'effect_completed', effectKey: contentFlowEffectKey(run, 'parcel'), result: {} }).run;
        }
        return run;
      },
    },
  });
  let state: { ready: boolean; error: boolean; definitionId?: string; gardenHandoffPending: boolean; complete: () => Promise<boolean> };
  function Probe() { state = runtime.useHatchableDayOne(feastle, true); return null; }
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(<Probe />); });
  assert.equal(state!.error, false);
  assert.equal(state!.ready, true);
  assert.equal(state!.definitionId, feastle.dayOne.conversationId);
  const definition = companionConversationDefinitionById.get(state!.definitionId!)!;
  assert.ok(definition);
  let session = createConversationSession({ definition, formId: 'feastle', dayId: '2026-09-17', createdAt: now });
  session = answerConversation(session, definition, feastle.dayOne.choices[0].id, now + 1).session;
  session = answerConversation(session, definition, 'garden', now + 2).session;
  if (session.status === 'active') session = continueConversation(session, definition, now + 3);
  assert.equal(session.status, 'completed');
  content.conversationSessions = [JSON.parse(JSON.stringify(session))];
  await act(async () => { assert.equal(await state!.complete(), true); });
  assert.equal(grants, 1);
  assert.equal(lessonReady, true);
  assert.equal(state!.gardenHandoffPending, true);
  await act(async () => { renderer!.unmount(); });
  await act(async () => { renderer = create(<Probe />); });
  assert.equal(state!.definitionId, undefined, 'relaunch does not replay the completed story');
  assert.equal(state!.gardenHandoffPending, true, 'unfinished handoff survives restart');
  await act(async () => { await state!.complete(); });
  assert.equal(grants, 1, 'no duplicate parcel');
  runtime.acknowledgeHatchableDayOneGarden(feastle);
  assert.equal(gardenHandoffPendingFor(content.conversationSessions[0], definition.id, flow.version), false);
  await act(async () => { renderer!.unmount(); });
});

test('Feastle daily questions are registered as playable conversations', () => {
  const polls = companionConversationDefinitionsForFamily('feastle').filter((definition) => definition.format === 'poll');
  assert.equal(polls.length, feastle.daily!.polls.length);
  assert.equal(new Set(polls.map((definition) => definition.id)).size, polls.length);
});
