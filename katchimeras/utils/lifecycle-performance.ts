export type LifecycleResourceKind =
  | 'audio_player'
  | 'game_route'
  | 'location_watcher'
  | 'pedometer_watcher'
  | 'timer';

export type LifecycleResourceSnapshot = {
  active: Readonly<Record<LifecycleResourceKind, number>>;
  total: number;
};

const RESOURCE_KINDS: readonly LifecycleResourceKind[] = [
  'audio_player',
  'game_route',
  'location_watcher',
  'pedometer_watcher',
  'timer',
];

const activeResources = new Map<number, { kind: LifecycleResourceKind; label: string }>();
let nextResourceId = 0;
const lifecyclePerfEnabled = typeof __DEV__ === 'undefined'
  || (__DEV__ && process.env.EXPO_PUBLIC_SCENE_PERF === '1');

export function acquireLifecycleResource(kind: LifecycleResourceKind, label: string): () => void {
  if (!lifecyclePerfEnabled) return () => undefined;
  const id = ++nextResourceId;
  activeResources.set(id, { kind, label });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeResources.delete(id);
  };
}

export function scheduleLifecycleAudit(label: string): void {
  if (!lifecyclePerfEnabled) return;
  setTimeout(() => {
    const snapshot = lifecycleResourceSnapshot();
    const details = lifecycleResourceDetails();
    const report = { ...snapshot, details };
    if (snapshot.total > 0) console.warn(`[lifecycle-perf] ${label}: resources remain`, report);
    else console.info(`[lifecycle-perf] ${label}: clean`, report);
  }, 0);
}

export function lifecycleResourceSnapshot(): LifecycleResourceSnapshot {
  const active = Object.fromEntries(RESOURCE_KINDS.map((kind) => [kind, 0])) as Record<LifecycleResourceKind, number>;
  activeResources.forEach((resource) => {
    active[resource.kind] += 1;
  });
  return { active, total: activeResources.size };
}

export function lifecycleResourceDetails(): readonly { kind: LifecycleResourceKind; label: string }[] {
  return [...activeResources.values()];
}

export function resetLifecycleResourcesForTests(): void {
  activeResources.clear();
  nextResourceId = 0;
}
