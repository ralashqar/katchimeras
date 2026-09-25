import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('Feastle has only the requested food photo daily activity', () => {
  const daily = hatchableByCompanion('feastle')!.daily!;
  assert.equal(daily.photo?.category, 'food');
  assert.equal(daily.moment, undefined);
  assert.equal(daily.notice, undefined);
});
