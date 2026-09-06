const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const executable = require.resolve('tsx/cli');
const result = spawnSync(process.execPath, [executable, '--test', 'tests/companion-interaction.test.ts'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
