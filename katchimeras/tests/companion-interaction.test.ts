import assert from 'node:assert/strict';
import test from 'node:test';

import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import {
  buildCompanionQuestViewModel,
  companionInteractionReducer,
  companionReflectionIsDirty,
  createCompanionInteractionState,
  insightForArchetype,
} from '@/utils/companion-interaction';
import { commandToJournalRecord, submissionToJournalCommand } from '@/utils/journal-domain';

function runtime(overrides: Partial<QuestRuntimeStatus> = {}): QuestRuntimeStatus {
  return {
    questId: 'quest-park', state: 'in_progress', complete: false, submissionMode: 'manual', readyToSubmit: false,
    progress: [], matchedEvidenceIds: [], possibleEvidenceIds: [], confidence: null, missingCapabilities: [],
    nextAction: 'take_photo', userMessage: 'Take a clear photo of a park.', debugReason: 'test', ...overrides,
  };
}

test('interaction reducer preserves reflection draft while switching threads', () => {
  const initial = createCompanionInteractionState({ initialThread: 'quest' });
  const reflection = companionInteractionReducer(initial, { type: 'select_thread', thread: 'reflection' });
  const withDraft = companionInteractionReducer(reflection, {
    type: 'set_reflection_draft',
    draft: { kind: 'text', text: 'A quiet walk', promptId: 'reflection:park', promptText: 'What stayed with you?' },
  });
  const insight = companionInteractionReducer(withDraft, { type: 'select_thread', thread: 'insight' });
  assert.equal(insight.direction, -1);
  assert.equal(insight.reflectionDraft?.text, 'A quiet walk');
  assert.equal(companionReflectionIsDirty(insight), true);
});

test('quest offer exposes one focused acceptance action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: null, offer: { id: 'quest-park', title: 'A green spot', hint: 'Take a photo of a park.' },
    runtime: null, questComplete: false, captureFeedback: null, items: [], criteria: [],
  });
  assert.equal(model.mode, 'offer');
  assert.equal(model.primaryAction?.kind, 'accept');
  assert.equal(model.primaryAction?.label, 'Accept quest');
});

test('blocked and active quests expose only the runtime recovery action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'A green spot', hint: 'Find a park.' }, offer: undefined,
    runtime: runtime({ state: 'blocked_permission', nextAction: 'enable_camera', userMessage: 'Camera access is needed.' }),
    questComplete: false, captureFeedback: null, items: [], criteria: [],
  });
  assert.equal(model.mode, 'blocked');
  assert.equal(model.primaryAction?.kind, 'quest_action');
  assert.equal(model.primaryAction?.label, 'Enable camera');
});

test('possible evidence requires review before submission', () => {
  const item = {
    id: 'photo-1', kind: 'photo' as const, sourceType: 'photo', sourceId: 'photo-1', title: 'Park photo', subtitle: 'Today',
    icon: 'photo.fill' as const, accentColor: '#7DE8CD', matchStatus: 'possible' as const, qualityId: 'place.park',
  };
  const model = buildCompanionQuestViewModel({
    activeQuest: { title: 'A green spot', hint: 'Find a park.' }, offer: undefined,
    runtime: runtime({ possibleEvidenceIds: ['photo-1'] }), questComplete: false, captureFeedback: null, items: [item], criteria: [],
  });
  assert.equal(model.mode, 'possible');
  assert.equal(model.primaryAction?.kind, 'review_match');
});

test('insight actions are contextual and optional', () => {
  assert.equal(insightForArchetype({ archetype: 'food', text: 'A food pattern', count: 3 }).action?.intent.kind, 'journal_flow');
  assert.equal(insightForArchetype({ archetype: 'places', text: 'A place pattern', count: 2 }).action?.intent.kind, 'places');
  assert.equal(insightForArchetype({ archetype: 'unknown', text: 'A quiet observation' }).action, null);
});

test('reflection origin survives journal review without entering user note text', () => {
  const origin = { kind: 'companion_reflection' as const, creatureId: 'mossprout', promptId: 'reflection:park', promptText: 'What pulls you back?' };
  const command = submissionToJournalCommand({
    sessionId: 'reflection-1', flowId: 'general', path: ['general', 'highlight'], categoryId: 'highlight', canonicalQualityIds: [],
    fields: { specific: null, context: null }, note: 'The quiet path by the pond.',
    journalSource: { kind: 'text_note', sourceId: 'reflection-1', origin },
    linkedNote: { kind: 'text', text: 'The quiet path by the pond.' },
  }, new Date('2026-07-13T12:00:00.000Z'));
  const record = command ? commandToJournalRecord(command, new Date('2026-07-13T12:00:00.000Z')) : null;
  assert.deepEqual(record?.source.kind === 'text_note' ? record.source.origin : null, origin);
  assert.equal(record?.note, 'The quiet path by the pond.');
  assert.equal(record?.note?.includes(origin.promptText), false);
});
