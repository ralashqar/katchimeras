import type {
  ContentFlowNode,
  ContentFlowSurface,
  StoryCameraPresentationPayload,
  StoryTarget,
  StoryUpgradeEconomyPolicy,
  StoryWorldUpgradeEffectPayload,
  StoryWorldUpgradePresentationPayload,
} from '@/types/content-flow';

export const STORY_CAMERA_PRESENTATION = 'world.camera';
export const STORY_WORLD_UPGRADE_EFFECT = 'world.upgrade';
export const STORY_WORLD_UPGRADE_PRESENTATION = 'world.upgrade_reveal';

type WorldUpgradeTarget = StoryWorldUpgradeEffectPayload['target'];
export type WorldActionView = {
  kind: 'goal' | 'garden' | 'return' | 'purchase' | 'discovery';
  guide: { eyebrow: string; title: string; body: string };
  actionLabel: string;
};

/** Scene copy and presentation intent are authored alongside the transition. */
export function worldActionScene(input: { id: string; actionId: string; next: string; view: WorldActionView }): ContentFlowNode {
  return { id: input.id, kind: 'scene', capability: 'world.action', surface: 'haven', sceneId: input.id,
    actions: [{ id: input.actionId, next: input.next }], payload: { worldAction: input.view } };
}
type WorldUpgradePresentationTarget = StoryWorldUpgradePresentationPayload['target'];

function isWorldUpgradePresentationTarget(target: StoryTarget | undefined): target is WorldUpgradePresentationTarget {
  return target?.kind === 'haven_tile'
    || target?.kind === 'haven_structure'
    || target?.kind === 'haven_nature_island';
}

export const storyOperations = {
  focusCamera(input: {
    id: string;
    target: StoryTarget;
    next: string;
    zoom?: number;
    anchorY?: number;
    durationMs?: number;
    lockInput?: boolean;
    surface?: ContentFlowSurface;
  }): ContentFlowNode {
    const payload: StoryCameraPresentationPayload = {
      operation: 'focus',
      target: input.target,
      zoom: input.zoom,
      anchorY: input.anchorY,
      durationMs: input.durationMs,
      lockInput: input.lockInput ?? true,
    };
    return {
      id: input.id,
      kind: 'presentation',
      capability: STORY_CAMERA_PRESENTATION,
      surface: input.surface ?? 'haven',
      presentationId: input.id,
      presentationType: STORY_CAMERA_PRESENTATION,
      payload,
      replayPolicy: 'replay',
      next: input.next,
    };
  },

  fitCamera(input: { id: string; targets: readonly StoryTarget[]; next: string; padding?: number; durationMs?: number; surface?: ContentFlowSurface }): ContentFlowNode {
    const payload: StoryCameraPresentationPayload = { operation: 'fit', targets: input.targets, padding: input.padding, durationMs: input.durationMs, lockInput: true };
    return { id: input.id, kind: 'presentation', capability: STORY_CAMERA_PRESENTATION, surface: input.surface ?? 'haven', presentationId: input.id, presentationType: STORY_CAMERA_PRESENTATION, payload, replayPolicy: 'replay', next: input.next };
  },

  restoreCamera(input: { id: string; snapshotId: string; next: string; durationMs?: number; surface?: ContentFlowSurface }): ContentFlowNode {
    const payload: StoryCameraPresentationPayload = { operation: 'restore', snapshotId: input.snapshotId, durationMs: input.durationMs, lockInput: true };
    return { id: input.id, kind: 'presentation', capability: STORY_CAMERA_PRESENTATION, surface: input.surface ?? 'haven', presentationId: input.id, presentationType: STORY_CAMERA_PRESENTATION, payload, replayPolicy: 'replay', next: input.next };
  },

  preserveCamera(input: { id: string; next: string; holdWorldState?: boolean; lockInput?: boolean; surface?: ContentFlowSurface }): ContentFlowNode {
    const payload: StoryCameraPresentationPayload = {
      operation: 'preserve',
      holdWorldState: input.holdWorldState,
      lockInput: input.lockInput ?? true,
    };
    return { id: input.id, kind: 'presentation', capability: STORY_CAMERA_PRESENTATION, surface: input.surface ?? 'haven', presentationId: input.id, presentationType: STORY_CAMERA_PRESENTATION, payload, replayPolicy: 'replay', next: input.next };
  },
};

export function upgradeWorldTargetRecipe(input: {
  id: string;
  target: WorldUpgradeTarget;
  toLevel: number;
  economy: StoryUpgradeEconomyPolicy;
  next: string;
  /** Camera focus can differ from the durable mutation target (for example, a
   * Garden structure that visually represents a resident's Haven tile). */
  focusTarget?: StoryTarget;
  camera?: { zoom?: number; anchorY?: number; durationMs?: number };
  /** Keep the current camera transform when an earlier story operation has
   * already established the exact composition for the upgrade control. */
  cameraAlreadyFocused?: boolean;
  presentation?: { preset?: string; reactionLine?: string; showCoins?: boolean };
}): ContentFlowNode[] {
  const focusId = `${input.id}.focus`;
  const effectId = `${input.id}.commit`;
  const revealId = `${input.id}.reveal`;
  const effectPayload: StoryWorldUpgradeEffectPayload = { target: input.target, toLevel: input.toLevel, economy: input.economy };
  const presentationPayload: StoryWorldUpgradePresentationPayload = {
    sourceEffectNodeId: effectId,
    sourceEffectId: effectId,
    target: isWorldUpgradePresentationTarget(input.focusTarget) ? input.focusTarget : input.target,
    preset: input.presentation?.preset ?? 'growth',
    reactionLine: input.presentation?.reactionLine,
    showCoins: input.presentation?.showCoins ?? input.economy.mode === 'normal',
  };
  const cameraNode = input.cameraAlreadyFocused
    ? storyOperations.preserveCamera({ id: focusId, next: effectId, holdWorldState: true })
    : storyOperations.focusCamera({ id: focusId, target: input.focusTarget ?? input.target, next: effectId, ...input.camera });
  return [
    cameraNode,
    { id: effectId, kind: 'effect', capability: STORY_WORLD_UPGRADE_EFFECT, effectId, effectType: STORY_WORLD_UPGRADE_EFFECT, payload: effectPayload, next: revealId },
    { id: revealId, kind: 'presentation', capability: STORY_WORLD_UPGRADE_PRESENTATION, surface: 'haven', presentationId: revealId, presentationType: STORY_WORLD_UPGRADE_PRESENTATION, payload: presentationPayload, replayPolicy: 'replay', next: input.next },
  ];
}

export function contentFlowEffectResult<T>(effectReceipts: Record<string, { result?: unknown }>, runId: string, nodeId: string, effectId: string): T | null {
  const result = effectReceipts[`${runId}:${nodeId}:effect:${effectId}`]?.result;
  return result == null ? null : result as T;
}
