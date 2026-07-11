// Node-only verification harness for the Memory Roles engine.
// Usage: node scripts/verify-memory-roles.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-roles-'));

function transpile(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, out);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const originalResolveFilename = require('module')._resolveFilename;
const studioDetectPath = transpile('utils/studio-detect.ts', 'studio-detect.js');
const memoryDisplayPath = transpile('utils/memory-display.ts', 'memory-display.js');
require('module')._resolveFilename = function resolveVerificationModule(request, parent, isMain, options) {
  if (request === '@/utils/studio-detect') return studioDetectPath;
  if (request === '@/utils/memory-display') return memoryDisplayPath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { deriveDayMemoryRoles } = require(transpile('utils/memory-roles-engine.ts', 'memory-roles-engine.js'));

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
    id: 'day-1',
    isoDate: '2026-06-17',
    state: 'forming',
    moments: [],
    promptAnswers: [],
    capturedMeanings: [],
    heroPhoto: null,
    confirmedPlaces: [],
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    notes: [],
    bigMoments: [],
    foodMoments: [],
    studioMoments: [],
    stepsCount: 0,
    scores: { energy: 0, calm: 0, social: 0, exploration: 0, focus: 0 },
    ...overrides,
  };
}

const empty = deriveDayMemoryRoles(day());
check('empty day has no forced role', empty.length === 0, JSON.stringify(empty));

const photo = deriveDayMemoryRoles(
  day({ capturedMeanings: [{ archetype: 'calm', label: 'A slow sip', thumbnailUri: null, createdAt: '' }] })
);
check('photo day becomes small joy', photo.some((role) => role.id === 'small_joy'));

const place = deriveDayMemoryRoles(
  day({ confirmedPlaces: [{ id: 'p1', category: 'cafe', archetype: 'calm', label: 'Cafe', meaningLabel: 'A quiet table', confirmedAt: '' }] })
);
check('confirmed place becomes anchor place', place.some((role) => role.id === 'anchor_place'));
check('cafe place can become comfort routine', place.some((role) => role.id === 'comfort_routine'));

const studio = deriveDayMemoryRoles(
  day({ studioMoments: [{ id: 's1', label: 'Dune', mediaType: 'book', emoji: 'book', rating: 'inspired', createdAt: '' }] })
);
check('studio item becomes creative spark', studio.some((role) => role.id === 'creative_spark'));

const social = deriveDayMemoryRoles(day({ notes: [{ id: 'n1', kind: 'text', text: 'Dinner with friends', audioUri: null, durationMs: null, archetype: 'together', label: 'Dinner with friends', createdAt: '' }] }));
check('together note becomes social moment', social.some((role) => role.id === 'social_moment'));

const milestone = deriveDayMemoryRoles(day({ bigMoments: [{ id: 'b1', type: 'birthday', label: 'Birthday', subject: 'Sam', noteId: null, createdAt: '' }] }));
check('big moment becomes milestone', milestone[0]?.id === 'milestone');

const capped = deriveDayMemoryRoles(
  day({
    bigMoments: [{ id: 'b1', type: 'birthday', label: 'Birthday', subject: 'Sam', noteId: null, createdAt: '' }],
    confirmedPlaces: [{ id: 'p1', category: 'museum', archetype: 'meaningful', label: 'Museum', confirmedAt: '' }],
    foodMoments: [{ id: 'f1', label: 'Cake', emoji: 'cake', meaning: 'treat', createdAt: '' }],
    studioMoments: [{ id: 's1', label: 'A film', mediaType: 'film', emoji: 'film', rating: 'liked', createdAt: '' }],
    promptAnswers: [{ kind: 'feeling', dismissed: false }],
    capturedMeanings: [{ archetype: 'together', label: 'Friends', thumbnailUri: null, createdAt: '' }],
  })
);
check('roles are capped', capped.length === 4, String(capped.length));
check('high-signal roles lead the list', capped[0]?.id === 'milestone' && capped[1]?.id === 'anchor_place');

console.log(failures === 0 ? '\nAll memory-role checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
