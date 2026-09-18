import type { ContentFlowDefinition, ContentFlowNode } from '@/types/content-flow';
import { FIRST_ANSWER } from './catalog';

export const ADVENTURE_FLOWS: readonly ContentFlowDefinition[] = FIRST_ANSWER.beats.map(beat => ({
  id: `${FIRST_ANSWER.id}:${beat.id}`, version: 1, entryNodeId: 'line:0',
  metadata: { title: beat.title, category: 'shared-adventure' },
  nodes: [
    ...beat.lines.map((text, index): ContentFlowNode => ({
      id: `line:${index}`, kind: 'scene', capability: 'shared.adventure.scene', surface: 'adventure', sceneId: `${beat.id}:${index}`,
      payload: { text, speaker: beat.id === 'answer' ? ['mossprout', 'steppling', 'feastle', 'mossprout'][index] : beat.speaker },
      actions: index === beat.lines.length - 1 && beat.id === 'wish'
        ? ['welcome', 'rest', 'company'].map(promise => ({ id: promise, next: 'commit', set: { promise } }))
        : [{ id: 'continue', next: index === beat.lines.length - 1 ? 'commit' : `line:${index + 1}` }],
    })),
    { id: 'commit', kind: 'effect', capability: 'shared.adventure.commit', effectId: beat.id, effectType: 'shared.adventure.commit', payload: { beatId: beat.id }, next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ],
}));
