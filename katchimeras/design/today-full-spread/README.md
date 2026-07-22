# Today full-spread environment pipeline

This pipeline expands each Katchimera's approved Kingdom environment into a
consistent edge-to-edge Today backdrop. It keeps the approved Feastle courtyard
as the shared **composition and finish guide**, while the selected Kingdom hex
tile remains the authoritative reference for each environment's identity.

## Invariants

- Production canvas: `945x1680` (`9:16`).
- Production format: RGB WebP, quality `92`, metadata stripped.
- Maximum production asset size: `650 KB`.
- Fixed composition bands:
  - sky and distant landscape: `0-18%`;
  - rear landmark: `15-38%`;
  - one uninterrupted, single-level creature stage: `34-72%`;
  - foreground approach with exactly one centered entrance staircase: `72-100%`.
- There must be no second/rear/side staircase, raised inner stage, stacked
  terrace, or other level change after the single foreground entrance.
- If the Kingdom reference contains stairs at the front of its hex tile, those
  stairs are relocated to the foreground entrance rather than copied in place.
- No creature, egg, UI, text, card frame, hex edge, or black studio background
  is baked into an environment.
- Generated candidates live under `.tmp/` and never ship until explicitly
  promoted.

## Commands

Resolve a prompt and references without spending a generation:

```powershell
npm run art:today-scenes -- plan --visual-key mossprout
```

Generate three high-quality GPT Image 2 edit candidates through the existing
queued FAL/Supabase route:

```powershell
npm run art:today-scenes -- generate --visual-key mossprout --count 3
```

The default generation request is `1152x2048`, GPT Image 2 `high`. Nano Banana
2 remains available for faster exploration:

```powershell
npm run art:today-scenes -- generate --visual-key mossprout --count 3 --model nano
```

Review the raw PNGs and normalized WebP previews in
`.tmp/today-full-spread/<visual-key>/`, then promote one winner:

```powershell
npm run art:today-scenes -- promote --visual-key mossprout --input .tmp/today-full-spread/mossprout/candidate-2.png --id mossprout-rain-garden-v1
```

For a targeted correction that preserves an otherwise strong portrait, use the
revision pass. It treats the supplied portrait as the edit target and the
Kingdom tile as the identity reference:

```powershell
npm run art:today-scenes -- revise --visual-key flickerbun --input .tmp/today-full-spread/flickerbun/candidate-2.png --instruction "Remove the inner staircase and extend the cinema floor seamlessly to the single foreground entrance."
```

Promotion packages the image, records it in `environments.json`, and regenerates
the static React Native asset registry. Validate the complete set with:

```powershell
npm run art:today-scenes:validate
```

## Adding another environment

Add one entry to `environments.json` with a visual key, selected Kingdom
reference image, concise theme, palette, and one signature landmark. Run
`plan`, inspect the prompt, generate candidates, then promote only the chosen
render. Do not add an `approved` block by hand before the production WebP
exists.

The generation route accepts portrait dimensions and a `9:16` Nano aspect ratio
through `supabase/functions/generate-asset`. Deploy that edge function before
running remote generation in an environment still using the previous square-only
version.
