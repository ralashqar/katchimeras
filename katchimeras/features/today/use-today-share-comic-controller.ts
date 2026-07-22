import { useCallback, useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { DayComicGenerationState } from '@/components/katchadeck/home/day-comic-overlay';
import { renderDayComic } from '@/utils/day-comic-render';
import { ensureDayVision } from '@/utils/photo-vision';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import type { HomeDayRecord } from '@/types/home';

const COMIC_PHOTO_CONSENT_KEY = 'comic_photo_consent_v1';

type ShareableDay = HomeDayRecord & {
  creature: NonNullable<HomeDayRecord['creature']>;
  card: NonNullable<HomeDayRecord['card']>;
};

type UseTodayShareComicControllerParams = {
  shareableDay: ShareableDay | null;
};

export function useTodayShareComicController({ shareableDay }: UseTodayShareComicControllerParams) {
  const [sharingDayId, setSharingDayId] = useState<string | null>(null);
  const [comicGen, setComicGen] = useState<DayComicGenerationState | null>(null);
  const [postcardDay, setPostcardDay] = useState<ShareableDay | null>(null);
  const postcardRef = useRef<View>(null);
  const comicShotRef = useRef<View>(null);

  const handleShareDay = useCallback(async () => {
    if (!shareableDay || !shareableDay.shareReadyAt) return;

    const day = shareableDay;
    setSharingDayId(day.id);
    // Export art is 1080×1536 and expensive to reconcile. It must not exist in
    // the ordinary tile-selection tree; mount it only for an explicit export.
    setPostcardDay(day);

    try {
      await waitForPresentationFrames(2);
      if (!postcardRef.current) return;
      const uri = await captureRef(postcardRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Share.share({
        message: `${day.card.creatureName} — ${day.card.state.label}`,
        title: `${day.card.creatureName} daily card`,
        url: uri,
      });
    } finally {
      setSharingDayId((current) => (current === day.id ? null : current));
      setPostcardDay((current) => (current?.id === day.id ? null : current));
    }
  }, [shareableDay]);

  const generateComic = useCallback(async (day: ShareableDay) => {
    setComicGen({ dayId: day.id, status: 'generating' });
    try {
      const vision = await ensureDayVision(day);
      const dayForComic = vision ? { ...day, vision } : day;
      const result = await renderDayComic(dayForComic, loadOnboardingProfile());
      if ('imageUrl' in result) {
        setComicGen({ dayId: day.id, status: 'done', imageUrl: result.imageUrl });
      } else {
        setComicGen({ dayId: day.id, status: 'error', error: result.error });
      }
    } catch {
      setComicGen({ dayId: day.id, status: 'error', error: 'Something went wrong generating the comic.' });
    }
  }, []);

  const handleMakeComic = useCallback(() => {
    if (!shareableDay) {
      return;
    }
    const day = shareableDay;
    if (getStoredJson(COMIC_PHOTO_CONSENT_KEY, false)) {
      void generateComic(day);
      return;
    }
    Alert.alert(
      'Make a comic from your photos?',
      "This sends a few of the day's photos to our image generator to draw your comic page. Your photos stay private otherwise.",
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            setStoredJson(COMIC_PHOTO_CONSENT_KEY, true);
            void generateComic(day);
          },
        },
      ]
    );
  }, [generateComic, shareableDay]);

  const handleRetryComic = useCallback(() => {
    if (shareableDay) {
      void generateComic(shareableDay);
    }
  }, [generateComic, shareableDay]);

  const handleShareGeneratedComic = useCallback(async () => {
    if (comicGen?.status !== 'done' || !comicGen.imageUrl) {
      return;
    }
    const message = `${shareableDay?.creature.name ?? 'My'} day - a Katchimeras comic.`;
    try {
      let url = comicGen.imageUrl;
      if (comicShotRef.current) {
        url = await captureRef(comicShotRef.current, { format: 'png', quality: 1, result: 'tmpfile' });
      }
      await Share.share({ message, url });
    } catch {
      await Share.share({ message, url: comicGen.imageUrl });
    }
  }, [comicGen, shareableDay]);

  return {
    sharingDayId,
    comicGen,
    postcardDay,
    postcardRef,
    comicShotRef,
    closeComic: () => setComicGen(null),
    handleShareDay,
    handleMakeComic,
    handleRetryComic,
    handleShareGeneratedComic,
  };
}

function waitForPresentationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const next = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });
}
