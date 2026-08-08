const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/wisps/catalog.json'), 'utf8'));
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
    ]) if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing ready Wisp asset: ${relative}`);
  }
}
if (catalog.items.length !== 50) throw new Error(`Expected 50 Wisps, found ${catalog.items.length}`);
if (ready !== 16) throw new Error(`Expected 16 ready Wisps, found ${ready}`);
console.log(`Verified ${catalog.items.length} Wisp definitions and ${ready} launch assets.`);
