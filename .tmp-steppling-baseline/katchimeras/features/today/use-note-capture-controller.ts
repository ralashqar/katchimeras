import { useCallback, useState } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { useInlineVoiceNote } from '@/hooks/use-inline-voice-note';
import type { DayInputTarget } from '@/types/home';
import type { applyNoteForToday } from '@/game/days/actions';
import { interpretNote } from '@/utils/note-interpret';

type NoteInput = Parameters<typeof applyNoteForToday>[1];

type UseNoteCaptureControllerParams = {
  allowRemote?: boolean;
  formingTarget: DayInputTarget;
  windowWidth: number;
  windowHeight: number;
  addNote: (note: NoteInput, target?: DayInputTarget) => void;
  startEggFeed: (from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) => void;
  pulseEgg: () => void;
  setMicrocopy: (message: string | null) => void;
  requiresJournalReview?: boolean;
};

export function useNoteCaptureController({
  formingTarget,
  windowWidth,
  windowHeight,
  addNote,
  startEggFeed,
  pulseEgg,
  setMicrocopy,
  allowRemote = false,
  requiresJournalReview = false,
}: UseNoteCaptureControllerParams) {
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [pendingJournalNote, setPendingJournalNote] = useState<(NoteInput & { captureId: string }) | null>(null);

  const handleQuickNoteSubmit = useCallback(
    async (text: string) => {
      const interpreted = await interpretNote({ text }, { allowRemote });
      setQuickNoteOpen(false);
      const note = {
        captureId: `note-${Date.now().toString(36)}`,
        kind: 'text' as const,
        text: interpreted.transcript || text,
        audioUri: null,
        durationMs: null,
        archetype: interpreted.archetype,
        label: interpreted.label,
        bigMoment: interpreted.bigMoment,
        media: interpreted.media,
        food: interpreted.food,
        llmClassified: interpreted.llmClassified,
        intelligenceProvider: interpreted.intelligenceProvider,
        journalClassification: interpreted.journalClassification,
        journalRoutes: interpreted.journalRoutes,
        suggestedJournalFlowId: interpreted.suggestedJournalFlowId,
        topLevelConfidence: interpreted.topLevelConfidence,
        subcategoryConfidence: interpreted.subcategoryConfidence,
      };
      if (requiresJournalReview || needsFoundationRouteReview(note)) {
        setPendingJournalNote(note);
        return;
      }
      const from: FeedSourceRect = { x: windowWidth / 2 - 27, y: windowHeight - 190, w: 54, h: 54 };
      startEggFeed(from, { label: interpreted.label }, () => {
        addNote(note, formingTarget);
        pulseEgg();
        setMicrocopy('The Egg kept your note');
      });
    },
    [addNote, allowRemote, formingTarget, pulseEgg, requiresJournalReview, setMicrocopy, startEggFeed, windowHeight, windowWidth]
  );

  const voiceNote = useInlineVoiceNote({
    allowRemote,
    saveNote: (note) => {
      setQuickNoteOpen(false);
      const captured = { ...note, captureId: `note-${Date.now().toString(36)}` };
      if (requiresJournalReview || needsFoundationRouteReview(captured)) setPendingJournalNote(captured);
      else {
        addNote(captured, formingTarget);
        pulseEgg();
      }
    },
    onAnalyzing: () => {
      const from: FeedSourceRect = { x: windowWidth / 2 + 40, y: windowHeight - 260, w: 60, h: 60 };
      startEggFeed(from, { label: 'mic' }, () => {});
    },
    onSaved: (interpreted) => {
      setMicrocopy(requiresJournalReview || needsFoundationRouteReview(interpreted)
        ? `${interpreted.label} is ready to review`
        : 'The Egg kept your voice note');
    },
  });

  return {
    quickNoteOpen,
    setQuickNoteOpen,
    handleQuickNoteSubmit,
    voiceNote,
    pendingJournalNote,
    clearPendingJournalNote: () => setPendingJournalNote(null),
  };
}

function needsFoundationRouteReview(note: {
  intelligenceProvider?: unknown;
  journalRoutes?: unknown;
  suggestedJournalFlowId?: unknown;
}): boolean {
  return note.intelligenceProvider === 'appleFoundation'
    && ((Array.isArray(note.journalRoutes) && note.journalRoutes.length > 0)
      || typeof note.suggestedJournalFlowId === 'string');
}
