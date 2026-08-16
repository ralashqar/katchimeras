import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

test('preview explicitly enables developer tools while production stays fail-closed', () => {
  const eas = JSON.parse(read('eas.json')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };

  assert.equal(eas.build.preview.env?.EXPO_PUBLIC_ENABLE_DEV_TOOLS, 'true');
  assert.notEqual(eas.build.production.env?.EXPO_PUBLIC_ENABLE_DEV_TOOLS, 'true');
});

test('developer navigation and tool implementations share the preview-safe gate', () => {
  const devContract = read('constants/dev.ts');
  assert.match(devContract, /EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true'/);
  assert.match(devContract, /DEV_DEBUG_NAV_ENABLED = DEV_TOOLS_ENABLED/);

  for (const relative of [
    'utils/dev-settings.ts',
    'utils/dev-subscription-simulator.ts',
    'utils/dev-atmosphere-settings.ts',
    'utils/dev-note-analysis.ts',
    'utils/dev-photo-analysis.ts',
    'utils/dev-asset-overrides.ts',
    'utils/katchimera-hex-tiles.ts',
  ]) {
    const implementation = read(relative);
    assert.match(implementation, /DEV_TOOLS_ENABLED/, `${relative} must use the shared gate`);
    assert.doesNotMatch(implementation, /if \([^\n]*!?__DEV__/, `${relative} must not reject preview builds via __DEV__`);
  }
});
