import type { ContentFlowDefinition } from '@/types/content-flow';
export const LANTERN_INTRO: ContentFlowDefinition = {
  id: 'wisp-lantern:planted-first-light', version: 1, entryNodeId: 'notice',
  metadata: { title: 'A home for little lights', category: 'wisp-lantern' },
  nodes: [
    { id: 'notice', kind: 'scene', capability: 'wisp.lantern.scene', surface: 'collection', sceneId: 'notice', payload: { speaker: 'Mossprout', text: 'Feastle’s first Snack brought a little light out of the Mist. Let’s plant a Lantern by Heartwood, so wandering Wisps have somewhere to come home.' }, actions: [{ id: 'Find a place', next: 'plant' }] },
    { id: 'plant', kind: 'scene', capability: 'wisp.lantern.scene', surface: 'collection', sceneId: 'plant', payload: {}, actions: [{ id: 'planted', next: 'light' }] },
    { id: 'light', kind: 'effect', capability: 'wisp.lantern.light', effectId: 'light', effectType: 'wisp.lantern.light', payload: {}, next: 'lit' },
    { id: 'lit', kind: 'scene', capability: 'wisp.lantern.scene', surface: 'collection', sceneId: 'lit', payload: {}, actions: [{ id: 'ready', next: 'pouch' }] },
    { id: 'pouch', kind: 'scene', capability: 'wisp.lantern.scene', surface: 'collection', sceneId: 'pouch', payload: {}, actions: [{ id: 'welcomed', next: 'collection' }] },
    { id: 'collection', kind: 'scene', capability: 'wisp.lantern.scene', surface: 'collection', sceneId: 'collection', payload: { speaker: 'Mossprout', text: 'A little light, and already a friend. Your Wisp lives beside the Lantern now. Helping in the Garden will bring more card packs—and more visitors to meet.' }, actions: [{ id: 'See collection', next: 'finish' }] },
    { id: 'finish', kind: 'effect', capability: 'wisp.lantern.finish', effectId: 'finish', effectType: 'wisp.lantern.finish', payload: {}, next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ],
};
