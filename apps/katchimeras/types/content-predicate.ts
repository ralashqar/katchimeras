/**
 * Content that decides and speaks as data. A condition reads facts a screen
 * has gathered (`theory.friction`, `today`, `coins`, an earlier answer) and
 * says yes or no; a line is text with `{{token}}` placeholders, optionally
 * with variants picked by condition. Both are plain JSON, so a content pack
 * can carry them, and both keep accepting a function while bundled
 * TypeScript content migrates.
 */
export type ContentValue = string | number | boolean | null;

/** Facts a line or condition can read, flat, by dotted name. */
export type ContentFacts = Readonly<Record<string, ContentValue | undefined>>;

export type ContentCondition =
  | { all: readonly ContentCondition[] }
  | { any: readonly ContentCondition[] }
  | { not: ContentCondition }
  /** A fact compared: equal, not equal, one of, ordered against a number, or merely present (non-empty). */
  | { fact: string; eq?: ContentValue; ne?: ContentValue; in?: readonly ContentValue[]; gt?: number; gte?: number; lt?: number; lte?: number; exists?: boolean }
  /** An earlier answer, by `${episodeId}.${askId}`: the fact `answer.<id>`. */
  | { answer: string; eq?: string; ne?: string; in?: readonly string[]; exists?: boolean };

/** A condition as data, or (while bundled content migrates) as code over its own context. */
export type ContentPredicate<Context> = ContentCondition | ((context: Context) => boolean);

/** A line as data: text with `{{token}}` placeholders, alone or with variants tried in order (the first whose condition holds is said). */
export type ContentTextSpec = string | { text: string; variants?: readonly { when: ContentCondition; text: string }[] };

/** A line as data, or (while bundled content migrates) as code over its own context. */
export type ContentLine<Context> = ContentTextSpec | ((context: Context) => string);
