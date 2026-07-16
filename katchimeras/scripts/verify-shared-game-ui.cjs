#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const required = [
  'constants/katcha-ui.ts',
  'components/katchadeck/ui/katcha-surface.tsx',
  'components/katchadeck/ui/katcha-sheet.tsx',
  'components/katchadeck/ui/katcha-dialog.tsx',
  'components/katchadeck/ui/katcha-inline-notice.tsx',
  'components/katchadeck/ui/katcha-toast.tsx',
  'features/today/today-surface-state.ts',
  'app/dev-ui-gallery.tsx',
];
const migratedSheets = [
  'components/katchadeck/home/manual-journal-sheet.tsx',
  'components/katchadeck/home/moment-prompt-sheet.tsx',
  'components/katchadeck/world/big-moment-picker-sheet.tsx',
  'components/katchadeck/world/memory-clarification-sheet.tsx',
  'components/katchadeck/world/mood-monument-sheet.tsx',
  'components/katchadeck/world/name-day-sheet.tsx',
  'components/katchadeck/world/quest-board-sheet.tsx',
  'components/katchadeck/world/sleep-sheet.tsx',
  'components/katchadeck/world/steps-prompt-sheet.tsx',
  'components/katchadeck/world/companion-interaction-sheet.tsx',
  'components/katchadeck/world/zodiac-tile-sheet.tsx',
  'components/katchadeck/world/chronicle-sheet.tsx',
  'components/katchadeck/world/keepsakes-sheet.tsx',
];
const standardizedFeedback = [
  'app/note-capture.tsx',
  'components/katchadeck/world/quests/block-jam-quest.tsx',
  'components/katchadeck/world/quests/merge-quest.tsx',
  'components/katchadeck/world/zodiac-tile-sheet.tsx',
];
const sharedShellFiles = [
  'components/katchadeck/world/sanctuary-sheet.tsx',
  'components/katchadeck/world/memory-vault-sheet.tsx',
  'components/katchadeck/world/food-vault-sheet.tsx',
  'components/katchadeck/world/studio-vault-sheet.tsx',
  'components/katchadeck/world/cell-detail-sheet.tsx',
  'components/katchadeck/world/observatory-sheet.tsx',
  'components/katchadeck/world/big-moment-sheet.tsx',
  'components/katchadeck/world/featured-board-sheet.tsx',
  'components/katchadeck/world/discoveries-hall-sheet.tsx',
  'components/katchadeck/world/cosmetics-sheet.tsx',
  'components/katchadeck/world/keepsake-almanac-sheet.tsx',
  'components/katchadeck/world/kingdom-building-sheet.tsx',
  'components/katchadeck/world/place-prompt-sheet.tsx',
  'components/katchadeck/world/starter-prop-sheet.tsx',
];
const failures = [];

for (const file of required) {
  try { readFileSync(join(root, file)); } catch { failures.push(`Missing shared UI contract: ${file}`); }
}
for (const file of migratedSheets) {
  const source = readFileSync(join(root, file), 'utf8');
  if (source.includes("ui/meadow-sheet")) failures.push(`${file} regressed to MeadowSheet`);
  if (/\bshadow(Color|Offset|Opacity|Radius)\s*:|\belevation\s*:/.test(source)) failures.push(`${file} uses a legacy shadow API`);
  if (/Alert\.alert\s*\(/.test(source)) failures.push(`${file} uses a native Alert confirmation`);
}
for (const file of standardizedFeedback) {
  const source = readFileSync(join(root, file), 'utf8');
  if (/Alert\.alert\s*\(/.test(source)) failures.push(`${file} regressed to a native Alert`);
}
for (const file of sharedShellFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  if (!source.includes('<KatchaSheet')) failures.push(`${file} does not use the shared sheet shell`);
  if (source.includes('<View style={styles.overlay}>')) failures.push(`${file} renders a one-off overlay shell`);
  if (source.includes('ui/meadow-sheet')) failures.push(`${file} imports the retired compatibility sheet`);
}
if (existsSync(join(root, 'components/katchadeck/ui/meadow-sheet.tsx'))) failures.push('Retired MeadowSheet compatibility wrapper was reintroduced');

const controller = readFileSync(join(root, 'features/today/use-today-sheet-controller.ts'), 'utf8');
if (/useState\s*\(false\)/.test(controller)) failures.push('Today sheet controller reintroduced independent popup booleans');

const moments = readFileSync(join(root, 'components/katchadeck/world/sanctuary-sheet.tsx'), 'utf8');
if (moments.includes('Give today a feeling')) failures.push('Moments reintroduced a second competing CTA');
if (moments.includes('onReflect')) failures.push('Moments reintroduced its retired mood transition prop');
if (/color=\{item\.accent\}|(?:light|dark)Color=\{item\.accent\}/.test(moments)) failures.push('Moments uses a decorative pastel as a readable foreground');

const button = readFileSync(join(root, 'components/katchadeck/ui/katcha-button.tsx'), 'utf8');
if (button.includes('styles.sheen')) failures.push('KatchaButton reintroduced the clipped highlight bar');
if (!button.includes('styles.rimLight')) failures.push('KatchaButton is missing its restrained rim light');

const cardBackground = '#F0DDC1';
const sheetBackground = '#E6CDA7';
const readableParchmentInks = ['#3A2517', '#62452B', '#704F2F', '#7B5000', '#8A4D1D', '#46589B', '#9C3F68', '#6B499C', '#356256'];
for (const ink of readableParchmentInks) {
  const contrast = contrastRatio(ink, cardBackground);
  if (contrast < 4.5) failures.push(`${ink} only reaches ${contrast.toFixed(2)}:1 on a parchment card`);
}
for (const ink of ['#3A2517', '#62452B', '#704F2F']) {
  const contrast = contrastRatio(ink, sheetBackground);
  if (contrast < 4.5) failures.push(`${ink} only reaches ${contrast.toFixed(2)}:1 on the parchment sheet`);
}
const accentPairs = [
  ['#FFC36B', '#7B5000'], ['#F4BE8D', '#8A4D1D'], ['#E8C272', '#7B5000'],
  ['#AAB2FF', '#46589B'], ['#A7D5FF', '#46589B'], ['#92D7FF', '#46589B'],
  ['#F49AC1', '#9C3F68'], ['#F5AFC6', '#9C3F68'], ['#C77DFF', '#6B499C'],
  ['#D5B8FF', '#6B499C'], ['#C9C2E8', '#6B499C'], ['#91D8C7', '#356256'], ['#A8C99A', '#356256'],
];
for (const [pastel, ink] of accentPairs) {
  const tintedCard = compositeHex(pastel, cardBackground, 0x20 / 255);
  const contrast = contrastRatio(ink, tintedCard);
  if (contrast < 4.5) failures.push(`${ink} only reaches ${contrast.toFixed(2)}:1 over the ${pastel} moment tint`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Shared game UI contracts verified (${required.length} contracts, ${migratedSheets.length} migrated sheets).`);

function contrastRatio(left, right) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function compositeHex(foreground, background, alpha) {
  const front = foreground.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16));
  const back = background.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16));
  const channels = front.map((value, index) => Math.round(value * alpha + back[index] * (1 - alpha)));
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
