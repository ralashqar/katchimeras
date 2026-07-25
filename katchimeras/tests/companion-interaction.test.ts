import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomeDayRecord } from '@/types/home';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import {
  buildCompanionQuestViewModel,
  companionInteractionReducer,
  companionQuestUsesFullBleed,
  companionReflectionIsDirty,
  companionViewportResetKey,
  createCompanionInteractionState,
  insightForArchetype,
} from '@/utils/companion-interaction';
import { prepareCompanionReflection } from '@/utils/companion-reflection';
import { commandToJournalRecord, submissionToJournalCommand } from '@/utils/journal-domain';
import { questCaptureBelongsTo } from '@/utils/quest-capture-session';
import { evidenceProvider, isLateNightHour, withCaptureTimeSignals } from '@/utils/signals/providers/evidence';

test('Mossprout, Feastle, and Tasklet games use the full-bleed game shell', () => {
  assert.equal(companionQuestUsesFullBleed({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'merge', packId: 'feastle-kitchen' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'block_jam', packId: 'tasklet-desk' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestUsesFullBleed({ kind: 'matching', packId: 'relicoon-gallery' } as InteractiveQuestExecution), false);
  assert.equal(companionQuestUsesFullBleed(null), false);
});

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
  assert.equal(insight.reflectionReviewOpen, false);
  assert.equal(companionReflectionIsDirty(insight), true);
});

test('reflection review stays inside the companion interaction state', () => {
  const initial = createCompanionInteractionState({
    initialThread: 'reflection',
    reflectionDraft: {
      kind: 'text',
      text: 'A quiet walk',
      promptId: 'reflection:park',
      promptText: 'What stayed with you?',
    },
  });
  const review = companionInteractionReducer(initial, { type: 'review_reflection' });
  const editing = companionInteractionReducer(review, { type: 'edit_reflection' });
  assert.equal(review.reflectionReviewOpen, true);
  assert.equal(review.reflectionDraft?.text, 'A quiet walk');
  assert.equal(editing.reflectionReviewOpen, false);
  assert.equal(editing.reflectionDraft?.text, 'A quiet walk');
});

test('skins is a first-class companion thread between insight and reflection', () => {
  const insight = createCompanionInteractionState({ initialThread: 'insight' });
  const skins = companionInteractionReducer(insight, { type: 'select_thread', thread: 'skins' });
  const reflection = companionInteractionReducer(skins, { type: 'select_thread', thread: 'reflection' });
  assert.equal(skins.thread, 'skins');
  assert.equal(skins.direction, 1);
  assert.equal(reflection.direction, 1);
});

test('discovery is a first-class companion thread between quest and insight', () => {
  const quest = createCompanionInteractionState({ initialThread: 'quest' });
  const discovery = companionInteractionReducer(quest, { type: 'select_thread', thread: 'discovery' });
  const insight = companionInteractionReducer(discovery, { type: 'select_thread', thread: 'insight' });
  assert.equal(discovery.thread, 'discovery');
  assert.equal(discovery.direction, 1);
  assert.equal(insight.direction, 1);
});

test('companion viewport resets across threads and content-shape transitions', () => {
  const base = {
    creatureId: 'companion:vesperitt',
    thread: 'quest' as const,
    questMode: 'offer' as const,
  };
  const quest = companionViewportResetKey(base);
  assert.notEqual(companionViewportResetKey({ ...base, thread: 'discovery' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, questMode: 'active', activeQuestTitle: 'The small hours' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, journeyNodeId: 'understand-goal' }), quest);
  assert.notEqual(companionViewportResetKey({ ...base, activeAttemptId: 'attempt-1' }), quest);
  assert.equal(companionViewportResetKey({ ...base }), quest);
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

test('quest capture feedback is visible only to the quest and creature that started it', () => {
  const feastleCapture = {
    questId: 'quest-photo-food',
    creatureId: 'feastle',
  };
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-photo-food', 'feastle'), true);
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-log-film', 'flickerbun'), false);
  assert.equal(questCaptureBelongsTo(feastleCapture, 'quest-photo-food', 'flickerbun'), false);
});

test('late-night quest evidence is restricted to photos captured from 11pm through 4:59am', () => {
  const evidence = (observedAt: string) => withCaptureTimeSignals({
    id: `photo:${observedAt}`,
    sourceType: 'photo',
    sourceId: observedAt,
    observedAt,
    provider: 'appleVision',
    confidence: 0.9,
    signals: [],
  });
  assert.equal(isLateNightHour(23), true);
  assert.equal(isLateNightHour(0), true);
  assert.equal(isLateNightHour(4), true);
  assert.equal(isLateNightHour(5), false);
  assert.equal(isLateNightHour(22), false);
  assert.equal(evidence('2026-07-13T23:30:00').signals.some((signal) => signal.key === 'time.late_night'), true);
  assert.equal(evidence('2026-07-14T04:59:00').signals.some((signal) => signal.key === 'time.late_night'), true);
  assert.equal(evidence('2026-07-14T05:00:00').signals.some((signal) => signal.key === 'time.late_night'), false);
  assert.equal(evidence('2026-07-14T14:00:00').signals.some((signal) => signal.key === 'time.late_night'), false);
});

test('the evidence provider returns its capture-time-enriched photo candidates', () => {
  const photo = {
    id: 'photo:late', sourceType: 'photo' as const, sourceId: 'late',
    observedAt: '2026-07-13T23:30:00', provider: 'appleVision' as const,
    confidence: 0.9, signals: [],
  };
  const facts = evidenceProvider.resolve({ today: { evidence: [photo] } as unknown as HomeDayRecord });
  const candidates = facts['evidence.items'] ?? [];
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].signals.some((signal) => signal.key === 'time.late_night'), true);
});

test('insight actions are contextual and optional', () => {
  assert.equal(insightForArchetype({ archetype: 'food', text: 'A food pattern', count: 3 }).action?.intent.kind, 'journal_flow');
  assert.equal(insightForArchetype({ archetype: 'places', text: 'A place pattern', count: 2 }).action?.intent.kind, 'places');
  assert.equal(insightForArchetype({ archetype: 'unknown', text: 'A quiet observation' }).action, null);
});

test('companion reflection saves directly to the canonical journal with a stable origin', () => {
  const origin = { kind: 'companion_reflection' as const, creatureId: 'mossprout', promptId: 'reflection:park', promptText: 'What pulls you back?' };
  const prepared = prepareCompanionReflection({
    creatureId: 'mossprout',
    dayId: '2026-07-13',
    draft: {
      kind: 'text',
      text: '  The quiet path by the pond.  ',
      promptId: origin.promptId,
      promptText: origin.promptText,
    },
  });
  assert.ok(prepared);
  assert.equal(prepared.sourceId, 'companion-reflection:mossprout:2026-07-13');
  assert.equal(prepared.submission.flowId, 'general');
  assert.equal(prepared.submission.categoryId, 'other');
  const command = submissionToJournalCommand(prepared.submission, new Date('2026-07-13T12:00:00.000Z'));
  const record = command ? commandToJournalRecord(command, new Date('2026-07-13T12:00:00.000Z')) : null;
  assert.deepEqual(record?.source.kind === 'text_note' ? record.source.origin : null, origin);
  assert.equal(record?.note, 'The quiet path by the pond.');
  assert.equal(record?.note?.includes(origin.promptText), false);
});

test('blank text without a voice recording cannot create a reflection', () => {
  assert.equal(prepareCompanionReflection({
    creatureId: 'mossprout',
    dayId: '2026-07-13',
    draft: {
      kind: 'text',
      text: '   ',
      promptId: 'reflection:park',
      promptText: 'What stayed with you?',
    },
  }), null);
});
