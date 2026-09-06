import type { DayEvidenceProvider, JournalNoteClassification, StudioMediaType } from '@/types/home';

export type NoteSpecificSource = {
  journalClassification?: JournalNoteClassification | null;
  intelligenceProvider?: DayEvidenceProvider;
  llmClassified?: boolean;
  media?: {
    mediaType: StudioMediaType;
    title: string | null;
    creator: string | null;
  } | null;
  food?: string | null;
};

/**
 * Returns only a concise value extracted by Foundation for the locked route.
 *
 * The classification label is intentionally excluded. It is presentation text
 * and may be the complete note transcript on compatibility paths. Treating it
 * as a form value caused notes such as "I ate an apple" to prefill that whole
 * sentence instead of the extracted value "Apple".
 */
export function noteSuggestedSpecific(interpreted: NoteSpecificSource): string | null {
  const classified = interpreted.journalClassification?.kind === 'categorized'
    || interpreted.journalClassification?.kind === 'generic';
  if (interpreted.intelligenceProvider === 'appleFoundation') {
    // Foundation note routing deliberately returns no field value. The shared
    // journal composer runs the separate route-locked extraction after opening.
    return classified ? interpreted.journalClassification?.fields.specific ?? null : null;
  }
  if (!classified) return null;

  return interpreted.journalClassification?.fields.specific
    ?? interpreted.media?.title
    ?? interpreted.food
    ?? null;
}
