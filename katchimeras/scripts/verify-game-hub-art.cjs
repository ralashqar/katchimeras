#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'game-hub-art.json'), 'utf8'));
const generator = fs.readFileSync(path.join(root, 'scripts', 'generate-game-hub-art.py'), 'utf8');
const hub = fs.readFileSync(path.join(root, 'components', 'katchadeck', 'games', 'game-hub-screen.tsx'), 'utf8');

function check(label, condition) {
  if (!condition) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok  ${label}`);
}

const byId = new Map(manifest.games.map((game) => [game.questId, game]));
check('all 25 game covers have authored entries', manifest.games.length === 25);
check(
  'every cover describes its actual mechanic in useful detail',
  manifest.games.every((game) => typeof game.mechanicDescription === 'string' && game.mechanicDescription.length >= 80),
);
check(
  'Desk Jam art direction names blocks, grid, and matching edge exits',
  /sliding block puzzle/i.test(byId.get('quest-tasklet-desk-jam')?.mechanicDescription ?? '')
    && /matching coloured doorway/i.test(byId.get('quest-tasklet-desk-jam')?.mechanicDescription ?? ''),
);
check(
  'Block Party art direction names the 8-by-8 board, three-piece tray, and line clear',
  /8-by-8/i.test(byId.get('quest-cheerlet-block-party')?.mechanicDescription ?? '')
    && /tray of three/i.test(byId.get('quest-cheerlet-block-party')?.mechanicDescription ?? '')
    && /row or column.*clears/i.test(byId.get('quest-cheerlet-block-party')?.mechanicDescription ?? ''),
);
check('generator assigns explicit roles to image references', /Input image 1 is the authoritative creature identity reference/.test(generator));
check('generator includes mechanicDescription in the image prompt', /game\['mechanicDescription'\]/.test(generator));
check('generator rejects generic mascot activity', /rather than a generic mascot activity/.test(generator));
check('generation cache uses the mechanic-grounded pipeline version', /game-hub-art-v2-mechanic-grounded/.test(generator));
check('hub renders the authored game description on every card', /\{item\.description\}/.test(hub));
check('hub keeps the section treatment without stacking outlines inside game cards', /styles\.sectionRim/.test(hub) && !/cardRimTop|cardRimLeft|artInnerRim/.test(hub));
check('hub is locked to a two-column game grid', /const columns = 2;/.test(hub) && /const cardWidth = Math\.floor/.test(hub));
check('hub opens directly on working game-category filters', /<GameFilterRail/.test(hub) && /setFilter/.test(hub) && /visiblePlayable/.test(hub));
check('redundant games hero copy has been removed', !/Play with your Katchimeras/.test(hub));

if (process.exitCode) process.exit(process.exitCode);
console.log('\nGame Hub art direction and card presentation verified.');
