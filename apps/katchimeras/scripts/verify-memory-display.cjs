const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-memory-display-'));
function transpile(relative, name) {
  const output = ts.transpileModule(readVerificationSource(contentPath(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const out = path.join(temp, name);
  fs.writeFileSync(out, output);
  return out;
}

const studioPath = transpile('utils/studio-detect.ts', 'studio.js');
const displayPath = transpile('utils/memory-display.ts', 'display.js');
const emptyPath = path.join(temp, 'empty.js');
fs.writeFileSync(emptyPath, '');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@/utils/studio-detect') return studioPath;
  if (request === '@/types/home') return emptyPath;
  return originalResolve.call(this, request, ...rest);
};

const display = require(displayPath);
let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const japaneseMeal = display.resolveFoodMomentDisplay({ label: 'Meal', emoji: '🍽', cuisine: 'japanese' });
check('generic Japanese meal promotes cuisine to primary label', japaneseMeal.label === 'Japanese', JSON.stringify(japaneseMeal));
check('generic Japanese meal uses sushi cuisine icon', japaneseMeal.emoji === '🍣', JSON.stringify(japaneseMeal));

const homeMeal = display.resolveFoodMomentDisplay({ label: 'Meal', emoji: '🍽', homeCooked: true });
check('generic home-cooked meal promotes preparation detail', homeMeal.label === 'Home-made meal' && homeMeal.emoji === '🍲', JSON.stringify(homeMeal));

const sushi = display.resolveFoodMomentDisplay({ label: 'Sushi', emoji: '🍣', cuisine: 'japanese' });
check('specific dish remains primary over cuisine family', sushi.label === 'Sushi' && sushi.detail === 'Japanese', JSON.stringify(sushi));

const studio = display.resolveStudioMomentDisplay({ label: 'A film', emoji: '🎬', mediaType: 'film', detail: 'Watched Dune' });
check('generic media promotes recovered title', studio.label === 'Dune', JSON.stringify(studio));

const movement = display.resolveMovementDisplay({ label: 'Just transit', emoji: '🚇', subtype: 'train' });
check('movement subtype outranks generic movement label', movement.label === 'Train / Tube' && movement.detail === 'Just transit', JSON.stringify(movement));

const lifeEvent = display.resolveBigMomentDisplay({ label: 'A new baby', subject: 'daughter' });
check('life event subject enriches generic event label', lifeEvent.label === 'A new baby · daughter', JSON.stringify(lifeEvent));

for (const relative of [
  'components/katchadeck/world/food-vault-sheet.tsx',
  'components/katchadeck/world/studio-vault-sheet.tsx',
  'utils/moment-timeline.ts',
  'utils/kingdom-archive.ts',
]) {
  const source = readVerificationSource(contentPath(root, relative), 'utf8');
  check(`${relative} uses rich memory display`, source.includes('resolveFoodMomentDisplay') || source.includes('resolveStudioMomentDisplay'));
}

Module._resolveFilename = originalResolve;
fs.rmSync(temp, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll memory-display checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
