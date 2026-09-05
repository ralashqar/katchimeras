import type { JournalRouteProposal } from '@/types/home';

export function shouldAutoRouteVoice(first: JournalRouteProposal, second?: JournalRouteProposal): boolean {
  return first.confidence >= 0.82 && (!second || first.confidence - second.confidence >= 0.12);
}
