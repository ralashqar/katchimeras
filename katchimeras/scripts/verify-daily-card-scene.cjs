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
check(
  'visible compact and expanded cards request full-resolution scene art',
  cardSource.includes("const imageLod = compact && renderTier === 'buffer' ? 'medium' : 'full'")
    && cardSource.includes('kingdomHexTileSourceForLod(kingdomTile, imageLod)')
    && cardSource.includes('lod: imageLod')
);
check(
  'card scene artwork keeps full decode quality through animated transforms',
  (cardSource.match(/allowDownscaling=\{false\}/g) ?? []).length >= 5
);
check('sky is rendered before the kingdom environment', cardSource.indexOf('source={skySource}') < cardSource.indexOf('source={kingdomSource}'));
check('compact and full cards receive fitted environment sizes', cardSource.includes('compact ? 785 : 763'));
check('card environments return to their fitted baseline', cardSource.includes('const kingdomEnvironmentBottom = (compact ? 0 : 5) * scale'));
check('card creatures keep their reduced fitted frame', cardSource.includes('kingdomCreatureFrameSize = Math.min('));
check('card creatures stay lifted at their tuned position', cardSource.includes("bottom: '41%'"));
check('legacy oversized 194% kingdom environment is removed', !cardSource.includes("height: '194%'"));
check(
  'card creatures and contact shadows share one fitted frame',
  cardSource.includes('<CreatureGroundShadow')
    && cardSource.includes('frameSize={kingdomCreatureFrameSize}')
    && cardSource.indexOf('<CreatureGroundShadow') < cardSource.lastIndexOf('style={StyleSheet.absoluteFill}')
);
check('expanded card requests the layered kingdom scene', viewerSource.includes('sceneArt="kingdom"'));
check('compact collection card requests the layered kingdom scene', carouselSource.includes('sceneArt="kingdom"'));

console.log(failures === 0 ? '\nAll daily card scene checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
