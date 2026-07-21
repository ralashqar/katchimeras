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
  const postcardRef = useRef<View>(null);
  const comicShotRef = useRef<View>(null);

  const handleShareDay = useCallback(async () => {
    if (!shareableDay || !shareableDay.shareReadyAt || !postcardRef.current) {
      return;
    }

    setSharingDayId(shareableDay.id);

    try {
      const uri = await captureRef(postcardRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Share.share({
        message: `${shareableDay.card.creatureName} — ${shareableDay.card.state.label}`,
        title: `${shareableDay.card.creatureName} daily card`,
        url: uri,
      });
    } finally {
      setSharingDayId((current) => (current === shareableDay.id ? null : current));
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
    postcardRef,
    comicShotRef,
    closeComic: () => setComicGen(null),
    handleShareDay,
    handleMakeComic,
    handleRetryComic,
    handleShareGeneratedComic,
  };
}
