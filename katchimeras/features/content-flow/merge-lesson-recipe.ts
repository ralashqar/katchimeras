import type { FtueGuide, FtueStepDefinition, FtueTarget } from '@/features/onboarding/ftue-types';
import type { ContentFlowNode } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { story } from './story-manifest';

export type MergeLessonBeat = { id: string; guide: FtueGuide } & (
  | { kind: 'spawn'; generatorId: string }
  | { kind: 'match'; definitionId: string; echoId: string }
  | { kind: 'pair'; definitionId: string }
  | { kind: 'serve'; orderId: string }
  | { kind: 'practice'; orderId: string }
);

export function mergeLessonRecipe(beats: readonly MergeLessonBeat[], next: string, eventPrefix = 'merge.lesson'): ContentFlowNode[] {
  return beats.map((beat, index) => story.task({
    id: beat.id, capability: 'merge.lesson', surface: 'merge', taskId: beat.id, mode: 'all',
    payload: { beat }, next: beats[index + 1]?.id ?? next,
    requirements: [{ id: beat.id, event: { type: `${eventPrefix}.${beat.id}` } }],
  }));
}

/** The same authored beat drives instruction, finger, spotlight, and allowed input. */
export function mergeLessonBoardStep(beat: MergeLessonBeat | undefined, idPrefix = 'merge.lesson', recovery?: {
  board: MergeWorldState['board']; generatorId: string; requiredDefinitionId: string;
}): FtueStepDefinition | null {
  if (!beat) return null;
  const base = { id: `${idPrefix}.${beat.id}`, surface: 'merge' as const, actions: [], guide: beat.guide };
  const missingSource = recovery && recovery.board.filter((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === recovery.requiredDefinitionId).length < (beat.kind === 'pair' ? 2 : 1);
  if (recovery && (beat.kind === 'spawn' || missingSource) && beat.kind !== 'practice') {
    if (!recovery.board.some((cell) => !cell.locked && !cell.occupant && !cell.mist)) return {
      ...base, guide: { eyebrow: 'A little room', title: 'Make space in the Garden.', body: 'Merge or store an item, then we’ll continue.' },
    };
    if (missingSource && beat.kind !== 'spawn') {
      const target: FtueTarget = { kind: 'board_generator', generatorId: recovery.generatorId };
      return { ...base, guide: { eyebrow: 'Let’s keep growing', title: 'One piece is missing.', body: 'Tap the Garden Basket for the piece we need.' },
        cue: { kind: 'tap', target }, spotlight: { targets: [target] }, interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target } } };
    }
  }
  if (beat.kind === 'practice') return base;
  if (beat.kind === 'spawn') {
    const target: FtueTarget = { kind: 'board_generator', generatorId: beat.generatorId };
    return { ...base, cue: { kind: 'tap', target }, spotlight: { targets: [target] }, interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target } } };
  }
  if (beat.kind === 'match' || beat.kind === 'pair') {
    const from: FtueTarget = { kind: 'board_items', definitionId: beat.definitionId, occurrence: 0 };
    const to: FtueTarget = beat.kind === 'pair' ? { kind: 'board_items', definitionId: beat.definitionId, occurrence: 1 } : { kind: 'board_dream_echo', echoId: beat.echoId };
    return { ...base, cue: { kind: 'drag', from, to }, spotlight: { targets: [from, to], grouping: 'bounding_rect' }, interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from, to } } };
  }
  const target: FtueTarget = { kind: 'order_serve', orderId: beat.orderId };
  return { ...base, cue: { kind: 'tap', target }, spotlight: { targets: [{ kind: 'order_card', orderId: beat.orderId }] }, interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target } } };
}

export function mergeLessonEvidenceReady(beat: MergeLessonBeat | undefined, evidence: {
  spawned: boolean; remainingEchoIds: readonly string[]; servedOrderIds: readonly string[];
  pairMerged?: boolean;
}) {
  if (!beat) return false;
  if (beat.kind === 'spawn') return evidence.spawned;
  if (beat.kind === 'pair') return Boolean(evidence.pairMerged);
  if (beat.kind === 'match') return !evidence.remainingEchoIds.includes(beat.echoId);
  return evidence.servedOrderIds.includes(beat.orderId);
}
