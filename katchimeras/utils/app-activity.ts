export type AppSurface = 'game' | 'standard';

export function appSurfaceForPathname(pathname: string): AppSurface {
  if (/^\/game\/[^/]+\/?$/.test(pathname)) return 'game';
  if (/^\/katchimera\/[^/]+\/quest\/[^/]+\/game\/?$/.test(pathname)) return 'game';
  return 'standard';
}
