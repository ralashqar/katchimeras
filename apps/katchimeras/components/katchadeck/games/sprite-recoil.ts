/**
 * A board piece's shooting recoil (Lanes, `docs/encounter-lanes.md`): whoever fires a piece names it here and only that
 * piece's sprite plays its squash and stretch, on the UI thread. Nothing re-renders for a shot, however many fly.
 */
type RecoilKind = 'shot' | 'impact';
const listeners = new Map<string, Set<(kind: RecoilKind) => void>>();

export const spriteRecoil = {
  /** The piece with this instance id just fired. */
  emit(instanceId: string, kind: RecoilKind = 'shot') {
    for (const listener of [...(listeners.get(instanceId) ?? [])]) listener(kind);
  },
  subscribe(instanceId: string, listener: (kind: RecoilKind) => void): () => void {
    const set = listeners.get(instanceId) ?? new Set<(kind: RecoilKind) => void>();
    set.add(listener);
    listeners.set(instanceId, set);
    return () => {
      set.delete(listener);
      if (!set.size) listeners.delete(instanceId);
    };
  },
};

/** How long the squash takes before the stretch that throws the shot: the bullet leaves the mouth at the stretch. */
export const RECOIL_SQUASH_MS = 70;
