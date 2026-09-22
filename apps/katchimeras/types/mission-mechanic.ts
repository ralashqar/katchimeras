/**
 * A mission board's mechanic: how a merge on the docked board becomes a
 * strike on the wisps over its tile, where the wisps hang, how many hits each
 * takes and when the mission is done. Authored as data on the mission (a
 * hatchable friend's mist mission, a journey tile's board, an island's
 * restoration board); absent, the board plays the way every board has so far.
 *
 * `glow-strikes` is that way: one strike per merge or waking, wisps scattered
 * over the tile, the clearing dealt across them in order, the last falling on
 * the final strike. `column-shot` fires what a merge makes straight up the
 * board's column; bigger things hit harder, and the wisps sit on a grid above
 * the board with hit points of their own, so where you merge matters.
 */

/** Where a wisp hangs: over the tile (fractions of the tile's frame), or on the sky grid above the board. */
export type WispPlacement =
  | { kind: 'tile'; fx: number; fy: number; size: number }
  /** `row` 0 is the row just above the board's top row; `size` is a fraction of a board cell (default 0.9). */
  | { kind: 'board'; column: number; row: number; size?: number };

export type ColumnShotWisp = { id: string; column: number; row: number; hp: number; size?: number };

/**
 * How a Dark Wisp fights back, every `every` actions the player spends: a
 * shrouder covers an open cell in Mist again; a hungry one eats the lowest
 * loose piece; a rootbound one spreads root Mist (and takes extra from plant
 * merges); a mender heals when it has not been struck since its last turn.
 */
export type DarkWispBehaviour =
  | { kind: 'plain' }
  | { kind: 'shrouder'; every: number }
  | { kind: 'hungry'; every: number; maxTier: number }
  | { kind: 'rootbound'; every: number; plantBonus: number }
  | { kind: 'mender'; every: number; amount?: number };

export type DarkWisp = { id: string; hp: number; placement: WispPlacement; behaviour?: DarkWispBehaviour };

/** What a mechanic did to the board after an action, for the layer to show. */
export type MechanicEffect =
  | { kind: 'shrouded'; wisp: number; cell: number }
  | { kind: 'ate'; wisp: number; cell: number; definitionId: string }
  | { kind: 'root_mist'; wisp: number; cell: number }
  | { kind: 'mended'; wisp: number; amount: number };

export type MissionMechanicDefinition =
  | {
      kind: 'glow-strikes';
      /** What flies at the wisp on each strike: a burst of Glow tokens (a mist mission) or the item the merge made (a restoration board). */
      flight?: 'glow' | 'item';
    }
  | {
      kind: 'column-shot';
      /** Damage dealt by the item a strike makes, by its tier (index 0 = tier 1); the last entry repeats for higher tiers. */
      damageByTier: readonly number[];
      /** Damage past a wisp's hit points: dropped, or carried up to the next living wisp in the column. */
      overflow: 'lost' | 'carry-up';
      /** A shot up a column with no living wisp: drifts to the nearest one still standing, or is wasted. */
      emptyColumn: 'nearest' | 'lost';
      wisps: {
        /** Rows of sky the grid uses. */
        rows: number;
        /** Distance between rows, as a fraction of a board cell (default 0.9). */
        rowPitch?: number;
        cells: readonly ColumnShotWisp[];
      };
      /** A strike budget for a later celebration; nothing fails on it. */
      par?: number;
    }
  | {
      /** Wisp Rush: wisps keep appearing over the tile for as long as the board is up; whoever runs the board says when. */
      kind: 'wisp-rush';
      /** Where wisps hang over the tile; how many can be up at once. */
      perches: readonly WispPlacement[];
    }
  | {
      /**
       * Dark Wisps: each has hit points and a behaviour of its own. A merge strikes one wisp (the first standing, or
       * the weakest) for the damage its result's tier deals; what is left over is lost. Between strikes the wisps act.
       */
      kind: 'dark-wisps';
      wisps: readonly DarkWisp[];
      /** Damage by the result's tier (index 0 = tier 1); the last entry repeats. Default: one, whatever is made. */
      damageByTier?: readonly number[];
      targeting?: 'in-order' | 'weakest';
    };

/** What a mechanic remembers between strikes; saved with the board. */
export type MissionMechanicState =
  | { kind: 'glow-strikes'; strikes: number }
  | { kind: 'column-shot'; strikes: number; damage: number[] }
  /** Every wisp that has appeared, in order; the list only grows. `bornAt` 0 marks the ones the board opened with. */
  | { kind: 'wisp-rush'; strikes: number; wisps: { id: string; hp: number; perch: number; damage: number; bornAt: number }[] }
  /** Damage on each wisp, how many actions have been spent, and the action each wisp was last struck on (-1: never). */
  | { kind: 'dark-wisps'; strikes: number; actions: number; damage: number[]; struckAt: number[] };

/** A board whose state moves on its own (a rush's wisps appear over time) publishes it here; the wisp layer subscribes. */
export type MissionMechanicLive = { get: () => MissionMechanicState; subscribe: (listener: () => void) => () => void };

/** One strike a board command produced: what flies, where it lands, and what that does. */
export type MissionStrike = {
  fromCell: number;
  resultDefinitionId: string;
  /** Damage dealt, wisp by wisp, in the order it lands (glow-strikes: one hit of one). */
  hits: readonly { wisp: number; damage: number }[];
  /** The wisp the flight is aimed at, or nothing when the shot is wasted. */
  target: number | null;
  /** The strike that completes the mission: its item leaves the board for the mist. */
  finale: boolean;
  wasted: boolean;
};

/** A wisp as the layer draws it: its hit points, the damage in, whether it stands, and where it hangs. */
export type MissionWispView = {
  id: string; hp: number; damage: number; alive: boolean; placement: WispPlacement;
  /** How long its arrival waits; by default wisps arrive one after another in order. */
  enterDelayMs?: number;
};

/** The move a mechanic points the finger at. */
export type MissionMechanicMove = { kind: 'wake' | 'merge'; from: number; to: number; definitionId: string | null };
