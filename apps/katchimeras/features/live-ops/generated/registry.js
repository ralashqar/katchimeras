import * as r0 from './rulesets/merge-v1-1fcfd9ee9e59e7949dd4163c79bbea97732481f371082068933f91a380663814.js';
import * as r1 from './rulesets/merge-v1-22d414730357ed0cb8d4edbd9bf05332e713081d9d2de8d59f717758f002e6b0.js';
import * as r2 from './rulesets/merge-v1-2cb07fa3ee72a2b67de9d620f5657ed7ead102882b18e5e2ce661a7efe92bd50.js';
import * as r3 from './rulesets/merge-v1-bf312a3b31590a93314794a38fc9502c256e31ce050748ddd436f532f39b5afc.js';
export const rulesetId = "merge-v1-bf312a3b31590a93314794a38fc9502c256e31ce050748ddd436f532f39b5afc";
export const replayRulesets = [r0,r1,r2,r3];
export const resolveReplayRuleset = (id) => replayRulesets.find((runtime) => runtime.rulesetId === id);
