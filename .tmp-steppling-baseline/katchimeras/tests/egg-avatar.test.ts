import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  EGG_AVATAR_BODY_CATALOG_IDS,
  EGG_AVATAR_FACE_CATALOG_IDS,
  EGG_AVATAR_FACE_IDS,
  EGG_AVATAR_HAT_CATALOG_IDS,
  EGG_AVATAR_HAT_IDS,
  EGG_AVATAR_HELD_ACCESSORY_IDS,
  EGG_AVATAR_HELD_CATALOG_IDS,
  EGG_AVATAR_SKIN_IDS,
} from '../types/egg-avatar';
import {
  allEggAvatarItems,
  availableEggAvatarItems,
  resolveEggAvatarAccess,
} from '../constants/egg-avatar-catalog';
import { EGG_AVATAR_FACE_LAYOUT } from '../constants/egg-avatar-face-layout';
import { EGG_AVATAR_ACCESSORY_LAYOUT } from '../constants/egg-avatar-accessory-layout';
import {
  DEFAULT_EGG_AVATAR_SELECTION,
  isEggAvatarSkinId,
  normalizeEggAvatarSelection,
} from '../utils/egg-avatar-rules';
import { eggAvatarCustomizerCamera } from '../utils/egg-avatar-customizer-camera';

const root = path.resolve(import.meta.dirname, '..');

test('egg avatar selection accepts only the versioned launch catalog', () => {
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'moss' }), {
    version: 3,
    equippedSkinId: 'moss',
    equippedFaceId: 'classic-smile',
    equippedHatId: 'moss-sprout',
    equippedHeldAccessoryId: null,
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 1, equippedSkinId: 'missing' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'moss', equippedFaceId: 'classic-smile' }), {
    version: 3,
    equippedSkinId: 'moss',
    equippedFaceId: 'classic-smile',
    equippedHatId: 'moss-sprout',
    equippedHeldAccessoryId: null,
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'pumpkin', equippedFaceId: 'curious' }), {
    version: 3,
    equippedSkinId: 'pumpkin',
    equippedFaceId: 'curious',
    equippedHatId: 'pumpkin-vine-crown',
    equippedHeldAccessoryId: null,
  });
  assert.deepEqual(normalizeEggAvatarSelection({
    version: 3,
    equippedSkinId: 'classic',
    equippedFaceId: 'sleepy',
    equippedHatId: 'cozy-beanie',
    equippedHeldAccessoryId: 'warm-lantern',
  }), {
    version: 3,
    equippedSkinId: 'classic',
    equippedFaceId: 'sleepy',
    equippedHatId: 'cozy-beanie',
    equippedHeldAccessoryId: 'warm-lantern',
  });
  assert.deepEqual(normalizeEggAvatarSelection({
    version: 3,
    equippedSkinId: 'classic',
    equippedFaceId: 'sleepy',
    equippedHatId: 'missing',
    equippedHeldAccessoryId: 'missing',
  }), {
    version: 3,
    equippedSkinId: 'classic',
    equippedFaceId: 'sleepy',
    equippedHatId: null,
    equippedHeldAccessoryId: null,
  });
  assert.deepEqual(normalizeEggAvatarSelection({ version: 2, equippedSkinId: 'moss', equippedFaceId: 'missing' }), DEFAULT_EGG_AVATAR_SELECTION);
  assert.deepEqual(normalizeEggAvatarSelection(null), DEFAULT_EGG_AVATAR_SELECTION);
  assert.equal(isEggAvatarSkinId('barista'), true);
  assert.equal(isEggAvatarSkinId('robot'), true);
  assert.equal(isEggAvatarSkinId('pumpkin'), true);
  assert.equal(isEggAvatarSkinId('lattelet'), false);
});

test('onboarding restarts reset every equipped Egg avatar layer through shared storage', () => {
  const storage = readFileSync(path.join(root, 'utils', 'egg-avatar-storage.ts'), 'utf8');
  const provider = readFileSync(path.join(root, 'features', 'egg-avatar', 'egg-avatar-provider.tsx'), 'utf8');
  const onboarding = readFileSync(path.join(root, 'utils', 'onboarding-state.ts'), 'utf8');
  const firstSession = readFileSync(path.join(root, 'features', 'onboarding', 'first-session.ts'), 'utf8');

  assert.match(storage, /resetEggAvatarSelection[\s\S]*?DEFAULT_EGG_AVATAR_SELECTION/);
  assert.match(storage, /removeStoredValue\(VERSION_TWO_EGG_AVATAR_STORAGE_KEY\)[\s\S]*?removeStoredValue\(LEGACY_EGG_AVATAR_STORAGE_KEY\)/);
  assert.match(storage, /saveEggAvatarSelection\(selection\)[\s\S]*?return selection/);
  assert.match(provider, /subscribeEggAvatarSelection\(\(\) => setState\(loadEggAvatarSelection\(\)\)\)/);
  assert.match(onboarding, /resetOnboardingProfile\(\)[\s\S]*?resetEggAvatarSelection\(\)/);
  assert.match(firstSession, /if \(options\.restart\) resetEggAvatarSelection\(\)/);
});

test('ready catalog has stable unique ids and Classic is first', () => {
  assert.ok(EGG_AVATAR_SKIN_IDS.length >= 10);
  assert.equal(new Set(EGG_AVATAR_SKIN_IDS).size, EGG_AVATAR_SKIN_IDS.length);
  assert.equal(EGG_AVATAR_SKIN_IDS[0], 'classic');
  assert.ok(EGG_AVATAR_FACE_IDS.length >= 5);
  assert.equal(new Set(EGG_AVATAR_FACE_IDS).size, EGG_AVATAR_FACE_IDS.length);
  assert.equal(EGG_AVATAR_FACE_IDS[0], 'classic-smile');
  assert.ok(EGG_AVATAR_HAT_IDS.length >= 6);
  assert.equal(new Set(EGG_AVATAR_HAT_IDS).size, EGG_AVATAR_HAT_IDS.length);
  assert.ok(EGG_AVATAR_HELD_ACCESSORY_IDS.length >= 6);
  assert.equal(new Set(EGG_AVATAR_HELD_ACCESSORY_IDS).size, EGG_AVATAR_HELD_ACCESSORY_IDS.length);
});

test('hero-resolution avatar art has a distinct high-resolution source', () => {
  const generatedAssets = readFileSync(
    path.join(root, 'constants', 'egg-avatar-assets.generated.ts'),
    'utf8',
  );
  assert.match(generatedAssets, /fullSource: require\('\.\.\/assets\/images\/katchimeras\/egg-avatars\/bases\/classic\.webp'\),/);
  assert.match(generatedAssets, /highSource: require\('\.\.\/assets\/images\/katchimeras\/egg-avatars\/bases\/high\/classic\.webp'\),/);
  assert.match(generatedAssets, /highSource: require\('\.\.\/assets\/images\/katchimeras\/egg-avatars\/faces\/high\/classic-smile\.webp'\),/);
  assert.doesNotMatch(generatedAssets, /require\([^\n]+\.png'\)/, 'runtime avatar registry must not import source PNGs');

  for (const category of ['body', 'face', 'hat', 'held'] as const) {
    for (const item of availableEggAvatarItems(category)) {
      const sourcePath = path.join(root, item.assetRefs!.high);
      const sourcePng = readFileSync(sourcePath);
      assert.equal(sourcePng.subarray(1, 4).toString('ascii'), 'PNG', `${item.id} source master must be PNG`);
      assert.ok(sourcePng.readUInt32BE(16) >= 2048, `${item.id} source master width`);
      assert.ok(sourcePng.readUInt32BE(20) >= 2048, `${item.id} source master height`);

      const runtimeHighPath = sourcePath.replace(/([\\/])([^\\/]+)\.png$/, '$1high$1$2.webp');
      const runtimeWebp = readFileSync(runtimeHighPath);
      assert.equal(runtimeWebp.subarray(0, 4).toString('ascii'), 'RIFF', `${item.id} runtime high RIFF header`);
      assert.equal(runtimeWebp.subarray(8, 12).toString('ascii'), 'WEBP', `${item.id} runtime high WebP header`);
    }
  }
});

test('the complete avatar roadmap is data driven while artless entries stay unavailable', () => {
  const expectedCounts = { body: 50, face: 30, hat: 40, held: 20 } as const;
  const expectedReadyCounts = {
    body: EGG_AVATAR_SKIN_IDS.length,
    face: EGG_AVATAR_FACE_IDS.length,
    hat: EGG_AVATAR_HAT_IDS.length,
    held: EGG_AVATAR_HELD_ACCESSORY_IDS.length,
  } as const;
  const generatedCatalogIds = [
    ...EGG_AVATAR_BODY_CATALOG_IDS,
    ...EGG_AVATAR_FACE_CATALOG_IDS,
    ...EGG_AVATAR_HAT_CATALOG_IDS,
    ...EGG_AVATAR_HELD_CATALOG_IDS,
  ];

  assert.equal(new Set(generatedCatalogIds).size, generatedCatalogIds.length, 'catalog ids are globally unique');

  for (const category of ['body', 'face', 'hat', 'held'] as const) {
    const all = allEggAvatarItems(category);
    const ready = availableEggAvatarItems(category);
    const planned = all.filter((item) => item.availability === 'planned');

    assert.equal(all.length, expectedCounts[category], `${category} roadmap count`);
    assert.equal(ready.length, expectedReadyCounts[category], `${category} ready count`);
    assert.ok(ready.every((item) => item.assetRefs !== null), `${category} ready art references`);
    assert.ok(planned.every((item) => item.assetRefs === null), `${category} planned entries have no pretend art`);
    assert.ok(planned.every((item) => !ready.some((readyItem) => readyItem.id === item.id)), `${category} planned entries are hidden`);
  }
  for (const promotedId of ['honeycomb', 'strawberry-cream', 'blueberry-swirl', 'matcha-marble']) {
    assert.ok(EGG_AVATAR_SKIN_IDS.includes(promotedId as (typeof EGG_AVATAR_SKIN_IDS)[number]), `${promotedId} is runtime-ready`);
  }
  for (const costumeId of [
    'wizard-robes',
    'football-kit',
    'sunny-raincoat',
    'knight-tunic',
    'astronaut-suit',
    'explorer-vest',
    'royal-robe',
    'party-outfit',
    'sailor-uniform',
    'chef-apron',
    'superhero-suit',
    'cozy-pajamas',
    'garden-overalls',
    'detective-coat',
    'pirate-coat',
    'ballet-wrap',
    'racing-suit',
    'artist-smock',
  ]) {
    const costume = allEggAvatarItems('body').find((item) => item.id === costumeId);
    assert.ok(costume, `${costumeId} is catalogued`);
    assert.equal(costume.availability, 'ready', `${costumeId} is promoted after generation`);
    assert.ok(costume.assetRefs, `${costumeId} has production art`);
  }
});

test('avatar access metadata resolves free, premium, and Essence ownership explicitly', () => {
  const noEntitlements = { isPremium: false, purchasedIds: new Set<string>() };

  assert.deepEqual(resolveEggAvatarAccess({ mode: 'free', essencePrice: null }, 'classic', noEntitlements), {
    owned: true,
    reason: 'free',
  });
  assert.deepEqual(resolveEggAvatarAccess({ mode: 'premium', essencePrice: null }, 'kintsugi', noEntitlements), {
    owned: false,
    reason: 'locked-premium',
  });
  assert.deepEqual(resolveEggAvatarAccess({ mode: 'premium', essencePrice: null }, 'kintsugi', {
    ...noEntitlements,
    isPremium: true,
  }), { owned: true, reason: 'premium' });
  assert.deepEqual(resolveEggAvatarAccess({ mode: 'essence', essencePrice: 60 }, 'matcha-marble', noEntitlements), {
    owned: false,
    reason: 'locked-essence',
  });
  assert.deepEqual(resolveEggAvatarAccess({ mode: 'essence', essencePrice: 60 }, 'matcha-marble', {
    ...noEntitlements,
    purchasedIds: new Set(['matcha-marble']),
  }), { owned: true, reason: 'essence-purchase' });
});

test('every launch skin has approved production assets and manifest provenance', () => {
  const assetRoot = path.join(root, 'assets', 'images', 'katchimeras', 'egg-avatars');
  const manifest = JSON.parse(readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8')) as {
    artDirectionVersion?: number;
    effects?: Record<string, unknown>;
    faceLayout?: typeof EGG_AVATAR_FACE_LAYOUT;
    faces?: Record<string, {
      faceLayoutVersion?: number;
      pipelineVersion?: string;
      generationModel?: string;
      generationQuality?: string;
      mattingSettings?: {
        model?: string;
        enclosedAlphaHoleRepair?: boolean;
        chromaEdgeDespill?: string;
        exteriorEdgeSource?: string;
      };
    }>;
    skins?: Record<string, {
      version?: number;
      faceLayoutVersion?: number;
      baseOutputs?: unknown;
      generationModel?: string;
      generationQuality?: string;
    }>;
    accessories?: {
      hatPipelineVersion?: string;
      hatStyleContractVersion?: string;
      hatReferences?: { path?: string; role?: string }[];
      hats?: Record<string, {
        generationModel?: string;
        generationQuality?: string;
        generationStage?: string;
        pipelineVersion?: string;
        styleContractVersion?: string;
        presentation?: { scale: number; offsetX: number; offsetY: number };
      }>;
    };
  };

  assert.ok((manifest.artDirectionVersion ?? 0) >= 6);
  assert.deepEqual(manifest.faceLayout, EGG_AVATAR_FACE_LAYOUT);

  for (const skinId of EGG_AVATAR_SKIN_IDS) {
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.png`)), true, `${skinId} png`);
    assert.equal(existsSync(path.join(assetRoot, `${skinId}.webp`)), true, `${skinId} webp`);
    assert.equal(existsSync(path.join(assetRoot, 'thumbnails', `${skinId}.webp`)), true, `${skinId} thumbnail`);
    assert.ok(manifest.skins?.[skinId], `${skinId} manifest entry`);
    assert.ok((manifest.skins?.[skinId]?.version ?? 0) >= 1, `${skinId} art version`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', `${skinId}.png`)), true, `${skinId} base png`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', `${skinId}.webp`)), true, `${skinId} base webp`);
    assert.equal(existsSync(path.join(assetRoot, 'bases', 'thumbnails', `${skinId}.webp`)), true, `${skinId} base thumbnail`);
    assert.ok(manifest.skins?.[skinId]?.baseOutputs, `${skinId} layered base manifest`);
  }

  for (const promotedId of ['honeycomb', 'strawberry-cream', 'blueberry-swirl', 'matcha-marble']) {
    assert.equal(manifest.skins?.[promotedId]?.generationModel, 'openai/gpt-image-2/edit');
    assert.equal(manifest.skins?.[promotedId]?.generationQuality, 'low');
  }

  for (const faceId of EGG_AVATAR_FACE_IDS) {
    assert.equal(existsSync(path.join(assetRoot, 'faces', `${faceId}.png`)), true, `${faceId} face png`);
    assert.equal(existsSync(path.join(assetRoot, 'faces', `${faceId}.webp`)), true, `${faceId} face webp`);
    assert.equal(existsSync(path.join(assetRoot, 'faces', 'thumbnails', `${faceId}.webp`)), true, `${faceId} face thumbnail`);
    assert.ok(manifest.faces?.[faceId], `${faceId} face manifest`);
  }

  for (const repairedFaceId of [
    'gentle-smile',
    'single-wink',
    'heart-eyes',
    'sparkle-awe',
    'shy-glance',
    'bashful-smile',
    'grumpy-cute',
  ]) {
    const face = manifest.faces?.[repairedFaceId];
    assert.equal(face?.pipelineVersion, 'egg-avatar-faces-v4-magenta-matte-enclosed-hole-repair');
    assert.equal(face?.generationModel, 'openai/gpt-image-2/edit');
    assert.equal(face?.generationQuality, 'low');
    assert.equal(face?.mattingSettings?.model, 'General Use (Heavy)');
    assert.equal(face?.mattingSettings?.enclosedAlphaHoleRepair, true);
    assert.equal(face?.mattingSettings?.chromaEdgeDespill, 'red-blue dominance suppression for #FF00FF');
    assert.equal(face?.mattingSettings?.exteriorEdgeSource, 'BiRefNet');
  }

  for (const stage of ['crack-1', 'crack-2']) {
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.png`)), true, `${stage} png`);
    assert.equal(existsSync(path.join(assetRoot, 'effects', `${stage}.webp`)), true, `${stage} webp`);
    assert.ok(manifest.effects?.[stage], `${stage} manifest entry`);
  }

  for (const hatId of EGG_AVATAR_HAT_IDS) {
    assert.equal(existsSync(path.join(assetRoot, 'hats', `${hatId}.png`)), true, `${hatId} png`);
    assert.equal(existsSync(path.join(assetRoot, 'hats', `${hatId}.webp`)), true, `${hatId} webp`);
    assert.equal(existsSync(path.join(assetRoot, 'hats', 'thumbnails', `${hatId}.webp`)), true, `${hatId} thumbnail`);
    const hat = manifest.accessories?.hats?.[hatId];
    assert.equal(hat?.pipelineVersion, 'egg-avatar-hats-v4-style-mapped');
    assert.equal(hat?.generationModel, 'openai/gpt-image-2/edit');
    assert.equal(hat?.generationQuality, 'low');
    assert.equal(hat?.generationStage, 'style-map');
    assert.equal(hat?.styleContractVersion, 'katchimeras-cozy-toy-v1');
    assert.ok(hat?.presentation && hat.presentation.scale > 0, `${hatId} presentation`);
    const catalogPresentation = allEggAvatarItems('hat').find((item) => item.id === hatId)?.presentation;
    assert.ok(catalogPresentation, `${hatId} catalog presentation`);
    assert.equal(Number.isFinite(catalogPresentation.scale), true, `${hatId} finite scale`);
    assert.equal(Number.isFinite(catalogPresentation.offsetX), true, `${hatId} finite horizontal offset`);
    assert.equal(Number.isFinite(catalogPresentation.offsetY), true, `${hatId} finite vertical offset`);
    assert.deepEqual(hat?.presentation, catalogPresentation, `${hatId} catalog/manifest presentation`);
  }
  assert.equal(manifest.accessories?.hatPipelineVersion, 'egg-avatar-hats-v4-style-mapped');
  assert.equal(manifest.accessories?.hatStyleContractVersion, 'katchimeras-cozy-toy-v1');
  assert.ok(manifest.accessories?.hatReferences?.some(
    ({ path: referencePath, role }) => role === 'character-art-style'
      && referencePath === 'assets/images/katchimeras/cutouts/baristabbit.png',
  ));
  assert.ok(manifest.accessories?.hatReferences?.some(
    ({ path: referencePath, role }) => role === 'runtime-lighting-palette'
      && referencePath === 'assets/images/katchimeras/world/today/today_bg.webp',
  ));
  for (const accessoryId of EGG_AVATAR_HELD_ACCESSORY_IDS) {
    assert.equal(existsSync(path.join(assetRoot, 'held', `${accessoryId}.png`)), true, `${accessoryId} png`);
    assert.equal(existsSync(path.join(assetRoot, 'held', `${accessoryId}.webp`)), true, `${accessoryId} webp`);
    assert.equal(existsSync(path.join(assetRoot, 'held', 'thumbnails', `${accessoryId}.webp`)), true, `${accessoryId} thumbnail`);
  }
});

test('hat generation uses GPT Image front-layer geometry followed by reference-locked style mapping', () => {
  const pipeline = readFileSync(path.join(root, 'scripts', 'generate-egg-avatar-skins.py'), 'utf8');
  const todayBackdrop = readFileSync(
    path.join(root, 'components', 'katchadeck', 'home', 'meadow-scene-backdrop.tsx'),
    'utf8',
  );
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.match(pipeline, /HAT_GENERATION_MODEL = "openai\/gpt-image-2\/edit"/);
  assert.match(pipeline, /HAT_STYLE_CONTRACT_VERSION = "katchimeras-cozy-toy-v1"/);
  assert.match(pipeline, /"quality": "low"/);
  assert.match(pipeline, /Draw only the front part of the hat layer/);
  assert.match(pipeline, /Do not draw an underside, inside, rear brim, back layer/);
  assert.match(pipeline, /Image 2, Baristabbit/);
  assert.match(pipeline, /Image 3 is the exact Today cinematic home environment/);
  assert.match(pipeline, /No realistic fibers/);
  assert.match(
    todayBackdrop,
    /assets\/images\/katchimeras\/world\/today\/today_bg\.webp/,
    'style reference must remain the background actually used by the Today scene',
  );
  assert.doesNotMatch(pipeline, /hat-fit-generate|hat-extract-generate|segmentationModel|SAM/);
  assert.match(pipeline, /Generation stopped at the required human review gate/);
  assert.match(pipeline, /choices=\("render", "restyle", "promote"\)/);
  assert.equal(
    packageJson.scripts?.['art:egg-avatar-hats'],
    'python scripts/generate-egg-avatar-skins.py hat-pipeline',
  );
  assert.equal(existsSync(path.join(root, 'docs', 'egg-avatar-hat-pipeline.md')), true);
});

test('face generation protects dark features and repairs only enclosed matte tears', () => {
  const pipeline = readFileSync(path.join(root, 'scripts', 'generate-egg-avatar-skins.py'), 'utf8');
  assert.match(pipeline, /FACE_GENERATION_MODEL = "openai\/gpt-image-2\/edit"/);
  assert.match(pipeline, /FACE_PIPELINE_VERSION = "egg-avatar-faces-v4-magenta-matte-enclosed-hole-repair"/);
  assert.match(pipeline, /quality": "low"/);
  assert.match(pipeline, /flat chroma-magenta #FF00FF background/);
  assert.match(pipeline, /def repair_enclosed_alpha_holes/);
  assert.match(pipeline, /def despill_chroma_edges/);
  assert.match(pipeline, /visible chroma-magenta pixels/);
  assert.match(pipeline, /--review-only/);
});

test('canonical face anchors stay inside the protected compositing zone', () => {
  const { anchors, safeZone } = EGG_AVATAR_FACE_LAYOUT;
  for (const [name, anchor] of Object.entries(anchors)) {
    assert.ok(anchor.x >= safeZone.left && anchor.x <= safeZone.right, `${name} x`);
    assert.ok(anchor.y >= safeZone.top && anchor.y <= safeZone.bottom, `${name} y`);
  }
});

test('accessory slots stay outside the protected face canvas', () => {
  const { hat, held } = EGG_AVATAR_ACCESSORY_LAYOUT;
  assert.ok(hat.bounds.bottom <= EGG_AVATAR_FACE_LAYOUT.safeZone.top);
  assert.ok(held.bounds.left >= EGG_AVATAR_FACE_LAYOUT.safeZone.right - 0.081);
  assert.ok(held.bounds.right <= 1 && held.bounds.bottom <= 1);
});

test('Today egg uses the shared calibrated body and face compositor', () => {
  const sources = [
    path.join('components', 'katchadeck', 'home', 'egg-shell.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-tile-hatch-reveal.tsx'),
    path.join('components', 'katchadeck', 'home', 'today-deck', 'forming-egg-item.tsx'),
  ].map((relativePath) => readFileSync(path.join(root, relativePath), 'utf8'));

  for (const source of sources) {
    assert.match(source, /useEggAvatar\(\)/);
    assert.match(source, /EggAvatarArtwork/);
    assert.match(source, /equippedSkinId/);
    assert.match(source, /equippedFaceId/);
    assert.doesNotMatch(source, /cutouts\/egg-base/);
  }

  const compositor = readFileSync(
    path.join(root, 'components', 'katchadeck', 'egg-avatar', 'egg-avatar-artwork.tsx'),
    'utf8'
  );
  assert.match(compositor, /EGG_AVATAR_FACE_PRESENTATION_SCALE = 0\.92/);
  const bodyLayer = compositor.indexOf('source={bodySource}');
  const faceLayer = compositor.indexOf('source={faceSource}');
  const hatLayer = compositor.indexOf('source={sourceForResolution(hat)}');
  const heldLayer = compositor.indexOf('source={sourceForResolution(heldAccessory)}');
  assert.ok(bodyLayer >= 0 && bodyLayer < faceLayer, 'body renders before face');
  assert.ok(faceLayer < hatLayer, 'face renders before hat');
  assert.ok(hatLayer < heldLayer, 'hat renders before held prop');
  assert.match(compositor, /eggAvatarHatPresentationStyle\(skinId, hat\.presentation\)/);
  assert.match(compositor, /body\.scale \* residual\.scale/);
});

test('Haven home tile renders the live customized Egg instead of a static substitute', () => {
  const haven = readFileSync(
    path.join(root, 'components', 'katchadeck', 'world', 'kingdom-hex-canvas.tsx'),
    'utf8',
  );
  const kingdomEgg = haven.slice(haven.indexOf('const KingdomEgg'), haven.indexOf('const RevealedCompanionEgg'));

  assert.match(kingdomEgg, /const avatar = useEggAvatar\(\)/);
  assert.match(kingdomEgg, /<EggAvatarArtwork/);
  assert.match(kingdomEgg, /skinId=\{avatar\.equippedSkinId\}/);
  assert.match(kingdomEgg, /faceId=\{avatar\.equippedFaceId\}/);
  assert.match(kingdomEgg, /hatId=\{avatar\.equippedHatId\}/);
  assert.match(kingdomEgg, /heldAccessoryId=\{avatar\.equippedHeldAccessoryId\}/);
  assert.match(kingdomEgg, /resolution="high"/);
  assert.doesNotMatch(kingdomEgg, /egg-base\.webp|KINGDOM_EGG_SOURCE/);
  assert.match(haven, /HAVEN_HOME_EGG_AVATAR_SCALE = 1\.2/);
  assert.match(haven, /kingdomWorldViewConfig\.egg\.globalScale \* HAVEN_HOME_EGG_AVATAR_SCALE/);
});

test('accessory-heavy skins carry explicit core-silhouette calibration', () => {
  for (const skinId of ['moss', 'barista', 'pumpkin'] as const) {
    const presentation = allEggAvatarItems('body').find((skin) => skin.id === skinId)?.presentation;
    assert.ok(presentation, `${skinId} presentation`);
    assert.ok(presentation.scale >= 1.05 && presentation.scale <= 1.08, `${skinId} scale`);
    assert.equal(presentation.offsetX, 0, `${skinId} horizontal offset`);
    assert.ok(presentation.offsetY >= -0.018 && presentation.offsetY <= -0.01, `${skinId} vertical offset`);
  }
});

test('You button navigates to a separately mounted, virtualized customizer route', () => {
  const tabBar = readFileSync(
    path.join(root, 'components', 'katchadeck', 'ui', 'meadow-tab-bar.tsx'),
    'utf8'
  );
  const today = readFileSync(path.join(root, 'app', '(tabs)', 'today.tsx'), 'utf8');
  const you = readFileSync(path.join(root, 'app', '(tabs)', 'you.tsx'), 'utf8');
  const customizer = readFileSync(
    path.join(root, 'components', 'katchadeck', 'egg-avatar', 'egg-avatar-profile-screen.tsx'),
    'utf8'
  );

  assert.match(tabBar, /navigation\.navigate\('you'\)/);
  assert.doesNotMatch(tabBar, /openCustomizer|customize:/);
  assert.doesNotMatch(today, /<EggAvatarProfileScreen|customizerCameraStyle/);
  assert.match(you, /if \(!focused\) return <View style=\{styles\.inactive\}/);
  assert.match(you, /<EggAvatarProfileScreen/);
  assert.match(you, /backgroundKey="home"/);
  assert.match(you, /const eggFrame = todayExplorationEggStageFrame\(width, height, stageTop\)/);
  assert.match(you, /subjectCenterY: stageTop \+ eggFrame\.centerY/);
  assert.match(you, /eggAvatarCustomizerCamera\(/);
  assert.match(you, /transform: \[\s*\{ translateY: camera\.translateY \},\s*\{ scale: camera\.scale \}/);
  assert.match(you, /verticalOffset=\{HOME_SCENE_Y_OFFSET\}/);
  assert.match(you, /const YOU_AVATAR_RELATIVE_Y_OFFSET = 18/);
  assert.match(you, /top: stageTop \+ YOU_AVATAR_RELATIVE_Y_OFFSET/);
  assert.match(you, /<TodayKingdomEggHero[\s\S]*?explorationStageTop=\{stageTop\}/);
  assert.match(you, /companionWispId=\{equippedWispId\}/);
  assert.match(customizer, /elevation: 100, zIndex: 100/);
  assert.match(customizer, /eggAvatarCustomizerPanelHeight\(height\)/);
  assert.doesNotMatch(customizer, /styles\.heroNameAnchor/);
  assert.doesNotMatch(customizer, />YOU</);
  assert.doesNotMatch(customizer, /styles\.headingWisp/);
  assert.match(customizer, /<FlashList/);
  assert.match(customizer, /numColumns=\{GRID_COLUMNS\}/);
  assert.match(customizer, /pointerEvents="auto"/);
  assert.match(customizer, /gridScroll: \{ flex: 1, minHeight: 0 \}/);
  assert.doesNotMatch(customizer, /today_pedestal|presentation="hero"/);
});

test('Today and You egg heroes omit the rotating radial ray layer', () => {
  const hero = readFileSync(
    path.join(root, 'components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    'utf8'
  );

  assert.doesNotMatch(hero, /RadialSunburstCanvas|styles\.rayField|rayStyle/);
});

test('customizer camera centres the existing egg in the unobstructed top region', () => {
  const camera = eggAvatarCustomizerCamera({
    bottomInset: 20,
    subjectCenterY: 305,
    topInset: 44,
    viewportHeight: 800,
  });
  const scaledSubjectCenter = 400 + (305 - 400) * camera.scale;

  assert.ok(camera.translateY < -80, 'camera pans down enough to move the scene upward');
  assert.equal(camera.panelTop, 336);
  assert.ok(Math.abs(scaledSubjectCenter + camera.translateY - camera.targetCenterY) < 0.001);
});

test('You customizer keeps four selection columns at every phone width', () => {
  const profile = readFileSync(
    path.join(root, 'components', 'katchadeck', 'egg-avatar', 'egg-avatar-profile-screen.tsx'),
    'utf8',
  );

  assert.match(profile, /const GRID_COLUMNS = 4;/);
  assert.match(profile, /GRID_GAP \* \(GRID_COLUMNS - 1\)/);
  assert.doesNotMatch(profile, /width < 360 \? 3 : 4/);
});

test('avatar customization keeps the previous layer until its replacement loads, then swaps instantly', () => {
  const artwork = readFileSync(
    path.join(root, 'components', 'katchadeck', 'egg-avatar', 'egg-avatar-artwork.tsx'),
    'utf8',
  );
  const todayHero = readFileSync(
    path.join(root, 'components', 'katchadeck', 'home', 'today-kingdom-egg-hero.tsx'),
    'utf8',
  );

  assert.doesNotMatch(
    artwork,
    /recyclingKey=/,
    'recycling keys clear expo-image before the next customization has loaded',
  );
  assert.match(artwork, /transition = 0/);
  assert.doesNotMatch(artwork, /EGG_AVATAR_LAYER_TRANSITION_MS/);
  assert.match(
    todayHero,
    /<EggAvatarArtwork[\s\S]*?transition=\{0\}[\s\S]*?\/>/,
  );
});
