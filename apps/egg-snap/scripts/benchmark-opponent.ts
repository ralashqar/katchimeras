import { performance } from 'node:perf_hooks';
import { DUELS, mechanicSequence } from '../data/campaign';
import { createCombat } from '../game/combat';
import { choosePlacement } from '../game/opponent';
import { choosePlacement as exhaustive } from '../tests/fixtures/opponent-exhaustive';

// CPU-only desktop comparison. Device frame/memory measurements are separate.
const results = [];
for (const mechanic of ['tap','drift','armour','bomb','fuse','crossed','hues']) {
  const runs = Array.from({length:100}, (_,seed) => createCombat({
    ...DUELS[0], progression:mechanicSequence([mechanic],2,1),
  }, 'bench', `bench:${seed}`).run);
  const sample = (choose: typeof choosePlacement) => {
    for(const run of runs) choose(run,false,700,.5);
    const times: number[]=[];
    for(let n=0;n<10;n++) for(const run of runs) {
      const start=performance.now(); choose(run,false,700,.5); times.push(performance.now()-start);
    }
    times.sort((a,b)=>a-b);
    return {mean:times.reduce((a,b)=>a+b,0)/times.length,p95:times[Math.floor(times.length*.95)]};
  };
  const before=sample(exhaustive), after=sample(choosePlacement);
  results.push({mechanic, beforeP95Ms:before.p95.toFixed(3), afterP95Ms:after.p95.toFixed(3),
    meanReductionPercent:(100*(1-after.mean/before.mean)).toFixed(1)});
}
console.table(results);
