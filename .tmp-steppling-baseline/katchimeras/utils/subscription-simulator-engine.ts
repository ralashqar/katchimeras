import type { RevenueCatPackageSummary } from '@/types/economy';
import type { DevSubscriptionSimulatorState } from '@/types/subscription';

export const DEV_SUBSCRIPTION_PACKAGES: RevenueCatPackageSummary[] = [
  { identifier: '$rc_monthly', productIdentifier: 'katchimeras_plus_monthly', title: 'Katchimeras Plus Monthly', priceString: '£5.99', period: 'monthly' },
  { identifier: '$rc_annual', productIdentifier: 'katchimeras_plus_annual', title: 'Katchimeras Plus Annual', priceString: '£39.99', period: 'annual' },
];

export const DEFAULT_DEV_SUBSCRIPTION_STATE: DevSubscriptionSimulatorState = {
  version: 1,
  enabled: false,
  status: 'inactive',
  productIdentifier: null,
  expiresAt: null,
  willRenew: false,
  monthlyClaimedAt: null,
  nextFailure: null,
  lastEvent: null,
  revision: 0,
};

export type DevSubscriptionScenario = 'trial' | 'monthly' | 'annual' | 'renew' | 'cancel' | 'expire' | 'refund' | 'inactive';

export function reduceDevSubscriptionScenario(
  current: DevSubscriptionSimulatorState,
  scenario: DevSubscriptionScenario,
  now = Date.now(),
): DevSubscriptionSimulatorState {
  const day = 24 * 60 * 60 * 1000;
  if (scenario === 'inactive') {
    return { ...current, status: 'inactive', productIdentifier: null, expiresAt: null, willRenew: false, monthlyClaimedAt: null, lastEvent: 'Entitlement reset' };
  }
  if (scenario === 'expire' || scenario === 'refund') {
    return { ...current, status: scenario === 'expire' ? 'expired' : 'refunded', expiresAt: new Date(now - 1000).toISOString(), willRenew: false, lastEvent: scenario === 'expire' ? 'Subscription expired' : 'Purchase refunded' };
  }
  if (scenario === 'cancel') {
    return { ...current, status: 'cancelled', expiresAt: current.expiresAt ?? new Date(now + 30 * day).toISOString(), willRenew: false, lastEvent: 'Cancelled at period end' };
  }
  const annual = scenario === 'annual' || (scenario === 'renew' && current.productIdentifier === 'katchimeras_plus_annual');
  const trial = scenario === 'trial';
  return {
    ...current,
    status: trial ? 'trial' : 'active',
    productIdentifier: trial ? 'katchimeras_plus_monthly' : annual ? 'katchimeras_plus_annual' : 'katchimeras_plus_monthly',
    expiresAt: new Date(now + (trial ? 7 : annual ? 365 : 30) * day).toISOString(),
    willRenew: true,
    lastEvent: trial ? 'Trial started' : scenario === 'renew' ? 'Subscription renewed' : `${annual ? 'Annual' : 'Monthly'} subscription activated`,
  };
}

export function isDevSubscriptionStateActive(state: DevSubscriptionSimulatorState, now = Date.now()) {
  if (!state.enabled || !['trial', 'active', 'cancelled'].includes(state.status)) return false;
  return !state.expiresAt || Date.parse(state.expiresAt) > now;
}
