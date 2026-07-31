import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomeDayRecord } from '@/types/home';
import type { InteractiveQuestExecution } from '@/utils/quests/experiences/types';
import type { QuestRuntimeStatus } from '@/utils/quests/runtime';
import {
  buildCompanionQuestViewModel,
  companionQuestBackAction,
  companionQuestInlineNoteAction,
  companionQuestPresentation,
  companionInteractionReducer,
  companionRouteBackAction,
  companionQuestSkipsPreview,
  companionQuestUsesFullBleed,
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

test('quest presentation keeps shell ownership and backdrop treatment together', () => {
  assert.deepEqual(
    companionQuestPresentation({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution),
    { backdrop: 'normal', layout: 'fullBleed', startsImmediately: true },
  );
  assert.deepEqual(
    companionQuestPresentation({ kind: 'block_blast', packId: 'cheerlet-party' } as InteractiveQuestExecution),
    { backdrop: 'strong', layout: 'standard', startsImmediately: true },
  );
  assert.deepEqual(
    companionQuestPresentation(null),
    { backdrop: 'normal', layout: 'standard', startsImmediately: false },
  );
});

test('interactive mini-games launch directly without duplicate preview screens', () => {
  assert.equal(companionQuestSkipsPreview({ kind: 'matching', packId: 'mossprout-garden' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview({ kind: 'matching', packId: 'relicoon-gallery' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview({ kind: 'merge', packId: 'feastle-kitchen' } as InteractiveQuestExecution), true);
  assert.equal(companionQuestSkipsPreview(null), false);
});

test('legacy mini-game back helper returns through the quest overview', () => {
  assert.equal(companionQuestBackAction({ activeAttemptId: 'attempt-1', experienceOpen: true }), 'confirm_attempt_exit');
  assert.equal(companionQuestBackAction({ activeAttemptId: null, experienceOpen: true }), 'return_to_do');
  assert.equal(companionQuestBackAction({ activeAttemptId: null, experienceOpen: false }), 'close_sheet');
});

function runtime(overrides: Partial<QuestRuntimeStatus> = {}): QuestRuntimeStatus {
  return {
    questId: 'quest-park', state: 'in_progress', complete: false, submissionMode: 'manual', readyToSubmit: false,
    progress: [], matchedEvidenceIds: [], possibleEvidenceIds: [], confidence: null, missingCapabilities: [],
    nextAction: 'take_photo', userMessage: 'Take a clear photo of a park.', debugReason: 'test', ...overrides,
  };
}

test('ordinary companion visits open on the new home route', () => {
  const initial = createCompanionInteractionState({});
  assert.deepEqual(initial.route, { kind: 'home' });
  assert.equal(initial.destination, null);
  assert.equal(companionRouteBackAction(initial), 'close_experience');
});

test('companion destinations clear focused review state and preserve direction', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'quest' });
  const reviewing = companionInteractionReducer(initial, { type: 'review_item', itemId: 'evidence-1' });
  const you = companionInteractionReducer(reviewing, { type: 'select_destination', destination: 'discovery' });
  const insight = companionInteractionReducer(you, { type: 'select_destination', destination: 'insight' });
  const backToYou = companionInteractionReducer(insight, { type: 'select_destination', destination: 'discovery' });
  assert.equal(you.destination, 'discovery');
  assert.equal(you.reviewItemId, null);
  assert.equal(insight.direction, 1);
  assert.equal(backToYou.direction, -1);
});

test('focused companion routes unwind to their destination, then home, then Kingdom', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'discovery' });
  const questionnaire = companionInteractionReducer(initial, {
    type: 'open_journey_questionnaire',
    sessionId: 'journey-1',
  });
  assert.equal(companionRouteBackAction(questionnaire), 'return_to_destination');

  const discovery = companionInteractionReducer(questionnaire, { type: 'return_to_destination' });
  assert.deepEqual(discovery.route, { kind: 'destination', destination: 'discovery' });
  assert.equal(companionRouteBackAction(discovery), 'return_to_home');

  const home = companionInteractionReducer(discovery, { type: 'show_home' });
  assert.deepEqual(home.route, { kind: 'home' });
  assert.equal(companionRouteBackAction(home), 'close_experience');
});

test('active mini-games require confirmation and reset their instance on return', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'quest' });
  const preview = companionInteractionReducer(initial, { type: 'open_quest_experience' });
  assert.equal(companionRouteBackAction(preview), 'return_to_destination');

  const active = companionInteractionReducer(preview, {
    type: 'set_quest_attempt',
    attemptId: 'attempt-1',
  });
  assert.equal(companionRouteBackAction(active), 'confirm_attempt_exit');

  const returned = companionInteractionReducer(active, { type: 'return_to_destination' });
  assert.deepEqual(returned.route, { kind: 'destination', destination: 'quest' });
  assert.equal(returned.experienceInstance, 1);
});

test('goal picker returns to the dedicated goals destination', () => {
  const initial = createCompanionInteractionState({ initialDestination: 'goals' });
  const picker = companionInteractionReducer(initial, { type: 'open_quick_goal_picker' });
  const returned = companionInteractionReducer(picker, { type: 'return_to_destination' });
  assert.deepEqual(returned.route, { kind: 'destination', destination: 'goals' });
});

test('explicit launch intents can open a destination directly', () => {
  const quest = createCompanionInteractionState({ initialDestination: 'quest' });
  const skins = createCompanionInteractionState({ initialDestination: 'skins' });
  assert.deepEqual(quest.route, { kind: 'destination', destination: 'quest' });
  assert.deepEqual(skins.route, { kind: 'destination', destination: 'skins' });
});

test('companion viewport resets across destinations and content-shape transitions', () => {
  const base = {
    creatureId: 'companion:vesperitt',
    destination: 'quest' as const,
    questMode: 'offer' as const,
  };
  const quest = companionViewportResetKey(base);
  assert.notEqual(companionViewportResetKey({ ...base, destination: 'discovery' }), quest);
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

test('semantic note quests expose an inline note and voice attempt action', () => {
  const model = buildCompanionQuestViewModel({
    activeQuest: {
      title: 'Notice one living detail',
      hint: 'Share something specific you noticed outside.',
      semanticInput: true,
      journalFallback: true,
    },
    offer: undefined,
    runtime: runtime({
      questId: 'quest-mossprout-living-detail',
      nextAction: 'add_note',
      userMessage: 'Add a note about what you noticed.',
    }),
    questComplete: false,
    captureFeedback: null,
    items: [],
    criteria: [{ label: 'Describe a real green-space moment', done: false }],
  });
  assert.equal(model.mode, 'active');
  assert.equal(model.journalFallback, true);
  assert.equal(companionQuestInlineNoteAction(model)?.nextAction, 'add_note');

  const ordinary = { ...model, semanticInput: false };
  assert.equal(companionQuestInlineNoteAction(ordinary), null);
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
