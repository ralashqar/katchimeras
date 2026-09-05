/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let failures = 0;
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const debtBaseline = JSON.parse(read('scripts/game-ui-debt-baseline.json'));
function check(label, condition) {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.error(`FAIL  ${label}`); }
}

function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDirectory, entry.name);
    if (relative.split(path.sep).some((part) => part.startsWith('dev-'))) return [];
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.[jt]sx?$/.test(entry.name) ? [relative] : [];
  });
}

function countMatches(files, pattern) {
  return files.reduce((total, file) => total + (read(file).match(pattern) ?? []).length, 0);
}

const required = [
  'constants/game-ui.ts',
  'components/katchadeck/ui/game-ui-provider.tsx',
  'components/katchadeck/ui/game-currency-hud.tsx',
  'components/katchadeck/ui/game-primitives.tsx',
  'components/katchadeck/ui/game-surface.tsx',
  'features/ui/game-feedback-provider.tsx',
  'features/ui/game-wallet-provider.tsx',
  'app/dev-ui-gallery.tsx',
];
required.forEach((file) => check(`${file} exists`, fs.existsSync(path.join(root, file))));
for (const file of required.filter((item) => item.endsWith('.tsx'))) {
  const source = read(file);
  check(`${file} does not use native Alert`, !source.includes('Alert.alert'));
  check(`${file} does not create a native Modal`, !source.includes('<Modal'));
}

const today = read('components/katchadeck/home/today-top-hud.tsx');
check('Today uses the shared currency HUD', today.includes('<GameCurrencyHud'));
check('Today uses the shared HUD bar', today.includes('<GameHudBar'));
check('Today uses illustrated shared currency art', today.includes('GAME_CURRENCY_ART.energy') && today.includes('GAME_CURRENCY_ART.coins'));
check('Today does not read Merge persistence', !today.includes('loadMergeWorldState'));
check('Today care uses procedural game surfaces', read('components/katchadeck/home/today-nurture-experience.tsx').includes('<GameSurface'));
const todayRoute = read('app/(tabs)/today.tsx');
const eggFeed = read('components/katchadeck/home/egg-feed-overlay.tsx');
check('Today rewards use the Merge Energy artwork', !todayRoute.includes('GROWTH_ENERGY_ART') && eggFeed.includes('GAME_CURRENCY_ART.energy'));
check('Merge Energy rewards target and pulse the Today HUD', todayRoute.includes('mergeEnergyAmount: journalMergeReward?.totalEnergy ?? 0') && eggFeed.includes('destination="currency"'));
const merge = read('components/katchadeck/games/merge-world-screen.tsx');
check('Merge uses the shared currency HUD', merge.includes('<GameCurrencyHud'));
check('Merge uses the shared HUD bar', merge.includes('<GameHudBar'));
check('Merge uses illustrated shared currency art', merge.includes('GAME_CURRENCY_ART.energy') && merge.includes('GAME_CURRENCY_ART.coins'));
check('Merge uses shared feedback', merge.includes('useGameFeedback'));
check('Merge has no local CurrencyHud', !merge.includes('function CurrencyHud'));
check('Merge parcels use shared game badges', read('components/katchadeck/games/merge-parcel-overlay.tsx').includes('<GameBadge'));
check('Companions use the shared hero stage', read('components/katchadeck/world/companion-hero.tsx').includes('<GameHeroStage'));

const productSources = [...sourceFiles('app'), ...sourceFiles('components')];
const debt = {
  alertAlert: countMatches(productSources, /Alert\.alert\s*\(/g),
  nativeModal: countMatches(productSources, /<Modal(?:\s|>)/g),
  localToastDefinitions: countMatches(productSources, /(?:function|const)\s+\w*Toast\b/g),
  sharedUiRawHex: countMatches(sourceFiles('components/katchadeck/ui'), /#[0-9a-fA-F]{3,8}\b/g),
};

for (const [name, count] of Object.entries(debt)) {
  const ceiling = debtBaseline[name];
  check(`UI debt ${name} is ${count}/${ceiling}`, Number.isInteger(ceiling) && count <= ceiling);
}

console.log(failures === 0 ? '\nAll game UI system checks passed.' : `\n${failures} game UI system check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
