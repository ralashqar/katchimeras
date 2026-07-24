const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const cardSource = fs.readFileSync(
  path.join(projectRoot, 'components/katchadeck/cards/daily-card.tsx'),
  'utf8'
);
const viewerSource = fs.readFileSync(
  path.join(projectRoot, 'components/katchadeck/cards/daily-card-viewer.tsx'),
  'utf8'
);
const carouselSource = fs.readFileSync(
  path.join(projectRoot, 'components/katchadeck/collection/card-deck-carousel.tsx'),
  'utf8'
);

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok  ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL  ${label}`);
}

check('card scene uses the shared atmosphere background catalog', cardSource.includes('TODAY_ATMOSPHERE_BACKGROUND_SOURCES'));
check('sky is rendered before the kingdom environment', cardSource.indexOf('source={skySource}') < cardSource.indexOf('source={kingdomSource}'));
check('compact and full cards receive separate fitted environment sizes', cardSource.includes('compact ? 670 : 650'));
check('legacy oversized 194% kingdom environment is removed', !cardSource.includes("height: '194%'"));
check(
  'creature geometry remains on its existing shared styles',
  cardSource.includes('styles.creature, compact ? styles.compactCreature : null, kingdomSource ? styles.kingdomCreature : null')
);
check('expanded card requests the layered kingdom scene', viewerSource.includes('sceneArt="kingdom"'));
check('compact collection card requests the layered kingdom scene', carouselSource.includes('sceneArt="kingdom"'));

console.log(failures === 0 ? '\nAll daily card scene checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
