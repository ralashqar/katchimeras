const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(process.cwd());
const atlasPath = resolve(root, 'assets/images/katchimeras/merge-world/generated/merge-board-atlas.webp');
const manifestPath = resolve(root, 'constants/merge-board-atlas.generated.ts');
const catalogPath = resolve(root, 'constants/merge-world-catalog.ts');

function fail(message) {
  console.error(`Merge board atlas check failed: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(atlasPath) || !existsSync(manifestPath)) {
  fail('generated atlas or manifest is missing; run npm run art:merge-board-atlas');
} else {
  const atlas = readFileSync(atlasPath);
  const manifest = readFileSync(manifestPath, 'utf8');
  const catalog = readFileSync(catalogPath, 'utf8');
  const expectedHash = createHash('sha256').update(atlas).digest('hex').slice(0, 16);
  const declaredHash = manifest.match(/MERGE_BOARD_ATLAS_HASH = '([^']+)'/)?.[1];
  if (declaredHash !== expectedHash) fail('asset hash does not match its typed manifest');

  const requiredIds = new Set([
    '__cell.normal',
    '__cell.alternate',
    '__cell.selected',
    '__cell.compatible',
    '__cell.invalid',
    '__cloud.lock',
  ]);
  const mossBlock = catalog.split('export const MOSSPROUT_DREAM_ECHOES = [')[1]?.split('] as const;')[0] ?? '';
  for (const match of mossBlock.matchAll(/definitionId:\s*'([^']+)'/g)) requiredIds.add(match[1]);
  const generatorBlock = catalog.split('export const MERGE_GENERATORS:')[1]?.split('];')[0] ?? '';
  for (const match of generatorBlock.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) {
    requiredIds.add(`${match[1]}:1`);
    requiredIds.add(`${match[2]}:1`);
  }
  for (const id of requiredIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`'${escaped}':`).test(manifest)) fail(`manifest is missing ${id}`);
  }

  if (!process.exitCode) console.log(`Merge board atlas integrity verified (${Math.round(atlas.length / 1024)} KB)`);
}
