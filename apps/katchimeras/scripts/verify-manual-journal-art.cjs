const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const expected = ['people', 'food', 'went_somewhere', 'movement', 'studio', 'work', 'big_event', 'general'];
const mapSource = readVerificationSource(contentPath(root, 'constants', 'manual-journal-art.ts'), 'utf8');
let failed = false;

for (const id of expected) {
  const asset = contentPath(root, 'assets', 'images', 'katchimeras', 'manual-journal', `${id}.webp`);
  const mapped = new RegExp(`\\b${id}:\\s*require\\(`).test(mapSource);
  const size = fs.existsSync(asset) ? fs.statSync(asset).size : 0;
  if (!mapped || size < 1024) {
    failed = true;
    console.error(`FAIL ${id}: mapped=${mapped} bytes=${size}`);
  } else {
    console.log(`  ok  ${id}: ${Math.round(size / 1024)} KB`);
  }
}

process.exit(failed ? 1 : 0);
