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

test('Feastle daily questions are registered as playable conversations', () => {
  const polls = companionConversationDefinitionsForFamily('feastle').filter((definition) => definition.format === 'poll');
  assert.equal(polls.length, feastle.daily!.polls.length);
  assert.equal(new Set(polls.map((definition) => definition.id)).size, polls.length);
});
