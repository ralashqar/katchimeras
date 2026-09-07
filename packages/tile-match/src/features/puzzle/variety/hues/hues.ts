/**
 * One footprint keeps changing colour. Drop its piece only while it matches.
 *
 * The tray's colours are **fixed**; the ghost cycles. Every `windowMs` the footprint flips between its own piece's
 * colour and a decoy, so half the time it will take the piece and half the time it will refuse it — and because
 * **colour is a rule** (`matchesColour`), dropping on it while mismatched fails completely.
 *
 * ## The turn is always one piece and one footprint
 *
 * `shape` trims it to that, whatever the level or the rung asked for, because the mechanic *is* a single decision
 * held under a clock: hold this piece, watch this target, drop when it matches. Two earlier versions both got this
 * wrong in the same direction and are worth knowing about, because both looked reasonable:
 *
 * - **Swatching every footprint of a double.** The windows are in phase, so the player was not waiting for *a*
 *   colour but for the only moment both agreed with their pieces — one window in two rather than one in one, which
 *   is a much harder mechanic than it reads as.
 * - **Swatching one footprint and leaving the other alone.** Fairer, and still not the mechanic: the player has two
 *   drags to plan, the interesting one is the one they are not allowed to make yet, and the turn reads as an
 *   ordinary double with a stalled corner rather than as a colour clock.
 *
 * The consequence for level authors is that `hues` **cannot be combined with a variety that needs two pieces**.
 * `crossed` is the one that matters, and the gauntlet's crossed-plus-hues turn went with this change rather than
 * quietly becoming a hues turn wearing a second id.
 *
 * ## Why the ghost moves and the piece does not
 *
 * The other way round would be easier to build and much worse to play. A piece whose colour changed in your
 * hand would mean the thing you are *holding* becomes wrong mid-drag, which reads as the game cheating. A ghost
 * that changes is a light going red: the target is telling you to wait, which is information rather than
 * betrayal.
 *
 * ## Why it flips rather than rotating through the palette
 *
 * The obvious implementation — rotate the beat's colours among its footprints — is **unsolvable**. With two
 * groups, rotating means group 0 shows group 1's colour and vice versa, so piece A now matches the footprint
 * whose *shape* belongs to piece B. There is no drop that both matches and fits, and the dealer's standing
 * guarantee that a perfect beat is always available would be broken every other window.
 *
 * Flipping between own-colour and a decoy keeps a perfect beat permanently reachable: it is simply not reachable
 * *right now*. That makes this a timing mechanic — the same shape as the cycling bomb, and deliberately so, so
 * the two read as siblings rather than as two unrelated ideas about clocks.
 *
 * The decoy is drawn from colours **no footprint in this beat is using**, so a mismatched ghost never implies
 * "this belongs to the other piece". It says "not yet", which is the only thing it should say.
 *
 * Capabilities: **B** (data), **C** (schedule), and the `recolour` effect. No `accepts` — the global colour rule
 * already does the enforcing, which is exactly the division of labour that rule was made a rule for.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../../core/rng';
import { BLOCK_COLOR_IDS } from '../../engine/types';
import type { BlockColorId } from '../../engine/types';
import { defineVariety } from '../contract';

/**
 * How long a footprint holds each colour, milliseconds.
 *
 * Sized against the pace budget the same way the bomb's window is: a double allows ~1.2s a piece, so a window
 * has to be comfortably longer than one drag or a player who began during a matching window would land during a
 * mismatched one — a failure they could not have avoided.
 *
 * The turn is one drop, so a window is comfortably more than the whole beat's budget. Waiting is therefore the cost
 * of arriving mid-window, which is the mechanic, rather than the cost of playing at all.
 */
export const HUES_WINDOW_MS = 2200;

/** How much `strength` may shorten the window, as a fraction. */
export const HUES_WINDOW_SQUEEZE = 0.35;

export type HuesData = {
  /**
   * The **one** footprint that changes colour: its own colour, and the decoy it flips to.
   *
   * A `Record` holding a single entry rather than a pair of fields, because `recolour` speaks in group ids and
   * ignoring ids it was not given is already how it leaves everything else alone.
   *
   * Still a `Record` and still keyed by id, even though `shape` guarantees there is only ever one entry: that is
   * what `recolour` speaks, and a `Record` that happens to hold one thing needs no special case at either end.
   *
   * See the header for the two earlier versions and why both were wrong — the short form is that the beat is now
   * trimmed to one footprint rather than one footprint of several being singled out.
   */
  swatches: Readonly<Record<string, { own: BlockColorId; decoy: BlockColorId }>>;
  windowMs: number;
  nextSwapMs: number;
  /** True while the affected footprint is showing its decoy. */
  swapped: boolean;
};

/** The hold at a given strength, in milliseconds. */
export function huesWindowMs(strength: number): number {
  const clamped = Math.min(1, Math.max(0, strength));
  return Math.round(HUES_WINDOW_MS * (1 - HUES_WINDOW_SQUEEZE * clamped));
}

/** What every footprint should show right now. Shared by `expire` and the view. */
export function huesColors(data: HuesData): Readonly<Record<string, BlockColorId>> {
  const colors: Record<string, BlockColorId> = {};
  for (const [id, swatch] of Object.entries(data.swatches)) {
    colors[id] = data.swapped ? swatch.decoy : swatch.own;
  }
  return colors;
}

export const HUES_VARIETY = defineVariety<HuesData>({
  id: 'hues',

  /**
   * **Trim the beat to one footprint and one piece.**
   *
   * This is the mechanic's shape, not a difficulty dial. The ask is *hold this piece, watch this target, drop when
   * it matches* — and on a two-piece beat the second placement is a distraction from exactly that. Swatching one
   * half of a double and leaving the other alone was the first attempt at the same idea, and it is a worse version
   * of it: the player still has two drags to plan, and the interesting one is the one they are not allowed to do
   * yet, so the turn reads as an ordinary double with a stalled corner rather than as a colour clock.
   *
   * Which footprint survives is **rolled**, so the beat cannot be learned as "always the left one" — and the roll
   * lives here rather than in `deal` because after this there is only one group left to swatch. Total rng
   * consumption is unchanged: one roll here and one for the decoy, where `deal` used to take both.
   *
   * Trimming can only ever *help* solvability — every surviving footprint is still its own piece's shape at a known
   * origin — so the standing "a perfect beat is always available" guarantee holds without an argument. The one thing
   * it must not do is empty the tray, which would resolve the beat before the player touched it; if the kept group's
   * piece cannot be found the beat is left exactly as dealt.
   */
  shape: (ctx) => {
    const pick = nextInt(ctx.rngState, Math.max(1, ctx.groups.length));
    const kept = ctx.groups[pick.value];
    const piece = kept ? ctx.tray.find((entry) => entry.id === kept.pieceId) : undefined;
    if (!kept || !piece) {
      return { groups: [...ctx.groups], tray: [...ctx.tray], rngState: pick.state };
    }
    return { groups: [kept], tray: [piece], rngState: pick.state };
  },

  /**
   * Give the beat's one footprint a decoy to flip to.
   *
   * `shape` has already reduced the beat to a single group, so there is nothing to choose between here — every
   * group present gets a swatch, and there is exactly one. Written as a loop over `ctx.groups` rather than as
   * `ctx.groups[0]` so that a caller who invoked `deal` without `shape` still produces coherent data instead of
   * silently swatching whichever footprint happened to be first.
   *
   * The decoy is chosen from colours **this beat is not using**, so a mismatched ghost cannot be misread as
   * belonging to another piece. With five block colours and one footprint there are always four to choose from, so
   * this cannot fail — but it falls back to the group's own colour if it ever did, which degrades to "this
   * footprint never lies" rather than to a crash.
   *
   * The roll is **unconditional**, which is what the contract's rng rule asks for: the generator advances by the
   * same amount whatever the beat looked like. A roll taken only when there was something to roll for is the thing
   * that makes deals diverge.
   */
  deal: (ctx, strength) => {
    const taken = new Set(ctx.groups.map((group) => group.colorId));
    const free = BLOCK_COLOR_IDS.filter((id) => !taken.has(id));
    const roll = nextInt(ctx.rngState, Math.max(1, free.length));

    const swatches: Record<string, { own: BlockColorId; decoy: BlockColorId }> = {};
    for (const target of ctx.groups) {
      const decoy = free.length > 0 ? free[roll.value % free.length]! : target.colorId;
      swatches[target.id] = { own: target.colorId, decoy };
    }

    const windowMs = huesWindowMs(strength);
    return {
      /**
       * Opens with a swap **already due**, so the first thing the turn asks for is a wait.
       *
       * The reverse was tried first — opening on the true colours, playable immediately — on the reasoning that
       * opening mismatched punishes a quick reader. It has the same flaw the cycling bomb's disarmed opening had,
       * and for the same reason: a brisk player drops inside the first window and the mechanic **never happens to
       * them**. The colours agreed, nothing refused anything, and the turn was an ordinary turn.
       *
       * ## Why `nextSwapMs: 0` rather than `swapped: true`
       *
       * Because `swapped` alone would be a lie for as long as it took to become true. The flag lives in this
       * variety's data, but what the player *sees* — and what `matchesColour` enforces — is `group.colorId`, and
       * the only thing that moves that is the `recolour` effect from `expire`. So a beat dealt `swapped: true`
       * would claim to be mismatched while showing, and accepting, the true colours.
       *
       * A deadline of zero means the first tick of the beat crosses it, `expire` computes window 0, and the decoys
       * go up through the one path that repaints anything. The cost is a single frame of honest truth before the
       * first tick lands, which the footprints' own staggered entrance covers several times over.
       */
      data: { swatches, windowMs, nextSwapMs: 0, swapped: false },
      rngState: roll.state,
    };
  },

  deadlineMs: (data) =>
    Object.keys(data.swatches).length === 0 ? null : data.nextSwapMs,

  /**
   * A mismatched footprint costs the player one whole window of standing still.
   *
   * And it *always* does, on every beat, because the deal opens on the decoy — so unlike the bomb's variants there
   * is no case here that costs nothing. That makes this the mechanic the pace allowance was most needed for: before
   * it, every hues beat charged a player for a wait the beat itself had insisted on.
   *
   * One window, which is now simply the truth rather than an approximation: only one footprint ever changes, so
   * there is only one wait to allow for.
   */
  waitMs: (data) => (Object.keys(data.swatches).length === 0 ? 0 : data.windowMs),

  /**
   * Flip every footprint, and say what they should now show.
   *
   * Derived from *how many* windows have elapsed rather than stepped once, so a late tick — a stalled frame, a
   * backgrounded app — lands on the right colour instead of leaving the schedule permanently behind. Same
   * reasoning, and the same off-by-one to avoid, as the bomb's cycle.
   */
  expire: (data, beatElapsedMs) => {
    const window = Math.floor(beatElapsedMs / data.windowMs);
    const next: HuesData = {
      ...data,
      // Window 0 shows the **decoys** — see `deal` — so the true colours are up on the odd windows.
      swapped: window % 2 === 0,
      nextSwapMs: (window + 1) * data.windowMs,
    };
    return { data: next, effects: [{ kind: 'recolour', colors: huesColors(next) }] };
  },
});
