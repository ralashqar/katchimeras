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
  assert.equal(second[0].placement, 'bottom');
});

test('feedback receipts retain an explicit middle placement', () => {
  const queue = enqueueGameFeedback([], { message: 'Remembered', placement: 'middle' }, 'memory');
  assert.equal(queue[0].placement, 'middle');
});

test('toast presentation can be disabled globally without removing feedback callers', () => {
  const constants = fs.readFileSync(path.resolve(process.cwd(), 'constants/game-ui.ts'), 'utf8');
  const toast = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/ui/katcha-toast.tsx'), 'utf8');
  const provider = fs.readFileSync(path.resolve(process.cwd(), 'features/ui/game-feedback-provider.tsx'), 'utf8');
  assert.match(constants, /export const TOAST_MESSAGES_ENABLED = false/);
  assert.match(toast, /if \(!TOAST_MESSAGES_ENABLED \|\| !message\) return null/);
  assert.match(provider, /show = useCallback[\s\S]*?if \(!TOAST_MESSAGES_ENABLED\) return/);
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
  assert.match(source, /<DayActionCardSurface/);
  assert.match(source, /<DayActionSwipeShell/);
});

test('Katchimera pages share a centered toy-like Bond header with coins at the right', () => {
  const header = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/katchimera-page-header.tsx'), 'utf8');
  const cards = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-cards-screen.tsx'), 'utf8');
  const trophies = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-trophy-room-screen.tsx'), 'utf8');
  const layout = fs.readFileSync(path.resolve(process.cwd(), 'app/_layout.tsx'), 'utf8');
  assert.match(header, /useWindowDimensions\(\)/);
  assert.match(header, /styles\.bondMedallion/);
  assert.match(header, /ref=\{bondIconTargetRef\}/);
  assert.match(header, /medallionPulseStyle/);
  assert.match(header, /medallionGlowStyle/);
  assert.doesNotMatch(header, />Bond<\/ThemedText>/);
  assert.match(header, /backgroundColor: '#F14D7B'/);
  assert.match(header, /position: 'absolute',[\s\S]*?width: 180/);
  assert.match(header, /bondProgress\.totalPoints\}\/\{relationshipTarget/);
  assert.match(header, /height: 13/);
  assert.match(header, /trackValue: \{ \.\.\.GameUI\.type\.numeric, fontFamily: GameUI\.type\.title\.fontFamily, fontSize: 9\.5/);
  assert.match(header, /useGameWallet\(\)/);
  assert.match(header, /<GameCurrencyHud[\s\S]*?GAME_CURRENCY_ART\.coins[\s\S]*?id: 'coins'/);
  assert.doesNotMatch(header, /<GameCurrencyHud[\s\S]{0,220}?\bcompact\b/);
  assert.doesNotMatch(header, /currencyHud: \{[^}]*paddingLeft/);
  assert.doesNotMatch(header, /HeaderAction|onOpenCards|onOpenTrophies/);
  assert.match(cards, /<KatchimeraPageHeader/);
  assert.match(trophies, /<KatchimeraPageHeader/);
  assert.doesNotMatch(cards, /onOpenTrophies/);
  assert.doesNotMatch(trophies, /onOpenCards/);
  assert.match(layout, /katchimera\/\[creatureId\]\/cards/);
});

test('Mossprout collection buttons live in the bottom dock and swap embedded content', () => {
  const sheet = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-interaction-sheet.tsx'), 'utf8');
  const stage = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/mossprout-story-stage.tsx'), 'utf8');
  const dock = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/katchimera-bottom-dock.tsx'), 'utf8');
  const navArt = fs.readFileSync(path.resolve(process.cwd(), 'constants/katchimera-nav-art.ts'), 'utf8');
  assert.match(sheet, /onOpenCards=\{\(\) => selectDestination\('skins'\)\}/);
  assert.match(sheet, /onOpenTrophies=\{\(\) => selectDestination\('achievements'\)\}/);
  assert.match(stage, /id: 'garden', label: 'Garden'[\s\S]*?id: 'discoveries', label: 'Discoveries'[\s\S]*?id: 'skins', label: 'Skins'[\s\S]*?id: 'trophies', label: 'Trophies'/);
  assert.doesNotMatch(stage, /label: 'Journey'/);
  assert.match(dock, /featuredId/);
  assert.match(dock, /icon: \{ height: 40, width: 40 \}/);
  assert.match(dock, /fontSize: 12/);
  ['garden', 'discoveries', 'skins', 'trophies'].forEach((id) => assert.match(navArt, new RegExp(`${id}: require`)));
  assert.match(navArt, /navigation\/mossprout\/garden\.webp/);
  ['discoveries', 'skins', 'trophies'].forEach((id) => {
    assert.match(navArt, new RegExp(`navigation/shared/${id}\\.webp`));
  });
  assert.match(sheet, /destination === 'achievements'[\s\S]*?<LazyCompanionTrophyRoomScreen creatureId=\{props\.creatureId\} embedded/);
  assert.match(sheet, /destination === 'skins'[\s\S]*?<CompanionSkinsThread/);
});

test('Mossprout Journey status uses the shared compact plaque without joining action layout animation', () => {
  const sheet = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-interaction-sheet.tsx'), 'utf8');
  const stage = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/mossprout-story-stage.tsx'), 'utf8');
  const milestone = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/katchimera-journey-status-plaque.tsx'), 'utf8');
  const celebration = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-bond-level-up-celebration.tsx'), 'utf8');
  const streakTitle = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/streak/streak-hero-title.tsx'), 'utf8');
  const heroNumber = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/ui/celebration-hero-number.tsx'), 'utf8');
  assert.match(stage, /journey && !storyComplete[\s\S]*?<KatchimeraJourneyStatusPlaque/);
  assert.match(stage, /status=\{journey\.status === 'complete' \? 'complete' : 'in_progress'\}/);
  assert.match(milestone, /position: 'absolute'/);
  assert.match(milestone, /Journey Day \{dayNumber\}/);
  assert.match(milestone, /complete \? 'Complete' : 'In progress'/);
  assert.match(milestone, /complete \? 'checkmark' : 'circle\.fill'/);
  assert.doesNotMatch(milestone, /FIRST JOURNEY DAY|tomorrow/);
  assert.match(milestone, /minHeight: 50/);
  assert.match(milestone, /useReducedMotion\(\)/);
  assert.match(sheet, /showNameplate=\{route\.kind === 'dashboard' && props\.familyId !== 'mossprout'\}/);
  assert.doesNotMatch(sheet, /mossproutJourneyDayStatus|mossproutNameplate/);
  assert.match(celebration, /styles\.journeyEyebrowChip[\s\S]*?<CelebrationHeroNumber[\s\S]*?label="JOURNEY DAY"/);
  assert.doesNotMatch(celebration, /journeyStageNode|COMPANION_RELATIONSHIP_STAGES/);
  assert.match(streakTitle, /<CelebrationHeroNumber[\s\S]*?label="DAY STREAK"/);
  assert.match(heroNumber, /withRepeat[\s\S]*?1_450[\s\S]*?AppFontFamilies\.fredokaBold/);
});

test('narrative modes use only the shared Katchimera header', () => {
  const conversation = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-conversation-scene.tsx'), 'utf8');
  const questionnaire = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-questionnaire-scene.tsx'), 'utf8');
  assert.match(conversation, /<KatchimeraPageHeader[\s\S]*?onBack=\{onClose\}/);
  assert.doesNotMatch(conversation, /preservesFtueHeader|Open companion story dashboard|headerVisual/);
  assert.match(questionnaire, /conversationPresentation \? <KatchimeraPageHeader/);
  assert.doesNotMatch(questionnaire, /conversationHeader|modernHeaderCopy|Open companion story dashboard/);
});

test('the companion-stage ground shadow is wider without becoming taller', () => {
  const shadow = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/creature-ground-shadow.tsx'), 'utf8');
  const stage = fs.readFileSync(path.resolve(process.cwd(), 'components/katchadeck/world/companion-home-environment-stage.tsx'), 'utf8');
  assert.match(shadow, /widthMultiplier = 1/);
  assert.match(shadow, /const width = layout\.width \* widthMultiplier/);
  assert.match(shadow, /left: layout\.left - \(width - layout\.width\) \/ 2/);
  assert.match(stage, /<CreatureGroundShadow[\s\S]*?stage="grown"[\s\S]*?widthMultiplier=\{1\.65\}/);
});
