const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = read('constants/creature-hatchling-sources.gen.ts');
const generator = read('scripts/generate-hatchling-lod.py');
const layout = read('utils/creature-ground-shadow.ts');
const shadow = read('components/katchadeck/creature-ground-shadow.tsx');
const card = read('components/katchadeck/cards/daily-card.tsx');
const today = read('components/katchadeck/home/creature-hero.tsx');
const todayReveal = read('components/katchadeck/home/today-tile-hatch-reveal.tsx');
const legacyKingdom = read('components/katchadeck/world/world-canvas.tsx');
const kingdom = read('components/katchadeck/world/kingdom-hex-canvas.tsx');

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}`);
  }
}

check(
  'hatchling generator publishes thresholded alpha bounds',
  generator.includes('ALPHA_THRESHOLD = 16')
    && generator.includes('normalized_alpha_bounds')
    && manifest.includes('CREATURE_HATCHLING_ALPHA_BOUNDS'),
);
check(
  'contact baseline uses the generated bottom-most visible pixel',
  layout.includes('const contactY = bounds.bottom * frameSize')
    && layout.includes('top: contactY - height * 0.44'),
);
check(
  'contact treatment uses a true radial-alpha ellipse rather than a capsule',
  shadow.includes('ELLIPSE_MASK')
    && shadow.includes('contentFit="fill"')
    && shadow.includes('tintColor="#0D0905"')
    && !shadow.includes('borderRadius')
    && !shadow.includes('boxShadow')
    && !shadow.includes('cast'),
);
check(
  'all creature surfaces use one shared contact-shadow scale',
  shadow.includes('CREATURE_CONTACT_SHADOW_SCALE = 1.534')
    && shadow.includes('sizeMultiplier = CREATURE_CONTACT_SHADOW_SCALE')
    && layout.includes('const width = baseWidth * sizeMultiplier')
    && layout.includes('const height = baseHeight * sizeMultiplier')
    && !today.includes('sizeMultiplier=')
    && !todayReveal.includes('sizeMultiplier=')
    && !kingdom.includes('sizeMultiplier=')
    && !legacyKingdom.includes('sizeMultiplier='),
);
check(
  'Today, cards, hatch reveal, and live Kingdom canvas share the same contact shadow',
  today.includes('<CreatureGroundShadow')
    && card.includes('<CreatureGroundShadow')
    && todayReveal.includes('<CreatureGroundShadow')
    && kingdom.includes('<CreatureGroundShadow')
    && card.indexOf('<CreatureGroundShadow') < card.lastIndexOf('style={StyleSheet.absoluteFill}')
    && today.indexOf('<CreatureGroundShadow') < today.indexOf('<Image pointerEvents="none" contentFit="contain" source={heroSource}')
    && kingdom.indexOf('<CreatureGroundShadow') < kingdom.indexOf('<SeamlessWorldImage source={source}'),
);
check(
  'Today scales its Katchimera and contact shadow together by 15%',
  today.includes('TODAY_KATCHIMERA_SCALE = 1.15')
    && today.includes('const todayCreatureSize = kingdomLayout.creatureSize * TODAY_KATCHIMERA_SCALE')
    && today.includes('frameSize={todayCreatureSize}')
    && today.includes('height: todayCreatureSize')
    && today.includes('width: todayCreatureSize'),
);

console.log(failures === 0 ? '\nAll creature contact-shadow checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
