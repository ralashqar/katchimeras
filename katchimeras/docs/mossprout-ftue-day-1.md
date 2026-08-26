# Mossprout FTUE — Day 1 and first return

Target length: 10–12 minutes including the existing Petalimp resident-card lesson. All choices use the existing action-card UI.

## Day 1 runtime sequence

1. **Haven discovery** — Open on Floating Neighbourhood V2. The Havenling is on the centre Home tile and the adjacent Mossprout coordinate is Dream Mist. The existing Haven sheet says “Did you see that?” and offers **Take a look**.
2. **Egg attunement** — Route to the current Egg presentation and preserve its close camera, pulse, answer-reward flight, crack overlays, zoom-out, and hatch sequence.
3. **Question 1** — “What sounds best right now?”: Somewhere peaceful / Somewhere new / Somewhere lively.
4. **Question 2** — “How are you feeling right now?”: Tired / Okay / Good.
5. **Question 3** — “What would you like a little more of lately?”: Energy / Calm / Something new.
6. **Hatch** — Use the existing hatch controller and Mossprout reveal. No new character movement is required.
7. **First meeting** — Use Mossprout’s current companion conversation UI. Responses are Hi, Mossprout / What happened here? / You’re tiny. The conversation reconverges and references the third attunement answer.
8. **First Bond answer** — Use Mossprout’s current Day 1 action cards for “What usually helps when your day isn’t going well?”: Getting outside / Being with someone / Having time alone / Doing something I enjoy. The existing Bond pipeline records the interaction without exposing the full Bond menu. Confirmation appears as a bottom toast.
9. **Grove goal** — Reuse the existing concise Garden intro and order preview. CTA: **Let’s begin**.
10. **First Merge** — Install the existing onboarding board with 10–12 visible cells, the existing Garden Basket, and four Seeds. Guided actions are Seed + Seed → Sprout, Seed + Seed → Sprout, then Sprout + Sprout → Plant. The request is called **The First Bloom** while retaining canonical chain IDs and item behavior.
11. **First request** — Serve the Plant through the existing `mossprout:chapter-0:first-sprout` order. Bond reward remains zero; Merge rewards stay in the Merge domain.
12. **First transformation** — Return through Mossprout’s existing conversation screen, then explicitly route to Haven. Stage 0 represents the revealed Grove/First Bloom and uses the existing Haven reveal effect. The next optional Haven upgrade remains outside the guided session.
13. **Resident bridge** — The First Bloom CTA returns to Mossprout and fixes the first resident match to Petalimp. Skip the retired resident-affinity questionnaire.
14. **Resident-card lesson** — Reuse the existing parcel, sealed card, mystery node, Dream Echo, Garden Basket, Petalimp request, and card-reveal sequence unchanged mechanically.
15. **Relationship pause and reward** — After Petalimp’s result, explicitly route back to Haven. The reward sheet explains that Mossprout is reflecting and the Garden remains playable. **Wear Leaf Pin** equips the existing free `moss-sprout` Havenling layer and completes FTUE.
16. **End frame** — Haven remains Home. Mossprout stays on its adjacent tile, Petalimp is collected, and other tiles remain mist-covered.

## First return / Day 2

- The existing relationship timer makes the next meaningful interaction available after four hours unless the current late-night policy resolves immediately.
- Mossprout’s existing conversation graph can reference stored answer IDs; return copy should ask one follow-up rather than repeat the original question.
- Familiar progress makes the First Returning Root eligible on the second active Mossprout day.
- The existing story-growth reconciler clears Seedbed Edge cells `[19, 20, 26]` together—exactly three playable cells.
- The existing `wild-garden` generator is presented as **Garden Basket**; there is no parallel generator.
- Day 2 continues through the current Mossprout campaign and Haven stage system. The pond project uses existing Merge requirements, story gates, environment art, effects, and upgrade transaction.

## Acceptance checks

- App onboarding lands on Haven, not Today.
- The Haven/grid toggle is absent from production Home.
- Asset Lab choices cannot change production Haven art.
- Mossprout is the first adjacent tile before and after discovery.
- Exactly three Egg action-card questions precede Hatch.
- Existing Egg feedback happens after every answer.
- Four Seeds are present and the tutorial cannot skip either Sprout merge.
- First request consumes the tier-three Garden item.
- First Bloom appears in Haven before the Petalimp resident lesson begins.
- Petalimp’s existing parcel/card/Echo/request flow completes without creating a second board or route system.
- Completion equips the Moss Sprout avatar layer.
- Merge remains playable during relationship reflection.
- No daily journal, store, Wisp album, or deep Bond UI appears in FTUE.
