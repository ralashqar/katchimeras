// Generate optional, per-item imports: consumers bundle only the eggs they select.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const game = process.env.INCUBATOR_GAME_ROOT || path.join(root, 'apps/katchimeras');
const output = path.join(root, 'art/assets/images/katchimeras/egg-avatars/catalog');
const check = process.argv.includes('--check');
let count = 0;
for (const [kind, filename] of [['body', 'bodies'], ['face', 'faces']]) {
  const data = JSON.parse(fs.readFileSync(path.join(game, `data/egg-avatar/${filename}.json`), 'utf8'));
  for (const item of data.items.filter(item => item.availability === 'ready')) {
    const folder = kind === 'body' ? 'bases' : 'faces';
    const target = path.join(output, kind, `${item.id}.ts`);
    const value = `// Generated art metadata. Ownership and prices belong to each game.\nexport default {\n  id: ${JSON.stringify(item.id)}, name: ${JSON.stringify(item.name)},\n  source: require('../../${folder}/${item.id}.webp'),\n  thumbnail: require('../../${folder}/thumbnails/${item.id}.webp'),\n  presentation: ${JSON.stringify(item.presentation ?? { scale: 1, offsetX: 0, offsetY: 0 })},\n  layoutVersion: ${item.layoutVersion ?? 1},\n};\n`;
    if (check) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== value) throw new Error(`Stale catalog: ${target}`); }
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); }
    count++;
  }
}
console.log(`${check ? 'Verified' : 'Generated'} ${count} shared egg art entries`);
