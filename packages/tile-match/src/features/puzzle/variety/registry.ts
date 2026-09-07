/**
 * Every variety's pure half, and the folds the engine applies over them.
 *
 * ## The one structural rule
 *
 * **This file must never reach a view.** It is imported by `slot-deal.ts` and `slot-reducer.ts`, which are
 * pure engine modules that `node --test` loads directly by stripping types — so a transitive import of
 * React, Reanimated or Skia would execute inside the test process and take the whole suite down. The same
 * constraint `ui/tokens.ts` documents for itself, for the same reason.
 *
 * So a variety is two registrations, not one: its logic here, its layers in `view-registry.ts`. The pair
 * is checked by a test rather than by convention — `variety.test.ts` asserts the two id sets match
 * exactly, which is what stops a variety that draws nothing or, worse, one that draws with no rules
 * behind it.
 *
 * ## The pattern this copies
 *
 * `camera-system.ts` and `race-cameras.ts`: machinery in one module, the table in another, generic over an
 * id union so the keys are exhaustively checked. And the id union is *derived* from the table with
 * `keyof typeof`, the way `Icon.tsx` does it, so a variety is named in exactly one place.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { ARMOUR_VARIETY } from './armour/armour';
import { BOMB_VARIETY } from './bomb/bomb';
import { CROSSED_VARIETY } from './crossed/crossed';
import { HUES_VARIETY } from './hues/hues';
import { DRIFT_VARIETY } from './drift/drift';
import { FUSE_VARIETY } from './fuse/fuse';
import type {
  AbsorbInput,
  BeatShape,
  PlaceInput,
  DealContext,
  VarietyDef,
  VarietyEffect,
  VarietyRequest,
  VarietySpec,
} from './contract';
import type { Beat, SlotGroup } from '../engine/slot-types';
import type { Piece } from '../engine/types';

/**
 * The table.
 *
 * `Record<string, VarietyDef<any>>` rather than a union of concrete data types, and that is the deliberate
 * trade at the heart of this design: the engine treats `data` as opaque, so it needs no knowledge of any
 * variety, so adding one touches no shared file. The type safety that buys it back sits at the definition
 * site — `defineVariety<Data>` pins every hook — and at the read site, where `varietyData<Data>` is the
 * only cast in the system.
 *
 * The alternative, a discriminated union, would make every shared file name every mode. That is precisely
 * the entanglement this exists to prevent.
 */
const VARIETIES = {
  drift: DRIFT_VARIETY,
  bomb: BOMB_VARIETY,
  crossed: CROSSED_VARIETY,
  hues: HUES_VARIETY,
  armour: ARMOUR_VARIETY,
  fuse: FUSE_VARIETY,
} as const satisfies Record<string, VarietyDef<any>>;

/** Every variety's id, derived from the table so a name exists in one place only. */
export type VarietyId = keyof typeof VARIETIES;

export const VARIETY_IDS = Object.keys(VARIETIES) as VarietyId[];

/** Whether a string names a registered variety. Levels are data, so their ids need validating. */
export function isVarietyId(id: string): id is VarietyId {
  return Object.prototype.hasOwnProperty.call(VARIETIES, id);
}

/**
 * Look one up.
 *
 * Returns `undefined` rather than throwing, because the callers are folds over a beat's own specs and a
 * beat can outlive a registry change — a saved run, a level config naming a variety that has since been
 * removed. Skipping an unknown variety degrades to "that beat has one fewer decoration", which is a far
 * better failure than a crash mid-race.
 */
export function varietyDef(id: string): VarietyDef<any> | undefined {
  return isVarietyId(id) ? VARIETIES[id] : undefined;
}

/**
 * How a fold finds a variety's definition.
 *
 * Every fold below takes one, defaulting to the real registry — the same separation of machinery from table
 * that `camera-system.ts` keeps from `race-cameras.ts`. Two things fall out of it, and the second is why it
 * is here rather than being added later:
 *
 *  - The folds become testable **before any mode ships**. The timed and gating capabilities exist for modes
 *    that do not exist yet; without injection the only way to exercise them would be to register a fake
 *    variety in the production table, which is exactly the sort of thing that survives to a release.
 *  - It makes the coupling explicit. A fold that reaches for a module-level table is a fold you cannot
 *    reason about in isolation, however pure it otherwise is.
 */
export type VarietyLookup = (id: string) => VarietyDef<any> | undefined;

// ---------------------------------------------------------------- the folds
//
// Everything below is called from the engine. Each one is a fold over a beat's requests or specs, written
// so that a beat with no varieties takes the cheapest possible path — usually returning the input
// untouched, by identity, because the reducer's whole no-op contract rests on referential equality.

/**
 * Let each requested variety rewrite the beat's skeleton, in order.
 *
 * Runs before `deal`, so a variety that splits a footprint is resolving against the groups it created
 * rather than the ones the dealer laid out. Order is the progression's order, which is the order a level
 * author wrote them in — two varieties both reshaping the same beat is legal and their composition is
 * their own business, but it is worth knowing it is sequential rather than merged.
 */
export function shapeBeat(
  requests: readonly VarietyRequest[],
  ctx: DealContext,
  resolve: VarietyLookup = varietyDef,
): BeatShape | null {
  let shaped: BeatShape | null = null;

  for (const request of requests) {
    const def = resolve(request.id);
    if (!def?.shape) continue;
    const current: DealContext = shaped
      ? { ...ctx, groups: shaped.groups, tray: shaped.tray, rngState: shaped.rngState }
      : ctx;
    shaped = def.shape(current, request.strength);
  }

  return shaped;
}

/**
 * Resolve every requested variety onto the beat.
 *
 * Threads the generator through each in turn and returns the specs to freeze onto the `Beat`. A request
 * naming an unregistered variety is dropped **without consuming a roll**, which is the honest choice: it
 * never ran, so it never advanced anything, and the alternative would make the rng depend on which
 * varieties happen to be compiled in.
 */
export function dealVarieties(
  requests: readonly VarietyRequest[],
  ctx: DealContext,
  resolve: VarietyLookup = varietyDef,
): { varieties: VarietySpec[]; rngState: number } {
  const varieties: VarietySpec[] = [];
  let rngState = ctx.rngState;

  for (const request of requests) {
    const def = resolve(request.id);
    if (!def) continue;
    const resolved = def.deal({ ...ctx, rngState }, request.strength);
    rngState = resolved.rngState;
    varieties.push({ id: request.id, data: resolved.data });
  }

  return { varieties, rngState };
}

/**
 * The soonest a variety on this beat wants to be told time has passed, or `null` if none do.
 *
 * The caller uses this to decide whether ticking is worth doing at all: a beat whose varieties have no
 * deadlines never needs a `tick` dispatched, so the common case costs nothing.
 */
export function nextDeadlineMs(beat: Beat, resolve: VarietyLookup = varietyDef): number | null {
  let soonest: number | null = null;

  for (const spec of beat.varieties) {
    const at = resolve(spec.id)?.deadlineMs?.(spec.data);
    if (at === null || at === undefined) continue;
    if (soonest === null || at < soonest) soonest = at;
  }

  return soonest;
}

/**
 * Advance every variety whose deadline has passed.
 *
 * **Returns `null` when nothing changed**, and that is load-bearing rather than tidy: the reducer converts
 * it straight into an identity return, `use-match` treats identity as a no-op, and so an uneventful tick —
 * which is almost all of them, sixty times a second — costs not one re-render. Without this the run state
 * would change every frame and the promise that React state holds only discrete things would be gone.
 */
export function expireVarieties(
  beat: Beat,
  beatElapsedMs: number,
  resolve: VarietyLookup = varietyDef,
): { varieties: VarietySpec[]; effects: VarietyEffect[] } | null {
  let varieties: VarietySpec[] | null = null;
  const effects: VarietyEffect[] = [];

  beat.varieties.forEach((spec, index) => {
    const def = resolve(spec.id);
    if (!def?.expire || !def.deadlineMs) return;

    const at = def.deadlineMs(spec.data);
    if (at === null || beatElapsedMs < at) return;

    const advanced = def.expire(spec.data, beatElapsedMs);
    // Copy on first change only, so an untouched beat keeps its own array and its own identity.
    if (!varieties) varieties = [...beat.varieties];
    varieties[index] = { id: spec.id, data: advanced.data };
    effects.push(...advanced.effects);
  });

  return varieties ? { varieties, effects } : null;
}

/**
 * Tell every variety that a piece was played, and collect what they ask for.
 *
 * **Returns `null` when nothing reacted**, on the same reasoning as `expireVarieties`: an ordinary beat has no
 * variety with an `onPlace` hook, so the common path allocates nothing and the caller keeps its own arrays.
 *
 * Note the order of effects is registry order, not importance. Today only `voidBeat` is emitted here and the
 * caller treats it as a latch, so ordering cannot matter; if two varieties ever emit competing effects, that is
 * the moment to give effects a precedence rather than to rely on which was registered first.
 */
export function observePlacement(
  beat: Beat,
  input: PlaceInput,
  resolve: VarietyLookup = varietyDef,
): { varieties: VarietySpec[]; effects: VarietyEffect[] } | null {
  let varieties: VarietySpec[] | null = null;
  const effects: VarietyEffect[] = [];

  beat.varieties.forEach((spec, index) => {
    const def = resolve(spec.id);
    if (!def?.onPlace) return;

    const reacted = def.onPlace(spec.data, input);
    // Copy on first change only, so an untouched beat keeps its own array and its own identity.
    if (!varieties) varieties = [...beat.varieties];
    varieties[index] = { id: spec.id, data: reacted.data };
    effects.push(...reacted.effects);
  });

  return varieties ? { varieties, effects } : null;
}

/**
 * How much waiting this beat's mechanics can force on the player, in milliseconds.
 *
 * Summed across varieties rather than maxed, because two waiting mechanics on one beat genuinely can make the
 * player wait twice — the gauntlet's `crossed` + `hues` turn is the shape, and a beat carrying both a bomb and a
 * colour clock would be another. Summing over-allows when the two windows happen to overlap, and that is the right
 * direction to be wrong in: a budget slightly too wide costs a flat bonus nobody notices, where one too narrow
 * hands out a verdict the player could not have avoided.
 *
 * Returns 0 for an ordinary beat without allocating, which is every beat below the ladder's hard rungs.
 */
export function beatPaceAllowanceMs(beat: Beat, resolve: VarietyLookup = varietyDef): number {
  let total = 0;
  for (const spec of beat.varieties) {
    const def = resolve(spec.id);
    if (!def?.waitMs) continue;
    total += Math.max(0, def.waitMs(spec.data));
  }
  return total;
}

/**
 * Does any variety eat this drop before it is scored?
 *
 * Returns `null` when none does, which is every drop in every beat that carries no absorbing variety — and, for
 * one that does, still most of them. That has to stay the cheap path: this runs on the drag's release, ahead of
 * scoring, on the JS thread the 3D view is drawing from.
 *
 * **First claim wins, and the fold stops there.** Unlike the other folds this does not compose, and that is
 * deliberate rather than an oversight: absorbing suspends the beat and hands the piece back, so two varieties both
 * eating one drop would each believe they had consumed it while only one drop happened. If two absorbing
 * mechanics ever share a beat, that is the moment to give them a precedence — not the moment to let both run.
 */
export function absorbDrop(
  beat: Beat,
  input: AbsorbInput,
  resolve: VarietyLookup = varietyDef,
): { varieties: VarietySpec[] } | null {
  for (let index = 0; index < beat.varieties.length; index += 1) {
    const spec = beat.varieties[index];
    const def = resolve(spec.id);
    if (!def?.absorb) continue;

    const eaten = def.absorb(spec.data, input);
    if (!eaten) continue;

    const varieties = [...beat.varieties];
    varieties[index] = { id: spec.id, data: eaten.data };
    return { varieties };
  }
  return null;
}

/**
 * The groups that will take this piece.
 *
 * Folded *before* the drop is scored, so a refusal is expressed as the group simply not being a candidate
 * — the piece then overlaps nothing scorable, coverage comes out 0 and the grade comes out `miss` through
 * the path a badly aimed drop already takes. `scorePlacement` is untouched and knows nothing about any of
 * this.
 *
 * Returns the input array by identity when every group accepts, which is every beat until a gating variety
 * exists — so the common case allocates nothing.
 */
export function eligibleGroups(
  beat: Beat,
  piece: Piece,
  resolve: VarietyLookup = varietyDef,
): readonly SlotGroup[] {
  const gates = beat.varieties.filter((spec) => resolve(spec.id)?.accepts);
  if (gates.length === 0) return beat.groups;

  const allowed = beat.groups.filter((group) =>
    gates.every((spec) => resolve(spec.id)?.accepts?.(spec.data, { group, piece }) ?? true),
  );

  return allowed.length === beat.groups.length ? beat.groups : allowed;
}
