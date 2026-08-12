export type AppSurface = 'game' | 'standard';

export function appSurfaceForPathname(pathname: string): AppSurface {
  if (/^\/games\/?$/.test(pathname)) return 'game';
  if (/^\/game\/[^/]+\/?$/.test(pathname)) return 'game';
  if (/^\/katchimera\/[^/]+\/quest\/[^/]+\/game\/?$/.test(pathname)) return 'game';
  return 'standard';
}
