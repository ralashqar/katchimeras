import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { Lantern } from '@/constants/theme';

type EggFeedPayload = {
  label?: string;
  photoUri?: string;
};

export function useEggFeedController() {
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const eggTargetRef = useRef<View | null>(null);
  const heroStageRef = useRef<View | null>(null);
  const pendingFeedCommit = useRef<(() => void) | null>(null);
  const feedNonce = useRef(0);
  const eggFeedRef = useRef<EggFeed | null>(null);

  const clearFeed = useCallback(() => {
    eggFeedRef.current = null;
    setEggFeed(null);
  }, []);

  const pulseEgg = useCallback(() => {
    setEggFeedKey((key) => key + 1);
  }, []);

  const startEggFeed = useCallback((from: FeedSourceRect, payload: EggFeedPayload, commit: () => void) => {
    if (eggFeedRef.current) {
      commit();
      return;
    }

    const launch = (toX: number, toY: number) => {
      feedNonce.current += 1;
      pendingFeedCommit.current = commit;
      const nextFeed: EggFeed = {
        nonce: feedNonce.current,
        fromX: from.x + from.w / 2,
        fromY: from.y + from.h / 2,
        toX,
        toY,
        label: payload.label,
        photoUri: payload.photoUri,
        tint: Lantern.ember300,
      };
      eggFeedRef.current = nextFeed;
      setEggFeed(nextFeed);
    };

    const destination = eggTargetRef.current ?? heroStageRef.current;
    if (destination) {
      destination.measureInWindow((x, y, w, h) => launch(x + w / 2, y + h / 2));
    } else {
      commit();
    }
  }, []);

  const handleEggFeedArrive = useCallback(() => {
    pendingFeedCommit.current?.();
    pendingFeedCommit.current = null;
    clearFeed();
    pulseEgg();
  }, [clearFeed, pulseEgg]);

  return {
    eggFeed,
    eggFeedKey,
    eggTargetRef,
    heroStageRef,
    startEggFeed,
    handleEggFeedArrive,
    pulseEgg,
  };
}
