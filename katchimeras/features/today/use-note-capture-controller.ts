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
}: UseNoteCaptureControllerParams) {
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [pendingJournalNote, setPendingJournalNote] = useState<(NoteInput & { captureId: string }) | null>(null);

  const handleQuickNoteSubmit = useCallback(
    async (text: string) => {
      const interpreted = await interpretNote({ text }, { allowRemote });
      setQuickNoteOpen(false);
      setPendingJournalNote({
            captureId: `note-${Date.now().toString(36)}`,
            kind: 'text',
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
      });
    },
    [addNote, allowRemote, formingTarget, pulseEgg, setMicrocopy, startEggFeed, windowHeight, windowWidth]
  );

  const voiceNote = useInlineVoiceNote({
    allowRemote,
    saveNote: (note) => setPendingJournalNote({ ...note, captureId: `note-${Date.now().toString(36)}` }),
    onAnalyzing: () => {
      const from: FeedSourceRect = { x: windowWidth / 2 + 40, y: windowHeight - 260, w: 60, h: 60 };
      startEggFeed(from, { label: 'mic' }, () => {});
    },
    onSaved: (interpreted) => {
      setMicrocopy(`${interpreted.label} is ready to review`);
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
