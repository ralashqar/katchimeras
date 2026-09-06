# Merge Board Player-Copy Guide

Use this guide for every sleeping item, covered cell, parcel, item maker, and
progression reward added for a Katchimera. The board can have complex rules;
the player should only have to understand what they can see and what to do next.

## The three questions every selection must answer

When a player selects something on the board, its copy should answer:

1. What is this?
2. What can I do now, or what should I do next?
3. What will happen when I do it?

Do not describe how the save schema, progression engine, or reward table works.
Translate the rule into the next player action and the visible result.

## Inspector copy structure

The inspector has an eyebrow, title, and a body limited to two short lines.

- Eyebrow: identify the player-facing category, such as `SLEEPING ROOT`,
  `SLEEPING ITEM`, `GARDEN GROWING`, or `NEW ITEM MAKER`.
- Title: use the authored object or place name. Keep it evocative and specific.
- Body: begin with a verb. Give one condition or interaction, followed by one
  concrete reward when useful.

Aim for no more than about 90 characters in the body. Remove scene-setting that
repeats the title or eyebrow. Story flavour belongs in the title, art, and
surrounding narrative; instructions must remain immediately understandable.

Template for a sleeping progression root:

```text
SLEEPING ROOT
[Authored root title]
[Player action]. [Visible result].
```

Template once its parcel is ready:

```text
READY TO WAKE
[Authored root title]
Drag the parcel’s [named item] here. [Visible result].
```

Template for a sleeping merge item:

```text
SLEEPING ITEM
[Item name]
Drag another [item name] here → [result name].
```

## Translate rules into actions

| Internal rule | Player copy pattern |
| --- | --- |
| `journey_day: 7` | Spend 7 Journey Days with [Katchimera]. |
| `friendship: 4` | Grow your friendship with [Katchimera] to Level 4. |
| `memory: 2` | Save [kind] memories on 2 different days. |
| `focusStage: 1` | Choose a [theme] direction with [Katchimera]. |
| `focusStage: 2` | Complete 3 activities that support your [theme] direction. |
| `wisp: 1` | Befriend a Wisp connected to [Katchimera]. |
| passive reveal day | Opens on [Katchimera] Journey Day 12. You don’t need an item. |
| matching definition ID | Drag another [visible item name] here. |
| discovery dependency | Meet [Katchimera name] to open this space. |

Use numerals for visible game values and compact progress instructions, such as
`Journey Day 7`, `Friendship Level 4`, or `Complete 3 activities`.

For direction-based roots, name the meaningful choice made in the companion
questionnaire. Do not call an individual Today activity a direction. The first
root recognises the saved direction; later roots can recognise the practical
activities completed after that direction was chosen.

## Describe rewards by their visible effect

| Internal reward | Player copy pattern |
| --- | --- |
| generator unlock | Adds the [item-maker name] to your board. |
| generator level 2 | The [item-maker name] can find [named items]. |
| later generator level | The [item-maker name] finds [named items] more often. |
| merge item reward | Places a [named item] here. |
| board-space reward | Opens this board space. |
| Wisp receipt | [Wisp name] joins your Wisps. |
| unrevealed card | Gives you a rare Memory Card to reveal. |
| landmark receipt | Restores [landmark name]. |

Never promise a result the game does not perform. If a card arrives veiled, say
it is ready to reveal rather than saying it has already been revealed. If an
item maker only gains a chance of a better item, use “can also find” or “finds
more often,” not “always makes.”

## Player vocabulary

Use established world language consistently:

- `item maker`, never `generator`;
- the visible item name, never a definition ID, chain ID, family ID, or tier;
- `Journey Day`, `Friendship Level`, `Dream Mist`, `Dream Echo`, `Root Memory`,
  and `Wisp` only where those terms have already been introduced to the player;
- `parcel` for the object the player opens in the tray;
- `goal` or `small activity` for the action the player recognises in Mossprout’s
  home, never a focus stage, quest event, or progression signal.

Avoid these internal phrases in all visible and accessibility copy:

- gate, target, requirement kind, receipt, schema, definition, branch, chain;
- generator level, tier, focus stage, active-day count;
- fallback day, fallback formula, queued gate, root-match parcel;
- “progress 0 of 1” when the player cannot see what the numbers represent.

`Dream Echo`, `Root Memory`, and themed names such as `Memory Nursery` are not
technical when the game introduces them as part of its world. Pair a new world
term with a plain action the first time it appears.

## Accessibility copy

Screen-reader labels must contain the same condition and reward as the visible
inspector. They must not expose additional debugging or balancing information.

- Name the selected object first.
- State whether it is sleeping or ready.
- Repeat the exact player action.
- State the visible reward.
- Use `Show details` as the action for a covered cell; do not imply it can move.

Example:

```text
A Direction for Growing. Sleeping root. Choose a nature direction with Mossprout.
The Wild Garden finds Sprouts and Shells more often.
```

## Art and copy must agree

A locked cell and its inspector thumbnail show the actual contained item or
reward art beneath the lower half of Dream Mist. Do not add a second badge or a
generic item icon. The title and reward sentence must name what that art
represents.

Full, unmarked Dream Mist means the space opens automatically. Its copy must say
when it opens and explicitly say that no item is needed.

## Adding a future Katchimera progression item

Before implementation:

1. Name the item, root, place, parcel item, item maker, and reward as the player
   will encounter them.
2. Define the internal condition and reward separately from their copy.
3. Write the locked instruction using a verb the player can act on.
4. Write the ready instruction with the exact parcel item name.
5. Describe item-maker improvements using named drops and frequency, not levels.
6. Confirm the shown art matches the named contained item or reward.

During implementation:

1. Add the internal rule to the relevant progression catalog.
2. Add its translation to the shared player-copy module rather than composing
   storage fields inside a component.
3. Use that same translation in the inspector and accessibility label.
4. Keep the body within two lines on the narrowest supported board width.
5. Add tests for the intended sentence and for banned internal phrases.

Review the finished flow in all four states: sealed, ready, parcel opened, and
reward granted. A writer or tester should be able to explain the route without
knowing any source-code identifiers.

## Quick review checklist

- Can a player identify the selected thing from the title and art?
- Does the first sentence begin with a useful action?
- Does it say where to perform an off-board action, such as visiting Mossprout?
- Does the reward name the exact item, Wisp, card, place, or item-maker benefit?
- Does it fit in two lines without relying on clipped text?
- Does screen-reader copy use the same language?
- Are all internal identifiers and balancing formulas absent?
- Does the copy remain true if progress is delayed or parcels are queued?
