import type { BigMoment, CuisineFamily, DayMovementKind, FoodMeaning, FoodMoment, JournalRecord, ManualJournalEntry, StoredHomeDayRecord, StudioMoment, StudioRating } from '@/types/home';
import type { ManualJournalChoice, ManualJournalFlowDefinition } from '@/utils/manual-journal-registry';

export type JournalProjectionContext = { record: JournalRecord; entry: ManualJournalEntry; flow: ManualJournalFlowDefinition; choice: ManualJournalChoice; specific: string; context: string; linkedNoteId: string | null };
type Projector = (day: StoredHomeDayRecord, context: JournalProjectionContext) => StoredHomeDayRecord;
const EMOJI: Record<string, string> = { meal: '🍽️', snack: '🥐', dessert: '🍰', coffee: '☕', tea: '🫖', drink: '🥤', cooking: '🍳', other_food: '🍎', book: '📖', film: '🎬', show: '📺', game: '🎮', music: '🎵', podcast: '🎙️', art: '🎨', other_media: '✨' };
const MOVEMENT_EMOJI: Record<string, string> = { walk: '🚶', run: '🏃', cycle: '🚲', workout: '🏋️', sport: '⚽', hike: '🥾', errands: '🛒', commute: '🚇', travel: '✈️', mixed: '⚡' };

const PROJECTORS: Partial<Record<ManualJournalFlowDefinition['projectionKind'], Projector>> = {
  food(day, { record, entry, choice, specific, context }) {
    const moment: FoodMoment = { id: `food-${entry.id}`, label: specific || choice.label, emoji: EMOJI[choice.id] ?? '🍽️', meaning: asFoodMeaning(entry.feeling), cuisine: context && context !== 'home_cooked' ? context as CuisineFamily : null, homeCooked: context === 'home_cooked' || undefined, source: legacySource(record), sourceId: record.source.kind === 'photo' ? record.source.sourceId : entry.id, thumbnailUri: record.source.kind === 'photo' ? record.source.thumbnailUri ?? null : null, detail: entry.note, createdAt: entry.createdAt };
    return { ...day, foodMoments: [...(day.foodMoments ?? []), moment].slice(-12) };
  },
  studio(day, { record, entry, choice, specific }) {
    const moment: StudioMoment = { id: `studio-${entry.id}`, label: specific || choice.label, mediaType: choice.mediaType ?? 'other', emoji: EMOJI[choice.id] ?? '✨', rating: asStudioRating(entry.feeling), source: legacySource(record), sourceId: record.source.kind === 'photo' ? record.source.sourceId : entry.id, thumbnailUri: record.source.kind === 'photo' ? record.source.thumbnailUri ?? null : null, detail: entry.note, createdAt: entry.createdAt };
    return { ...day, studioMoments: [...(day.studioMoments ?? []), moment].slice(-12) };
  },
  place(day, { record, entry, choice, specific, context }) {
    const location = record.location;
    const match = location ? (day.confirmedPlaces ?? []).find((place) =>
      (location.placeId && place.placeId === location.placeId) ||
      (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && geoDistance(
        place.latitude!, place.longitude!, location.latitude, location.longitude
      ) <= 75)
    ) : null;
    const id = match?.id ?? `place-${entry.id}`;
    const place = {
      ...(match ?? {}), id,
      category: choice.id,
      categoryLabel: choice.label,
      archetype: archetypeForFeeling(entry.feeling),
      label: specific || location?.name || choice.label,
      name: location?.name || specific || match?.name,
      meaningLabel: context ? humanize(context) : undefined,
      confirmedAt: entry.createdAt,
      latitude: location?.latitude ?? match?.latitude,
      longitude: location?.longitude ?? match?.longitude,
      address: location?.address ?? match?.address,
      placeId: location?.placeId ?? match?.placeId,
      locationSource: location?.source ?? match?.locationSource,
      locationPointId: match?.locationPointId ?? (location ? `journal-location-${record.id}` : undefined),
    };
    return { ...day, confirmedPlaces: [...(day.confirmedPlaces ?? []).filter((candidate) => candidate.id !== id), place] };
  },
  movement(day, { entry, choice, specific, context }) { return { ...day, stepsInterpretation: { movement: movementKind(choice.id), label: specific || choice.label, emoji: MOVEMENT_EMOJI[choice.id] ?? '⚡', subtype: context || undefined, createdAt: entry.createdAt } }; },
  big_event(day, { entry, choice, specific, linkedNoteId }) {
    if (!choice.bigMomentType) return day;
    const moment: BigMoment = { id: `bm-${entry.id}`, type: choice.bigMomentType, label: specific || choice.label, subject: stringField(entry.fields.subject) || null, noteId: linkedNoteId, createdAt: entry.createdAt };
    return { ...day, bigMoments: [...(day.bigMoments ?? []), moment] };
  },
};

export function applyJournalCompatibilityProjection(day: StoredHomeDayRecord, context: JournalProjectionContext): StoredHomeDayRecord { return PROJECTORS[context.flow.projectionKind]?.(day, context) ?? day; }
function legacySource(record: JournalRecord): 'manual' | 'photo' | 'note' { return record.source.kind === 'photo' ? 'photo' : record.source.kind === 'text_note' || record.source.kind === 'voice_note' ? 'note' : 'manual'; }
function stringField(value: string | string[] | boolean | null | undefined): string { return typeof value === 'string' ? value.trim() : ''; }
function asFoodMeaning(value?: string | null): FoodMeaning | null { return value && ['treat', 'sharedMeal', 'comfort', 'fuel', 'discovery'].includes(value) ? value as FoodMeaning : null; }
function asStudioRating(value?: string | null): StudioRating | null { return value && ['loved', 'inspired', 'liked', 'meh'].includes(value) ? value as StudioRating : null; }
function movementKind(value: string): DayMovementKind { if (value === 'sport') return 'workout'; return ['walk', 'run', 'cycle', 'workout', 'hike', 'errands', 'commute', 'travel', 'mixed'].includes(value) ? value as DayMovementKind : 'mixed'; }
function archetypeForFeeling(value?: string | null): string { if (value === 'exciting') return 'energy'; if (value === 'loved' || value === 'liked') return 'together'; if (value === 'difficult') return 'meaningful'; return 'calm'; }
function humanize(value: string): string { return value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function geoDistance(aLat: number, aLng: number, bLat: number, bLng: number): number { const r = 6371000; const dLat = (bLat - aLat) * Math.PI / 180; const dLng = (bLng - aLng) * Math.PI / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
