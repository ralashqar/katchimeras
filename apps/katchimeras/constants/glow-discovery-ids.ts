/**
 * Ids the Glow discovery shares between the world policy, the flows and the
 * hatchable-companion definitions. A leaf on purpose: definitions are data and
 * must not pull the engine in behind them.
 */
export const GLOW_GATEWAY_ID = 'mossprout:overgrown-trail' as const;
export const GLOW_ORDER_IDS = ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] as const;
/** The parcel the Garden Basket arrives in: the first thing the player opens on the Garden board. */
export const MOSSPROUT_BASKET_ARRIVAL_ID = 'arrival:ftue:garden-basket';
/** The discovery's pay step: the tile's marker is the story's next tap, and the ticket paid there opens the board. */
export const HATCHABLE_MISSION_PAY_NODE_ID = 'gateway.pay';
export const HATCHABLE_MISSION_PAID_EVENT = 'glow.mission.paid';
/**
 * The nodes where a hatchable tile's marker is the next thing to tap: after the Garden lesson, and the pay
 * step. The two older ids are read-side tolerance for a save the director has not migrated yet.
 */
export const HATCHABLE_GATEWAY_NODE_IDS: readonly string[] = ['gateway.ready', HATCHABLE_MISSION_PAY_NODE_ID, 'gateway.return', 'gateway.offer'];
/** One receipt per discovery run: paying again for the same run is a no-op, on any retry or relaunch. */
export const hatchableTicketReceiptId = (runId: string) => `${runId}:ticket`;
