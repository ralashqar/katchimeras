import type { HomeDayRecord } from '@/types/home';
import type { KingdomBuildingId } from '@/types/kingdom';
import { isGenericStudioLabel } from '@/utils/studio-detect';
import { resolveFoodMomentDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';

// The Kingdom buildings' lifetime archives — every inspiration, meal and
// reflection ever logged, folded from the full day archive and grouped by
// month (newest first). The buildings are VIEWS over the one memory store
// (docs/world-structures-cozy-direction.md §9): nothing is copied, just read.

export type KingdomArchiveEntry = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  isoDate: string;
  // Sort key (createdAt when known, else the day).
  time: number;
  // The day this came from — every entry is a door back into its day.
  dayId: string;
  // A photo of the moment when one exists (food photos, later library thumbs).
  thumbnailUri?: string | null;
  // What the modal's filter chips match on (media type / meaning / kind).
  filterKey: string;
};

export type KingdomArchiveSection = { title: string; entries: KingdomArchiveEntry[] };

const STUDIO_RATING_LABEL: Record<string, string> = {
  loved: 'Loved',
  inspired: 'Inspired me',
  liked: 'Liked',
  meh: 'Meh',
};
const STUDIO_MEDIA_LABEL: Record<string, string> = {
  book: 'Book',
  film: 'Film',
  show: 'Show',
  game: 'Game',
  music: 'Music',
  art: 'Art',
  other: 'Inspiration',
};
const FOOD_MEANING_LABEL: Record<string, string> = {
  treat: 'A treat',
  sharedMeal: 'Shared',
  comfort: 'Comfort',
  fuel: 'Fuel',
  discovery: 'Discovery',
};
const REFLECTIVE_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'gratitude', 'highlight', 'intention']);

function entryTime(createdAt: string | null | undefined, isoDate: string): number {
  const exact = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isNaN(exact)) return exact;
  const day = Date.parse(`${isoDate}T12:00:00`);
  return Number.isNaN(day) ? 0 : day;
}

function collect(days: HomeDayRecord[], buildingId: KingdomBuildingId): KingdomArchiveEntry[] {
  const entries: KingdomArchiveEntry[] = [];
  for (const day of days) {
    if (buildingId === 'study') {
      for (const moment of day.studioMoments ?? []) {
        // Heal generic titles ("A book") from the source note's excerpt; when
        // no title can be recovered, surface the excerpt itself so the entry
        // is never meaningless.
        const display = resolveStudioMomentDisplay(moment);
        const title = display.label;
        const meta = [STUDIO_MEDIA_LABEL[moment.mediaType] ?? 'Inspiration', moment.rating ? STUDIO_RATING_LABEL[moment.rating] : null]
          .filter(Boolean)
          .join(' · ');
        entries.push({
          id: `study-${day.id}-${moment.id}`,
          emoji: moment.emoji,
          title,
          subtitle:
            isGenericStudioLabel(title) && moment.detail
              ? `${meta} — “${moment.detail.slice(0, 48)}”`
              : meta,
          isoDate: day.isoDate,
          time: entryTime(moment.createdAt, day.isoDate),
          dayId: day.id,
          thumbnailUri: moment.thumbnailUri,
          filterKey: moment.mediaType,
        });
      }
    } else if (buildingId === 'foodPavilion') {
      for (const moment of day.foodMoments ?? []) {
        const display = resolveFoodMomentDisplay(moment);
        entries.push({
          id: `food-${day.id}-${moment.id}`,
          emoji: display.emoji,
          title: display.label,
          subtitle: [display.detail, moment.meaning ? FOOD_MEANING_LABEL[moment.meaning] : null].filter(Boolean).join(' · '),
          isoDate: day.isoDate,
          time: entryTime(moment.createdAt, day.isoDate),
          dayId: day.id,
          thumbnailUri: moment.thumbnailUri,
          filterKey: moment.meaning ?? 'unrated',
        });
      }
    } else if (buildingId === 'sanctuary') {
      for (const answer of day.promptAnswers ?? []) {
        if (answer.dismissed || !REFLECTIVE_KINDS.has(answer.kind) || answer.labels.length === 0) continue;
        entries.push({
          id: `reflect-${day.id}-${answer.id}`,
          emoji: '🌿',
          title: answer.labels.join(' · '),
          subtitle: answer.kind.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
          isoDate: day.isoDate,
          time: entryTime(answer.createdAt, day.isoDate),
          dayId: day.id,
          filterKey: answer.kind,
        });
      }
    }
  }
  return entries.sort((a, b) => b.time - a.time);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthTitle(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  if (!year || !month) return 'Earlier';
  return `${MONTHS[month - 1]} ${year}`;
}

// Which buildings have a browsable archive (the rest keep the level card only).
export const ARCHIVE_BUILDINGS: KingdomBuildingId[] = ['study', 'foodPavilion', 'sanctuary'];

export function buildKingdomArchive(days: HomeDayRecord[], buildingId: KingdomBuildingId): KingdomArchiveSection[] {
  if (!ARCHIVE_BUILDINGS.includes(buildingId)) return [];
  const entries = collect(days, buildingId);
  const sections: KingdomArchiveSection[] = [];
  for (const entry of entries) {
    const title = monthTitle(entry.isoDate);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.entries.push(entry);
    else sections.push({ title, entries: [entry] });
  }
  return sections;
}

export function formatArchiveDate(entry: KingdomArchiveEntry): string {
  const date = new Date(entry.time);
  if (Number.isNaN(date.getTime())) return entry.isoDate;
  const day = date.getDate();
  const month = MONTHS[date.getMonth()]?.slice(0, 3) ?? '';
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${month} ${day} · ${hours}:${minutes} ${ampm}`;
}

// Flat, filtered access for the full-screen collection modal.
export function collectKingdomArchiveEntries(days: HomeDayRecord[], buildingId: KingdomBuildingId): KingdomArchiveEntry[] {
  return collect(days, buildingId);
}

export function groupArchiveSections(entries: KingdomArchiveEntry[]): KingdomArchiveSection[] {
  const sections: KingdomArchiveSection[] = [];
  for (const entry of entries) {
    const title = monthTitle(entry.isoDate);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.entries.push(entry);
    else sections.push({ title, entries: [entry] });
  }
  return sections;
}

export type ArchiveFilter = { key: string; label: string };

// The modal's filter chips + card layout per building.
export function archiveModalConfig(buildingId: KingdomBuildingId): {
  title: string;
  layout: 'grid' | 'list';
  filters: ArchiveFilter[];
} {
  switch (buildingId) {
    case 'study':
      return {
        title: 'The Shelf',
        layout: 'grid',
        filters: [
          { key: 'all', label: 'All' },
          { key: 'book', label: 'Books' },
          { key: 'film', label: 'Films' },
          { key: 'show', label: 'Shows' },
          { key: 'game', label: 'Games' },
          { key: 'music', label: 'Music' },
        ],
      };
    case 'foodPavilion':
      return {
        title: 'The Menu',
        layout: 'grid',
        filters: [
          { key: 'all', label: 'All' },
          { key: 'sharedMeal', label: 'Shared' },
          { key: 'comfort', label: 'Comfort' },
          { key: 'treat', label: 'Treats' },
          { key: 'fuel', label: 'Fuel' },
          { key: 'discovery', label: 'Discoveries' },
        ],
      };
    default:
      return {
        title: 'The Grove',
        layout: 'list',
        filters: [
          { key: 'all', label: 'All' },
          { key: 'feeling', label: 'Mood' },
          { key: 'gratitude', label: 'Gratitude' },
          { key: 'highlight', label: 'Highlights' },
          { key: 'day_word', label: 'Day words' },
          { key: 'inner_weather', label: 'Inner weather' },
        ],
      };
  }
}
