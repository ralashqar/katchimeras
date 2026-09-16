import type { ReplayRuntime } from '../replay-handler';
export const rulesetId: string;
export const replayRulesets: ReplayRuntime[];
export function resolveReplayRuleset(id: string): ReplayRuntime | undefined;
