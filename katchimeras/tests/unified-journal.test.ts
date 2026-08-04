import assert from 'node:assert/strict';
import test from 'node:test';

import { commitJournalRecord } from '@/game/days/mutations/manual-journal';
import { withCapturedMoment } from '@/game/days/mutations/capture';
import type { JournalCommitCommand, StoredHomeDayRecord } from '@/types/home';
import { commandToJournalRecord, submissionToJournalCommand } from '@/utils/journal-domain';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';
import { createJournalSession, journalDraftIsDirty, journalSessionReducer } from '@/utils/journal-session';
import { noteSuggestedSpecific } from '@/utils/note-journal-specific';
import { journalDaySearchAnchors, journalPlaceSearchQuery, mergePlaceSearchAnchors } from '@/utils/journal-place-search';
import { classificationForResolvedRoute, foundationAtomicNeedsRetry, foundationAtomicRoutes, foundationNoteRoute, journalNoteRouteNeedsConfirmation, journalRouteForAlias, journalRouteForIds, journalRouteNeedsConfirmation, parseFoundationJournalClassification, rankJournalRoutes, registryJournalRoutes, resolveFoundationRouteEvidence } from '@/utils/journal-routing';
import { validateJournalProjections } from '@/utils/journal-selectors';
import { prepareCompanionCheckInReflection } from '@/utils/companion-reflection';

const now = new Date('2026-07-13T12:00:00.000Z');
function baseDay(): StoredHomeDayRecord {
  return { id: 'day', isoDate: '2026-07-13', state: 'forming', moments: [], locations: [], promptAnswers: [], evidence: [], classifiedMemories: [], manualJournalEntries: [], journalRecords: [], notes: [], foodMoments: [], studioMoments: [], bigMoments: [] } as unknown as StoredHomeDayRecord;
}

test('historical Photo Library review journals without changing hatched energy', () => {
  const day = {
    ...baseDay(),
    state: 'hatched' as const,
    capturedEnergy: { calm: 0.2 },
    usedPhotoAssetIds: [],
  };
  const result = withCapturedMoment(
    day,
    {
      energy: { energy: 0.9 },
      vision: null,
      sourceId: 'asset-map-photo',
      meaning: { archetype: 'calm', label: 'Apple', thumbnailUri: 'ph://asset-map-photo', sourceId: 'asset-map-photo' },
      journal: {
        sessionId: 'asset-map-photo',
        flowId: 'food',
        path: ['food', 'snack'],
        categoryId: 'snack',
        canonicalQualityIds: ['subject.food'],
        fields: { specific: 'Apple' },
        sourceType: 'photo',
        sourceId: 'asset-map-photo',
        thumbnailUri: 'ph://asset-map-photo',
      },
    },
    { food: { detected: false }, studio: { detected: false } },
    now,
    { allowHatched: true, journalOnly: true }
  );

  assert.deepEqual(result.capturedEnergy, { calm: 0.2 });
  assert.equal(result.journalRecords?.[0]?.source.kind, 'photo');
  assert.equal(result.journalRecords?.[0]?.fields.specific, 'Apple');
});

test('editing a daily companion check-in replaces its canonical journal memory', () => {
  const baseCheckIn = {
    id: 'journey-check-in:companion:tasklet:2026-07-13',
    companionId: 'companion:tasklet',
    familyId: 'tasklet' as const,
    dayId: '2026-07-13',
    goalId: null,
    definitionId: null,
    definitionVersion: 0,
    suggestedQuickGoalIds: [],
    taskSuggestionStatus: null,
    startedAt: 1,
    updatedAt: 4,
    completedAt: 4,
    answers: [
      { questionId: 'moment' as const, optionId: 'progress', label: 'I made progress', answeredAt: 2 },
      { questionId: 'effect' as const, optionId: 'supported', label: 'It supported what I want', answeredAt: 3 },
      { questionId: 'next' as const, optionId: 'remember', label: 'Just remember it', answeredAt: 4 },
    ],
  };
  const firstPrepared = prepareCompanionCheckInReflection({ checkIn: baseCheckIn });
  assert.ok(firstPrepared);
  const firstCommand = submissionToJournalCommand(firstPrepared.submission, now);
  assert.ok(firstCommand);
  const first = commitJournalRecord(baseDay(), firstCommand, now);

  const editedPrepared = prepareCompanionCheckInReflection({
    checkIn: {
      ...baseCheckIn,
      updatedAt: 8,
      completedAt: 8,
      answers: [
        { questionId: 'moment', optionId: 'blocked', label: 'Something felt difficult', answeredAt: 6 },
        { questionId: 'effect', optionId: 'blocked', label: 'It got in the way', answeredAt: 7 },
        { questionId: 'next', optionId: 'smaller', label: 'Make the next step easier', answeredAt: 8 },
      ],
    },
  });
  assert.ok(editedPrepared);
  const editedCommand = submissionToJournalCommand(editedPrepared.submission, new Date(now.getTime() + 1_000));
  assert.ok(editedCommand);
  const edited = commitJournalRecord(first, editedCommand, new Date(now.getTime() + 1_000));

  assert.equal(edited.journalRecords?.length, 1);
  assert.equal(edited.manualJournalEntries?.length, 1);
  assert.match(edited.journalRecords?.[0]?.note ?? '', /Something felt difficult/);
});

test('journal session reducer handles deep links and reversible navigation', () => {
  const initial = createJournalSession({ sessionId: 's1', source: { kind: 'manual', sourceId: 's1' }, flowId: 'food' });
  assert.equal(initial.stage, 'category');
  const details = journalSessionReducer(initial, { type: 'select_category', categoryId: 'meal' });
  assert.equal(details.stage, 'details');
  assert.equal(details.draft.categoryId, 'meal');
  assert.equal(journalSessionReducer(details, { type: 'back' }).stage, 'category');
  assert.equal(journalDraftIsDirty(details.draft), true);
});

test('changing a journal category preserves its submitted source note', () => {
  const initial = createJournalSession({ sessionId: 's-note', source: { kind: 'voice_note', sourceId: 'voice-1', audioUri: 'voice.m4a', durationMs: 4200 }, flowId: 'food' });
  const withNote = journalSessionReducer(
    journalSessionReducer(initial, { type: 'set_note', value: 'Had ramen after the walk' }),
    { type: 'set_attachments', value: [{ id: 'voice-1', kind: 'voice', text: 'Had ramen after the walk', uri: 'voice.m4a', durationMs: 4200 }] }
  );
  const changed = journalSessionReducer(withNote, { type: 'select_category', categoryId: 'meal' });
  assert.equal(changed.draft.note, 'Had ramen after the walk');
  assert.equal(changed.draft.attachments[0]?.uri, 'voice.m4a');
});

test('Foundation journal output is canonicalized and invalid pairs are rejected', () => {
  assert.deepEqual(parseFoundationJournalClassification({
    classificationKind: 'categorized', flowId: 'food', categoryId: 'meal', specific: 'Ramen', context: 'not-valid', journalFeeling: 'treat',
  }), {
    kind: 'categorized', flowId: 'food', categoryId: 'meal', fields: { specific: 'Ramen', context: null }, feeling: 'treat', provider: 'appleFoundation',
  });
  assert.equal(parseFoundationJournalClassification({ classificationKind: 'categorized', flowId: 'food', categoryId: 'film' })?.flowId, 'studio');
  assert.deepEqual(parseFoundationJournalClassification({ classificationKind: 'generic', flowId: 'studio', categoryId: 'film', specific: 'A passing thought' }), {
    kind: 'generic', flowId: 'general', categoryId: 'other', fields: { specific: 'A passing thought', context: null }, feeling: null, provider: 'appleFoundation',
  });
  assert.equal(parseFoundationJournalClassification({ classificationKind: 'categorized', flowId: 'food', categoryId: 'meal', specific: 'x'.repeat(121) })?.fields.specific, null);
});

test('I watched the movie obsession routes to the Film journal with new or legacy Foundation output', () => {
  const structured = parseFoundationJournalClassification({
    classificationKind: 'categorized', flowId: 'media', categoryId: 'movie', specific: 'Obsession',
  });
  assert.equal(structured?.flowId, 'studio');
  assert.equal(structured?.categoryId, 'film');
  assert.equal(foundationNoteRoute({ classification: structured })?.id, 'studio.film');
  assert.equal(foundationNoteRoute({ provider: 'appleFoundation', llmClassified: true, mediaType: 'film' })?.id, 'studio.film');
  assert.equal(foundationNoteRoute({ provider: 'deterministic', llmClassified: true, mediaType: 'film' }), null);
});

test('I went to the national history museum routes to Places and days out, Museum', () => {
  const classification = parseFoundationJournalClassification({
    classificationKind: 'clear', flowId: 'places', categoryId: 'national history museum', specific: 'National History Museum',
  });
  assert.equal(classification?.flowId, 'went_somewhere');
  assert.equal(classification?.categoryId, 'museum');
  assert.equal(classification?.fields.specific, 'National History Museum');
  assert.equal(foundationNoteRoute({ classification })?.id, 'went_somewhere.museum');
});

test('unnamed place notes search by category around meaningful locations from that day', () => {
  assert.equal(journalPlaceSearchQuery('', 'museum'), 'museum or gallery');
  assert.equal(journalPlaceSearchQuery('Natural History Museum', 'museum'), 'Natural History Museum');
  assert.equal(journalPlaceSearchQuery('', 'cafe'), 'cafe');
  assert.equal(journalPlaceSearchQuery('', 'other_place'), '');
  const homeAnchor = { lat: 51.5000, lng: -0.1200, source: 'manual' as const, setAt: now.toISOString() };
  const anchors = journalDaySearchAnchors([
    { id: 'home-1', lat: 51.5000, lng: -0.1200, capturedAt: '2026-07-13T08:00:00.000Z', type: 'home', hasPhoto: false, source: 'foreground' },
    { id: 'museum-1', lat: 51.4967, lng: -0.1764, capturedAt: '2026-07-13T12:00:00.000Z', type: 'unknown', hasPhoto: false, source: 'foreground' },
    { id: 'museum-2', lat: 51.4968, lng: -0.1765, capturedAt: '2026-07-13T12:05:00.000Z', type: 'unknown', hasPhoto: true, source: 'photo_attachment' },
  ], homeAnchor);
  assert.equal(anchors.length, 1);
  assert.ok(Math.abs(anchors[0]!.latitude - 51.49675) < 0.001);
  assert.deepEqual(mergePlaceSearchAnchors(anchors, { latitude: 51.5000, longitude: -0.1200 }), [
    anchors[0],
    { latitude: 51.5000, longitude: -0.1200 },
  ]);
});

test('registry-wide evidence corrects generic birthday output without misrouting birthday food', () => {
  const birthday = resolveFoundationRouteEvidence('It’s my birthday', { routeKey: 'general.other', routeConfidence: 0.9 }, { routeKey: 'big_event.birthday', routeConfidence: 0.91 });
  assert.equal(birthday.selected?.id, 'big_event.birthday');
  assert.equal(registryJournalRoutes('It’s my birthday')[0]?.id, 'big_event.birthday');
  assert.equal(registryJournalRoutes("I baked my son's birthday cake")[0]?.id, 'food.cooking');
});

test('watched international football routes to live sport while played video games remain games', () => {
  const transcript = 'I watched the England Argentina football game';
  assert.equal(registryJournalRoutes(transcript)[0]?.id, 'studio.other_media');
  assert.equal(registryJournalRoutes('I played a video game')[0]?.id, 'studio.game');
  assert.notEqual(registryJournalRoutes('I played a football game')[0]?.id, 'studio.game');
  const corrected = resolveFoundationRouteEvidence(
    transcript,
    { routeKey: 'studio.game', routeConfidence: 0.9 },
    { routeKey: 'studio.other_media', routeConfidence: 0.88 }
  );
  assert.equal(corrected.selected?.id, 'studio.other_media');
  const foundationOnly = resolveFoundationRouteEvidence(
    transcript,
    { routeKey: 'studio.game', routeConfidence: 0.9 },
    null,
    { includeRegistryEvidence: false }
  );
  assert.equal(foundationOnly.selected?.id, 'studio.game');
  assert.deepEqual(foundationOnly.routes.map((route) => route.id), ['studio.game']);
  assert.equal(
    foundationAtomicNeedsRetry(transcript, { routeKey: 'studio.game', routeConfidence: 0.9 }, { includeRegistryEvidence: false }),
    false
  );
});

test('every manual journal category accepts canonical IDs, labels, and missing kind inference', () => {
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    for (const choice of flow.choices) {
      assert.equal(journalRouteForIds(flow.id, choice.id)?.id, `${flow.id}.${choice.id}`);
      assert.equal(journalRouteForIds(flow.id, choice.label)?.id, `${flow.id}.${choice.id}`);
      const parsed = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, specific: 'Test detail' });
      assert.equal(parsed?.flowId, flow.id, `${flow.id}.${choice.id} flow`);
      assert.equal(parsed?.categoryId, choice.id, `${flow.id}.${choice.id} category`);
      const contexts = choice.contextChoices ?? flow.contextChoices ?? [];
      const feelings = choice.feelings ?? flow.feelings;
      if (contexts[0]) {
        const withContext = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, context: contexts[0].label });
        assert.equal(withContext?.fields.context, contexts[0].id, `${flow.id}.${choice.id} context`);
      }
      if (feelings[0]) {
        const withFeeling = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, journalFeeling: feelings[0].label });
        assert.equal(withFeeling?.feeling, feelings[0].id, `${flow.id}.${choice.id} feeling`);
      }
    }
  }
});

test('classification catalog covers every category and every representative example', () => {
  const registryKeys = MANUAL_JOURNAL_FLOWS.flatMap((flow) => flow.choices.map((choice) => `${flow.id}.${choice.id}`)).sort();
  assert.deepEqual(JOURNAL_CLASSIFICATION_CATALOG.map((entry) => entry.routeKey).sort(), registryKeys);
  for (const entry of JOURNAL_CLASSIFICATION_CATALOG) {
    assert.ok(entry.definition.length > 8, `${entry.routeKey} definition`);
    assert.ok(entry.examples.length > 0, `${entry.routeKey} examples`);
    assert.equal(registryJournalRoutes(entry.examples[0])[0]?.id, entry.routeKey, `${entry.routeKey} representative example`);
    const atomic = foundationAtomicRoutes({ routeKey: entry.routeKey, routeConfidence: '0.93', specific: 'Test' });
    assert.equal(atomic[0]?.id, entry.routeKey, `${entry.routeKey} atomic route`);
    assert.equal(classificationForResolvedRoute(atomic[0]!, { specific: 'Test' }, 'foundation')?.categoryId, entry.categoryId, `${entry.routeKey} classification`);
  }
});

test('atomic routing retries generic, ambiguous, low-margin, and registry-conflicting reads', () => {
  assert.equal(foundationAtomicNeedsRetry('A thought', { routeKey: 'general.other', routeConfidence: 0.95 }), true);
  assert.equal(foundationAtomicNeedsRetry('A thought', { routeKey: 'ambiguous', routeConfidence: 0.8 }), true);
  assert.equal(foundationAtomicNeedsRetry('I watched a movie', { routeKey: 'studio.film', routeConfidence: 0.8 }), true);
  assert.equal(foundationAtomicNeedsRetry('It’s my birthday', { routeKey: 'people.solo', routeConfidence: 0.95 }), true);
  assert.equal(foundationAtomicNeedsRetry('I watched a movie', { routeKey: 'studio.film', routeConfidence: 0.95, alternativeRouteKey: 'studio.show', alternativeRouteConfidence: 0.5 }), false);
});

test('conflicting evidence remains editable suggestions instead of forcing a route', () => {
  const decision = resolveFoundationRouteEvidence(
    'I travelled to a new city',
    { routeKey: 'went_somewhere.city', routeConfidence: 0.9, alternativeRouteKey: 'movement.travel', alternativeRouteConfidence: 0.82 },
    { routeKey: 'movement.travel', routeConfidence: 0.88, alternativeRouteKey: 'went_somewhere.city', alternativeRouteConfidence: 0.84 }
  );
  assert.ok(decision.routes.length >= 2);
  assert.equal(decision.selected, null);
});

test('a clear Foundation note route opens its journal category and retains generated detail', () => {
  const raw = {
    routeKey: 'food.snack',
    routeConfidence: 0.76,
    alternativeRouteKey: '',
    alternativeRouteConfidence: 0,
    specific: 'Apple',
  };
  const decision = resolveFoundationRouteEvidence('I ate an apple', raw, null, { includeRegistryEvidence: false });
  assert.equal(decision.selected?.id, 'food.snack');
  assert.equal(journalNoteRouteNeedsConfirmation(decision.routes), false);
  assert.equal(classificationForResolvedRoute(decision.selected!, raw, decision.decisionSource)?.fields.specific, 'Apple');
});

test('Foundation note fields wait for route-locked extraction and never copy other read metadata', () => {
  const base = {
    intelligenceProvider: 'appleFoundation' as const,
    llmClassified: false,
    media: null,
    food: null,
  };
  assert.equal(noteSuggestedSpecific({
    ...base,
    journalClassification: {
      kind: 'categorized', flowId: 'food', categoryId: 'snack', fields: { specific: null, context: null }, feeling: null, provider: 'appleFoundation',
    },
  }), null);
  assert.equal(noteSuggestedSpecific({
    ...base,
    journalClassification: {
      kind: 'categorized', flowId: 'food', categoryId: 'snack', fields: { specific: 'Apple', context: null }, feeling: null, provider: 'appleFoundation',
    },
  }), 'Apple');
  assert.equal(noteSuggestedSpecific({
    ...base,
    llmClassified: true,
    media: { mediaType: 'book', title: 'Harry Potter', creator: null },
    journalClassification: {
      kind: 'categorized', flowId: 'studio', categoryId: 'book', fields: { specific: null, context: null }, feeling: null, provider: 'appleFoundation',
    },
  }), null);
});

test('note routing still asks for confirmation when confidence or candidate lead is weak', () => {
  const lowConfidence = foundationAtomicRoutes({ routeKey: 'food.snack', routeConfidence: 0.7 });
  const closeCandidates = foundationAtomicRoutes({
    routeKey: 'food.snack',
    routeConfidence: 0.8,
    alternativeRouteKey: 'food.meal',
    alternativeRouteConfidence: 0.7,
  });
  assert.equal(journalNoteRouteNeedsConfirmation(lowConfidence), true);
  assert.equal(journalNoteRouteNeedsConfirmation(closeCandidates), true);
});

test('shared route resolver uses registry aliases and confidence boundaries', () => {
  const meal = journalRouteForAlias('meal', 0.9, 'test');
  const book = journalRouteForAlias('book', 0.8, 'test');
  const routes = rankJournalRoutes([meal, book]);
  assert.equal(routes[0]?.id, 'food.meal');
  assert.equal(journalRouteNeedsConfirmation(routes), true);
  assert.equal(journalRouteNeedsConfirmation([meal!]), false);
});

test('canonical commit is idempotent and creates compatibility projections', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'photo:file:///meal.jpg',
    draft: {
      sessionId: 'capture-1', source: { kind: 'photo', sourceId: 'file:///meal.jpg', thumbnailUri: 'thumb.jpg' },
      flowId: 'food', categoryId: 'meal', fields: { specific: 'Ramen', context: 'japanese' }, feeling: 'treat', note: null,
      attachments: [{ id: 'photo-1', kind: 'photo', uri: 'thumb.jpg' }], confirmedFacets: [{ key: 'food_item', value: 'Ramen' }],
    },
  };
  assert.equal(commandToJournalRecord(command, now)?.source.kind, 'photo');
  const first = commitJournalRecord(baseDay(), command, now);
  const repeated = commitJournalRecord(first, command, new Date(now.getTime() + 1000));
  assert.equal(first.journalRecords?.length, 1);
  assert.equal(first.foodMoments?.[0]?.label, 'Ramen');
  assert.equal(repeated, first);
  assert.deepEqual(validateJournalProjections(first), []);
});

test('confirmed place locations persist once while non-place routes discard coordinates', () => {
  const location = {
    latitude: 51.4967,
    longitude: -0.1764,
    name: 'Natural History Museum',
    address: 'Cromwell Road, London',
    placeId: 'apple:natural-history-museum',
    venueKey: 'provider:apple:natural-history-museum',
    locality: null,
    region: null,
    countryCode: null,
    source: 'apple_maps' as const,
    accuracyMeters: null,
  };
  const placeCommand = submissionToJournalCommand({
    sessionId: 'place-note',
    flowId: 'went_somewhere',
    path: ['went_somewhere', 'museum'],
    categoryId: 'museum',
    canonicalQualityIds: [],
    fields: { specific: 'Natural History Museum', context: null },
    journalSource: { kind: 'text_note', sourceId: 'place-note' },
    linkedNote: { kind: 'text', text: 'I went to the Natural History Museum' },
    location,
  }, now);
  assert.ok(placeCommand);
  const first = commitJournalRecord(baseDay(), placeCommand!, now);
  const repeated = commitJournalRecord(first, placeCommand!, new Date(now.getTime() + 1_000));
  assert.deepEqual(first.journalRecords?.[0]?.location, location);
  assert.equal(first.locations.length, 1);
  assert.equal(first.locations[0]?.label, 'Natural History Museum');
  assert.equal(first.locations[0]?.journalRecordId, first.journalRecords?.[0]?.id);
  assert.equal(repeated.locations.length, 1);

  const foodCommand = submissionToJournalCommand({
    sessionId: 'food-note',
    flowId: 'food',
    path: ['food', 'snack'],
    categoryId: 'snack',
    canonicalQualityIds: [],
    fields: { specific: 'Apple', context: null },
    location,
  }, now);
  assert.equal(foodCommand?.draft.location, null);

  const photoPlaceCommand = submissionToJournalCommand({
    sessionId: 'photo-place',
    flowId: 'went_somewhere',
    path: ['went_somewhere', 'museum'],
    categoryId: 'museum',
    canonicalQualityIds: [],
    fields: { specific: 'Natural History Museum', context: null },
    sourceType: 'photo',
    sourceId: 'photo-place-asset',
    thumbnailUri: 'ph://photo-place-asset',
    location,
  }, now);
  assert.equal(photoPlaceCommand?.draft.location, null);
});

test('new journal memories inherit the current day location and photo memories prefer their own geotag', () => {
  const day = {
    ...baseDay(),
    locations: [
      {
        id: 'live-location', lat: 51.5, lng: -0.14, capturedAt: now.toISOString(), type: 'home',
        hasPhoto: false, source: 'foreground', momentId: null, label: 'Home',
      },
      {
        id: 'camera-roll-photo-book-cover', lat: 51.51, lng: -0.12, capturedAt: now.toISOString(), type: 'unknown',
        hasPhoto: true, source: 'photo_attachment', momentId: null, thumbnailUri: 'ph://book-cover',
      },
    ],
  } as unknown as StoredHomeDayRecord;
  const foodCommand = submissionToJournalCommand({
    sessionId: 'food-location', flowId: 'food', path: ['food', 'snack'], categoryId: 'snack',
    canonicalQualityIds: [], fields: { specific: 'Apple', context: null },
  }, now)!;
  const withFood = commitJournalRecord(day, foodCommand, now);
  assert.equal(withFood.journalRecords?.[0]?.location?.name, 'Home');
  assert.equal(withFood.journalRecords?.[0]?.location?.source, 'day_location');
  assert.equal(withFood.locations.find((point) => point.journalRecordId === withFood.journalRecords?.[0]?.id)?.lat, 51.5);

  const photoCommand: JournalCommitCommand = {
    idempotencyKey: 'photo:book-cover',
    draft: {
      sessionId: 'book-location', source: { kind: 'photo', sourceId: 'book-cover', thumbnailUri: 'ph://book-cover' },
      flowId: 'studio', categoryId: 'book', fields: { specific: 'A Brief History of Time' }, feeling: null,
      note: null, attachments: [], confirmedFacets: [],
    },
  };
  const withPhoto = commitJournalRecord(day, photoCommand, now);
  assert.equal(withPhoto.journalRecords?.[0]?.location?.source, 'photo_metadata');
  assert.equal(withPhoto.journalRecords?.[0]?.location?.latitude, 51.51);
  assert.equal(withPhoto.journalRecords?.[0]?.location?.longitude, -0.12);

  const unmatchedPhotoCommand: JournalCommitCommand = {
    idempotencyKey: 'photo:no-geotag',
    draft: {
      sessionId: 'no-geotag', source: { kind: 'photo', sourceId: 'no-geotag', thumbnailUri: 'ph://no-geotag' },
      flowId: 'went_somewhere', categoryId: 'museum', fields: { specific: 'A museum' }, feeling: null,
      note: null, attachments: [], confirmedFacets: [],
      location: {
        latitude: 40.7128, longitude: -74.006, name: 'Suggested place', source: 'apple_maps',
      },
    },
  };
  const withoutPhotoGeotag = commitJournalRecord(day, unmatchedPhotoCommand, now);
  assert.equal(withoutPhotoGeotag.journalRecords?.[0]?.location, null);
});

test('a categorized voice submission atomically preserves journal, note, and audio', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'voice_note:voice-atomic',
    draft: {
      sessionId: 'voice-atomic', source: { kind: 'voice_note', sourceId: 'voice-atomic', audioUri: 'voice.m4a', durationMs: 7300 },
      flowId: 'general', categoryId: 'other', fields: { specific: 'A passing thought', context: null }, feeling: null,
      note: 'A passing thought I wanted to keep',
      attachments: [{ id: 'voice-attachment', kind: 'voice', text: 'A passing thought I wanted to keep', uri: 'voice.m4a', durationMs: 7300 }],
      confirmedFacets: [],
    },
  };
  const result = commitJournalRecord(baseDay(), command, now);
  assert.equal(result.journalRecords?.[0]?.flowId, 'general');
  assert.equal(result.journalRecords?.[0]?.categoryId, 'other');
  assert.equal(result.notes?.[0]?.id, 'voice-atomic');
  assert.equal(result.notes?.[0]?.audioUri, 'voice.m4a');
  assert.equal(result.notes?.[0]?.durationMs, 7300);
  assert.equal(result.classifiedMemories?.[0]?.sourceId, 'voice-atomic');
});

test('journal commit stays below the foreground mutation budget', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'manual:perf',
    draft: { sessionId: 'perf', source: { kind: 'manual', sourceId: 'perf' }, flowId: 'general', categoryId: 'highlight', fields: { specific: 'A good moment' }, feeling: null, note: null, attachments: [], confirmedFacets: [] },
  };
  const started = performance.now();
  commitJournalRecord(baseDay(), command, now);
  assert.ok(performance.now() - started < 100);
});
