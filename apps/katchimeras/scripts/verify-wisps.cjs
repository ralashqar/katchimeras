const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(readVerificationSource(contentPath(root, 'data/wisps/catalog.generated.json'), 'utf8'));
const ids = new Set();
let ready = 0;
for (const [index, item] of catalog.items.entries()) {
  if (ids.has(item.id)) throw new Error(`Duplicate Wisp id: ${item.id}`);
  ids.add(item.id);
  if (item.sortOrder !== index + 1) throw new Error(`Non-contiguous sortOrder for ${item.id}`);
  if (!['common', 'rare', 'epic', 'legendary'].includes(item.rarity)) throw new Error(`Invalid rarity for ${item.id}`);
  if (item.availability === 'ready') {
    ready += 1;
    for (const relative of [
      `assets/images/katchimeras/wisps/${item.id}.png`,
      `assets/images/katchimeras/wisps/${item.id}.webp`,
      `assets/images/katchimeras/wisps/thumbnails/${item.id}.webp`,
    ]) if (!fs.existsSync(contentPath(root, relative))) throw new Error(`Missing ready Wisp asset: ${relative}`);
  }
}
if (catalog.items.length !== 120) throw new Error(`Expected 120 Wisps, found ${catalog.items.length}`);
if (ready !== 51) throw new Error(`Expected 51 ready Wisps, found ${ready}`);
for (const item of catalog.items.filter((entry) => entry.availability === 'planned')) {
  if (item.assetRefs !== null) throw new Error(`Planned Wisp ${item.id} must not claim assets`);
}
console.log(`Verified ${catalog.items.length} Wisp definitions, ${ready} production asset sets, and ${catalog.items.length - ready} planned art briefs.`);
