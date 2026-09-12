/**
 * Ids the Glow discovery shares between the world policy, the flows and the
 * hatchable-companion definitions. A leaf on purpose: definitions are data and
 * must not pull the engine in behind them.
 */
export const GLOW_GATEWAY_ID = 'mossprout:overgrown-trail' as const;
export const GLOW_ORDER_IDS = ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] as const;
/** The parcel the Garden Basket arrives in: the first thing the player opens on the Garden board. */
export const MOSSPROUT_BASKET_ARRIVAL_ID = 'arrival:ftue:garden-basket';
