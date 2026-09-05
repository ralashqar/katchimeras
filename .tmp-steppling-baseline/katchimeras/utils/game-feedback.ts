import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type GameFeedbackTone = 'neutral' | 'success' | 'danger';
export type GameFeedbackPlacement = 'bottom' | 'middle';
export type GameFeedbackInput = { durationMs?: number; icon?: IconSymbolName; id?: string; message: string; placement?: GameFeedbackPlacement; tone?: GameFeedbackTone };
export type QueuedGameFeedback = Required<Pick<GameFeedbackInput, 'id' | 'message' | 'placement' | 'tone' | 'durationMs'>> & Pick<GameFeedbackInput, 'icon'>;

export function enqueueGameFeedback(queue: readonly QueuedGameFeedback[], input: GameFeedbackInput, fallbackId: string): QueuedGameFeedback[] {
  const id = input.id ?? fallbackId;
  if (queue.some((item) => item.id === id)) return [...queue];
  return [...queue, { durationMs: input.durationMs ?? 1_800, icon: input.icon, id, message: input.message, placement: input.placement ?? 'bottom', tone: input.tone ?? 'neutral' }];
}
