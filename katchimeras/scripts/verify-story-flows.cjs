const { spawnSync } = require('node:child_process');

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'tsx',
  '--test',
  'tests/content-flow.test.ts',
  'tests/ftue-script.test.ts',
  'tests/glow-discovery.test.ts',
], { cwd: process.cwd(), shell: process.platform === 'win32', stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
