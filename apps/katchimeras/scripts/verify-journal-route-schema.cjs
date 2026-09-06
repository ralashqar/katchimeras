const {contentPath, assetSpecifier, readVerificationSource} = require('@incubator/art-pipeline/context');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tsxCli = require.resolve('tsx/cli');
const result = spawnSync(process.execPath, [tsxCli, 'scripts/generate-note-route-schema.ts', '--check'], {
  cwd: root,
  encoding: 'utf8',
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
