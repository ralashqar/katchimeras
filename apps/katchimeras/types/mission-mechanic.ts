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
  | { kind: 'board'; column: number; row: number; size?: number }
  /** Territory: on a board cell, its nest (`size` a fraction of a board cell, default 0.9). */
  | { kind: 'cell'; cell: number; size?: number }
  /**
   * Territory: a sky wisp, floating over the island tile above one of the board's five columns (1-5); struck by a
   * pulse that reaches past the board's top row in that column. `fx`/`fy`/`size` as a tile wisp's, read off the
   * column when absent.
   */
  | { kind: 'sky'; column: number; fx?: number; fy?: number; size?: number }
  /**
   * Lanes (`docs/encounter-lanes.md`): a wisp coming down a board column (0 the left one). `row` is the board row it is
   * on (0 the top row); below 0 it is still floating over the board, that many rows up.
   */
  | { kind: 'lane'; column: number; row: number; size?: number };

export type ColumnShotWisp = { id: string; column: number; row: number; hp: number; size?: number };

/**
 * Lanes (`docs/encounter-lanes.md`): a wisp that arrives over one board column at `at` ms into the level, then comes
 * down a row every `stepMs`. Every `dropEvery` steps it leaves Mist on the free cell it steps off (0: never). It
 * starts `startRow` rows over the board (default 2).
 */
export type LaneWisp = {
  id: string; hp: number; column: number; at: number; stepMs: number; dropEvery?: number; startRow?: number; look?: string;
  /** While still over the board, it spits Mist down its column every this many ms (absent: it never does). */
  spitEvery?: number;
  /**
   * A striker: every this many ms it strikes down its column at the nearest plant under it, which drops a tier (a Seed
   * is knocked off the board). Absent: it never does.
   */
  strikeEvery?: number;
  /** A weaver: every this many ms it slides a column over, weaving between its own column and those beside it. */
  weaveEvery?: number;
  /** A dasher: every this many ms (once near the board) it lunges down `dashRows` rows in a moment. */
  dashEvery?: number;
  dashRows?: number;
  /** A bulwark: wisps in the columns beside it take no damage while it stands (it does). */
  shield?: boolean;
  /** A mender: every this many ms it mends `mendAmount` on every wisp within a column of it, itself too. */
  mendEvery?: number;
  mendAmount?: number;
  /** A frost wisp: every this many ms it freezes the nearest plant under it, which cannot shoot for a while. */
  frostEvery?: number;
  /** A snatcher: every this many ms it steals the smallest piece under it in its column. */
  snatchEvery?: number;
  /** A caller: every this many ms it calls the next of its mistlings down its column. */
  callEvery?: number;
  /** Brought by another wisp (its index): a splitter's shards when it falls, a caller's mistlings when it calls. */
  spawn?: { by: number; on: 'death' | 'call' };
};
/** Mist a wisp spat down its column: at which cell, and when it lands (ms of level time). */
export type LaneSpit = { id: number; wisp: number; cell: number; firedAt: number; landsAt: number; /** A striker's bolt at a plant, not Mist. */ strike?: boolean; /** A frost wisp's bolt: the plant freezes. */ frost?: boolean; /** A snatcher's grab: the piece is taken. */ snatch?: boolean };
/**
 * A lane wisp as the level stands: its board row as it drifts (fractional; below 0 over the board; its cell is the
 * one its centre is in), damage taken, the level time it holds until (after reaching a piece), and cells entered.
 */
export type LaneWispState = { row: number; damage: number; holdUntil: number; cells: number; /** When it spits Mist next (level time). */ spitAt?: number; /** When it strikes next (level time). */ strikeAt?: number;
  /** A weaver's column now (absent: its own), when it moves next, and how many moves it has made. */ column?: number; weaveAt?: number; weaves?: number;
  /** A dasher: when it lunges next, and the lunge it is in. */ dashAt?: number; dashFrom?: number; dashUntil?: number;
  /** When it mends, freezes, snatches or calls next. */ mendAt?: number; frostAt?: number; snatchAt?: number; callAt?: number;
  /** A spawned wisp: when it was brought (absent: not yet). */ bornAt?: number };
/** Glow a piece fired up its column: from which cell, at which wisp (-1: nothing over it), for how much, and when it lands (ms of level time). */
export type LaneShot = { id: number; fromCell: number; wisp: number; damage: number; firedAt: number; landsAt: number };

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

/**
 * What a Dark Wisp says it will do next, and in how many turns (territory battles, `docs/encounter-territory.md`).
 * A turn is a merge. `surge` spreads its Mist into the free cells nearest its nest; `shroud` lays thick Mist beside
 * its own where the pieces crowd; `root` spreads root Mist; `devour` eats a small piece beside its Mist; `ward`
 * absorbs the next hits; `mend` heals; `call` brings a hidden wisp in; `burrow` moves its nest deeper into its Mist;
 * `spores` marks a free cell that turns to Mist unless a piece is put on it; `gather` (a boss) is a heavy surge that
 * enough damage while it gathers staggers. `snuff` is the old Light-era intent, read as a surge of one.
 */
export type WispIntentKind = 'surge' | 'shroud' | 'root' | 'devour' | 'ward' | 'mend' | 'call' | 'gather' | 'burrow' | 'spores' | 'snuff'
  /** Sky wisps (`docs/encounter-turns-sky-bound.md`): Mist falls into the top of its column; it binds a piece in its column; it wards a nest wisp. */
  | 'rain' | 'bind' | 'shield'
  /** Merge vs Mist (`docs/encounter-tactics.md`): a wisp Mists the cells it showed, drifts a cell through its Mist, or has nowhere to go. */
  | 'corrupt' | 'move' | 'rest';

/**
 * Merge vs Mist: a Dark Wisp's kind, each one sentence (`features/encounter/wisp-ai.ts`). A Creeper Mists one free cell
 * beside its Mist after every merge; a Spore Wisp two on every third; a Root Wisp's Mist is Thick; a Snare Wisp reaches
 * for a piece first, which stays locked until that Mist is cleared; a Drifter drifts a cell through its Mist away
 * from the player's pieces, leaving Mist where it was.
 */
export type DarkWispKind = 'creeper' | 'spore' | 'root' | 'snare' | 'drifter';
export type WispIntent = { kind: WispIntentKind; every: number; amount?: number };

export type DarkWisp = {
  id: string; hp: number; placement: WispPlacement;
  /** v1 behaviour, read as one intent when `intents` is absent. */
  behaviour?: DarkWispBehaviour;
  /** Its cycle of intents, in order, repeating. */
  intents?: readonly WispIntent[];
  /** Old lane battles: the board column (1-5) it hovered over. Territory wisps sit on a cell instead. */
  lane?: number;
  /** Territory: a hidden wisp that breaks off when this one is struck to half its health or below. */
  splitsInto?: string;
  /** The turn strip: how many places it takes (a boss acts twice a round). Default 1. */
  slots?: number;
  /** A sky wisp that cannot be hurt while any of these nest wisps stand. */
  guardedBy?: readonly string[];
  /** Merge vs Mist: it spreads its Mist after every merge, as its kind says. */
  kind?: DarkWispKind;
  /** Not on the board until a caller calls it. */
  hidden?: boolean;
  /** Its art (`constants/dark-wisp-looks.ts`); absent, read off its first intent (a plain wisp keeps the corruption wisp). */
  look?: string;
  /** The chain that hits it for one more (`features/encounter/chains.ts`). */
  weakTo?: 'growth' | 'water';
};

/** What a mechanic did to the board after an action, for the layer to show. */
export type MechanicEffect =
  | { kind: 'shrouded'; wisp: number; cell: number }
  | { kind: 'ate'; wisp: number; cell: number; definitionId: string }
  | { kind: 'root_mist'; wisp: number; cell: number }
  | { kind: 'mended'; wisp: number; amount: number }
  | { kind: 'snuffed'; wisp: number; amount: number }
  | { kind: 'warded'; wisp: number; amount: number }
  | { kind: 'called'; wisp: number; caller: number; cell?: number }
  | { kind: 'staggered'; wisp: number }
  /** Territory: its Mist spread into a cell (a piece there is swallowed). */
  | { kind: 'surged'; wisp: number; cell: number; swallowed?: string }
  | { kind: 'burrowed'; wisp: number; from: number; to: number }
  | { kind: 'spored'; wisp: number; cell: number }
  | { kind: 'spore_bloomed'; wisp: number; cell: number }
  | { kind: 'split'; wisp: number; twin: number; cell: number }
  /** A planned cell held its ground (a Plant or bigger stood there). */
  | { kind: 'held'; wisp: number; cell: number }
  /** The Mist closed over a piece: it is bound, not lost. */
  | { kind: 'bound'; wisp: number; cell: number; definitionId: string }
  | { kind: 'rained'; wisp: number; cell: number }
  | { kind: 'shielded'; wisp: number; target: number; amount: number }
  /** A Rest in the turn strip: nothing acted. */
  | { kind: 'rested' }
  /** Merge vs Mist: it Misted a free cell; a Drifter drifted from one cell to another, leaving Mist behind. */
  | { kind: 'corrupted'; wisp: number; cell: number }
  | { kind: 'drifted'; wisp: number; from: number; to: number }
  /** Lanes: a wisp came down a row; it reached a piece and put it under Mist; it got past the bottom of the board. */
  | { kind: 'stepped'; wisp: number; row: number }
  | { kind: 'breached'; wisp: number }
  /** Lanes: a frost wisp froze a plant; a snatcher took a piece. */
  | { kind: 'frozen'; wisp: number; cell: number }
  | { kind: 'snatched'; wisp: number; cell: number; definitionId: string };

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
      /**
       * `adjacent` (territory): a merge strikes a wisp whose nest is inside its Harmony pulse; `lane` (old): the wisp
       * over its column.
       */
      targeting?: 'in-order' | 'weakest' | 'lane' | 'adjacent';
      /** Territory: Rest turns in the turn strip (a calm level's breathing room). */
      rest?: number;
      /**
       * `tactics`, Merge vs Mist (`docs/encounter-tactics.md`): only a merge is a turn; after it every wisp spreads its Mist
       * onto the cells it showed; a merge clears Mist by its tier and cleanses a wisp once the cells beside it are clear.
       */
      mode?: 'tactics';
      /** Damage a gathering wisp must take to be staggered (default 3). */
      stagger?: number;
    }
  | {
      /**
       * Lanes (`docs/encounter-lanes.md`), a real-time battle: wisps come down the board's columns on a beat; every piece
       * of Sprout size or bigger fires Glow up its own column at the lowest wisp over it, harder and faster by tier; a
       * wisp that reaches a piece puts it under Mist; one that gets past the bottom row loses the level.
       */
      kind: 'lanes';
      wisps: readonly LaneWisp[];
      /**
       * Pieces arrive on their own (there is no spawner to tap): every `everyMs`, a `drops[0]` (a Seed) lands on a random
       * empty cell, or, by the player's luck (the Haven's Seed Nursery), a `drops[1]` (a Sprout). A full board waits.
       */
      seeds?: {
        everyMs: number;
        drops: readonly [string, string];
        /** The cells a Seed may land on (the first battle keeps them to the bottom rows); every free cell when absent. */
        area?: readonly number[];
      };
      /** A level that cannot be lost (the first battle): a wisp that would get through is pushed back over the board. */
      forgiving?: boolean;
    };

/** What a mechanic remembers between strikes; saved with the board. */
export type MissionMechanicState =
  | { kind: 'glow-strikes'; strikes: number }
  | { kind: 'column-shot'; strikes: number; damage: number[] }
  /** Every wisp that has appeared, in order; the list only grows. `bornAt` 0 marks the ones the board opened with. */
  | { kind: 'wisp-rush'; strikes: number; wisps: { id: string; hp: number; perch: number; damage: number; bornAt: number }[] }
  /** Damage on each wisp, how many actions have been spent, and the action each wisp was last struck on (-1: never). */
  /** Lanes: the level's clock (ms of play), every wisp as it stands, each piece's next shot time, the Glow in the air, and who got through. */
  | { kind: 'lanes'; strikes: number; clock: number; wisps: LaneWispState[]; ready: Record<string, number>; shots: LaneShot[]; seq: number; breached: number | null; /** Mist spat by wisps over the board, still falling. */ spits?: LaneSpit[]; /** How far the level has skipped ahead to bring the next wisp in when none was left (ms off every later arrival). */ advance?: number; /** When the next piece arrives on its own, and how many have. */ nextSeedAt?: number; seeded?: number; /** A forgiving level: wisps pushed back rather than let through, and when the last was. */ pushedBack?: number; lastPushAt?: number; /** Plants a frost wisp froze: by piece, until when. */ frozen?: Record<string, number> }
  | {
      kind: 'dark-wisps'; strikes: number; actions: number; damage: number[]; struckAt: number[];
      /** v2: turns until each wisp acts, where it is in its cycle, its ward, damage taken while gathering, and whether it was called in. */
      countdown?: number[]; cycle?: number[]; ward?: number[]; gathered?: number[]; called?: boolean[];
      /** Whether its current intent has already been knocked back (once per intent). */
      knocked?: boolean[];
      /** Territory: each wisp's nest cell (-1 before a hidden one arrives), whether it has split, and its spores. */
      nest?: number[]; split?: boolean[]; spores?: { cell: number; turns: number; wisp: number }[];
      /** Territory: the turn strip (wisp indices, -1 a Rest), the front entry's locked plan, and who was pushed back this turn. */
      order?: number[]; plan?: WispPlan | null; pushed?: boolean[];
      /** Merge vs Mist: every wisp's locked plan for after the player's next merge. */
      plans?: (WispPlan | null)[];
    };

/**
 * What the wisp at the front of the turn strip will do after the player's next merge, worked out and shown before
 * it happens (`docs/encounter-turns-sky-bound.md`): the cells it takes, the piece it eats, the wisp it wards.
 */
export type WispPlan = { wisp: number; kind: WispIntentKind; amount?: number; cells: number[]; piece?: { cell: number; instanceId: string }; target?: number };

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
  /** v2: what it will do next and in how many turns; its ward; how close a gather is to being staggered. */
  intent?: { kind: WispIntentKind; countdown: number; amount?: number; ward?: number; gathered?: number; stagger?: number } | null;
  lane?: number;
  /** v2: which Dark Wisp art it wears; absent, the corruption wisp. */
  look?: string | null;
  /** v2: the chain it is weak to. */
  weakTo?: 'growth' | 'water';
  /** Territory: cells it has marked, and turns until each turns to Mist. */
  spores?: readonly { cell: number; turns: number }[];
  /** A sky wisp that cannot be hurt yet: its guards still stand. */
  guarded?: boolean;
  /** It acts after the player's next merge. */
  acting?: boolean;
  /** Lanes: how fast it is drifting down right now, in board rows per ms (0 while it holds). */
  drift?: number;
};

/** The move a mechanic points the finger at. */
export type MissionMechanicMove = { kind: 'wake' | 'merge'; from: number; to: number; definitionId: string | null };
