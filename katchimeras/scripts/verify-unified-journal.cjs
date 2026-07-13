const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const executable = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const result = spawnSync(process.execPath, [executable, '--test', 'tests/unified-journal.test.ts'], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
