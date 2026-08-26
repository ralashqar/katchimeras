# Authoring FTUE and Journey Stories

Use this guide for every new FTUE beat, Journey Day, resident chapter, or rewarded optional action.

## Start with a typed manifest

```ts
import { defineStory, story } from '@/features/content-flow/story-manifest';

export const POND_DAY = defineStory({
  id: 'mossprout:journey:pond-day',
  version: 1,
  entryNodeId: 'opening',
  nodes: [
    story.conversation({
      id: 'opening',
      conversationId: 'pond-knocked-twice',
      next: 'garden',
    }),
    story.route({
      id: 'garden',
      route: 'merge',
      lock: true,
      readiness: ['route', 'data', 'layout', 'background', 'foreground', 'interaction_target'],
      next: 'orders',
    }),
    story.task({
      id: 'orders',
      capability: 'merge.orders',
      surface: 'merge',
      taskId: 'pond-orders',
      payload: { objectiveId: 'pond-day' },
      requirements: [
        { id: 'listening-place', event: { type: 'merge.order_served', where: { orderId: 'listening-place' } } },
      ],
      next: 'resolution',
    }),
    story.conversation({ id: 'resolution', conversationId: 'pond-resolution', next: 'complete' }),
    story.complete(),
  ],
  metadata: { kind: 'journey_day', familyId: 'mossprout', dayNumber: 2 },
});
```

Use the builders. Do not hand-write routes, readiness polling, curtain timers, reward sequencing, or persistence.

## Stable node rules

- IDs describe story meaning, not screen position: `resident.orders`, not `screen-7`.
- Never reuse an ID for different behavior.
- Never remove or rename an ID from a released version without a migration.
- Increment `version` for a released graph change.
- Add `migrations: { 'old-node': 'replacement-node' }` when an old save can safely continue at a new node.
- A migration target must exist and retain already-earned facts/rewards.

## Choose the correct primitive

- `story.conversation`: dialogue or choices on the companion surface.
- `story.questionnaire`: multi-question insight/profile sequence.
- `story.task`: wait for domain facts such as order served or parcel claimed.
- `story.effect`: idempotent durable change such as granting a parcel.
- `story.presentation`: reward/reveal animation that needs an acknowledgement.
- `story.route`: registered cross-surface navigation.
- `story.complete`: terminal node.
- `startChildContentFlow`: an optional activity with its own reward sequence.

If a primitive is missing, add one capability renderer and one builder. Do not special-case a screen for one story.

## Effect contract

Every effect handler receives `effectKey`. Store or pass that key into the domain mutation. Replaying the same key must return the same result without granting twice.

Bad:

```ts
wallet.addCoins(20);
```

Good:

```ts
wallet.grantOnce(effectKey, 20);
```

## Back and replay behavior

- `locked`: Back is unavailable for a truly mandatory tutorial interaction.
- `pause`: Back returns to a safe surface with Continue Story.
- `allow`: the story does not own Back.
- Presentation `replay`: replay an interrupted animation.
- Presentation `continue`: the underlying reward is already claimed; continue after interruption.

Choose these in the manifest. A component must not infer them from an FTUE boolean.

## Readiness

Every routed screen reports:

- `data`: repository state loaded.
- `layout`: usable measured bounds exist.
- `background`: backdrop art decoded.
- `foreground`: required board/character art decoded.
- `interaction_target`: spotlight target has a real measured ref, when requested.

Never report readiness from a timeout. Never acknowledge navigation merely because a pathname changed.

## Content review checklist

- Dialogue uses the speaking character's voice and a consistent person.
- Speech bubble copy fits the shared four-line scaler; content is never manually ellipsized.
- The player has at least one meaningful insight per Journey Day.
- Merge orders are story-motivated before entering Merge and resolved afterward.
- Only active Journey tasks are visible while the day is incomplete.
- A resident parcel, reveal, dialogue, requests, and card reward use the shared resident chapter.
- Optional actions are child flows and cannot advance or block the parent accidentally.

## Required verification

Run:

```sh
npm run verify:story-flows
npm run typecheck
```

Before release, use Developer Tools → Content Flow Inspector and test:

1. Restart on every node.
2. Background during every curtain and presentation.
3. Back on every allowed node, then Continue Story.
4. Duplicate taps and duplicate domain events.
5. Slow/missing art and a missing spotlight target.
6. Upgrade a saved run from the previous manifest version.

## Troubleshooting

### Curtain stays covered

Open the inspector. Compare expected pathname and the missing readiness gate. Fix the destination's readiness report; do not add another timer or force reveal.

### Regular dashboard appears during FTUE

The route is not wrapped by `StorySurfaceHost`, or the node declares the wrong surface. Fix surface ownership rather than hiding individual controls.

### A node skips immediately

Look for an old event ID, a reused node ID, or a domain event missing run/node correlation. The inspector shows objective progress and receipts.

### Reward happens twice or disappears

The effect is not idempotent or the presentation was acknowledged broadly. Use `effectKey` and the exact presentation key.

### A released save cannot resume

Keep the old definition registered or add a node migration to the new version. Never guess a destination from the current screen.
