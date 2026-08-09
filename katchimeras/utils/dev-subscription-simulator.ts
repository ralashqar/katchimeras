import type { DevSubscriptionSimulatorState, SubscriptionClient, SubscriptionOperation } from '@/types/subscription';
import { getStoredJson, getStoredRaw, setStoredJson } from '@/utils/app-storage';
import {
  DEFAULT_DEV_SUBSCRIPTION_STATE,
  DEV_SUBSCRIPTION_PACKAGES,
  isDevSubscriptionStateActive,
  reduceDevSubscriptionScenario,
  type DevSubscriptionScenario,
} from '@/utils/subscription-simulator-engine';

const STORAGE_KEY = 'katchadeck.dev.subscription-simulator-v1';
const listeners = new Set<() => void>();
const entitlementListeners = new Set<(active: boolean) => void>();
let cachedState: DevSubscriptionSimulatorState | null = null;
let cachedRaw: string | null | undefined;

function isDevBuild() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function normalizeState(value: unknown): DevSubscriptionSimulatorState {
  if (!isDevBuild() || !value || typeof value !== 'object') return DEFAULT_DEV_SUBSCRIPTION_STATE;
  const candidate = value as Partial<DevSubscriptionSimulatorState>;
  const statuses = new Set(['inactive', 'trial', 'active', 'cancelled', 'expired', 'refunded']);
  const failures = new Set(['configure', 'packages', 'purchase', 'restore']);
  return {
    version: 1,
    enabled: candidate.enabled === true,
    status: statuses.has(candidate.status ?? '') ? candidate.status! : 'inactive',
    productIdentifier: typeof candidate.productIdentifier === 'string' ? candidate.productIdentifier : null,
    expiresAt: typeof candidate.expiresAt === 'string' ? candidate.expiresAt : null,
    willRenew: candidate.willRenew === true,
    monthlyClaimedAt: typeof candidate.monthlyClaimedAt === 'string' ? candidate.monthlyClaimedAt : null,
    nextFailure: failures.has(candidate.nextFailure ?? '') ? candidate.nextFailure! : null,
    lastEvent: typeof candidate.lastEvent === 'string' ? candidate.lastEvent : null,
    revision: Math.max(0, Math.floor(Number(candidate.revision) || 0)),
  };
}

export function getDevSubscriptionSimulatorState() {
  const raw = getStoredRaw(STORAGE_KEY);
  if (cachedState && raw === cachedRaw) return cachedState;
  cachedRaw = raw;
  cachedState = normalizeState(getStoredJson<unknown>(STORAGE_KEY, DEFAULT_DEV_SUBSCRIPTION_STATE));
  return cachedState;
}

export function subscribeDevSubscriptionSimulator(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function saveState(next: DevSubscriptionSimulatorState) {
  if (!isDevBuild()) return DEFAULT_DEV_SUBSCRIPTION_STATE;
  const previousActive = isDevSubscriptionActive(getDevSubscriptionSimulatorState());
  const saved = { ...normalizeState(next), revision: getDevSubscriptionSimulatorState().revision + 1 };
  cachedState = saved;
  cachedRaw = JSON.stringify(saved);
  setStoredJson(STORAGE_KEY, saved);
  listeners.forEach((listener) => listener());
  const active = isDevSubscriptionActive(saved);
  if (active !== previousActive) entitlementListeners.forEach((listener) => listener(active));
  return saved;
}

export function setDevSubscriptionSimulatorEnabled(enabled: boolean) {
  const current = getDevSubscriptionSimulatorState();
  return saveState({ ...current, enabled, lastEvent: enabled ? 'Simulator enabled' : 'Simulator disabled' });
}

export function setDevSubscriptionNextFailure(operation: SubscriptionOperation | null) {
  const current = getDevSubscriptionSimulatorState();
  return saveState({ ...current, nextFailure: operation, lastEvent: operation ? `Next ${operation} will fail` : 'Failure cleared' });
}

export function applyDevSubscriptionScenario(
  scenario: DevSubscriptionScenario,
  now = Date.now(),
) {
  const current = getDevSubscriptionSimulatorState();
  return saveState(reduceDevSubscriptionScenario(current, scenario, now));
}

export function resetDevSubscriptionSimulator() {
  return saveState({ ...DEFAULT_DEV_SUBSCRIPTION_STATE, enabled: true, lastEvent: 'Simulator reset' });
}

export function isDevSubscriptionActive(state = getDevSubscriptionSimulatorState(), now = Date.now()) {
  return isDevSubscriptionStateActive(state, now);
}

export function claimDevMonthlyWisp(now = Date.now()) {
  const current = getDevSubscriptionSimulatorState();
  if (!isDevSubscriptionActive(current) || current.monthlyClaimedAt) return false;
  saveState({ ...current, monthlyClaimedAt: new Date(now).toISOString(), lastEvent: 'Monthly Opal claimed' });
  return true;
}

function consumeFailure(operation: SubscriptionOperation) {
  const current = getDevSubscriptionSimulatorState();
  if (current.nextFailure !== operation) return false;
  saveState({ ...current, nextFailure: null, lastEvent: `${operation} failed as requested` });
  return true;
}

export const devSubscriptionClient: SubscriptionClient = {
  runtime: 'simulator',
  async configure() {
    return !consumeFailure('configure');
  },
  async isEntitled() {
    return isDevSubscriptionActive();
  },
  async restore() {
    if (consumeFailure('restore')) throw new Error('Simulated restore failure');
    const current = getDevSubscriptionSimulatorState();
    saveState({ ...current, lastEvent: isDevSubscriptionActive(current) ? 'Purchase restored' : 'Restore found no active purchase' });
    return isDevSubscriptionActive();
  },
  async getPackages() {
    if (consumeFailure('packages')) return [];
    return DEV_SUBSCRIPTION_PACKAGES;
  },
  async purchasePackage(identifier) {
    if (consumeFailure('purchase')) return false;
    const item = DEV_SUBSCRIPTION_PACKAGES.find((candidate) => candidate.identifier === identifier);
    if (!item) return false;
    applyDevSubscriptionScenario(item.period === 'annual' ? 'annual' : 'trial');
    return true;
  },
  async addEntitlementListener(_entitlementId, listener) {
    entitlementListeners.add(listener);
    return () => entitlementListeners.delete(listener);
  },
};
