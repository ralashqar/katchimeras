const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const carouselSource = readVerificationSource(
  contentPath(projectRoot, 'components/katchadeck/collection/card-deck-carousel.tsx'),
  'utf8'
);
const windowSource = readVerificationSource(
  contentPath(projectRoot, 'utils/collection-deck.ts'),
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

check('collection deck keeps three cards mounted on either side', carouselSource.includes('const WINDOW_RADIUS = 3'));
check('collection deck window defaults to a three-card radius', /radius\s*=\s*3/.test(windowSource));
check('newly mounted cards use a combined fade, drop, and scale entrance', carouselSource.includes('ZoomInDown'));
check('entrance motion is isolated from the animated deck slot', carouselSource.includes('<DeckVisualSlot') && carouselSource.includes('<Animated.View'));
check('entrance motion respects reduced-motion preference', carouselSource.includes('useReducedMotion'));
check(
  'compact deck stage and its shared hit layer move slightly left and up together',
  carouselSource.includes('const COMPACT_DECK_OFFSET_X = -10')
    && carouselSource.includes('const COMPACT_DECK_OFFSET_Y = -8')
    && carouselSource.includes('{ translateX: COMPACT_DECK_OFFSET_X }')
    && carouselSource.includes('{ translateY: COMPACT_DECK_OFFSET_Y }')
    && carouselSource.includes('style={deckSlotStyles.hitLayer}')
);

console.log(failures === 0 ? '\nAll collection deck checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
