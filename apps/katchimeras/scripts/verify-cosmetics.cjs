const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification harness for the cosmetics engine (Phase 4 + Phase C shop).
// Transpile the pure modules with TypeScript and run scenarios.
// Usage: node scripts/verify-cosmetics.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-cosm-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const cosmeticsCatalogPath = transpileToTemp('utils/cosmetics-catalog.ts', 'cosmetics-catalog.js');
const cosmeticsSkinPath = transpileToTemp('utils/cosmetics-skin.ts', 'cosmetics-skin.js');
const stubs = { '@/utils/cosmetics-catalog': cosmeticsCatalogPath, '@/utils/cosmetics-skin': cosmeticsSkinPath };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return originalResolve.call(this, request, ...rest);
};

const engine = require(transpileToTemp('utils/cosmetics-engine.ts', 'cosmetics-engine.js'));
const { resolveSkin } = require(cosmeticsSkinPath);
const { COSMETIC_CATALOG } = require(cosmeticsCatalogPath);
const { DISCOVERY_CATALOG } = require(transpileToTemp('utils/discoveries-catalog.ts', 'discoveries-catalog.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

const state = (selected = {}) => ({ version: 1, selected });
const NONE = new Set();
const REFLECTION = new Set(['first_reflection']);
const discoveryIds = new Set(DISCOVERY_CATALOG.map((d) => d.id));
const def = (id) => COSMETIC_CATALOG.find((c) => c.id === id);

const natural = def('lantern_natural'); // default
const aurora = def('lantern_aurora'); // discoveryUnlock: first_reflection
const ember = def('lantern_ember'); // essencePurchase: 20

// ── catalog integrity ──
const ids = COSMETIC_CATALOG.map((c) => c.id);
check('cosmetic ids are unique', new Set(ids).size === ids.length);
check('lanternColour has a default', COSMETIC_CATALOG.some((c) => c.type === 'lanternColour' && c.isDefault));
check(
  'every unlockDiscoveryId references a real discovery',
  COSMETIC_CATALOG.every((c) => !c.unlockDiscoveryId || discoveryIds.has(c.unlockDiscoveryId)),
  COSMETIC_CATALOG.filter((c) => c.unlockDiscoveryId && !discoveryIds.has(c.unlockDiscoveryId)).map((c) => c.id).join(',')
);
check('purchasable cosmetics declare a positive cost', COSMETIC_CATALOG.filter((c) => c.unlockMethod === 'essencePurchase').every((c) => (c.essenceCost ?? 0) > 0));
check('there are both discovery and purchasable cosmetics', COSMETIC_CATALOG.some((c) => c.unlockDiscoveryId) && COSMETIC_CATALOG.some((c) => c.essenceCost != null));

// ── ownership ──
check('a default is always owned', engine.isCosmeticOwned(natural, NONE, []));
check('a discovery cosmetic is locked without its discovery', !engine.isCosmeticOwned(aurora, NONE, []));
check('a discovery cosmetic is owned with its discovery', engine.isCosmeticOwned(aurora, REFLECTION, []));
check('a purchasable is not owned until bought', !engine.isCosmeticOwned(ember, NONE, []));
check('a purchasable is owned once in the receipt', engine.isCosmeticOwned(ember, NONE, ['lantern_ember']));

// ── affordability + buyable ──
check('canAfford true at exact balance', engine.canAfford(ember, 20));
check('canAfford false below cost', !engine.canAfford(ember, 19));
check('a free default is always affordable', engine.canAfford(natural, 0));
check('isBuyable true for an unbought purchasable', engine.isBuyable(ember, []));
check('isBuyable false once bought', !engine.isBuyable(ember, ['lantern_ember']));
check('isBuyable false for a discovery cosmetic', !engine.isBuyable(aurora, []));

// ── ownedCosmetics ──
check('ownedCosmetics excludes locked/unbought', !engine.ownedCosmetics(NONE, []).some((c) => c.id === 'lantern_aurora' || c.id === 'lantern_ember'));
check('ownedCosmetics grows with a purchase', engine.ownedCosmetics(NONE, ['lantern_ember']).some((c) => c.id === 'lantern_ember'));

// ── selection + fallback ──
check('selectedCosmetic defaults when nothing chosen', engine.selectedCosmetic(state(), 'lanternColour', NONE, [])?.id === 'lantern_natural');
check('selectedCosmetic returns a bought choice', engine.selectedCosmetic(state({ lanternColour: 'lantern_ember' }), 'lanternColour', NONE, ['lantern_ember'])?.id === 'lantern_ember');
check('selectedCosmetic falls back when the choice is not owned', engine.selectedCosmetic(state({ lanternColour: 'lantern_ember' }), 'lanternColour', NONE, [])?.id === 'lantern_natural');
check('selectedCosmetic ignores an unknown id', engine.selectedCosmetic(state({ lanternColour: 'nope' }), 'lanternColour', REFLECTION, [])?.id === 'lantern_natural');

// ── lantern colour value (applied output) ──
check('default lantern colour is natural (undefined)', engine.lanternColourValue(state(), NONE, []) === undefined);
check('bought lantern colour returns its value', engine.lanternColourValue(state({ lanternColour: 'lantern_ember' }), NONE, ['lantern_ember']) === ember.value);
check('discovery lantern colour returns its value when unlocked', engine.lanternColourValue(state({ lanternColour: 'lantern_aurora' }), REFLECTION, []) === aurora.value);
check('unowned selection falls back to natural', engine.lanternColourValue(state({ lanternColour: 'lantern_ember' }), NONE, []) === undefined);

// ── resolveSkin layering (Phase D) ──
check('resolveSkin: seasonal wins', resolveSkin({ seasonal: 's', override: 'o', theme: 't', fallback: 'f' }) === 's');
check('resolveSkin: override beats theme + fallback', resolveSkin({ override: 'o', theme: 't', fallback: 'f' }) === 'o');
check('resolveSkin: theme beats fallback', resolveSkin({ theme: 't', fallback: 'f' }) === 't');
check('resolveSkin: fallback when nothing else', resolveSkin({ fallback: 'f' }) === 'f');
check('resolveSkin: undefined when all empty', resolveSkin({}) === undefined);

// ── world theme → lantern composition ──
const springBloom = def('theme_spring_bloom'); // discoveryUnlock first_reflection
const ocean = def('theme_ocean_breeze'); // essencePurchase
check('activeWorldThemeValue is undefined by default', engine.activeWorldThemeValue(state(), NONE, []) === undefined);
check('a discovery theme applies once unlocked + selected', engine.activeWorldThemeValue(state({ worldTheme: 'theme_spring_bloom' }), REFLECTION, []) === springBloom.value);
check('an unowned theme does not apply', engine.activeWorldThemeValue(state({ worldTheme: 'theme_ocean_breeze' }), NONE, []) === undefined);
check('a bought theme applies', engine.activeWorldThemeValue(state({ worldTheme: 'theme_ocean_breeze' }), NONE, ['theme_ocean_breeze']) === ocean.value);
check('an active theme tints the lantern (no explicit choice)', engine.lanternColourValue(state({ worldTheme: 'theme_spring_bloom' }), REFLECTION, []) === springBloom.value);
check(
  'an explicit lantern choice overrides the theme tint',
  engine.lanternColourValue(state({ worldTheme: 'theme_spring_bloom', lanternColour: 'lantern_aurora' }), REFLECTION, []) === aurora.value
);

console.log(failures === 0 ? '\nAll cosmetics checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
