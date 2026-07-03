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
    re: /\b(books|a book|the book|good book|new book|novel|memoir|reading|finished reading|paperback|hardback|kindle|audiobook|bookshop|bookstore|book club)\b/,
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

// Words that end a title run when reading free text ("finished Dune tonight").
const TITLE_STOPWORDS = new Set([
  'today', 'tonight', 'yesterday', 'tomorrow', 'this', 'that', 'again', 'now',
  'earlier', 'later', 'finally', 'and', 'but', 'so', 'then', 'with', 'while',
  'before', 'after', 'at', 'on', 'in', 'it', 'was', 'is', 'really', 'very',
]);
// Lowercase connectors allowed INSIDE a capitalised title (The Lord of the Rings).
const TITLE_CONNECTORS = new Set(['of', 'the', 'a', 'an', 'and', 'to', 'in', 'on', 'at', 'for', 'vs']);
const GIVEAWAY_VERBS =
  'reading|read|re-?reading|watching|watched|rewatching|rewatched|playing|played|listening to|listened to|finished|started|binging|binged|saw';

function titleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && TITLE_CONNECTORS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

function cleanTitle(raw: string): string | null {
  const words = raw.trim().replace(/[.,!?;:]+$/, '').split(/\s+/);
  // Trim trailing stopwords ("Dune tonight" -> "Dune").
  while (words.length > 0 && TITLE_STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  const title = words.slice(0, 7).join(' ').trim();
  if (title.length < 2 || title.length > 60) return null;
  // Reject runs that are ONLY connectors/stopwords ("the", "a and the").
  if (words.every((word) => TITLE_CONNECTORS.has(word.toLowerCase()) || TITLE_STOPWORDS.has(word.toLowerCase()))) return null;
  return titleCase(title);
}

// Pull a real title out of free text. Tries, in order: a "quoted phrase";
// "called/titled X"; "X by Author"; a run of words after a give-away verb
// (capitalised or not — people dictate lowercase). Falls back to null.
export function extractStudioTitle(text: string | undefined | null): string | null {
  if (!text || !text.trim()) return null;
  const quoted = text.match(/["“']([^"”']{2,60})["”']/);
  if (quoted) return cleanTitle(quoted[1]);
  const called = text.match(/\b(?:called|titled|named)\s+([\w'’ -]{2,60})/i);
  if (called) return cleanTitle(called[1]);
  const byAuthor = text.match(new RegExp(`\\b(?:${GIVEAWAY_VERBS})\\s+(.{2,60}?)\\s+by\\s+[A-Z]`, 'i'));
  if (byAuthor) return cleanTitle(byAuthor[1]);
  // Capitalised run first (strongest signal)...
  const capitalised = text.match(
    new RegExp(`\\b(?:${GIVEAWAY_VERBS})\\s+((?:(?:[A-Z][\\w'’-]+|of|the|a|an|and|to|in|on|at|for)\\s*){1,7})`)
  );
  if (capitalised) {
    const title = cleanTitle(capitalised[1]);
    if (title) return title;
  }
  // ...then any run after the verb (dictated lowercase: "finished reading dune").
  const anyRun = text.match(new RegExp(`\\b(?:${GIVEAWAY_VERBS})\\s+([\\w'’ -]{2,60})`, 'i'));
  if (anyRun) {
    const withoutArticle = anyRun[1].replace(/^(?:the book|the film|the movie|a book|a film|a movie|an?)\s+/i, '');
    return cleanTitle(withoutArticle);
  }
  return null;
}

function extractTitle(text: string): string | null {
  return extractStudioTitle(text);
}

// The generic media-kind labels ("A book") — anything else is a real title.
const GENERIC_LABELS = new Set(Object.values(MEDIA_LABEL).map((label) => label.toLowerCase()));
export function isGenericStudioLabel(label: string | undefined | null): boolean {
  return !label || GENERIC_LABELS.has(label.trim().toLowerCase());
}

// Read-time healer for stored moments: a generic label ("A book") tries to
// recover the real title from the moment's detail (the source note excerpt) —
// so old entries fix themselves everywhere they're shown.
export function resolveStudioTitle(label: string, detail?: string | null): string {
  if (!isGenericStudioLabel(label)) return label;
  const fromDetail = extractStudioTitle(detail);
  return fromDetail ?? label;
}

// Build a detection from an already-resolved media read (the hierarchical scene
// classifier's media branch) — title when the work was named, kind label otherwise.
export function studioDetectionFromMedia(mediaType: StudioMediaType, title?: string | null): StudioDetection {
  return {
    detected: true,
    mediaType,
    label: title?.trim() || MEDIA_LABEL[mediaType],
    emoji: emojiFor(mediaType),
  };
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

// Media VERB + a Capitalised Title = a work, even without a media keyword —
// "I read Dune" has no 'book/novel/reading' but is unmistakable. The capital
// requirement is the guard: "i read the news" stays a plain note.
const VERB_MEDIA: [RegExp, StudioMediaType][] = [
  [/\b(read|re-?read)\b/, 'book'],
  [/\b(watched|rewatched)\b/, 'film'],
  [/\b(played)\b/, 'game'],
  [/\b(listened to)\b/, 'music'],
];

// STRICT capitalised-run extraction (no lowercase fallback): the run after a
// give-away verb, in the ORIGINAL casing. Verbs tolerate a sentence-start
// capital ("Watched Oppenheimer") without loosening the title's capital gate.
function extractCapitalisedTitle(text: string): string | null {
  const verbs = GIVEAWAY_VERBS.split('|')
    .map((verb) => verb.replace(/^[a-z]/, (ch) => `[${ch.toUpperCase()}${ch}]`))
    .join('|');
  const match = text.match(
    new RegExp(`\\b(?:${verbs})\\s+([A-Z][\\w'’-]*(?:\\s+(?:[A-Z][\\w'’-]+|(?:of|the|a|an|and|to|in|on|at|for)\\b))*)`)
  );
  if (!match) return null;
  // A title never ENDS on a connector ("Hollow Knight for a" → "Hollow Knight").
  const words = match[1].split(/\s+/);
  while (words.length > 0 && /^[a-z]/.test(words[words.length - 1])) words.pop();
  if (words.length === 0) return null;
  return cleanTitle(words.join(' '));
}

// A bare media noun in the sentence CONFIRMS the verb even without capitals —
// voice transcripts are often all-lowercase ("i read the way of kings book").
// The bare noun alone still detects nothing (that's the "book a table" guard);
// it needs the verb too.
const VERB_NOUN_CONFIRM: Partial<Record<StudioMediaType, RegExp>> = {
  book: /\b(book|books)\b/,
  film: /\b(movie|movies)\b/,
  game: /\b(game|games)\b/,
  music: /\b(album|albums)\b/,
};

const MEDIA_NOUN_WORD = /^(book|novel|movie|film|show|game|album)$/i;

// "The Way of Kings Book" → "The Way of Kings". Only when ≥3 words remain —
// real titles end in the noun too ("The Jungle Book" must survive).
function stripTrailingMediaNoun(title: string): string {
  const words = title.split(/\s+/);
  if (words.length >= 4 && MEDIA_NOUN_WORD.test(words[words.length - 1])) {
    return words.slice(0, -1).join(' ');
  }
  return title;
}

// Detect from a written/voice note's transcript. "finally finished reading Dune"
// → { book, label: 'Dune' }.
export function detectStudioInText(text: string | undefined | null): StudioDetection {
  if (!text || !text.trim()) return { detected: false };
  const mediaType = matchMedia(` ${text.toLowerCase()} `);
  if (mediaType) {
    const title = extractTitle(text);
    return {
      detected: true,
      mediaType,
      label: title ? stripTrailingMediaNoun(title) : MEDIA_LABEL[mediaType],
      emoji: emojiFor(mediaType),
    };
  }
  // Second chance: a media verb + either a Capitalised Title ("I read Dune",
  // "watched Oppenheimer") or a confirming bare noun ("i read the way of kings book").
  const lower = ` ${text.toLowerCase()} `;
  for (const [re, verbMedia] of VERB_MEDIA) {
    if (!re.test(lower)) continue;
    const capitalised = extractCapitalisedTitle(text);
    if (capitalised) {
      return { detected: true, mediaType: verbMedia, label: stripTrailingMediaNoun(capitalised), emoji: emojiFor(verbMedia) };
    }
    const nounConfirm = VERB_NOUN_CONFIRM[verbMedia];
    if (nounConfirm && nounConfirm.test(lower)) {
      const raw = extractStudioTitle(text);
      // A "title" that STARTS with the noun is no title ("played a game of
      // cards" → 'Game of Cards') — keep the generic label instead.
      const title = raw && !MEDIA_NOUN_WORD.test(raw.split(/\s+/)[0]) ? stripTrailingMediaNoun(raw) : null;
      return { detected: true, mediaType: verbMedia, label: title ?? MEDIA_LABEL[verbMedia], emoji: emojiFor(verbMedia) };
    }
  }
  return { detected: false };
}

// Cover furniture that is NOT the title — author/publisher/marketing lines.
const COVER_NOISE =
  /^(a novel|a memoir|a thriller|the\s.*bestseller.*|(inter)?national bestseller|bestselling.*|author of .*|by [\w'’. -]+|winner of .*|shortlisted .*|now a major .*|introduction by .*|foreword by .*|translated by .*|soon to be .*|volume \d+|book (one|two|three|\d+)|\d+(th|st|nd|rd) anniversary.*|penguin|vintage|picador|faber|harper ?collins|bloomsbury|tor|orbit|del rey|paperback|hardcover)$/i;

// Pull a title off a photographed cover/poster from the OCR read. Covers stack
// the title in big display type across SHORT lines ('NORWEGIAN' / 'WOOD') with
// the author above or below, so a single OCR line is rarely the whole title.
// Candidates are built from runs of 1–3 consecutive clean lines and scored:
// multi-word beats single-word, reassembled stacks get a bonus, the top block
// is discounted when more text follows (that slot is usually the author), and
// a run that swallows EVERY block is discounted (author + title never OCR as
// one). A wall of text (a page, an article screenshot) is skipped entirely.
export function extractTitleFromVisionText(tokens: string[] | undefined | null): string | null {
  if (!tokens || tokens.length === 0 || tokens.length > 25) return null;
  const lines = tokens
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 60)
    .filter((token) => /[a-zA-Z]{2}/.test(token) && !/^\d+$/.test(token))
    .filter((token) => !COVER_NOISE.test(token));
  if (lines.length === 0) return null;
  const head = lines.slice(0, 5);
  const wordsIn = (text: string) => text.split(/\s+/).length;
  let best: { text: string; score: number } | null = null;
  for (let start = 0; start < head.length; start++) {
    for (let span = 1; span <= 3 && start + span <= head.length; span++) {
      // Only reassemble stacks of short lines — display type runs a few words
      // per line; joining longer lines glues the author onto the title.
      if (span > 1 && head.slice(start, start + span).some((line) => wordsIn(line) > 3)) break;
      const text = head.slice(start, start + span).join(' ');
      const words = wordsIn(text);
      if (text.length > 60 || words > (span > 1 ? 5 : 6)) break;
      let score = words >= 2 ? 3 : 0;
      if (span > 1) score += 1;
      if (start === 0 && head.length >= 3 && (words === 1 || span > 1)) score -= 2;
      if (span === head.length && head.length >= 2) score -= 2;
      if (/\b(of|the|and)\b/i.test(text)) score += 0.5;
      score += Math.min(text.length, 30) / 100;
      if (!best || score > best.score) best = { text, score };
    }
  }
  if (!best) return null;
  // Cover type is usually ALL CAPS — normalise so titleCase can do its job.
  return cleanTitle(best.text === best.text.toUpperCase() ? best.text.toLowerCase() : best.text);
}

// Vision CLASSIFIER labels are single terms ('book', 'publication', 'poster'),
// not prose — the prose matcher above deliberately excludes bare 'book' (the
// verb), so vision needs its own classification-first matcher.
const VISION_MEDIA: MediaSpec[] = [
  { re: /\b(book|books|book cover|bookcase|bookshelf|paperback|hardcover|novel|publication|comic book|magazine cover)\b/, mediaType: 'book', emoji: '📖' },
  { re: /\b(movie poster|film poster|cinema|movie theater|projector screen)\b/, mediaType: 'film', emoji: '🎬' },
  { re: /\b(television|tv screen|tv set)\b/, mediaType: 'show', emoji: '📺' },
  { re: /\b(game controller|gamepad|video game|game console|joystick|arcade)\b/, mediaType: 'game', emoji: '🎮' },
  { re: /\b(vinyl|record player|turntable|headphones|concert|album cover)\b/, mediaType: 'music', emoji: '🎵' },
  { re: /\b(painting|sculpture|art gallery|artwork|exhibition|canvas)\b/, mediaType: 'art', emoji: '🎨' },
];

function matchVisionMedia(haystack: string): StudioMediaType | null {
  for (const spec of VISION_MEDIA) {
    if (spec.re.test(haystack)) return spec.mediaType;
  }
  return null;
}

// Cover furniture in the OCR itself is a strong book/film signal even when the
// classifier only said 'text' or 'document'.
const OCR_BOOK_HINT = /\b(a novel|a memoir|(inter)?national bestseller|bestselling author|winner of the|shortlisted for)\b/;

// Detect from the on-device Apple Vision read — a bookcase, a television, a
// poster, a games console. Classification comes FIRST from the classifier's
// own labels (concepts + details), then an OCR-furniture hint, then the prose
// matcher as a last resort. When the photo IS the work (a book cover, a film
// poster), the OCR read supplies the actual title.
export function detectStudioInVision(vision: DayVisionSummary | undefined | null): StudioDetection {
  if (!vision) return { detected: false };
  const labelTerms = [...(vision.concepts ?? []).map((concept) => concept.name), ...(vision.details ?? [])]
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.toLowerCase())
    .join(' ');
  const ocrText = (vision.textTokens ?? [])
    .filter((term): term is string => typeof term === 'string')
    .map((term) => term.toLowerCase())
    .join(' ');
  const mediaType =
    matchVisionMedia(` ${labelTerms} `) ??
    (OCR_BOOK_HINT.test(` ${ocrText} `) ? 'book' : null) ??
    matchMedia(` ${labelTerms} ${ocrText} `);
  if (!mediaType) return { detected: false };
  const ocrTitle = extractTitleFromVisionText(vision.textTokens);
  return { detected: true, mediaType, label: ocrTitle ?? MEDIA_LABEL[mediaType], emoji: emojiFor(mediaType) };
}
