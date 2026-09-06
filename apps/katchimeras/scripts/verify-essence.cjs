const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the Essence engine (Phase A). Transpile the
// pure modules with TypeScript and run scenarios. Usage: node scripts/verify-essence.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-ess-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

// essence-storage imports @/utils/app-storage (native localStorage shim) — stub it.
const appStorageStub = path.join(tempDir, 'app-storage.js');
fs.writeFileSync(appStorageStub, 'exports.getStoredJson = (k, f) => f;\nexports.setStoredJson = () => {};\n');
const stubs = { '@/utils/app-storage': appStorageStub };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const engine = require(transpileToTemp('utils/essence-engine.ts', 'essence-engine.js'));
const storage = require(transpileToTemp('utils/essence-storage.ts', 'essence-storage.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(overrides = {}) {
  return {
    isoDate: '2026-06-20',
    state: 'forming',
    capturedMeanings: [],
    heroPhoto: null,
    notes: [],
    promptAnswers: [],
    confirmedPlaces: [],
    newPlaceCount: 0,
    foodMoments: [],
    bigMoments: [],
    ...overrides,
  };
}

// ── per-day awards ──
check('an empty day earns 0', engine.essenceAwardsForDay(day()) === 0);

const rich = day({
  capturedMeanings: [{}, {}], // 2 × 5 = 10
  heroPhoto: { assetId: 'a' }, // 5
  notes: [{ kind: 'voice' }, { kind: 'text' }], // 1 × 8 = 8
  promptAnswers: [{ kind: 'feeling' }, { kind: 'feeling', dismissed: true }], // 1 × 4 = 4
  confirmedPlaces: [{}, {}], // 2 × 6 = 12
  newPlaceCount: 1, // min(1,2) × 4 = 4
  foodMoments: [{}], // 1 × 5 = 5
  bigMoments: [{ type: 'birthday' }], // 1 × 15 = 15
});
check('a rich day sums every event award', engine.essenceAwardsForDay(rich) === 63, String(engine.essenceAwardsForDay(rich)));
check('new-place bonus is capped at confirmed places', engine.essenceAwardsForDay(day({ confirmedPlaces: [{}], newPlaceCount: 5 })) === 6 + 4);

// ── discovery essence ──
check('discovery essence defaults by rarity', engine.discoveryEssence({ rarity: 'rare' }) === 40);
check('discovery essence honours an override', engine.discoveryEssence({ rarity: 'epic', essenceReward: 5 }) === 5);

// ── earned total ──
const unlocked = [{ rarity: 'common' }, { rarity: 'legendary', essenceReward: 100 }]; // 20 + 100
check('earnedTotal = day events + discovery essence', engine.earnedTotal([rich], unlocked) === 63 + 120, String(engine.earnedTotal([rich], unlocked)));
check('earnedTotal is deterministic (anti-farm)', engine.earnedTotal([rich], unlocked) === engine.earnedTotal([rich], unlocked));

// ── weekly recap ──
const hatched = (n) => Array.from({ length: n }, () => day({ state: 'hatched' }));
check('14 finalised days → two weekly recaps (50)', engine.earnedTotal(hatched(14), []) === 50, String(engine.earnedTotal(hatched(14), [])));
check('6 finalised days → no recap', engine.earnedTotal(hatched(6), []) === 0);
check('7 finalised days → one recap (25)', engine.earnedTotal(hatched(7), []) === 25);

// ── balance ──
check('balance = earned − spent', engine.essenceBalance(100, 30) === 70);
check('balance never goes negative', engine.essenceBalance(10, 50) === 0);

// ── spend ledger ──
const s0 = { version: 1, spent: 0, purchases: [] };
const s1 = storage.recordSpend(s0, 'theme_a', 25);
check('recordSpend adds cost + receipt', s1.spent === 25 && s1.purchases.includes('theme_a'));
check('recordSpend is idempotent per id', storage.recordSpend(s1, 'theme_a', 25).spent === 25);
const s2 = storage.recordSpend(s1, 'skin_b', 10);
check('recordSpend accumulates distinct purchases', s2.spent === 35 && s2.purchases.length === 2);

console.log(failures === 0 ? '\nAll essence checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
