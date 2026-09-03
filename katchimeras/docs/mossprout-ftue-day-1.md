# Mossprout FTUE — a little of your world, growing in mine

## Product promise

The player should feel that Mossprout heard them, that their answer made something real, and that both the Garden and the relationship can keep growing. The experience teaches Merge through play, not a menu tour.

## Shipping sequence (script v43, Content Flow v45)

| Beat | Player action | Purpose |
| --- | --- | --- |
| Egg in the quiet Garden | Watch the existing world reveal | Establish a place worth caring for. |
| “How has today felt?” | Choose one of three short answers | Include good, busy, and neutral days. |
| “What would feel good right now?” | Progress, calm, or unsure | Give the personal Seed an honest origin. |
| Hatch and meeting | Hatch, then choose a playful greeting | Mossprout echoes the day answer. |
| Your memory Seed | Continue | Show the named Seed, acknowledge the greeting, explain Bond inline. |
| A place of its own | Plant Seed | Place this exact personal Seed in the world. |
| Wake the Garden | Open Merge | Hold the explanation until the player is ready; preview the requested Plant. |
| Seed → Sprout → Plant | Three merges, then Serve | Four board Seeds become two Sprouts, then one Plant. |
| The First Bloom | Restore Garden | One explicit free restoration; watch the same personal Seed grow. |
| Shared moment | Continue, then answer Water Together | Move directly back to Mossprout. Water is optional. |
| Farewell | Rest, Mossprout | Acknowledge the water answer and explain the next Journey in one beat. |
| Meditation | Enter interaction, then Go to Merge or Back | Show the compact eight-hour next-Journey timer inside Mossprout’s normal interaction UI. |
| Basket handoff | Tap twice, merge the two Seeds | Teach where pieces come from; then release coaching immediately. |

The first request's story title remains “The First Bloom”; its merge item is consistently called a Plant. The personal memory Seed is a separate world object, not a board ingredient or currency.

## Voice and choices

Shared copy lives in `features/onboarding/mossprout-ftue-copy.ts`. Keep prose short, concrete, friendly, and gently playful. Avoid diagnosis, false insight, compulsory positivity, or promises about changing someone's life.

- Progress → Seed of Momentum.
- Calm → Seed of Stillness.
- Unsure → Seed of Curiosity.
- Greeting replies acknowledge “Hi”, “What is this place?”, and “You’re tiny.”
- Water answers are “I’ll get some.”, “Already had some.”, and “Not now, Mossprout.” None blocks progress or marks water completed.
- Support preference remains in Journey 2, where it is saved without repeating the first-session question.
- “Your Bond grows through little moments together” replaces a separate Bond tutorial acknowledgement.

## Free play and meditation

The Garden Basket currently does not spend Energy on the companion activity board. Do not teach a cost or add an Energy top-up. The tutorial uses that same behavior.

“Go to Merge” opens Merge. After the Basket lesson, the existing “Help the Garden Wake Up” Plant request remains: repair the path and bring back the spring. Back dismisses the optional coaching, not the request or the player's board.

Meditation gates the next Journey, not all play. The compact timer says “Next Journey in”; the interaction offers Go to Merge and the normal Back exit. Preserve the existing eight-hour duration and existing shortening rules. The Steppling movement Egg is never rendered in Mossprout’s world map.

## Device acceptance pass

1. Try every Egg answer, including “Pretty good” and “I’m not sure yet”; verify the named Seed and first line.
2. Check small screens, large text, reduced motion, and screen-reader labels.
3. Double-tap Continue/Plant/Rest; verify one Seed, one restoration, one meditation start.
4. Cold launch at planting, after Serve, during growth, after Rest, and after the first Basket tap.
5. Confirm planting copy waits for Open Merge; no repeated Garden handoff or insight-accuracy question appears.
6. Confirm every water answer reaches the same farewell and only acceptance pins optional water.
7. Confirm Rest enters Mossprout’s interaction UI and the compact timer remains readable. Use both Go to Merge and Back.
8. Finish the Basket lesson, then independently grow and serve the next Plant.
9. Back out midway through coaching; return and confirm the board/request survive without forced coaching.
10. Upgrade an active v42 save at each removed beat and a completed save. No questionnaire replay, duplicate rewards, or reset timer.
