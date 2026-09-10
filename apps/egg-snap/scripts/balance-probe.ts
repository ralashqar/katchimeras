import { getDuel } from '../data/campaign';
import { FIRST_SESSION, ftueEncounter } from '../data/ftue-encounters';
import { freshProfile } from '../state/profile';
import { CASUAL, probeMedian, type ModelPlayer } from '../game/balance-probe';

// Human-paced tuning table for the first session. Run: npx tsx scripts/balance-probe.ts [placeMs] [accuracy]
const model: ModelPlayer = { ...CASUAL, placeMs: Number(process.argv[2]) || CASUAL.placeMs, accuracy: Number(process.argv[3]) || CASUAL.accuracy };
const profile = freshProfile();
const rows = Object.keys(FIRST_SESSION).map(id => {
  const definition = ftueEncounter(getDuel(id), profile);
  return { id, hp: definition.opponentHealth, ai: `${definition.ai.minActionMs}-${definition.ai.maxActionMs} @${definition.ai.accuracy}`, ...probeMedian(definition, 20, model) };
});
console.table(rows);
