export type LifecycleResourceKind =
  | 'world_canvas'
  | 'active_merge_provider'
  | 'art_worker'
  | 'animation_loop'
  | 'audio_player'
  | 'app_state_listener'
  | 'companion_scene'
  | 'companion_sheet'
  | 'game_route'
  | 'merge_board'
  | 'merge_provider'
  | 'frame_probe'
  | 'location_watcher'
  | 'pedometer_watcher'
  | 'repository_worker'
  | 'store_subscription'
  | 'retained_subscription'
  | 'today_scene'
  | 'timer';

export type LifecycleResourceSnapshot = {
  active: Readonly<Record<LifecycleResourceKind, number>>;
  total: number;
};

export type ForegroundSurface = 'today' | 'companion' | 'merge' | 'world';

const RESOURCE_KINDS: readonly LifecycleResourceKind[] = [
  'world_canvas', 'active_merge_provider', 'art_worker', 'animation_loop',
  'audio_player',
  'app_state_listener',
  'companion_scene',
  'companion_sheet',
  'game_route',
  'merge_board',
  'merge_provider',
  'frame_probe',
  'location_watcher',
  'pedometer_watcher',
  'repository_worker',
  'store_subscription',
  'retained_subscription',
  'today_scene',
  'timer',
];

const activeResources = new Map<number, { kind: LifecycleResourceKind; label: string }>();
let nextResourceId = 0;
const lifecyclePerfEnabled = typeof __DEV__ === 'undefined'
  || process.env.EXPO_PUBLIC_SCENE_PERF === '1';

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

export function foregroundLifecycleViolations(
  surface: ForegroundSurface,
  snapshot = lifecycleResourceSnapshot(),
): string[] {
  const violations: string[] = [];
  const { active } = snapshot;
  const maximums: Partial<Record<LifecycleResourceKind, number>> = {
    world_canvas: surface === 'world' ? 1 : 0,
    active_merge_provider: surface === 'world' || surface === 'merge' ? 1 : 0,
    companion_scene: surface === 'companion' || surface === 'world' ? 1 : 0,
    companion_sheet: surface === 'companion' || surface === 'world' ? 1 : 0,
    merge_board: surface === 'merge' ? 1 : 0,
    today_scene: surface === 'today' ? 1 : 0,
  };
  for (const [kind, maximum] of Object.entries(maximums) as [LifecycleResourceKind, number][]) {
    if (active[kind] > maximum) violations.push(`${kind}:${active[kind]}>${maximum}`);
  }
  if (surface !== 'merge' && surface !== 'world' && active.store_subscription > 0) {
    violations.push(`store_subscription:${active.store_subscription}>0`);
  }
  if (surface !== 'merge' && surface !== 'world' && active.app_state_listener > 0) {
    violations.push(`app_state_listener:${active.app_state_listener}>0`);
  }
  return violations;
}

export function scheduleForegroundLifecycleAudit(surface: ForegroundSurface): void {
  if (!lifecyclePerfEnabled) return;
  setTimeout(() => {
    const violations = foregroundLifecycleViolations(surface);
    if (!violations.length) return;
    console.warn(`[lifecycle-perf] ${surface}: foreground isolation failed`, {
      violations,
      snapshot: lifecycleResourceSnapshot(),
      details: lifecycleResourceDetails(),
    });
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
