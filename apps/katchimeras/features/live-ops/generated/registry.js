import * as r0 from './rulesets/merge-v1-1fcfd9ee9e59e7949dd4163c79bbea97732481f371082068933f91a380663814.js';
import * as r1 from './rulesets/merge-v1-22d414730357ed0cb8d4edbd9bf05332e713081d9d2de8d59f717758f002e6b0.js';
export const rulesetId = "merge-v1-1fcfd9ee9e59e7949dd4163c79bbea97732481f371082068933f91a380663814";
export const replayRulesets = [r0,r1];
export const resolveReplayRuleset = (id) => replayRulesets.find((runtime) => runtime.rulesetId === id);
