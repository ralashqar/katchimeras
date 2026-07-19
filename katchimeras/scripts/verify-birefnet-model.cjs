#!/usr/bin/env node

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const edgeFunction = readFileSync(
  join(root, 'supabase', 'functions', 'remove-image-background', 'index.ts'),
  'utf8'
);
const hexPipeline = readFileSync(join(root, 'scripts', 'hex-tile-pipeline.py'), 'utf8');
const floatingPromotion = readFileSync(
  join(root, 'scripts', 'promote-floating-neighborhood-v2-tile.py'),
  'utf8'
);
const eggPipeline = readFileSync(join(root, 'scripts', 'generate-egg.py'), 'utf8');
const objectGridPipeline = readFileSync(join(root, 'scripts', 'generate-world-object-grid.py'), 'utf8');

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
  hexPipeline.includes('restore_interior_source_pixels') &&
    hexPipeline.includes('ImageFilter.MinFilter(7)') &&
    hexPipeline.includes('exterior BiRefNet edge unchanged'),
  'hex tile repair is restricted to an eroded interior silhouette'
);
check(
  hexPipeline.includes('matted.source.sha256') &&
    hexPipeline.includes('hashlib.sha256(source.read_bytes()).hexdigest()'),
  'hex tile matte cache is keyed by source SHA-256'
);
check(
  floatingPromotion.includes('shutil.copy2(work / "final.png", alpha)'),
  'floating tile promotion uses the boundary-safe repaired matte'
);
check(eggPipeline.includes("'model': 'BiRefNet_lite'"), 'egg pipeline declares the Heavy enum');
check(objectGridPipeline.includes("BIREFNET_MODEL = 'BiRefNet_lite'"), 'object grid pipeline declares the Heavy enum');

if (process.exitCode) process.exit(process.exitCode);
console.log('All BiRefNet model checks passed.');
