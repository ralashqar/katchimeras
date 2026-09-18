import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import { FIRST_ANSWER } from './catalog';

const SCENE_KEYS = {
  wish: ['roots-awake', 'road-ahead', 'signal-promise'],
  trail: ['old-marker', 'path-supplies', 'warm-table'],
  hearth: ['two-handles', 'travellers'],
  welcome: ['doorstep', 'keep-warm'],
  post: ['footing', 'last-stretch'],
  answer: ['raise-light', 'send-signal', 'receive-answer', 'road-ahead'],
} as const;

export const ADVENTURE_FLOWS: readonly ContentFlowDefinition[] = FIRST_ANSWER.beats.map(beat => ({
  id: `${FIRST_ANSWER.id}:${beat.id}`, version: 2, entryNodeId: SCENE_KEYS[beat.id][0],
  migrations: Object.fromEntries(SCENE_KEYS[beat.id].map((key, index) => [`line:${index}`, key])),
  metadata: { title: beat.title, category: 'shared-adventure' },
  nodes: [
    ...beat.lines.map((text, index): ContentFlowNode => ({
      id: SCENE_KEYS[beat.id][index], kind: 'scene', capability: 'shared.adventure.scene', surface: 'adventure', sceneId: `${beat.id}:${SCENE_KEYS[beat.id][index]}`,
      payload: { text, speaker: beat.id === 'answer' ? ['mossprout', 'steppling', 'feastle', 'mossprout'][index] : beat.speaker },
      actions: index === beat.lines.length - 1 && beat.id === 'wish'
        ? ['welcome', 'rest', 'company'].map(promise => ({ id: promise, next: 'commit', set: { promise } }))
        : [{ id: 'continue', next: index === beat.lines.length - 1 ? 'commit' : SCENE_KEYS[beat.id][index + 1] }],
    })),
    { id: 'commit', kind: 'effect', capability: 'shared.adventure.commit', effectId: beat.id, effectType: 'shared.adventure.commit', payload: { beatId: beat.id }, next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ],
}));
