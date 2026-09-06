import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const PASSIVE_CAPTURE_LOCATION_COOLDOWN_MS = 30 * 60_000;
export const PASSIVE_CAPTURE_STEP_COOLDOWN_MS = 15 * 60_000;
export const PASSIVE_CAPTURE_INITIAL_STEP_DELAY_MS = 700;
export const PASSIVE_CAPTURE_INITIAL_LOCATION_DELAY_MS = 1_200;
export const PASSIVE_CAPTURE_INITIAL_PHOTO_DELAY_MS = 2_400;

type CaptureRequests = {
  location: number;
  photos: number;
  steps: number;
};

export function usePassiveCaptureGates({
  active,
  blocked,
  dayId,
}: {
  active: boolean;
  blocked: boolean;
  dayId: string | null;
}) {
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');
  const [requests, setRequests] = useState<CaptureRequests>({ location: 0, photos: 0, steps: 0 });
  const activeSinceRef = useRef<number | null>(null);
  const lastLocationAttemptAtRef = useRef<number | null>(null);
  const lastStepAttemptAtRef = useRef<number | null>(null);
  const photoSessionDayRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const runnable = active && appActive && !blocked && dayId != null;
    if (!runnable) {
      activeSinceRef.current = null;
      return;
    }

    const now = Date.now();
    const activeSince = activeSinceRef.current ?? now;
    activeSinceRef.current = activeSince;
    const stepReadyAt = Math.max(
      activeSince + PASSIVE_CAPTURE_INITIAL_STEP_DELAY_MS,
      (lastStepAttemptAtRef.current ?? 0) + PASSIVE_CAPTURE_STEP_COOLDOWN_MS,
    );
    const locationReadyAt = Math.max(
      activeSince + PASSIVE_CAPTURE_INITIAL_LOCATION_DELAY_MS,
      (lastLocationAttemptAtRef.current ?? 0) + PASSIVE_CAPTURE_LOCATION_COOLDOWN_MS,
    );
    const photoReadyAt = photoSessionDayRef.current === dayId
      ? Number.POSITIVE_INFINITY
      : activeSince + PASSIVE_CAPTURE_INITIAL_PHOTO_DELAY_MS;
    const nextReadyAt = Math.min(stepReadyAt, locationReadyAt, photoReadyAt);
    if (!Number.isFinite(nextReadyAt)) return;

    const timer = setTimeout(() => {
      const firedAt = Date.now();
      const runSteps = firedAt >= stepReadyAt;
      const runLocation = firedAt >= locationReadyAt;
      const runPhotos = firedAt >= photoReadyAt;
      if (runSteps) lastStepAttemptAtRef.current = firedAt;
      if (runLocation) lastLocationAttemptAtRef.current = firedAt;
      if (runPhotos) photoSessionDayRef.current = dayId;
      setRequests((current) => ({
        location: current.location + (runLocation ? 1 : 0),
        photos: current.photos + (runPhotos ? 1 : 0),
        steps: current.steps + (runSteps ? 1 : 0),
      }));
    }, Math.max(0, nextReadyAt - now));

    return () => clearTimeout(timer);
  }, [active, appActive, blocked, dayId, requests]);

  return {
    appActive,
    captureEnabled: active && appActive && !blocked && dayId != null,
    locationRequestKey: requests.location,
    photoRequestKey: requests.photos,
    stepRequestKey: requests.steps,
  };
}
