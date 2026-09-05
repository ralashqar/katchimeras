import { DEV_TOOLS_ENABLED } from '@/constants/dev';

const DEV_RECOVERY_PATH_PREFIXES = [
  '/dev-',
  '/art-lab',
  '/world-base-lab',
  '/intelligence-lab',
] as const;

/** FTUE never owns internal recovery and inspection routes. */
export function ftueNavigationYieldsToDevRecovery(pathname: string, enabled = DEV_TOOLS_ENABLED) {
  if (!enabled) return false;
  const normalizedPath = decodeURIComponent(pathname).replace(/\/$/, '') || '/';
  return normalizedPath === '/explore'
    || DEV_RECOVERY_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}
