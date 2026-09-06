const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
// Node-only verification for the world object registry (constants/world-objects.ts):
// proves the declarative unlock specs + label templates reproduce EXACTLY what
// the old kingdom-decor closure rules did. Usage: node scripts/verify-world-objects.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const projectRoot = path.join(__dirname, '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'katchimera-worldobj-'));

function transpileToTemp(relativeSourcePath, outName) {
  const source = readVerificationSource(contentPath(projectRoot, relativeSourcePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const outPath = path.join(tempDir, outName);
  fs.writeFileSync(outPath, output);
  return outPath;
}

const registry = require(transpileToTemp('constants/world-objects.ts', 'world-objects.js'));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

function day(overrides) {
  return {
    id: 'day-x',
    isoDate: '2026-07-04',
    stepsCount: 0,
    notes: [],
    promptAnswers: [],
    confirmedPlaces: [],
    foodMoments: [],
    studioMoments: [],
    bigMoments: [],
    capturedMeanings: [],
    ...overrides,
  };
}

// Mirror of kingdom-decor's grant selection: registry order, max 2 per day.
function firing(testDay, ctx) {
  return registry.SIGNATURE_KEEPSAKES.filter((def) => registry.evaluateDayUnlock(def.unlock, testDay, ctx)).map(
    (def) => def.id
  );
}

// --- Rule parity (old `when` closures) ---------------------------------------
check('steps 9000 fires journey_stone', firing(day({ stepsCount: 9000 })).includes('journey_stone'));
check('steps 7999 does NOT fire journey_stone', !firing(day({ stepsCount: 7999 })).includes('journey_stone'));
check(
  'hike fires journey_stone even at 2000 steps',
  firing(day({ stepsCount: 2000, stepsInterpretation: { movement: 'hike' } })).includes('journey_stone')
);
check('a big moment fires big_moment_blossom', firing(day({ bigMoments: [{ label: 'Birthday' }] })).includes('big_moment_blossom'));
check('a confirmed place fires wayfinder_post', firing(day({ confirmedPlaces: [{ label: 'Blue Bottle' }] })).includes('wayfinder_post'));
check('a food moment fires market_crate', firing(day({ foodMoments: [{ emoji: '🍜', label: 'Ramen' }] })).includes('market_crate'));
check('a studio moment fires study_planter', firing(day({ studioMoments: [{ emoji: '📖', label: 'Dune' }] })).includes('study_planter'));
check(
  '3 answered reflections fire reflection_flowers',
  firing(
    day({
      promptAnswers: [
        { dismissed: false, choiceIds: ['a'] },
        { dismissed: false, choiceIds: ['b'] },
        { dismissed: false, choiceIds: ['c'] },
      ],
    })
  ).includes('reflection_flowers')
);
check(
  '2 reflections + 1 dismissed does NOT fire reflection_flowers',
  !firing(
    day({
      promptAnswers: [
        { dismissed: false, choiceIds: ['a'] },
        { dismissed: false, choiceIds: ['b'] },
        { dismissed: true, choiceIds: ['c'] },
      ],
    })
  ).includes('reflection_flowers')
);
check('2 notes fire keeper_lantern', firing(day({ notes: [{}, {}] })).includes('keeper_lantern'));
check('1 note does NOT fire keeper_lantern', !firing(day({ notes: [{}] })).includes('keeper_lantern'));

// --- Priority order (array order = old DAILY_RULES order) --------------------
const expectedOrder = [
  'big_moment_blossom',
  'journey_stone',
  'wayfinder_post',
  'market_crate',
  'study_planter',
  'reflection_flowers',
  'keeper_lantern',
];
// The ORIGINAL seven must stay a prefix in this exact order (their relative
// grant priority is load-bearing); expansion-wave keepsakes append after them.
check(
  'signature keepsake priority order preserved',
  JSON.stringify(registry.SIGNATURE_KEEPSAKES.slice(0, expectedOrder.length).map((def) => def.id)) ===
    JSON.stringify(expectedOrder),
  registry.SIGNATURE_KEEPSAKES.map((def) => def.id).join(',')
);

// --- Label parity (old `label` closures) --------------------------------------
function label(defId, testDay) {
  const def = registry.SIGNATURE_KEEPSAKES.find((candidate) => candidate.id === defId);
  return registry.formatUnlockLabel(def.labelTemplate, testDay);
}
check(
  'steps label matches old format',
  label('journey_stone', day({ stepsCount: 12500 })) === '12,500 steps in one day',
  label('journey_stone', day({ stepsCount: 12500 }))
);
check('big moment label uses the moment', label('big_moment_blossom', day({ bigMoments: [{ label: 'Birthday' }] })) === 'Birthday');
check('big moment label fallback', label('big_moment_blossom', day({})) === 'A big moment');
check(
  'place label matches old format',
  label('wayfinder_post', day({ confirmedPlaces: [{ label: 'Blue Bottle' }] })) === 'Blue Bottle · a place given meaning'
);
check('place label fallback', label('wayfinder_post', day({})) === 'A place given meaning');
check(
  'food label matches old format',
  label('market_crate', day({ foodMoments: [{ emoji: '🍜', label: 'Ramen' }] })) === '🍜 Ramen · savoured'
);
check('food label fallback', label('market_crate', day({})) === 'A meal savoured');
check(
  'studio label matches old format',
  label('study_planter', day({ studioMoments: [{ emoji: '📖', label: 'Dune' }] })) === '📖 Dune · an inspiration'
);
check('reflection label is static', label('reflection_flowers', day({})) === 'A deeply reflected day');
check('notes label matches old format', label('keeper_lantern', day({ notes: [{}, {}] })) === '2 notes kept in one day');

// --- Asset keys + scales (old rule/table values) -------------------------------
const expectedArt = {
  big_moment_blossom: ['festival_bunting', 1.1],
  journey_stone: ['trail_stone', undefined],
  wayfinder_post: ['decor_13', undefined],
  market_crate: ['picnic_basket', undefined],
  study_planter: ['book_stack', undefined],
  reflection_flowers: ['decor_7', undefined],
  keeper_lantern: ['decor_12', 1.15],
};
for (const [id, [assetKey, sizeScale]] of Object.entries(expectedArt)) {
  const def = registry.SIGNATURE_KEEPSAKES.find((candidate) => candidate.id === id);
  check(`${id} art + scale preserved`, def.art.variants[0] === assetKey && def.art.sizeScale === sizeScale);
}

// --- Bloom commons (order matters — hash picks index into it) ------------------
// The original nine SPECIES stay the ordered prefix (their art keys changed to
// B1 variant families); expansion species append after them. Every variant key
// must be unique across the whole pool.
const expectedCommonsIds = [
  'bloom_pine',
  'bloom_oak',
  'bloom_birch',
  'bloom_blossom',
  'bloom_shrub',
  'bloom_fern',
  'bloom_wildflowers',
  'bloom_mushrooms',
  'bloom_planter',
];
check(
  'bloom commons order preserved',
  JSON.stringify(registry.BLOOM_COMMONS.slice(0, expectedCommonsIds.length).map((def) => def.id)) ===
    JSON.stringify(expectedCommonsIds),
  registry.BLOOM_COMMONS.map((def) => def.id).join(',')
);
const allVariantKeys = registry.BLOOM_COMMONS.flatMap((def) => def.art.variants);
check('bloom variant keys unique', new Set(allVariantKeys).size === allVariantKeys.length);
check(
  'every bloom species has at least 3 variants or is the bespoke birch',
  registry.BLOOM_COMMONS.every((def) => def.art.variants.length >= 3 || def.id === 'bloom_birch')
);

// --- Discovery tiers (old TIER_FALLBACK) ---------------------------------------
const tiers = registry.DISCOVERY_TIER_KEEPSAKES;
check('common tier = pooled discovery saplings', tiers.common.art.variants.includes('decor_4') && tiers.common.art.variants.length > 4 && tiers.common.name === 'Discovery Sapling');
check('rare tier = lantern 1.15', tiers.rare.art.variants[0] === 'decor_12' && tiers.rare.art.sizeScale === 1.15);
check('epic tier = monument_stone 1.15', tiers.epic.art.variants[0] === 'monument_stone' && tiers.epic.art.sizeScale === 1.15);
check('legendary tier = monument_shard 1.3', tiers.legendary.art.variants[0] === 'monument_shard' && tiers.legendary.art.sizeScale === 1.3);

// --- Variant picking determinism ------------------------------------------------
const sapling = { ...tiers.common, art: { ...tiers.common.art, variants: ['a', 'b', 'c', 'd'] } };
const pickOnce = registry.pickVariant(sapling, 'disc:museum-1');
check('random pick is deterministic per seed', pickOnce === registry.pickVariant(sapling, 'disc:museum-1'));
check('single-variant pick is the variant', registry.pickVariant(tiers.common, 'anything') === 'decor_4');
check(
  'hashSeed matches the old kingdom-decor hashString algorithm',
  registry.hashSeed('day-1:0') === (() => { let h = 0; const s = 'day-1:0'; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); })()
);

// --- Expansion wave 1: new spec kinds + the lifetime lane ----------------------
check('goodSleep fires dream_bell', firing(day({ sleep: { quality: 'good', source: 'manual' } })).includes('dream_bell'));
check('normal sleep does NOT fire dream_bell', !firing(day({ sleep: { quality: 'normal', source: 'manual' } })).includes('dream_bell'));
check('voice note fires echo_shell', firing(day({ notes: [{ kind: 'voice' }] })).includes('echo_shell'));
check('text note does NOT fire echo_shell', !firing(day({ notes: [{ kind: 'text' }] })).includes('echo_shell'));
check(
  'placeCategory park matches',
  registry.evaluateDayUnlock({ kind: 'placeCategory', category: 'park' }, day({ confirmedPlaces: [{ category: 'park' }] }))
);
check(
  'bigMomentType birthday matches',
  registry.evaluateDayUnlock({ kind: 'bigMomentType', type: 'birthday' }, day({ bigMoments: [{ type: 'birthday' }] }))
);
check('calendar leapDay matches 02-29', registry.evaluateDayUnlock({ kind: 'calendar', window: 'leapDay' }, day({ isoDate: '2028-02-29' })));
check('calendar newYear matches 12-31', registry.evaluateDayUnlock({ kind: 'calendar', window: 'newYear' }, day({ isoDate: '2026-12-31' })));
check('lifetime kinds never fire in the day lane', !registry.evaluateDayUnlock({ kind: 'tenure', daysLived: 1 }, day({})));

function isoRun(startIso, count, overrides) {
  const out = [];
  const date = new Date(`${startIso}T00:00:00`);
  for (let i = 0; i < count; i += 1) {
    const iso = date.toISOString().slice(0, 10);
    out.push(day({ id: iso, isoDate: iso, ...overrides }));
    date.setDate(date.getDate() + 1);
  }
  return out;
}
const noted31 = isoRun('2026-01-01', 31, { notes: [{ kind: 'text' }] });
check('tenure 30 over 31 days', registry.evaluateLifetimeUnlock({ kind: 'tenure', daysLived: 30 }, noted31));
check(
  'streak 30 over 31 consecutive noted days',
  registry.evaluateLifetimeUnlock({ kind: 'streak', of: { kind: 'metric', metric: 'notes', gte: 1 }, days: 30 }, noted31)
);
const gapped = [...isoRun('2026-01-01', 15, { notes: [{ kind: 'text' }] }), ...isoRun('2026-01-20', 15, { notes: [{ kind: 'text' }] })];
check(
  'streak 30 REJECTS a gapped 30 days',
  !registry.evaluateLifetimeUnlock({ kind: 'streak', of: { kind: 'metric', metric: 'notes', gte: 1 }, days: 30 }, gapped)
);
check(
  'lifetimeCount 10 hikes',
  registry.evaluateLifetimeUnlock(
    { kind: 'lifetimeCount', of: { kind: 'event', event: 'hike' }, gte: 10 },
    isoRun('2026-01-01', 10, { stepsInterpretation: { movement: 'hike' } })
  )
);
check('MILESTONE_KEEPSAKES all have unlocks + rarity', registry.MILESTONE_KEEPSAKES.every((def) => def.unlock && def.rarity));

// Geo lane: distanceFromHome resolves through the injected eval context.
const farCtx = { distanceFromHomeKm: () => 620 };
check('distanceFromHome 500 fires with ctx', registry.evaluateDayUnlock({ kind: 'distanceFromHome', gteKm: 500 }, day({}), farCtx));
check('distanceFromHome 3000 does NOT fire at 620km', !registry.evaluateDayUnlock({ kind: 'distanceFromHome', gteKm: 3000 }, day({}), farCtx));
check('distanceFromHome without ctx never fires', !registry.evaluateDayUnlock({ kind: 'distanceFromHome', gteKm: 1 }, day({})));
check('milepost_50 fires via signature lane with ctx', firing(day({}), farCtx).includes('milepost_50'));
check(
  'newPlaces lifetimeCount 25',
  registry.evaluateLifetimeUnlock(
    { kind: 'lifetimeCount', of: { kind: 'metric', metric: 'newPlaces', gte: 1 }, gte: 25 },
    isoRun('2026-01-01', 25, { newPlaceCount: 2 })
  )
);

// Photo-subject lane: photoLabel reads the day's persisted Vision concepts.
const sunsetDay = day({ vision: { concepts: [{ name: 'sunset', salience: 0.8, coverage: 0.5, count: 2, peakConfidence: 0.9 }] } });
check('photoLabel sunset matches', registry.evaluateDayUnlock({ kind: 'photoLabel', label: 'sunset' }, sunsetDay));
check('photoLabel snow does NOT match a sunset day', !registry.evaluateDayUnlock({ kind: 'photoLabel', label: 'snow' }, sunsetDay));
check('photoLabel without vision read never fires', !registry.evaluateDayUnlock({ kind: 'photoLabel', label: 'sunset' }, day({})));
check(
  'pet pedestal any-of dog/cat',
  registry.evaluateDayUnlock(
    { kind: 'any', of: [{ kind: 'photoLabel', label: 'dog' }, { kind: 'photoLabel', label: 'cat' }] },
    day({ vision: { concepts: [{ name: 'cat', salience: 0.5, coverage: 0.2, count: 1, peakConfidence: 0.8 }] } })
  )
);

// Studio media types + photo metrics (B5/B9 wave).
check(
  'studioMediaType book matches',
  registry.evaluateDayUnlock({ kind: 'studioMediaType', mediaType: 'book' }, day({ studioMoments: [{ mediaType: 'book' }] }))
);
check(
  'studioMediaType film does NOT match a book day',
  !registry.evaluateDayUnlock({ kind: 'studioMediaType', mediaType: 'film' }, day({ studioMoments: [{ mediaType: 'book' }] }))
);
check(
  'photosKept counts meanings + hero',
  registry.dayMetric(day({ capturedMeanings: [{}, {}], heroPhoto: { uri: 'x' } }), 'photosKept') === 3
);
check(
  'photoFaces reads vision maxFaceCount',
  registry.dayMetric(day({ vision: { concepts: [], maxFaceCount: 4 } }), 'photoFaces') === 4
);

// --- Grove merge helpers -----------------------------------------------------
check('grove merge fuses three', registry.GROVE_MERGE_COUNT === 3);
check(
  'every bloom species has a grove upgrade with grove_ art',
  registry.BLOOM_COMMONS.every((species) => {
    const grove = registry.groveForSpecies(species.id);
    return grove && grove.assetKey === `grove_${species.id.replace(/^bloom_/, '')}` && grove.name.endsWith(' Grove');
  })
);
check(
  'bloomSpeciesForAssetKey round-trips every variant',
  registry.BLOOM_COMMONS.every((species) =>
    species.art.variants.every((key) => registry.bloomSpeciesForAssetKey(key) === species.id)
  )
);
check('bloomSpeciesForAssetKey ignores non-bloom art', registry.bloomSpeciesForAssetKey('harmony_wreath') === null);
check('groveForSpecies rejects unknown species', registry.groveForSpecies('bloom_nonexistent') === null);

// B11 heroes: the four registry-wired monuments carry their bespoke art.
check(
  'B11 hero art wired (century/year/meridian/leap)',
  ['century_pillar', 'year_monument', 'meridian_globe', 'leap_clock'].every((id) => {
    const def = registry.MILESTONE_KEEPSAKES.find((entry) => entry.id === id);
    return def && def.art.variants[0] === id;
  })
);
check(
  'harmony_prism lifetime earn: 7 full days',
  (() => {
    const def = registry.MILESTONE_KEEPSAKES.find((entry) => entry.id === 'harmony_prism');
    if (!def || def.unlock.kind !== 'lifetimeCount' || def.unlock.gte !== 7) return false;
    const fullDay = day({
      promptAnswers: [{ dismissed: false, choiceIds: ['calm'] }],
      notes: [{ kind: 'text' }],
      foodMoments: [{}],
      sleep: { quality: 'good' },
    });
    return registry.evaluateDayUnlock(def.unlock.of, fullDay) === true;
  })()
);

// --- Food lane (B7) ----------------------------------------------------------
check(
  'cuisine spec matches a tagged meal, any family',
  registry.evaluateDayUnlock({ kind: 'cuisine' }, day({ foodMoments: [{ label: 'Meal', cuisine: 'italian' }] }))
);
check(
  'cuisine spec with family filters',
  registry.evaluateDayUnlock({ kind: 'cuisine', family: 'greek' }, day({ foodMoments: [{ label: 'Meal', cuisine: 'greek' }] })) &&
    !registry.evaluateDayUnlock({ kind: 'cuisine', family: 'greek' }, day({ foodMoments: [{ label: 'Meal', cuisine: 'italian' }] }))
);
check(
  'untagged meals never fire cuisine',
  !registry.evaluateDayUnlock({ kind: 'cuisine' }, day({ foodMoments: [{ label: 'Meal' }] }))
);
check(
  'subjectsForSpec dedups families',
  (() => {
    const subjects = registry.subjectsForSpec(
      { kind: 'cuisine' },
      day({ foodMoments: [{ label: 'Meal', cuisine: 'indian' }, { label: 'Meal', cuisine: 'indian' }, { label: 'Meal', cuisine: 'french' }] })
    );
    return subjects.length === 2 && subjects.includes('indian') && subjects.includes('french');
  })()
);
check(
  'desserts metric counts Dessert foods',
  registry.dayMetric(day({ foodMoments: [{ label: 'Dessert' }, { label: 'Meal' }, { label: 'Dessert' }] }), 'desserts') === 2
);
check(
  'homeCookedMeals metric counts the tag',
  registry.dayMetric(day({ foodMoments: [{ label: 'Meal', homeCooked: true }, { label: 'Meal' }] }), 'homeCookedMeals') === 1
);
check(
  'cuisine_lantern: perSubject, one variant per family in canonical order',
  (() => {
    const def = registry.MILESTONE_KEEPSAKES.find((entry) => entry.id === 'cuisine_lantern');
    if (!def || def.repeat !== 'perSubject' || def.unlock.kind !== 'cuisine') return false;
    return (
      def.art.variants.length === registry.CUISINE_FAMILIES.length &&
      registry.CUISINE_FAMILIES.every((family, index) => def.art.variants[index] === `cuisine_lantern_${family}`)
    );
  })()
);

// Every placeCategory the registry earns from must exist as a picker chip —
// otherwise the rule is DEAD (the wonder_miniature lesson).
check(
  'every placeCategory spec has a picker chip',
  (() => {
    const sheetSource = readVerificationSource(
      contentPath(projectRoot, 'components', 'katchadeck', 'world', 'place-prompt-sheet.tsx'),
      'utf8'
    );
    const pickerIds = new Set([...sheetSource.matchAll(/\{ id: '([a-z_]+)', emoji:/g)].map((match) => match[1]));
    const specCategories = new Set();
    const walk = (spec) => {
      if (!spec) return;
      if (spec.kind === 'placeCategory') specCategories.add(spec.category);
      if (spec.of) (Array.isArray(spec.of) ? spec.of : [spec.of]).forEach(walk);
    };
    for (const def of [...registry.SIGNATURE_KEEPSAKES, ...registry.MILESTONE_KEEPSAKES]) walk(def.unlock);
    const missing = [...specCategories].filter((category) => !pickerIds.has(category));
    if (missing.length > 0) console.log('      missing picker chips:', missing.join(', '));
    return missing.length === 0;
  })()
);

// Same guard for Big Moment types: every bigMomentType spec needs a picker option.
check(
  'every bigMomentType spec has a picker option',
  (() => {
    const sheetSource = readVerificationSource(
      contentPath(projectRoot, 'components', 'katchadeck', 'world', 'big-moment-picker-sheet.tsx'),
      'utf8'
    );
    const pickerTypes = new Set([...sheetSource.matchAll(/\{ type: '(\w+)', emoji:/g)].map((match) => match[1]));
    const specTypes = new Set();
    const walk = (spec) => {
      if (!spec) return;
      if (spec.kind === 'bigMomentType') specTypes.add(spec.type);
      if (spec.of) (Array.isArray(spec.of) ? spec.of : [spec.of]).forEach(walk);
    };
    for (const def of [...registry.SIGNATURE_KEEPSAKES, ...registry.MILESTONE_KEEPSAKES]) walk(def.unlock);
    const missing = [...specTypes].filter((type) => !pickerTypes.has(type));
    if (missing.length > 0) console.log('      missing picker options:', missing.join(', '));
    return missing.length === 0;
  })()
);
check(
  'life-event earns wired (baby/wedding/graduation/newHome/newJob/reunion)',
  ['stork_lantern', 'vow_arbor', 'laurel_scroll', 'housewarming_wreath', 'desk_bell', 'reunion_table'].every((id) => {
    const def = registry.MILESTONE_KEEPSAKES.find((entry) => entry.id === id);
    return def && def.unlock.kind === 'bigMomentType' && def.art.variants[0] === id;
  })
);

// --- describeUnlockSpec (the Asset Lab "How it's earned" copy) ---------------
check(
  'describeUnlockSpec renders thresholds',
  registry.describeUnlockSpec({ kind: 'metric', metric: 'steps', gte: 8000 }) === '8,000+ steps in one day'
);
check(
  'describeUnlockSpec renders streaks recursively',
  registry.describeUnlockSpec({ kind: 'streak', of: { kind: 'metric', metric: 'homeCookedMeals', gte: 1 }, days: 7 }) ===
    '7 consecutive days of: home-cooked meals'
);
check(
  'describeUnlockSpec renders composites',
  registry
    .describeUnlockSpec({
      kind: 'all',
      of: [{ kind: 'placeCategory', category: 'market' }, { kind: 'metric', metric: 'foodMoments', gte: 1 }],
    })
    .includes(' — AND — ')
);
check(
  'describeUnlockSpec covers every live definition without throwing',
  [...registry.SIGNATURE_KEEPSAKES, ...registry.MILESTONE_KEEPSAKES].every((def) => {
    if (!def.unlock) return true;
    try {
      return registry.describeUnlockSpec(def.unlock).length > 0;
    } catch {
      console.log('      threw for', def.id);
      return false;
    }
  })
);

console.log(failures === 0 ? '\nAll world-object checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
