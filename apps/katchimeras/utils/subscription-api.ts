import type { SubscriptionClient } from '@/types/subscription';
import { devSubscriptionClient, getDevSubscriptionSimulatorState } from '@/utils/dev-subscription-simulator';
import {
  addRevenueCatPlusListener,
  configureRevenueCat,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  revenueCatPackages,
  revenueCatPlusActive,
} from '@/utils/revenuecat';

const revenueCatClient: SubscriptionClient = {
  runtime: 'revenuecat',
  configure: configureRevenueCat,
  isEntitled: revenueCatPlusActive,
  restore: restoreRevenueCatPurchases,
  getPackages: revenueCatPackages,
  purchasePackage: purchaseRevenueCatPackage,
  addEntitlementListener: addRevenueCatPlusListener,
};

export function isSubscriptionSimulatorEnabled() {
  return getDevSubscriptionSimulatorState().enabled;
}

export function activeSubscriptionClient(): SubscriptionClient {
  return isSubscriptionSimulatorEnabled() ? devSubscriptionClient : revenueCatClient;
}

/** Shared subscription API. Production and the development simulator implement this same contract. */
export const subscriptionApi: SubscriptionClient = {
  get runtime() { return activeSubscriptionClient().runtime; },
  configure: (userId) => activeSubscriptionClient().configure(userId),
  isEntitled: (entitlementId) => activeSubscriptionClient().isEntitled(entitlementId),
  restore: (entitlementId) => activeSubscriptionClient().restore(entitlementId),
  getPackages: (offeringId) => activeSubscriptionClient().getPackages(offeringId),
  purchasePackage: (identifier, entitlementId) => activeSubscriptionClient().purchasePackage(identifier, entitlementId),
  addEntitlementListener: (entitlementId, listener) => activeSubscriptionClient().addEntitlementListener(entitlementId, listener),
};
