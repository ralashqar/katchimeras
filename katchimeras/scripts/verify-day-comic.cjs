// Node-only verification harness for the day-comic beat builder.
// Usage: node scripts/verify-day-comic.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-comic-'));

function transpileToTemp(rel, out) {
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, out);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const { buildComicStrip } = require(transpileToTemp('utils/day-comic.ts', 'day-comic.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}

function makeDay(creature, overrides = {}) {
  return {
    dayLabel: 'Tuesday',
    highlight: 'You found a quiet corner at the cafe again.',
    dayMap: { nodes: [{ photos: [{ id: 'p1', thumbnailUri: 'file://a.jpg' }, { id: 'p2', thumbnailUri: 'file://b.jpg' }] }] },
    creature,
    ...overrides,
  };
}
function makeCreature(overrides = {}) {
  return {
    name: 'Baristabbit', rarity: 'common', rarityReason: null, repeatDepth: 0, bondVisitCount: 1,
    highlight: 'A warm cup, a familiar seat.', reflection: 'Baristabbit saw you come home to the ritual.',
    motifTags: ['Coffee shop', 'Latte'], encounterProfileId: 'location_coffee_shop_baristabbit', accentColor: '#E3B68C',
    ...overrides,
  };
}

// 1. Four panels in the right order, titled by the creature.
const strip = buildComicStrip(makeDay(makeCreature()));
check('builds 4 panels', strip?.panels.length === 4, JSON.stringify(strip?.panels?.length));
check('panel order is open/scene/turn/close', strip.panels.map((p) => p.kind).join(',') === 'open,scene,turn,close');
check('titled by creature', strip.title === 'Baristabbit' && strip.accentColor === '#E3B68C');

// 2. Curated photos back the middle panels in order.
check('scene panel uses first photo', strip.panels[1].photoUri === 'file://a.jpg');
check('turn panel uses second photo', strip.panels[2].photoUri === 'file://b.jpg');
check('open + close show the creature', strip.panels[0].showCreature && strip.panels[3].showCreature);

// 3. Every caption is non-empty and within the panel length cap.
check('captions non-empty + capped', strip.panels.every((p) => p.caption.length > 0 && p.caption.length <= 100), JSON.stringify(strip.panels.map((p) => p.caption.length)));

// 4. A rare day's turn beat names the living reason.
const rareStrip = buildComicStrip(makeDay(makeCreature({ rarity: 'rare', rarityReason: 'somewhere far from your usual map' })));
check('rare turn beat names the reason', /rare/.test(rareStrip.panels[2].caption) && /far from your usual map/.test(rareStrip.panels[2].caption), rareStrip.panels[2].caption);
check('rare subtitle shows rarity', /rare/.test(rareStrip.subtitle), rareStrip.subtitle);

// 5. A repeat day's turn beat counts the visit.
const repeatStrip = buildComicStrip(makeDay(makeCreature({ repeatDepth: 4, bondVisitCount: 5 })));
check('repeat turn beat counts the visit', /5th time/.test(repeatStrip.panels[2].caption), repeatStrip.panels[2].caption);

// 6. A photo-less day still produces a full strip (creature carries the panels).
const noPhotoStrip = buildComicStrip(makeDay(makeCreature(), { dayMap: { nodes: [] } }));
check('photo-less day still builds 4 panels', noPhotoStrip.panels.length === 4 && noPhotoStrip.panels.every((p) => p.photoUri === null));
check('photo-less middle panels show creature', noPhotoStrip.panels[1].showCreature && noPhotoStrip.panels[2].showCreature);

// 7. No creature → no comic.
check('no creature yields null', buildComicStrip(makeDay(null)) === null);

// 7b. LLM beats override the local captions when provided.
const llmStrip = buildComicStrip(makeDay(makeCreature()), ['Morning, slow and gray.', 'Coffee, then the long way round.', 'The same corner, the same quiet.', 'You came back. Of course you did.']);
check('LLM beats drive the captions', llmStrip.panels.map((p) => p.caption).join('|') === 'Morning, slow and gray.|Coffee, then the long way round.|The same corner, the same quiet.|You came back. Of course you did.', JSON.stringify(llmStrip.panels.map((p) => p.caption)));

// 7c. Per-panel fallback: a missing/blank LLM beat reverts to the local one.
const partialStrip = buildComicStrip(makeDay(makeCreature()), ['A custom open.', '', null, undefined]);
check('blank LLM beat falls back to local', partialStrip.panels[0].caption === 'A custom open.' && partialStrip.panels[1].caption === 'You found a quiet corner at the cafe again.', JSON.stringify(partialStrip.panels.map((p) => p.caption)));

// 8. Long highlight gets trimmed with an ellipsis.
const longStrip = buildComicStrip(makeDay(makeCreature(), { highlight: 'You wandered far past the usual edges of your map today, following a long thread of curiosity that kept pulling you onward into places you had never once seen before now.' }));
check('long scene caption trimmed', longStrip.panels[1].caption.length <= 100 && longStrip.panels[1].caption.endsWith('…'), longStrip.panels[1].caption);

console.log(failures === 0 ? '\nAll day-comic checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
