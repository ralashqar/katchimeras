const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');

const readFileSync = readVerificationSource;
const { readFileSync: nativeReadFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const edgeFunction = readFileSync(
  contentPath(root, 'supabase', 'functions', 'remove-image-background', 'index.ts'),
  'utf8'
);
const hexPipeline = readFileSync(contentPath(root, 'scripts', 'hex-tile-pipeline.py'), 'utf8');
const floatingPromotion = readFileSync(
  contentPath(root, 'scripts', 'promote-floating-neighborhood-v2-tile.py'),
  'utf8'
);
const transparentHexPackaging = readFileSync(
  contentPath(root, 'scripts', 'package-transparent-hex-tile.py'),
  'utf8'
);
const hexAlphaPipeline = readFileSync(contentPath(root, 'scripts', 'hex_tile_alpha.py'), 'utf8');
const eggPipeline = readFileSync(contentPath(root, 'scripts', 'generate-egg.py'), 'utf8');
const objectGridPipeline = readFileSync(contentPath(root, 'scripts', 'generate-world-object-grid.py'), 'utf8');

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok  ${message}`);
}

check(
  edgeFunction.includes("const birefnetModelEnum = 'BiRefNet_lite';") &&
    edgeFunction.includes("const falModelInput = 'General Use (Heavy)';") &&
    edgeFunction.includes('model: falModelInput'),
  'shared background-removal function maps BiRefNet_lite to FAL HTTP Heavy'
);
check(
  edgeFunction.includes('model: falModelInput') && !edgeFunction.includes('body.model'),
  'callers cannot override the shared Heavy model'
);
check(
  edgeFunction.includes("const operatingResolution = '1024x1024';") &&
    edgeFunction.includes('refine_foreground: refineForeground'),
  'shared matting uses 1024 resolution with foreground refinement'
);
check(hexPipeline.includes('BIREFNET_HEAVY_MODEL = "BiRefNet_lite"'), 'hex tile pipeline declares the Heavy enum');
check(
  !hexPipeline.includes('restore_nonblack_source_pixels') &&
    !hexPipeline.includes('restore_source_silhouette') &&
    !hexPipeline.includes('fill_internal_alpha_holes'),
  'hex tile pipeline excludes the old unrestricted alpha repairs'
);
check(
  hexPipeline.includes('restore_source_backed_interior') &&
    hexPipeline.includes('source_foreground_mask') &&
    hexPipeline.includes('ImageFilter.MinFilter(7)') &&
    hexPipeline.includes('restore = safe_interior & (alpha < 255)'),
  'hex tile repair restores enclosed shadows and tears behind a protected exterior edge'
);
check(
  hexPipeline.includes('postprocess_hex_tile_edges') &&
    hexAlphaPipeline.includes('ImageFilter.MinFilter(3)') &&
    hexAlphaPipeline.includes('ImageFilter.GaussianBlur(0.45)') &&
    !hexAlphaPipeline.includes('ImageDraw.floodfill') &&
    !hexAlphaPipeline.includes('CONNECTED_DARK_MAX_RGB'),
  'hex tile pipeline applies only the approved mild boundary-edge cleanup'
);
check(
  hexPipeline.includes('matted.source.sha256') &&
    hexPipeline.includes('hashlib.sha256(source.read_bytes()).hexdigest()'),
  'hex tile matte cache is keyed by source SHA-256'
);
check(
  floatingPromotion.includes('replace_file(work / "final.png", alpha)') &&
    floatingPromotion.includes('"--skip-package"'),
  'floating tile promotion uses the boundary-safe repaired matte'
);
check(
  hexPipeline.includes('default=95') &&
    hexPipeline.includes('lod_quality = 95 if lod_size >= 512 else 90') &&
    transparentHexPackaging.includes('default=95') &&
    transparentHexPackaging.includes('95 if lod_size >= 512 else 90'),
  'hex tile runtime packaging uses quality 95 for 1024/512 and 90 for 256'
);
check(
  hexPipeline.includes('resize_rgba_premultiplied') &&
    transparentHexPackaging.includes('resize_rgba_premultiplied') &&
    hexAlphaPipeline.includes('premultiplied = rgb * alpha[:, :, None]'),
  'hex tile pipeline and packager resize LODs in premultiplied-alpha space'
);
check(eggPipeline.includes("'model': 'BiRefNet_lite'"), 'egg pipeline declares the Heavy enum');
check(objectGridPipeline.includes("BIREFNET_MODEL = 'BiRefNet_lite'"), 'object grid pipeline declares the Heavy enum');

if (process.exitCode) process.exit(process.exitCode);
console.log('All BiRefNet model checks passed.');
