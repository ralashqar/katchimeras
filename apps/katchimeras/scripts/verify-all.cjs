const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');

const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const scriptsDir = __dirname;
const scripts = readdirSync(scriptsDir)
  .filter((name) => /^verify-.+\.cjs$/.test(name) && name !== 'verify-all.cjs')
  .sort();

if (scripts.length === 0) {
  console.log('No verify scripts found.');
  process.exit(0);
}

for (const script of scripts) {
  console.log(`\n> ${script}`);
  const result = spawnSync(process.execPath, [join(scriptsDir, script)], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nVerified ${scripts.length} scripts.`);
