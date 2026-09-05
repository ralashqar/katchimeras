import type { RevenueCatPackageSummary } from '@/types/economy';

export type SubscriptionRuntime = 'revenuecat' | 'simulator';
export type SubscriptionOperation = 'configure' | 'packages' | 'purchase' | 'restore';
export type DevSubscriptionStatus = 'inactive' | 'trial' | 'active' | 'cancelled' | 'expired' | 'refunded';

export type DevSubscriptionSimulatorState = {
  version: 1;
  enabled: boolean;
  status: DevSubscriptionStatus;
  productIdentifier: string | null;
  expiresAt: string | null;
  willRenew: boolean;
  monthlyClaimedAt: string | null;
  nextFailure: SubscriptionOperation | null;
  lastEvent: string | null;
  revision: number;
};

export type SubscriptionClient = {
  runtime: SubscriptionRuntime;
  configure: (userId: string) => Promise<boolean>;
  isEntitled: (entitlementId: string) => Promise<boolean>;
  restore: (entitlementId: string) => Promise<boolean>;
  getPackages: (offeringId: string) => Promise<RevenueCatPackageSummary[]>;
  purchasePackage: (identifier: string, entitlementId: string) => Promise<boolean>;
  addEntitlementListener: (entitlementId: string, listener: (active: boolean) => void) => Promise<() => void>;
};
