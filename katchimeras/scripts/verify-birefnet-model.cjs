#!/usr/bin/env node

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const edgeFunction = readFileSync(
  join(root, 'supabase', 'functions', 'remove-image-background', 'index.ts'),
  'utf8'
);
const hexPipeline = readFileSync(join(root, 'scripts', 'hex-tile-pipeline.py'), 'utf8');
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
  edgeFunction.includes("const birefnetModel = 'General Use (Heavy)';"),
  'shared background-removal function pins BiRefNet Heavy'
);
check(
  edgeFunction.includes('model: birefnetModel') && !edgeFunction.includes('body.model'),
  'callers cannot override the shared Heavy model'
);
check(
  edgeFunction.includes("const operatingResolution = '2048x2048';") &&
    edgeFunction.includes('refine_foreground: refineForeground'),
  'shared matting uses 2048 resolution with foreground refinement'
);
check(hexPipeline.includes('BIREFNET_HEAVY_MODEL = "General Use (Heavy)"'), 'hex tile pipeline declares Heavy');
check(eggPipeline.includes("'model': 'General Use (Heavy)'"), 'egg pipeline no longer requests Light 2K');
check(objectGridPipeline.includes("BIREFNET_MODEL = 'General Use (Heavy)'"), 'object grid pipeline no longer requests Light 2K');

if (process.exitCode) process.exit(process.exitCode);
console.log('All BiRefNet model checks passed.');
