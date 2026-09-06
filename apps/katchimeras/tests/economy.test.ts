import assert from 'node:assert/strict';
import test from 'node:test';

import { WISP_CATALOG, READY_WISPS } from '@/constants/wisps';
import { avatarEssencePrice, FALLBACK_ECONOMY_CONFIG, deterministicVisitorOffer, normalizeEconomyConfig } from '@/utils/economy-config';
import { historyDaysForAccess } from '@/utils/history-access';
import type { EconomyConfig } from '@/types/economy';

test('the generated catalog contains 51 ready and 69 planned Wisps', () => {
  assert.equal(WISP_CATALOG.length, 120);
  assert.equal(READY_WISPS.length, 51);
  assert.equal(WISP_CATALOG.filter((item) => item.availability === 'planned').length, 69);
  assert.equal(WISP_CATALOG.find((item) => item.id === 'orbit')?.unlockRule?.target, 400);
});

test('visitor choices are deterministic, unique, and exclude owned Wisps', () => {
  const config: EconomyConfig = {
    ...FALLBACK_ECONOMY_CONFIG,
    visitor: { ...FALLBACK_ECONOMY_CONFIG.visitor, enabled: true, pool: ['sprout', 'steam', 'page', 'relic'] },
  };
  const input = { userSeed: 'user-1', claimIndex: 0, capturedDays: 7, owned: new Set(['steam'] as const), config };
  const first = deterministicVisitorOffer(input);
  const second = deterministicVisitorOffer(input);
  assert.deepEqual(first, second);
  assert.equal(first?.choices.length, 3);
  assert.equal(new Set(first?.choices).size, first?.choices.length);
  assert.equal(first?.choices.includes('steam'), false);
});

test('remote config cannot activate planned Wisp IDs', () => {
  const config = normalizeEconomyConfig({
    ...FALLBACK_ECONOMY_CONFIG,
    version: 2,
    flags: { ...FALLBACK_ECONOMY_CONFIG.flags, wispShop: true },
    shop: { offers: [
      { id: 'ready', collectibleType: 'wisp', collectibleId: 'orbit', currency: 'essence', price: 400, enabled: true },
      { id: 'planned', collectibleType: 'wisp', collectibleId: 'opal', currency: 'essence', price: 400, enabled: true },
    ] },
  });
  assert.deepEqual(config.shop.offers.map((offer) => offer.id), ['ready']);
});

test('avatar prices are category and rarity driven', () => {
  assert.equal(avatarEssencePrice('body', 'legendary'), 900);
  assert.equal(avatarEssencePrice('face', 'rare'), 120);
  assert.equal(avatarEssencePrice('hat', 'epic'), 320);
  assert.equal(avatarEssencePrice('held', 'common'), 80);
});

test('free historical insight is scoped to the latest fourteen calendar days', () => {
  const days = Array.from({ length: 20 }, (_, index) => ({ isoDate: `2026-07-${String(index + 1).padStart(2, '0')}` }));
  assert.equal(historyDaysForAccess(days, false).length, 14);
  assert.equal(historyDaysForAccess(days, true).length, 20);
});
