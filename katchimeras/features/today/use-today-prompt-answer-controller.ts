import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { photoPromptSignature } from '@/utils/today-categories';
import type { DayInputTarget, DayPromptKind, HomeDayRecord } from '@/types/home';
import { runAfterNativeModalDismiss } from '@/utils/native-modal-navigation';

type PromptAnswerInput = {
  kind: DayPromptKind;
  choiceIds: string[];
};

type UseTodayPromptAnswerControllerParams = {
  formingDay: HomeDayRecord | null;
  formingTarget: DayInputTarget;
  formingPrompts: ActiveDayPrompt[];
  formingActivePrompt: ActiveDayPrompt | null;
  answerDayPrompt: (input: PromptAnswerInput, target?: DayInputTarget) => void;
  answerPhotoMeaning: (input: { choiceIds: string[] }, target?: DayInputTarget) => void;
  closePromptSheet: () => void;
  startEggFeed: (from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) => void;
};

export function useTodayPromptAnswerController({
  formingDay,
  formingTarget,
  formingPrompts,
  formingActivePrompt,
  answerDayPrompt,
  answerPhotoMeaning,
  closePromptSheet,
  startEggFeed,
}: UseTodayPromptAnswerControllerParams) {
  const router = useRouter();
  const photoPrompt = useMemo(
    () => formingPrompts.find((prompt) => prompt.id === 'meaningful_photo' && prompt.photoCandidates.length > 0) ?? null,
    [formingPrompts]
  );
  const photoSig = useMemo(() => photoPromptSignature(formingPrompts), [formingPrompts]);
  const [handledPhotoSig, setHandledPhotoSig] = useState<string | null>(null);
  const pendingPhotoNavigationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingPhotoNavigationRef.current) clearTimeout(pendingPhotoNavigationRef.current);
  }, []);

  const dismissPhotoAlert = useCallback(() => setHandledPhotoSig(photoSig), [photoSig]);

  // Keep the recent-library photo action in the manual menu as a distinct
  // choice from taking a new photo. It is already gated on a real candidate.
  const popupPrompts = formingPrompts;

  const handleAnswerDayPrompt = useCallback(
    (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => {
      const isPhotoMeaning = kind === 'meaning' && !!formingDay?.heroPhoto;
      const sourcePrompts = [formingActivePrompt, ...formingPrompts].filter(Boolean);
      const label = sourcePrompts
        .find((prompt) => prompt?.id === kind)
        ?.options.find((option) => option.id === choiceIds[0])?.label;

      startEggFeed(from, { label }, () => {
        if (isPhotoMeaning) {
          answerPhotoMeaning({ choiceIds }, formingTarget);
        } else {
          answerDayPrompt({ kind, choiceIds }, formingTarget);
        }
      });
    },
    [answerDayPrompt, answerPhotoMeaning, formingActivePrompt, formingDay, formingPrompts, formingTarget, startEggFeed]
  );

  const handleSelectHeroPhoto = useCallback(
    (photo: DayPromptPhotoCandidate, _from: FeedSourceRect) => {
      dismissPhotoAlert();
      closePromptSheet();
      if (pendingPhotoNavigationRef.current) clearTimeout(pendingPhotoNavigationRef.current);
      pendingPhotoNavigationRef.current = runAfterNativeModalDismiss(() => {
        pendingPhotoNavigationRef.current = null;
        router.push({
          pathname: '/photo-essence',
          params: {
            assetId: photo.assetId,
            thumbnailUri: photo.thumbnailUri ?? '',
            capturedAt: photo.capturedAt,
            target: formingTarget,
          },
        });
      });
    },
    [closePromptSheet, dismissPhotoAlert, formingTarget, router]
  );

  return {
    photoPrompt,
    handledPhotoSig,
    dismissPhotoAlert,
    popupPrompts,
    handleAnswerDayPrompt,
    handleSelectHeroPhoto,
  };
}
