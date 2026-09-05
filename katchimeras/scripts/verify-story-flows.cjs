const { spawnSync } = require('node:child_process');

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'tsx',
  '--test',
  'tests/content-flow.test.ts',
  'tests/ftue-script.test.ts',
  'tests/glow-discovery.test.ts',
  'tests/steppling-encounter.test.ts',
  'tests/companion-journey-cycle.test.ts',
  'tests/companion-journey-service.test.ts',
  'tests/companion-journey-cycle-stage.test.tsx',
  'tests/companion-journey-reminder.test.ts',
  'tests/companion-life.test.tsx',
  'tests/companion-scene.test.tsx',
  'tests/companion-daily-garden.test.ts',
  'tests/companion-daily-actions.test.tsx',
  'tests/steppling-activities.test.tsx',
], { cwd: process.cwd(), shell: process.platform === 'win32', stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
