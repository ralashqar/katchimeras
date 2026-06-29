import type { DayVisionSummary, StudioMediaType } from '@/types/home';

// Detect whether a piece of entertainment / inspiration was part of the day — a
// book, film, show, game, album, or exhibition — from a note's text or the
// on-device Apple Vision read (no pixels leave the phone; only derived labels +
// OCR text are inspected). Drives the Studio's trigger: "you mentioned a book →
// keep it in the archive." It never auto-creates a memory silently in a way the
// user can't refine — the rating (how it landed) is still theirs to give.

type MediaSpec = { re: RegExp; mediaType: StudioMediaType; emoji: string };

// Ordered most-specific first; the first hit wins. Kept broad so both free text
// and Apple Vision's generic concept labels ("bookcase", "television") land.
const MEDIA: MediaSpec[] = [
  {
    // Note: bare "book" (the verb — "book a table") is intentionally excluded.
    re: /\b(books|a book|the book|good book|novel|memoir|reading|finished reading|paperback|hardback|kindle|audiobook|bookshop|bookstore|book club)\b/,
    mediaType: 'book',
    emoji: '📖',
  },
  {
    re: /\b(film|movie|movies|cinema|documentary|screening|watched a film|at the theatre|at the theater)\b/,
    mediaType: 'film',
    emoji: '🎬',
  },
  {
    re: /\b(tv show|a show|series|episode|netflix|binge|binged|sitcom|drama series|rewatch)\b/,
    mediaType: 'show',
    emoji: '📺',
  },
  {
    re: /\b(video ?game|gaming|playthrough|playstation|xbox|nintendo|steam deck|on steam|rpg|boss fight|speedrun|playing .* game)\b/,
    mediaType: 'game',
    emoji: '🎮',
  },
  {
    re: /\b(album|song|concert|gig|playlist|vinyl|the band|live music|listened to|spotify|setlist)\b/,
    mediaType: 'music',
    emoji: '🎵',
  },
  {
    re: /\b(exhibit|exhibition|gallery|museum|artwork|sculpture|the painting|art show|installation)\b/,
    mediaType: 'art',
    emoji: '🎨',
  },
];

const MEDIA_LABEL: Record<StudioMediaType, string> = {
  book: 'A book',
  film: 'A film',
  show: 'A show',
  game: 'A game',
  music: 'Music',
  art: 'Art',
  other: 'Something',
};

export type StudioDetection = {
  detected: boolean;
  mediaType?: StudioMediaType;
  label?: string; // a title if we could pull one, else the media kind ("A book")
  emoji?: string;
};

// Try to pull a title out of free text — a "quoted phrase", or a Capitalised run
// of words after a give-away verb ("reading Dune", "watching The Bear"). Best
// effort only; falls back to the generic media-kind label.
function extractTitle(text: string): string | null {
  const quoted = text.match(/["“']([^"”']{2,60})["”']/);
  if (quoted) return quoted[1].trim();
  const after = text.match(
    /\b(?:reading|read|watching|watched|playing|played|listening to|listened to|finished)\s+((?:[A-Z][\w'’-]+\s*){1,5})/
  );
  if (after) {
    const title = after[1].trim();
    if (title.length >= 2) return title;
  }
  return null;
}

function matchMedia(haystack: string): StudioMediaType | null {
  for (const spec of MEDIA) {
    if (spec.re.test(haystack)) return spec.mediaType;
  }
  return null;
}

function emojiFor(mediaType: StudioMediaType): string {
  return MEDIA.find((spec) => spec.mediaType === mediaType)?.emoji ?? '✨';
}

// Detect from a written/voice note's transcript. "finally finished reading Dune"
// → { book, label: 'Dune' }.
export function detectStudioInText(text: string | undefined | null): StudioDetection {
  if (!text || !text.trim()) return { detected: false };
  const mediaType = matchMedia(` ${text.toLowerCase()} `);
  if (!mediaType) return { detected: false };
  const title = extractTitle(text);
  return { detected: true, mediaType, label: title ?? MEDIA_LABEL[mediaType], emoji: emojiFor(mediaType) };
}

// Detect from the on-device Apple Vision read — a bookcase, a television, a poster,
// a games console. Title detection from OCR is unreliable, so vision lands at the
// media-KIND level (the note path supplies real titles).
export function detectStudioInVision(vision: DayVisionSummary | undefined | null): StudioDetection {
  if (!vision) return { detected: false };
  const terms = [
    ...(vision.concepts ?? []).map((concept) => concept.name),
    ...(vision.details ?? []),
    ...(vision.textTokens ?? []),
  ]
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.toLowerCase());
  const mediaType = matchMedia(` ${terms.join(' ')} `);
  if (!mediaType) return { detected: false };
  return { detected: true, mediaType, label: MEDIA_LABEL[mediaType], emoji: emojiFor(mediaType) };
}
