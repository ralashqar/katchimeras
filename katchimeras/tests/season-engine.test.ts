import assert from 'node:assert/strict';
import test from 'node:test';

import { SEASON_CATALOG } from '@/constants/season-catalog';
import type { MetaEvent } from '@/types/meta-game';
import { applySeasonEvents, claimSeasonTier, emptySeasonProgress } from '@/utils/season-engine';

const event = (id: string, kind: MetaEvent['kind']): MetaEvent => ({ id, kind, localDayId: '2026-08-13', occurredAt: 1, sourceHash: 'safe' });

test('season XP uses the shared receipt-safe meta events', () => {
  const initial = emptySeasonProgress(SEASON_CATALOG[0].id);
  const events = [event('capture:1', 'capture'), event('hatch:1', 'hatch')];
  const first = applySeasonEvents(initial, events);
  const retried = applySeasonEvents(first, events);
  assert.equal(first.xp, 40);
  assert.equal(retried, first);
});

test('free and premium claims use the same progression track', () => {
  const season = SEASON_CATALOG[0];
  const eligible = { ...emptySeasonProgress(season.id), xp: 100, premium: true };
  const free = claimSeasonTier(eligible, season, 'tier-1', 'free');
  const premium = claimSeasonTier(free.state, season, 'tier-1', 'premium');
  assert.equal(free.reward?.kind, 'merge_energy');
  assert.equal(premium.reward?.kind, 'gems');
  assert.equal(claimSeasonTier(premium.state, season, 'tier-1', 'premium').reward, null);
});
