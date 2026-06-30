// Node-only verification harness for world prop inventory and decor projection.
// Usage: node scripts/verify-world-props.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-world-props-'));

const SPECIFIER_MAP = {
  '@/utils/world-props-catalog': './world-props-catalog',
  '@/utils/app-storage': './app-storage',
};

function transpile(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries(SPECIFIER_MAP)) {
    output = output.split(`"${from}"`).join(`"${to}"`).split(`'${from}'`).join(`'${to}'`);
  }
  fs.writeFileSync(path.join(tempDir, out), output);
}

fs.writeFileSync(
  path.join(tempDir, 'app-storage.js'),
  'exports.getStoredJson = (_key, fallback) => fallback; exports.setStoredJson = () => {};'
);
transpile('utils/world-props-catalog.ts', 'world-props-catalog.js');
transpile('utils/world-props-engine.ts', 'world-props-engine.js');
transpile('utils/world-decor.ts', 'world-decor.js');

const { deriveWorldPropInventory } = require(path.join(tempDir, 'world-props-engine.js'));
const { decorObjects } = require(path.join(tempDir, 'world-decor.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const emptyState = { version: 1, starterPropId: null, seenPropIds: [] };
const noUnlocks = deriveWorldPropInventory({ propsState: emptyState, discoveryEntries: [], observations: [] });
check('new user sees five starter choices', noUnlocks.starterChoices.length === 5, String(noUnlocks.starterChoices.length));
check('new user owns no starter before choosing', noUnlocks.owned.every((entry) => entry.def.unlockKind !== 'starter'));

const starterState = { version: 1, starterPropId: 'starter_memory_tree', seenPropIds: ['starter_memory_tree'] };
const starterInventory = deriveWorldPropInventory({ propsState: starterState, discoveryEntries: [], observations: [] });
check('choosing one starter owns only that starter', starterInventory.owned.filter((entry) => entry.def.unlockKind === 'starter').length === 1);
check('chosen starter is memory tree', starterInventory.owned.some((entry) => entry.def.id === 'starter_memory_tree'));

const discoveryInventory = deriveWorldPropInventory({
  propsState: starterState,
  discoveryEntries: [
    { def: { id: 'steps_20k' }, record: { id: 'steps_20k', unlockedAt: 1, sourceMomentIds: [], seenAnimation: true } },
    { def: { id: 'goal_achieved' }, record: { id: 'goal_achieved', unlockedAt: 1, sourceMomentIds: [], seenAnimation: true } },
  ],
  observations: [],
});
check('20k steps unlocks trail marker', discoveryInventory.owned.some((entry) => entry.def.id === 'prop_trail_marker'));
check('goal achieved unlocks trophy stone', discoveryInventory.owned.some((entry) => entry.def.id === 'prop_trophy_stone'));

const observationInventory = deriveWorldPropInventory({
  propsState: starterState,
  discoveryEntries: [],
  observations: [{ id: 'motif:movement', kind: 'movement', title: 'Walks', body: 'Walking', strength: 2, relatedDayIds: ['d1'], source: 'continuity' }],
});
check('strong movement observation unlocks walking signpost', observationInventory.owned.some((entry) => entry.def.id === 'prop_walking_signpost'));
check('locked props include readable requirement copy', observationInventory.locked.some((entry) => entry.lockedLabel.includes('Walk 20,000')));

const moodInventory = deriveWorldPropInventory({
  propsState: starterState,
  discoveryEntries: [],
  observations: [],
  days: [{ promptAnswers: [{ kind: 'feeling', choiceIds: ['stressed'], dismissed: false }] }],
});
check('stormy mood unlocks Night Iris', moodInventory.owned.some((entry) => entry.def.id === 'prop_mood_night_iris'));
check('other mood seeds stay locked', moodInventory.locked.some((entry) => entry.def.id === 'prop_mood_sunbud'));

const projected = decorObjects([{ id: 'legacy', assetKey: 'decor_1', col: 1, row: 2 }]);
check('legacy assetKey decor still projects', projected[0]?.assetKey === 'decor_1' && projected[0]?.category === 'decor');

const sourced = decorObjects([
  { id: 'earned', assetKey: 'decor_13', col: 1, row: 2, propId: 'prop_trail_marker', sourceLabel: 'Earned from steps', earnedFrom: 'Trail Marker' },
]);
check('earned decor carries source label', sourced[0]?.sourceLabel === 'Earned from steps' && sourced[0]?.label === 'Trail Marker');

console.log(failures === 0 ? '\nAll world prop checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
