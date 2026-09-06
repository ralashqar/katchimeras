const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Validates the creature variant grid spec + that every sliced cell asset
// exists on disk. Usage: node scripts/verify-creature-variants.cjs
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const data = JSON.parse(
  readVerificationSource(contentPath(projectRoot, 'data/katchimeras/creature-variants.json'), 'utf8')
);

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const moodRows = data.axes.moodRows;
const bondColumns = data.axes.bondColumns;
check('4 mood rows', moodRows.length === 4, JSON.stringify(moodRows));
check('4 bond columns', bondColumns.length === 4, JSON.stringify(bondColumns));

for (const [key, creature] of Object.entries(data.creatures)) {
  const cells = creature.cells === '@cellTemplate' ? data.cellTemplate : creature.cells;
  check(`${key}: 16 cells`, cells.length === 16, String(cells.length));

  const expected = new Set();
  for (const m of moodRows) for (const b of bondColumns) expected.add(`${m}_${b}`);
  const got = new Set(cells.map((c) => c.id));
  check(`${key}: cell ids exactly cover mood x bond`, expected.size === got.size && [...expected].every((id) => got.has(id)));

  // gridRow/gridCol must agree with the mood/bond and stay in range.
  let coordsOk = true;
  for (const c of cells) {
    if (c.gridRow !== moodRows.indexOf(c.mood) || c.gridCol !== bondColumns.indexOf(c.bond)) coordsOk = false;
  }
  check(`${key}: gridRow/gridCol match mood/bond order`, coordsOk);

  // Asset state: a creature is either complete (all 16 cells sliced) or art is
  // deferred (none yet). A PARTIAL set is a real error worth failing on.
  const dir = contentPath(projectRoot, 'assets/images/katchimeras/cutouts/variants', creature.visualKey);
  const present = cells.filter((c) => fs.existsSync(path.join(dir, `${c.id}.png`))).length;
  if (present === 0) {
    console.log(`  --  ${key}: spec ready, art deferred (0/16 cells)`);
  } else if (present === cells.length) {
    check(`${key}: all 16 cell PNGs present`, true);
  } else {
    check(`${key}: complete or empty (no partial slices)`, false, `${present}/16 present`);
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
