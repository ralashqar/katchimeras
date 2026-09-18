import { createMissionState } from '@/features/onboarding/steppling-mission';
import { unlockGardenSupply, collectGardenSupply } from './heartwood-progression';
import { placeHeartwood, reconcileHeartwoodPlants, tendHeartwood } from './heartwood-garden';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { ADVENTURE_ID, DOORSTEP_ORDER, DOORSTEP_ORDER_ID, FIRST_ANSWER, LANTERN_ROUTES, PREPARATION_ORDER, PREPARATION_ORDER_ID, routeById } from './catalog';
import type { AdventureCommand, AdventureNext, AdventureOrder, SharedAdventureProgress } from './types';

export const emptyAdventure = (): SharedAdventureProgress => ({ version: 1, clock: 0, acknowledged: {}, nextRun: 1, routeFirsts: {}, rewardDays: {}, activity: [] });
export const orderServed = (world: MergeWorldState, id: string) => world.externalRewardReceipts.some(r => r.kind === 'story_order_served' && r.id === `merge-story-served:${id}`);
export const feastleReady = (world: MergeWorldState) => Boolean(world.gardenLessons?.feastle?.servedAt || orderServed(world, 'feastle:discovery:first-snack'));
export function adventureNext(world: MergeWorldState): AdventureNext | null {
  if (!world.kingdomGoal?.introducedAt) return null;
  const progress = world.sharedAdventure;
  if (progress?.completedAt) return { kind: 'routes', title: 'Explore the Lantern Routes' };
  const scene = (beatId: NonNullable<AdventureNext['beatId']>): AdventureNext => ({ kind: 'scene', beatId, title: FIRST_ANSWER.beats.find(b => b.id === beatId)!.title });
  if (!progress?.acknowledged.wish) return scene('wish');
  if (!progress.acknowledged.trail) return scene('trail');
  if (!orderServed(world, PREPARATION_ORDER_ID)) return { kind: 'garden', title: 'Make a Plant and a Shoe for the signal' };
  if (!feastleReady(world)) return { kind: 'feastle', title: 'Find Feastle at the warm table' };
  if (!progress.acknowledged.hearth) return scene('hearth');
  if (!progress.acknowledged.welcome) return scene('welcome');
  if (!orderServed(world, DOORSTEP_ORDER_ID)) return { kind: 'garden', title: 'Make two Snacks for the doorstep' };
  if (!progress.acknowledged.post) return scene('post');
  if (!progress.postBuiltAt) return { kind: 'mission', title: 'Clear the signal site' };
  if (!progress.completedAt) return scene('answer');
  return { kind: 'routes', title: 'Explore the Lantern Routes' };
}
function ensureOrder(world: MergeWorldState, order: AdventureOrder, now: number) {
  if (!orderServed(world, order.id) && !world.activeOrders.some(o => o.id === order.id)) world.activeOrders.push({ ...structuredClone(order), createdAt: now });
}
export function routeRewardDay(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function routeRewardAvailable(progress: SharedAdventureProgress, routeId: string, now: number) {
  return (progress.rewardDays[routeId] ?? '') < routeRewardDay(Math.max(now, progress.clock));
}
/** Runs on the repository's serialized transaction. No personal Journey or Bond writes. */
export function reduceAdventure(source: MergeWorldState, command: AdventureCommand, time: number): MergeWorldCommandResult {
  if (!Number.isFinite(time)) throw new Error('Invalid adventure time');
  const world = structuredClone(source);
  const progress = world.sharedAdventure ??= emptyAdventure();
  const now = Math.max(time, progress.clock);
  const unchanged = (): MergeWorldCommandResult => ({ state: source, changed: false });
  if (command.type === 'sync_heartwood' || command.type === 'collect_garden_supply' || command.type === 'tend_heartwood' || command.type === 'place_heartwood') {
    const reconciled = reconcileHeartwoodPlants(world);
    const unlocked = unlockGardenSupply(world, now);
    const migrated = !!progress.gardenSupply && progress.gardenBedsVersion !== 2;
    if (migrated) progress.gardenBedsVersion = 2;
    if ((command.type === 'tend_heartwood' || command.type === 'place_heartwood') && !progress.gardenSupply) throw new Error('Grow Mossprout’s first Seed before tending the other roots.');
    const tended = command.type === 'place_heartwood' ? placeHeartwood(world, command.category, command.slotId, command.expectedOccupantId, now)
      : command.type === 'tend_heartwood' && tendHeartwood(world, command.category, command.expectedGrowth, now, command.slotId);
    const collected = command.type === 'collect_garden_supply' && collectGardenSupply(world, now);
    if (!unlocked && !collected && !reconciled && !tended && !migrated) return unchanged();
    if (tended) progress.activity = [...progress.activity, { at: now, kind: 'plant_tended', target: command.type === 'tend_heartwood' || command.type === 'place_heartwood' ? command.category : '' }].slice(-200);
    if (collected) progress.activity = [...progress.activity, { at: now, kind: 'supply_collected', target: 'mossprout-garden' }].slice(-200);
    progress.clock = now;
    world.revision = source.revision + 1;
    world.updatedAt = now;
    return { state: world, changed: true };
  }
  // Presentation receipts are available before the chapter's gameplay gate.
  // They never award currency, complete orders, or advance a personal Journey.
  if (command.type === 'presented') {
    if (!['introduction', 'signal', 'recap'].includes(command.scene)) throw new Error('Unknown Heartwood scene');
    if (progress.presentations?.[command.scene] != null) return unchanged();
    progress.presentations = { ...progress.presentations, [command.scene]: now };
    progress.clock = now;
    world.revision = source.revision + 1;
    world.updatedAt = now;
    return { state: world, changed: true };
  }
  const next = adventureNext(world);
  if (!next) throw new Error('Finish the first introductions before following the light.');
  let target = ADVENTURE_ID;
  if (command.type === 'acknowledge') {
    target = command.beatId;
    if (progress.acknowledged[command.beatId]) return unchanged();
    if (next.kind !== 'scene' || next.beatId !== command.beatId) throw new Error('Finish the current adventure objective first.');
    if (command.beatId === 'wish') {
      if (!command.promise || !['welcome', 'rest', 'company'].includes(command.promise)) throw new Error('Choose what the signal promises.');
      progress.promise = command.promise;
    }
    progress.acknowledged[command.beatId] = now;
    if (command.beatId === 'trail') ensureOrder(world, PREPARATION_ORDER, now);
    if (command.beatId === 'welcome') ensureOrder(world, DOORSTEP_ORDER, now);
    if (command.beatId === 'answer') progress.completedAt = now;
  } else if (command.type === 'start_route') {
    target = command.routeId;
    const route = routeById(command.routeId);
    if (!route || (route.id === 'signal-site' ? next.kind !== 'mission' : !progress.completedAt)) throw new Error('This route is not ready yet.');
    if (progress.run && !progress.run.completedAt) {
      if (progress.run.routeId === command.routeId) return unchanged();
      throw new Error('Finish the open route before starting another.');
    }
    progress.run = { id: `${ADVENTURE_ID}:run:${progress.nextRun++}`, routeId: route.id, startedAt: now, merges: 0, board: createMissionState(route.seed, route.companion, now) };
  } else if (command.type === 'move') {
    if (![command.from, command.to].every(cell => missionWindow(4).cellIndices.includes(cell))) return unchanged();
    const run = progress.run;
    if (!run || run.id !== command.runId || run.completedAt) return unchanged();
    const route = routeById(run.routeId)!;
    if (run.merges >= route.required) return unchanged();
    const result = reduceMergeWorld(run.board, { type: 'move', from: command.from, to: command.to, now });
    if (!result.changed) return unchanged();
    run.board = result.state;
    if (result.mergedCell != null) run.merges++;
    target = run.id;
  } else if (command.type === 'finish_route') {
    const run = progress.run;
    if (!run || run.id !== command.runId || run.completedAt) return unchanged();
    const route = routeById(run.routeId)!;
    if (run.merges < route.required || !run.board.board.some(c => c.occupant?.kind === 'item' && c.occupant.definitionId === route.finalItem)) throw new Error('Complete the route before bringing back its light.');
    run.completedAt = now;
    run.reward = 0;
    if (route.id === 'signal-site') progress.postBuiltAt ??= now;
    else {
      if (routeRewardAvailable(progress, route.id, now)) {
        run.reward = route.reward;
        world.coins += route.reward;
        progress.rewardDays[route.id] = routeRewardDay(now);
      }
      progress.routeFirsts[route.id] ??= now;
      if (LANTERN_ROUTES.every(r => progress.routeFirsts[r.id] != null)) progress.pathfinderAt ??= now;
    }
    target = run.id;
  } else target = command.target;
  progress.clock = now;
  progress.activity = [...progress.activity, { at: now, kind: command.type === 'diagnostic' ? command.kind : command.type, target }].slice(-200);
  world.revision = source.revision + 1;
  world.updatedAt = now;
  return { state: world, changed: true };
}
