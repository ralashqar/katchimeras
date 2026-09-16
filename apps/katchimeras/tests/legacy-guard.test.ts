import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Nothing reaches for what the companion refactor removed, and the shared
 * tech names no friend. A friend is a definition, a chapter and copy files;
 * the code that draws, runs and records them is the same for everyone.
 */
const ROOTS = ['app', 'components', 'constants', 'features', 'game', 'hooks', 'storage', 'types', 'utils', 'tests'];
const DELETED_MODULES = [
  'companion-journey-chapters/episode-flow',
  'steppling-journey-campaign',
  'world/hatchable-actions',
  'mossprout-life-activities',
  'world/steppling-actions',
  'world/journey-episode-row',
  'use-journey-chapter-state',
  'steppling-mission-dock',
  'use-steppling-encounter',
  'steppling-encounter-panel',
  'content-flow/steppling-day-one-flow-v1',
  'content-flow/steppling-day-one-flow-v2',
];
/** Shared companion tech: every file here serves every friend and names none but Mossprout, the world's fixed centre. */
const SHARED_TECH = [
  'components/katchadeck/world/companion-journey-cycle-stage.tsx',
  'components/katchadeck/world/companion-daily-actions.tsx',
  'components/katchadeck/world/companion-daily-question.tsx',
  'components/katchadeck/world/companion-life-activity-card.tsx',
  'components/katchadeck/world/companion-step-goal.tsx',
  'components/katchadeck/world/hatchable-mission-dock.tsx',
  'constants/companion-daily/registry.ts',
  'constants/companion-journey-chapters/episode-conversation.ts',
  'constants/companion-journey-chapters/consequence-flow.ts',
  'constants/story-tiles/registry.ts',
  'features/companion/companion-journey-service.ts',
  'features/companion/journey-triggers.ts',
  'features/companion/journey-consequences.ts',
  'features/companion/journey-consequence-state.ts',
  'features/onboarding/hatchable-flows.ts',
  'features/onboarding/hatchable-runtime.ts',
  'utils/companion-journey-personalisation.ts',
  'utils/companion-life-activity-storage.ts',
  'utils/companion-step-milestones.ts',
  'utils/companion-daily-moment.ts',
];
const FRIEND_LITERALS = /['"`](steppling|baristabbit)['"`]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' || name === 'fixtures' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test('no source file imports a module the companion refactor removed', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      if (file.endsWith('legacy-guard.test.ts')) continue;
      const source = readFileSync(file, 'utf8');
      for (const line of source.split('\n')) {
        if (!/^\s*(import|export)\b|require\(|loadNativeModule\(|readFileSync\(/.test(line)) continue;
        for (const module of DELETED_MODULES) if (line.includes(`${module}'`) || line.includes(`${module}.ts`)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('the shared companion tech names no friend', () => {
  const offenders: string[] = [];
  for (const file of SHARED_TECH) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
      if (FRIEND_LITERALS.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
