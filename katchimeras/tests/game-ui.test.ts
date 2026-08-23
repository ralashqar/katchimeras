import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { formatGameCurrency } from '@/utils/game-currency';
import { enqueueGameFeedback } from '@/utils/game-feedback';

test('currency formatting stays compact and stable', () => {
  assert.equal(formatGameCurrency(42), '42');
  assert.equal(formatGameCurrency(1_250), '1.3k');
  assert.equal(formatGameCurrency(24_900), '25k');
  assert.equal(formatGameCurrency(1_250_000), '1.3m');
  assert.equal(formatGameCurrency(-8), '0');
});

test('feedback receipts deduplicate by stable id and preserve order', () => {
  const first = enqueueGameFeedback([], { id: 'save', message: 'Saved', tone: 'success' }, 'fallback:1');
  const duplicate = enqueueGameFeedback(first, { id: 'save', message: 'Saved again' }, 'fallback:2');
  const second = enqueueGameFeedback(duplicate, { id: 'offline', message: 'Offline', tone: 'danger' }, 'fallback:3');
  assert.deepEqual(second.map((item) => item.id), ['save', 'offline']);
  assert.equal(second[0].durationMs, 1_800);
});

test('cozy-playful surfaces provide a complete semantic treatment', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'constants/game-ui.ts'), 'utf8');
  ['cream', 'gold', 'teal', 'sage', 'rose', 'dark'].forEach((tone) => {
    assert.match(source, new RegExp(`\\b${tone}: \\{ top:`));
  });
  ['bottom', 'rim', 'highlight', 'ink', 'shadow'].forEach((token) => assert.match(source, new RegExp(`\\b${token}:`)));
  const component = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/ui/game-surface.tsx'), 'utf8');
  assert.doesNotMatch(component, /lowerBevel|tokens\.bevel/);
  assert.match(component, /density === 'compact'[\s\S]*`0 3px 8px \$\{tokens\.shadow\}`/);
});

test('currency artwork remains large and unframed inside shared pills', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/ui/game-currency-hud.tsx'), 'utf8');
  assert.doesNotMatch(source, /GameIconWell/);
  assert.match(source, /style=\{styles\.pillSurface\} tone="cream"/);
  assert.doesNotMatch(source, /tone=\{glass \?/);
  assert.match(source, /pillGlass: \{ height: 29 \}/);
  assert.match(source, /pillSurface: \{[^}]*overflow: 'visible'/);
  assert.match(source, /pill: \{ flex: 1, flexBasis: 0/);
  assert.match(source, /row: \{[^}]*gap: 20[^}]*paddingLeft: 22/);
  assert.match(source, /pill: \{[^}]*maxWidth: 88/);
  assert.match(source, /pillContent: \{[^}]*paddingLeft: 25[^}]*paddingRight: 5/);
  assert.match(source, /currencyIconGlass: \{ height: 41, left: -17, top: -3, transform: \[\{ translateY: -4 \}\], width: 41 \}/);
  assert.match(source, /artGlass: \{ height: 42, width: 42 \}/);
  assert.match(source, /fontFamily: GameUI\.type\.title\.fontFamily/);
  assert.doesNotMatch(source, /name="timer"/);
  assert.match(source, /if \(safeSeconds < 60\) return `\$\{safeSeconds\}s`/);
  assert.match(source, /return `\$\{minutes\}m \$\{String\(safeSeconds % 60\)\.padStart\(2, '0'\)\}s`/);
});

test('Merge omits the retired Energy HUD and presents generator spawning as unlimited', () => {
  const screenSource = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/games/merge-world-screen.tsx'), 'utf8');
  const inspectorSource = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/games/merge-cell-inspector.tsx'), 'utf8');
  const policySource = fs.readFileSync(path.resolve(process.cwd(), 'utils/merge-world/economy-policy.ts'), 'utf8');
  assert.doesNotMatch(screenSource, /countdownSeconds: energyCountdownSeconds|Next Energy in about|energyStatusRow|generatorUpgradePressable/);
  assert.doesNotMatch(screenSource, /L\{upgradeGenerator\.level\}/);
  assert.match(policySource, /export const MERGE_GENERATORS_UNLIMITED = true/);
  assert.match(inspectorSource, /Unlimited finds ready\./);
});

test('Today action rows use neutral unframed art and reversible swipe actions', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/home/today-nurture-experience.tsx'), 'utf8');
  assert.doesNotMatch(source, /GameIconWell/);
  assert.match(source, /doorIconArt: \{ height: 46, width: 46 \}/);
  assert.match(source, /<GameSurface contentStyle=\{styles\.careDoorContent\} style=\{styles\.careDoor\} tone="cream">/);
  assert.match(source, /activeOffsetX\(\[-CARE_SWIPE_ACTIVATION_DISTANCE, CARE_SWIPE_ACTIVATION_DISTANCE\]\)/);
  assert.match(source, /shouldClose = event\.translationX <= -CARE_SWIPE_CLOSE_DISTANCE \|\| event\.velocityX <= -360/);
});
