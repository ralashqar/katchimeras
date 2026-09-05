import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const reviewPath = resolve(
  process.cwd(),
  'components/katchadeck/capture/essence-review.tsx'
);

test('the photo analysis flow keeps place data without rendering location controls', async () => {
  const source = await readFile(reviewPath, 'utf8');

  assert.match(source, /placeResolutionRef/);
  assert.match(source, /placeResolution: placeResolutionRef\.current/);
  assert.doesNotMatch(source, /PhotoPlaceCard|PhotoPlaceConfirmationSheet/);
  assert.doesNotMatch(source, /placeSheetOpen|Where was this\?/);
  assert.doesNotMatch(source, /confirmPhotoPlaceCandidate|rememberPersonalPlaceForPhoto/);
});
