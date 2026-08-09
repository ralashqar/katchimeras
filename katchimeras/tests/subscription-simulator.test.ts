import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_DEV_SUBSCRIPTION_STATE,
  DEV_SUBSCRIPTION_PACKAGES,
  isDevSubscriptionStateActive,
  reduceDevSubscriptionScenario,
} from '../utils/subscription-simulator-engine';

const NOW = Date.parse('2026-08-09T12:00:00.000Z');
const enabled = { ...DEFAULT_DEV_SUBSCRIPTION_STATE, enabled: true };

test('development packages mirror the planned RevenueCat products and prices', () => {
  assert.deepEqual(
    DEV_SUBSCRIPTION_PACKAGES.map(({ productIdentifier, priceString, period }) => ({ productIdentifier, priceString, period })),
    [
      { productIdentifier: 'katchimeras_plus_monthly', priceString: '£5.99', period: 'monthly' },
      { productIdentifier: 'katchimeras_plus_annual', priceString: '£39.99', period: 'annual' },
    ],
  );
});

test('a simulated trial grants access for seven days', () => {
  const trial = reduceDevSubscriptionScenario(enabled, 'trial', NOW);
  assert.equal(trial.status, 'trial');
  assert.equal(trial.productIdentifier, 'katchimeras_plus_monthly');
  assert.equal(isDevSubscriptionStateActive(trial, NOW + 6 * 24 * 60 * 60 * 1000), true);
  assert.equal(isDevSubscriptionStateActive(trial, NOW + 8 * 24 * 60 * 60 * 1000), false);
});

test('cancellation retains access until period expiry', () => {
  const monthly = reduceDevSubscriptionScenario(enabled, 'monthly', NOW);
  const cancelled = reduceDevSubscriptionScenario(monthly, 'cancel', NOW + 1000);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.willRenew, false);
  assert.equal(isDevSubscriptionStateActive(cancelled, NOW + 20 * 24 * 60 * 60 * 1000), true);
  assert.equal(isDevSubscriptionStateActive(cancelled, NOW + 31 * 24 * 60 * 60 * 1000), false);
});

test('renewal preserves the annual product cadence', () => {
  const annual = reduceDevSubscriptionScenario(enabled, 'annual', NOW);
  const renewed = reduceDevSubscriptionScenario(annual, 'renew', NOW + 10_000);
  assert.equal(renewed.status, 'active');
  assert.equal(renewed.productIdentifier, 'katchimeras_plus_annual');
  assert.equal(isDevSubscriptionStateActive(renewed, NOW + 360 * 24 * 60 * 60 * 1000), true);
});

test('expiry, refund and reset revoke simulated access', () => {
  const active = reduceDevSubscriptionScenario(enabled, 'monthly', NOW);
  for (const scenario of ['expire', 'refund', 'inactive'] as const) {
    const next = reduceDevSubscriptionScenario(active, scenario, NOW + 1000);
    assert.equal(isDevSubscriptionStateActive(next, NOW + 1000), false);
  }
});

test('the persisted simulator is guarded by the development build flag', () => {
  const source = readFileSync(resolve(process.cwd(), 'utils/dev-subscription-simulator.ts'), 'utf8');
  assert.match(source, /typeof __DEV__ !== 'undefined' && __DEV__/u);
  assert.match(source, /if \(!isDevBuild\(\)\) return DEFAULT_DEV_SUBSCRIPTION_STATE/u);
});
