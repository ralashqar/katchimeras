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

export function createStoryTargets<StoryTarget>(storyTargetKey: (target:StoryTarget)=>string) {
/** Surface-local registry. Geometry is deliberately runtime-only and never persisted in a story. */
class StoryTargetRegistry {
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

function storyTargetRegistry(surface: string) {
  let registry = surfaceRegistries.get(surface);
  if (!registry) {
    registry = new StoryTargetRegistry();
    surfaceRegistries.set(surface, registry);
  }
  return registry;
}

function waitForStoryTargets(registry: StoryTargetRegistry, targets: readonly StoryTarget[], timeoutMs = 5_000) {
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

return {StoryTargetRegistry, storyTargetRegistry, waitForStoryTargets};
}
