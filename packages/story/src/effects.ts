import type { ContentFlowPendingWork, ContentFlowRun } from './types';
export type ContentFlowEffectContext = {
  run: ContentFlowRun;
  effectKey: string;
  payload: Readonly<Record<string, unknown>>;
};
export type ContentFlowEffectHandler = (context: ContentFlowEffectContext) => Promise<unknown>;
export function createContentFlowEffects() {

const effectHandlers = new Map<string, ContentFlowEffectHandler>();

function registerContentFlowEffect(type: string, handler: ContentFlowEffectHandler) {
  const current = effectHandlers.get(type);
  if (current && current !== handler) throw new Error(`Content flow effect ${type} already has a handler`);
  effectHandlers.set(type, handler);
  return () => { if (effectHandlers.get(type) === handler) effectHandlers.delete(type); };
}

function contentFlowEffectHandler(type: string) {
  return effectHandlers.get(type) ?? null;
}

function validatePendingContentFlowWork(work: ContentFlowPendingWork): string | null {
  if (work.kind === 'effect' && !contentFlowEffectHandler(work.effectType)) return `No effect handler is registered for ${work.effectType}`;
  return null;
}


return { registerContentFlowEffect, contentFlowEffectHandler, validatePendingContentFlowWork };
}
