const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function tests(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tests(path.join(dir, e.name)) : e.name.endsWith('.test.ts') ? [path.join(dir, e.name)] : []); }
const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), '--test', '--test-reporter=dot', ...tests(path.join(root, 'packages/tile-match/src'))], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
