import { useGlobalSearchParams, usePathname } from 'expo-router';

/** A companion camera is a temporary cover, not a departure from its origin. */
export function companionCameraCoversRoute(pathname: string, params: { companionActivityId?: unknown; companionReturnTo?: unknown }, origin: string) {
  if (pathname !== '/moment-capture' || typeof params.companionActivityId !== 'string' || !params.companionActivityId) return false;
  if (typeof params.companionReturnTo !== 'string') return false;
  try { return decodeURIComponent(params.companionReturnTo) === decodeURIComponent(origin); }
  catch { return false; }
}

export function useCompanionCameraCover(origin: string) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return companionCameraCoversRoute(pathname, params, origin);
}
