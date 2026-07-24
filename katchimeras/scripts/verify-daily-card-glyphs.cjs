const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const cardSource = fs.readFileSync(
  path.join(projectRoot, 'components/katchadeck/cards/daily-card.tsx'),
  'utf8'
);
const glyphRoot = path.join(projectRoot, 'assets/images/katchimeras/card-glyphs');
const glyphs = [
  'movement',
  'connection',
  'milestone',
  'explore',
  'nature',
  'food',
  'culture',
  'focus',
];

let failures = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  ok  ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL  ${label}`);
}

for (const glyph of glyphs) {
  check(`${glyph} glyph asset exists`, fs.existsSync(path.join(glyphRoot, `${glyph}.png`)));
}
check('glyph strip is rendered inside the shared scene', cardSource.includes('<CardGlyphStrip compact={compact}'));
check('glyph strip does not consume card gestures', cardSource.includes('pointerEvents="none"'));
check('glyphs extend the card accessibility label', cardSource.includes('Day highlights:'));
check('compact glyphs are large enough to remain readable', cardSource.includes('compact ? 74 : 62'));
check('compact and expanded glyphs clear their lower frame overlaps', cardSource.includes('compact ? 78 : 46'));
check(
  'compact glyph strip moves left and up by half a scaled icon',
  cardSource.includes('const compactHalfIconOffset = compact ? diameter / 2 : 0')
    && cardSource.includes('(compact ? 78 : 46) * scale + compactHalfIconOffset')
    && cardSource.includes('18 * scale + compactHalfIconOffset')
);

console.log(failures === 0 ? '\nAll daily card glyph checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
