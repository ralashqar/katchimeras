import type { StoryRouteId, StoryRouteTarget } from '@/types/content-flow';

const ROUTES: Readonly<Record<StoryRouteId, Omit<StoryRouteTarget, 'params'>>> = {
  today: { id: 'today', pathname: '/(tabs)/today', surface: 'today' },
  companion: { id: 'companion', pathname: '/katchimera/mossprout/activity', surface: 'companion' },
  merge: { id: 'merge', pathname: '/game/merge-world', surface: 'merge' },
  haven: { id: 'haven', pathname: '/katchimera/mossprout', surface: 'haven' },
  collection: { id: 'collection', pathname: '/(tabs)/katchimeras', surface: 'collection' },
};

export function storyRoute(id: StoryRouteId, params?: Readonly<Record<string, string>>): StoryRouteTarget {
  return { ...ROUTES[id], ...(params ? { params } : {}) };
}

export function isRegisteredStoryRoute(target: StoryRouteTarget) {
  const registered = ROUTES[target.id];
  return registered.pathname === target.pathname && registered.surface === target.surface;
}

export function registeredStoryRoutes() {
  return Object.values(ROUTES);
}
