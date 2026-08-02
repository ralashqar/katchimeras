import type { JournalCommitCommand, JournalLocationSelection, JournalRecord, ManualJournalEntry, ManualJournalSubmission, MemoryDomain, StoredHomeDayRecord, StoredHomeLocationPoint } from '@/types/home';
import { buildNoteEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { applyManualJournalFacets, buildManualJournalClassifiedMemory, buildNoteClassifiedMemory, upsertClassifiedMemory } from '@/utils/intelligence/classification';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import { commandToJournalRecord, submissionToJournalCommand } from '@/utils/journal-domain';
import { isPlausibleGeographicCoordinate } from '@/utils/photo-location';
import { applyJournalCompatibilityProjection } from './journal-projections';

export function withManualJournalEntry(day: StoredHomeDayRecord, submission: ManualJournalSubmission, now: Date): StoredHomeDayRecord {
  const command = submissionToJournalCommand(submission, now);
  return command ? commitJournalRecord(day, command, now) : day;
}

export function commitJournalRecord(day: StoredHomeDayRecord, command: JournalCommitCommand, now: Date): StoredHomeDayRecord {
  const existing = day.journalRecords?.find((item) => item.idempotencyKey === command.idempotencyKey) ?? null;
  const origin = command.draft.source.origin ?? null;
  if (existing && origin?.kind !== 'companion_reflection') return day;
  const record = commandToJournalRecord(command, now);
  if (!record) return day;
  const base = existing ? removeReplaceableCompanionReflection(day, existing) : day;
  return projectJournalRecord(base, assignAutomaticJournalLocation(base, record, now), now);
}

function removeReplaceableCompanionReflection(
  day: StoredHomeDayRecord,
  existing: JournalRecord
): StoredHomeDayRecord {
  const manualEntryId = `manual-${existing.id}`;
  const sourceId = existing.source.sourceId;
  return {
    ...day,
    journalRecords: (day.journalRecords ?? []).filter((record) => record.id !== existing.id),
    manualJournalEntries: (day.manualJournalEntries ?? []).filter((entry) => entry.id !== manualEntryId),
    notes: (day.notes ?? []).filter((note) => note.id !== sourceId),
    classifiedMemories: (day.classifiedMemories ?? []).filter((memory) => memory.sourceId !== sourceId),
    evidence: (day.evidence ?? []).filter((evidence) => evidence.sourceId !== sourceId),
    locations: (day.locations ?? []).filter((location) => location.journalRecordId !== existing.id),
  };
}

function projectJournalRecord(day: StoredHomeDayRecord, record: JournalRecord, _now: Date): StoredHomeDayRecord {
  const submission = recordToLegacySubmission(record);
  const flow = manualJournalFlow(submission.flowId);
  const choice = flow?.choices.find((item) => item.id === submission.categoryId);
  if (!flow || !choice) return day;

  const createdAt = record.createdAt;
  const id = `manual-${record.id}`;
  if (day.manualJournalEntries?.some((item) => item.id === id)) return day;
  const noteSource = record.source.kind === 'text_note' || record.source.kind === 'voice_note';
  const linkedNoteId = submission.linkedNote && (submission.linkedNote.text.trim() || submission.linkedNote.audioUri)
    ? noteSource ? record.source.sourceId : `note-${record.id}`
    : null;
  const entry: ManualJournalEntry = {
    id, flowId: flow.id, flowVersion: flow.version, path: submission.path, categoryId: submission.categoryId,
    canonicalQualityIds: submission.canonicalQualityIds, fields: submission.fields, feeling: submission.feeling ?? null,
    note: submission.note?.trim() || null, sourceType: submission.sourceType ?? 'manual', sourceId: submission.sourceId ?? null,
    linkedNoteId, location: record.location ?? null, createdAt,
  };
  const specific = stringField(entry.fields.specific);
  const context = stringField(entry.fields.context);
  const text = [choice.label, specific, entry.feeling, entry.note].filter(Boolean).join(' · ');
  const primaryQuality = entry.canonicalQualityIds[0] ?? null;
  const food = flow.adapter === 'food' ? specific || choice.label : null;
  const mediaType = flow.adapter === 'studio' ? choice.mediaType ?? null : null;
  const photoMemory = submission.sourceType === 'photo' && submission.sourceId
    ? day.classifiedMemories?.find((memory) => memory.sourceType === 'photo' && memory.sourceId === submission.sourceId)
    : null;
  const noteKind = record.source.kind === 'voice_note' ? 'voice' : 'text';
  let classified = photoMemory ?? (noteSource
    ? buildNoteClassifiedMemory({
        noteId: linkedNoteId ?? record.source.sourceId,
        kind: noteKind,
        observedAt: createdAt,
        text,
        provider: 'manual',
        semanticCategoryId: primaryQuality,
        semanticConfidence: 1,
        mediaType,
        food,
        bigMomentType: choice.bigMomentType ?? null,
      })
    : buildManualJournalClassifiedMemory({ entryId: id, observedAt: createdAt, text, semanticCategoryId: primaryQuality, mediaType, food, bigMomentType: choice.bigMomentType ?? null }));
  const facets: Array<{ key: string; value: string; sensitive?: boolean }> = [...record.confirmedFacets];
  if (flow.adapter === 'place') facets.push({ key: 'place_category', value: choice.id });
  if (flow.adapter === 'movement') facets.push({ key: 'movement_mode', value: choice.id });
  if (flow.adapter === 'movement' && context) facets.push({ key: 'movement_subtype', value: context });
  if (flow.adapter === 'studio' && mediaType) facets.push({ key: 'media_type', value: mediaType });
  if (flow.adapter === 'studio' && specific) facets.push({ key: 'media_title', value: specific });
  if (flow.adapter === 'food') facets.push({ key: 'food_item', value: food ?? choice.label });
  if (flow.adapter === 'relationship') {
    const relationship = ({ partner: 'partner', my_child: 'my_child', family: 'family', friends: 'friends', group: 'friends', someone_new: 'someone_known', someone_else: 'someone_known', pet: 'my_pet' } as Record<string, string>)[choice.id];
    if (relationship) facets.push({ key: 'relationship', value: relationship, sensitive: true });
  }
  if (facets.length) classified = applyManualJournalFacets({ ...classified, dominantDomain: domainForAdapter(flow.adapter) }, facets, createdAt);
  const evidence = buildNoteEvidence({
    noteId: noteSource ? linkedNoteId ?? record.source.sourceId : id,
    kind: noteKind,
    observedAt: createdAt,
    text,
    provider: 'manual',
    mediaType,
    food,
    bigMomentType: choice.bigMomentType ?? null,
    semanticCategoryId: primaryQuality,
    semanticConfidence: 1,
    journalFlowId: record.flowId,
    journalCategoryId: record.categoryId,
    journalContextId: context || null,
    questLink: record.source.origin?.kind === 'companion_quest' ? {
      questRunId: record.source.origin.questRunId,
      questId: record.source.origin.questId,
      journalTemplateId: record.source.origin.journalTemplateId,
      inputMode: record.source.origin.inputMode,
    } : null,
  });
  const linkedNote = linkedNoteId && submission.linkedNote ? {
    id: linkedNoteId, kind: submission.linkedNote.kind, text: submission.linkedNote.text.trim(), audioUri: submission.linkedNote.audioUri ?? null,
    durationMs: submission.linkedNote.durationMs ?? null, archetype: archetypeForFeeling(entry.feeling), label: specific || choice.label,
    parentSourceType: submission.sourceType === 'photo' ? 'photo' as const : undefined,
    parentSourceId: submission.sourceType === 'photo' ? submission.sourceId ?? null : null,
    createdAt,
  } : null;
  const matchingSavedPlace = record.location ? (day.confirmedPlaces ?? []).find((place) =>
    (record.location?.placeId && place.placeId === record.location.placeId) ||
    (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && coordinateDistance(
      place.latitude!, place.longitude!, record.location!.latitude, record.location!.longitude
    ) <= 75)
  ) : null;
  const next: StoredHomeDayRecord = {
    ...day,
    journalRecords: [...(day.journalRecords ?? []), record].slice(-120),
    manualJournalEntries: [...(day.manualJournalEntries ?? []), entry].slice(-80),
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [classified]),
    evidence: submission.sourceType === 'photo'
      ? day.evidence
      : upsertEvidence(day.evidence, [noteSource ? evidence : { ...evidence, id: `evidence:manual:${id}`, sourceType: 'manual_log', sourceId: id }]),
    notes: linkedNote ? [...(day.notes ?? []), linkedNote] : day.notes,
    locations: record.location && !matchingSavedPlace?.locationPointId
      ? [
          ...(day.locations ?? []).filter((point) => point.journalRecordId !== record.id),
          {
            id: `journal-location-${record.id}`,
            lat: Number(record.location.latitude.toFixed(6)),
            lng: Number(record.location.longitude.toFixed(6)),
            capturedAt: createdAt,
            type: locationTypeForJournalChoice(choice.id),
            hasPhoto: record.source.kind === 'photo',
            source: locationPointSource(record.location.source),
            momentId: null,
            thumbnailUri: record.source.kind === 'photo' ? record.source.thumbnailUri ?? undefined : undefined,
            accuracyMeters: record.location.accuracyMeters ?? undefined,
            label: record.location.name,
            address: record.location.address ?? undefined,
            journalRecordId: record.id,
          },
        ].slice(-180)
      : day.locations,
  };
  return applyJournalCompatibilityProjection(next, { record, entry, flow, choice, specific, context, linkedNoteId });
}

function recordToLegacySubmission(record: JournalRecord): ManualJournalSubmission {
  const linked = record.attachments.find((item): item is typeof item & { kind: 'text' | 'voice' } => item.kind === 'text' || item.kind === 'voice');
  return {
    sessionId: record.id,
    flowId: record.flowId,
    path: [record.flowId, record.categoryId, ...(record.feeling ? [record.feeling] : [])],
    categoryId: record.categoryId,
    canonicalQualityIds: record.canonicalQualityIds,
    fields: record.fields,
    feeling: record.feeling,
    note: record.note,
    sourceType: record.source.kind === 'photo' ? 'photo' : 'manual',
    sourceId: record.source.sourceId,
    thumbnailUri: record.source.kind === 'photo' ? record.source.thumbnailUri ?? null : null,
    confirmedFacets: record.confirmedFacets,
    journalSource: record.source,
    linkedNote: linked ? { kind: linked.kind, text: linked.text ?? '', audioUri: linked.uri ?? null, durationMs: linked.durationMs ?? null } : null,
    location: record.location ?? null,
  };
}

function stringField(value: string | string[] | boolean | null | undefined): string { return typeof value === 'string' ? value.trim() : ''; }
function archetypeForFeeling(value?: string | null): string { if (value === 'exciting') return 'energy'; if (value === 'loved' || value === 'liked') return 'together'; if (value === 'difficult') return 'meaningful'; return 'calm'; }
function domainForAdapter(adapter: string): MemoryDomain { return ({ food: 'food', studio: 'media', place: 'place', movement: 'movement', relationship: 'people', work: 'work', big_event: 'life_event' } as Record<string, MemoryDomain>)[adapter] ?? 'other'; }
function locationTypeForJournalChoice(choiceId: string): 'home' | 'cafe' | 'park' | 'unknown' {
  if (choiceId === 'home') return 'home';
  if (choiceId === 'cafe' || choiceId === 'restaurant') return 'cafe';
  if (choiceId === 'park' || choiceId === 'garden' || choiceId === 'forest') return 'park';
  return 'unknown';
}
const CURRENT_LOCATION_WINDOW_MS = 30 * 60 * 1000;

function assignAutomaticJournalLocation(
  day: StoredHomeDayRecord,
  record: JournalRecord,
  now: Date
): JournalRecord {
  const points = (day.locations ?? []).filter((point) =>
    isPlausibleGeographicCoordinate(point.lat, point.lng)
  );
  const associatedPhoto = record.source.kind === 'photo'
    ? points.find((point) => photoPointMatchesRecord(point, record)) ?? null
    : null;

  // A photo journal can only inherit the source photo's own geotag. Do not
  // substitute a live sample, home, manual pin, or Apple Maps suggestion when
  // metadata is unavailable; an unlocated photo should remain unlocated.
  if (record.source.kind === 'photo') {
    return {
      ...record,
      location: associatedPhoto ? locationSelectionFromPoint(associatedPhoto, true) : null,
    };
  }

  if (record.location) return record;
  if (points.length === 0) return record;

  const livePoints = points.filter((point) =>
    point.source === 'foreground' || point.source === 'background' || point.source === 'manual'
  );
  const recentLivePoint = [...livePoints]
    .filter((point) => Math.abs(now.getTime() - pointTime(point)) <= CURRENT_LOCATION_WINDOW_MS)
    .sort((left, right) =>
      Math.abs(now.getTime() - pointTime(left)) - Math.abs(now.getTime() - pointTime(right))
    )[0] ?? null;
  const homePoint = newestPoint(points.filter((point) => point.type === 'home'));
  const fallbackPoint = newestPoint(livePoints);
  const point = recentLivePoint ?? homePoint ?? fallbackPoint;
  if (!point) return record;

  return {
    ...record,
    location: locationSelectionFromPoint(point, false),
  };
}

function photoPointMatchesRecord(point: StoredHomeLocationPoint, record: JournalRecord): boolean {
  if (record.source.kind !== 'photo') return false;
  return (
    point.id === `camera-roll-photo-${record.source.sourceId}` ||
    point.id.endsWith(record.source.sourceId) ||
    Boolean(record.source.thumbnailUri && point.thumbnailUri === record.source.thumbnailUri)
  );
}

function locationSelectionFromPoint(
  point: StoredHomeLocationPoint,
  fromPhoto: boolean
): JournalLocationSelection {
  return {
    latitude: point.lat,
    longitude: point.lng,
    name: point.label?.trim() || (point.type === 'home' ? 'Home' : fromPhoto ? 'Photo location' : 'Location at the time'),
    address: point.address?.trim() || null,
    placeId: null,
    source: fromPhoto ? 'photo_metadata' : 'day_location',
    accuracyMeters: point.accuracyMeters ?? null,
  };
}

function newestPoint(points: StoredHomeLocationPoint[]): StoredHomeLocationPoint | null {
  return [...points].sort((left, right) => pointTime(right) - pointTime(left))[0] ?? null;
}

function pointTime(point: StoredHomeLocationPoint): number {
  const time = new Date(point.capturedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function locationPointSource(source: JournalLocationSelection['source']): 'manual' | 'photo_attachment' | 'foreground' {
  if (source === 'photo_metadata') return 'photo_attachment';
  if (source === 'day_location' || source === 'current_location') return 'foreground';
  return 'manual';
}
function coordinateDistance(aLat: number, aLng: number, bLat: number, bLng: number): number { const r = 6371000; const dLat = (bLat - aLat) * Math.PI / 180; const dLng = (bLng - aLng) * Math.PI / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
