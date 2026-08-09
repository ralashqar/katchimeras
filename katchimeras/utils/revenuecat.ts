import Constants from 'expo-constants';
import type { RevenueCatPackageSummary } from '@/types/economy';

let configuredUserId: string | null = null;
const packageCache = new Map<string, import('react-native-purchases').PurchasesPackage>();

export async function configureRevenueCat(userId: string): Promise<boolean> {
  if (Constants.appOwnership === 'expo' || process.env.EXPO_OS === 'web') return false;
  const apiKey = process.env.EXPO_OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey) return false;
  try {
    const { default: Purchases } = await import('react-native-purchases');
    if (configuredUserId && configuredUserId !== userId) await Purchases.logIn(userId);
    else if (!configuredUserId) Purchases.configure({ apiKey, appUserID: userId });
    configuredUserId = userId;
    return true;
  } catch {
    return false;
  }
}

export async function revenueCatPlusActive(entitlementId = 'plus'): Promise<boolean> {
  if (!configuredUserId) return false;
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[entitlementId]?.isActive === true;
  } catch {
    return false;
  }
}

export async function restoreRevenueCatPurchases(entitlementId = 'plus'): Promise<boolean> {
  if (!configuredUserId) return false;
  const { default: Purchases } = await import('react-native-purchases');
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[entitlementId]?.isActive === true;
}

export async function revenueCatPackages(offeringId = 'default'): Promise<RevenueCatPackageSummary[]> {
  if (!configuredUserId) return [];
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all[offeringId] ?? offerings.current;
    packageCache.clear();
    return (offering?.availablePackages ?? []).map((item) => {
      packageCache.set(item.identifier, item);
      const productId = item.product.identifier;
      return {
        identifier: item.identifier,
        productIdentifier: productId,
        title: item.product.title,
        priceString: item.product.priceString,
        period: /annual|year/i.test(`${item.identifier}:${productId}`) ? 'annual' : /month/i.test(`${item.identifier}:${productId}`) ? 'monthly' : 'other',
      };
    });
  } catch {
    return [];
  }
}

export async function purchaseRevenueCatPackage(identifier: string, entitlementId = 'plus'): Promise<boolean> {
  const item = packageCache.get(identifier);
  if (!configuredUserId || !item) return false;
  const { default: Purchases } = await import('react-native-purchases');
  const result = await Purchases.purchasePackage(item);
  return result.customerInfo.entitlements.active[entitlementId]?.isActive === true;
}

export async function addRevenueCatPlusListener(entitlementId: string, listener: (active: boolean) => void) {
  if (!configuredUserId) return () => {};
  const { default: Purchases } = await import('react-native-purchases');
  const handler: import('react-native-purchases').CustomerInfoUpdateListener = (info) => {
    listener(info.entitlements.active[entitlementId]?.isActive === true);
  };
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => Purchases.removeCustomerInfoUpdateListener(handler);
}
