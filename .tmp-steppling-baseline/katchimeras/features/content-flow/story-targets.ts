import type { StoryTarget } from '@/types/content-flow';

const GARDEN_PLOT_IDS = new Set(['back-left', 'back-centre', 'back-right', 'front-left', 'front-centre', 'front-right']);

export type StoryTargetFrame = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type StoryTargetRegistration = {
  frame: StoryTargetFrame;
  interactive: boolean;
  ready: boolean;
};

export function storyTargetKey(target: StoryTarget): string {
  switch (target.kind) {
    case 'haven_world': return 'haven:world';
    case 'haven_home': return 'haven:home';
    case 'haven_tile': return `haven:tile:${target.familyId}`;
    case 'haven_resident': return `haven:resident:${target.familyId}`;
    case 'haven_structure': return `haven:structure:${target.structureId}`;
    case 'haven_garden_plot': return `haven:garden-plot:${target.slotId}`;
    case 'haven_nature_island': return `haven:nature-island:${target.islandId}`;
    case 'merge_cell': return `merge:cell:${target.cell}`;
    case 'merge_item': return `merge:item:${target.instanceId}`;
    case 'merge_generator': return `merge:generator:${target.generatorId}`;
    case 'merge_order': return `merge:order:${target.orderId}`;
    case 'ui_control': return `ui:${target.controlId}`;
  }
}

export function validateStoryTarget(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'target must be an object';
  const target = value as Partial<StoryTarget> & Record<string, unknown>;
  if (typeof target.kind !== 'string') return 'target.kind must be a string';
  if (target.kind === 'haven_world' || target.kind === 'haven_home') return null;
  if (target.kind === 'merge_cell') return Number.isInteger(target.cell) && Number(target.cell) >= 0 ? null : 'merge_cell.cell must be a non-negative integer';
  if (target.kind === 'haven_garden_plot') return typeof target.slotId === 'string' && GARDEN_PLOT_IDS.has(target.slotId)
    ? null
    : 'haven_garden_plot.slotId must be a known Garden plot';
  const key = target.kind === 'haven_tile' || target.kind === 'haven_resident'
    ? 'familyId'
    : target.kind === 'haven_structure'
      ? 'structureId'
      : target.kind === 'haven_nature_island'
        ? 'islandId'
        : target.kind === 'merge_item'
          ? 'instanceId'
          : target.kind === 'merge_generator'
            ? 'generatorId'
            : target.kind === 'merge_order'
              ? 'orderId'
              : target.kind === 'ui_control'
                ? 'controlId'
                : null;
  if (!key) return `Unknown story target kind ${target.kind}`;
  return typeof target[key] === 'string' && target[key] ? null : `${target.kind}.${key} must be a non-empty string`;
}

/** Surface-local registry. Geometry is deliberately runtime-only and never persisted in a story. */
export class StoryTargetRegistry {
  private readonly targets = new Map<string, StoryTargetRegistration>();
  private readonly listeners = new Set<() => void>();

  register(target: StoryTarget, registration: StoryTargetRegistration) {
    const key = storyTargetKey(target);
    this.targets.set(key, registration);
    this.listeners.forEach((listener) => listener());
    return () => {
      // A late cleanup from an older renderer must not remove a newer owner.
      if (this.targets.get(key) !== registration) return;
      this.unregister(target);
    };
  }

  unregister(target: StoryTarget) {
    if (!this.targets.delete(storyTargetKey(target))) return;
    this.listeners.forEach((listener) => listener());
  }

  resolve(target: StoryTarget) {
    return this.targets.get(storyTargetKey(target)) ?? null;
  }

  ready(target: StoryTarget) {
    return this.resolve(target)?.ready === true;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const surfaceRegistries = new Map<string, StoryTargetRegistry>();

export function storyTargetRegistry(surface: string) {
  let registry = surfaceRegistries.get(surface);
  if (!registry) {
    registry = new StoryTargetRegistry();
    surfaceRegistries.set(surface, registry);
  }
  return registry;
}

export function waitForStoryTargets(registry: StoryTargetRegistry, targets: readonly StoryTarget[], timeoutMs = 5_000) {
  if (targets.every((target) => registry.ready(target))) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const unsubscribe = registry.subscribe(() => {
      if (!targets.every((target) => registry.ready(target))) return;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Story targets did not become ready: ${targets.filter((target) => !registry.ready(target)).map(storyTargetKey).join(', ')}`));
    }, timeoutMs);
  });
}
