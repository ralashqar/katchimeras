// Node-only verification harness for the day lifecycle gate (utils/day-state.ts).
// Usage: node scripts/verify-day-state.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-daystate-'));
const source = fs.readFileSync(path.join(projectRoot, 'utils/day-state.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const outPath = path.join(tempDir, 'day-state.js');
fs.writeFileSync(outPath, output);
const { resolveDayLifecycleState } = require(outPath);

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

const HATCH_HOUR = 21;
function todayState(over = {}) {
  return resolveDayLifecycleState({
    hasCreature: false, storedState: 'forming',
    isSameDay: true, hour: 12, hatchHour: HATCH_HOUR, ...over,
  });
}

// === The core bug: today is never hatchable before its hatch hour ===========
check('today before hatch hour is forming', todayState({ hour: 12 }) === 'forming', todayState({ hour: 12 }));
check('today AT hatch hour is ready', todayState({ hour: 21 }) === 'ready_to_hatch', todayState({ hour: 21 }));
check('today after hatch hour is ready', todayState({ hour: 22 }) === 'ready_to_hatch', todayState({ hour: 22 }));

// The regression itself: a STALE stored ready flag must NOT make today hatchable
// before the hatch hour (this is what made "Reveal" appear early).
check('today ignores a stale ready flag before hatch hour',
  todayState({ storedState: 'ready_to_hatch', hour: 9 }) === 'forming',
  todayState({ storedState: 'ready_to_hatch', hour: 9 }));
check('today honors a ready flag once the hatch hour passes',
  todayState({ storedState: 'ready_to_hatch', hour: 22 }) === 'ready_to_hatch');

// === Past days stay hatchable on demand =====================================
check('a past day is ready even with low context', resolveDayLifecycleState({ hasCreature: false, storedState: 'forming', isSameDay: false, hour: 9, hatchHour: HATCH_HOUR }) === 'ready_to_hatch');
check('a past day stored ready stays ready (any hour)', resolveDayLifecycleState({ hasCreature: false, storedState: 'ready_to_hatch', isSameDay: false, hour: 3, hatchHour: HATCH_HOUR }) === 'ready_to_hatch');

// === Other invariants =======================================================
check('a hatched day is hatched', resolveDayLifecycleState({ hasCreature: true, storedState: 'hatched', isSameDay: true, hour: 23, hatchHour: HATCH_HOUR }) === 'hatched');
check('a zero-context today still becomes ready at hatch time', todayState({ hour: 23 }) === 'ready_to_hatch', todayState({ hour: 23 }));

// === Cross-midnight scenario (the open-app case) ============================
// At 00:30 the calendar has advanced: yesterday (now a past day) stored ready
// stays ready; a freshly-created today with no shape is forming.
check('cross-midnight: yesterday stays ready', resolveDayLifecycleState({ hasCreature: false, storedState: 'ready_to_hatch', isSameDay: false, hour: 0, hatchHour: HATCH_HOUR }) === 'ready_to_hatch');
check('cross-midnight: new today is forming', todayState({ hour: 0 }) === 'forming');

console.log(failures === 0 ? '\nAll day-state checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
