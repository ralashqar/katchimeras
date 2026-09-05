import type { MergeWorldState } from '@/types/merge-world';

/** An active lesson owns its drop stream; opportunities and upgrades cannot override it. */
export type TutorialGeneratorRule = {
  generatorId: string;
  defaultDefinitionId: string;
  matches: readonly { echoId: string; definitionId: string }[];
  orderId: string;
  orderDefinitionId: string;
};

export function tutorialGeneratorDrop(state: MergeWorldState, rule: TutorialGeneratorRule, servedOrderIds: readonly string[]) {
  const match = rule.matches.find((candidate) => state.board.some((cell) => cell.mist?.kind === 'echo' && cell.mist.id === candidate.echoId));
  const needed = match?.definitionId ?? (!servedOrderIds.includes(rule.orderId) ? rule.orderDefinitionId : null);
  const available = needed && state.board.some((cell) => !cell.locked && cell.occupant?.kind === 'item' && cell.occupant.definitionId === needed);
  // Repair an interrupted/legacy lesson with its exact missing source. Otherwise all
  // tutorial spawns remain deterministic tier-one pieces for the repeat request.
  return needed && !available ? needed : rule.defaultDefinitionId;
}
