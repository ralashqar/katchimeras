# Katchimeras exploration backgrounds

This pipeline creates square, horizontally explorable environment plates for
portrait phone screens. It deliberately does not use the archived painterly
Today backgrounds as style references.

## Locked generation contract

- Generate through the repository `generate-asset` route with
  `fal-ai/nano-banana-2/edit`.
- Request a square `2K` render.
- Pass only the approved Home plate as the image reference. Do not pass a hex
  tile, creature portrait, or secondary style image.
- Keep each Katchimera prompt compact and structured. Use five sections:
  `ART STYLE`, `ENVIRONMENT DESIGN`, `COMPOSITION`, `REDESIGN FREEDOM`, and
  `EXCLUSIONS`.
- Give the environment-design section enough concrete visual direction to
  define the world, while keeping composition invariants and exclusions short.
- Keep numeric platform and camera measurements out of the model prompt. They
  exist only to draw the review overlay after generation.
- Preserve a normalized 2048x2048 master and derive a 1024x1024 review/runtime
  image with Lanczos downsampling.
- Treat the middle phone-width crop as the default view. At a 390x844 viewport,
  a square image fitted by height exposes about 46.2% of its width. The rest is
  reached by horizontal panning.

The platform remains centered at normalized x `0.5`. For the home template its
center is y `0.57` and its diameter is approximately `0.26` of the square.
Katchimera variants use the approved runtime Home plate as their template and
lock its platform at x `0.5`, y `0.582`, horizontal diameter `0.26`, and
camera-projected visible height `0.12`. At 2048px this means center
`(1024, 1192)`, diameter about `532px`, and projected visible height about
`246px`.
Important default-view content must remain inside the central phone-safe crop;
side scenery may reward panning but must not introduce another focal platform.

## Prompt contract

The manifest contains one shared `providerPromptTemplate` for every
environment. It owns `ART STYLE`, `COMPOSITION`, `REDESIGN FREEDOM`, and
`EXCLUSIONS`. Individual background entries may inject only one prompt value:
`environmentDesign`, rendered as `ENVIRONMENT DESIGN` between the shared
sections.

This separation is intentional:

- the shared template controls visual finish, detail density, camera and
  platform preservation, spacing, redesign behavior, and universal exclusions;
- `environmentDesign` contains only the target setting, landmarks, props, and
  thematic content;
- environment entries must not define or override `promptSections`;
- changing a universal art-direction rule happens once in
  `providerPromptTemplate`, never separately for each environment.

Every provider-facing prompt must be written from the image generator's actual
point of view. The model receives exactly one image: the `template` declared by
that environment. It has no knowledge of this repository, its creature-family
names, its previous hex tiles, or any internal art taxonomy.

Therefore every current and future environment prompt must:

- use ordinary, visually descriptive language that stands on its own;
- call the one supplied input `the supplied reference image`;
- describe the intended style directly with observable shape, material,
  lighting, color, density, and composition language;
- translate internal themes into concrete scenery and props instead of naming
  a creature family;
- avoid project names, environment keys, internal shorthand, phrases such as
  `project art style`, and references to a style guide or second image;
- avoid saying that the result should match an asset the provider did not
  receive.

Each non-Home manifest entry must declare its opaque project vocabulary under
`internalPromptTerms`. The generator combines those terms with the global
`providerPromptContract` denylist and rejects any resolved prompt containing
them. It also rejects missing shared template sections, a missing
`environmentDesign` injection, per-environment prompt-section overrides,
non-template-only reference modes, and references to image numbers beyond the
single supplied image. `plan` applies the same validation before writing a
prompt, while `validate` checks every environment at once. This is a generation
gate, not merely a documentation convention.

## Commands

Run from the Expo app directory:

```powershell
npm run art:exploration-backgrounds:validate
npm run art:exploration-backgrounds -- plan home
npm run art:exploration-backgrounds -- generate home
npm run art:exploration-backgrounds -- plan feastle
npm run art:exploration-backgrounds -- generate feastle
npm run art:exploration-backgrounds -- package feastle .tmp/exploration-backgrounds/feastle/candidate-1-raw.png
npm run art:exploration-backgrounds -- export feastle 1 feastle-exploration-v1
npm run art:exploration-backgrounds -- registry
```

Review output is written to `.tmp/exploration-backgrounds/<key>/`:

- `candidate-N-master-2k.png`
- `candidate-N-preview-1k.png`
- `candidate-N-phone-left.png`
- `candidate-N-phone-center.png`
- `candidate-N-phone-right.png`
- `candidate-N-platform-guide.png` (cyan platform lock, yellow center crop,
  magenta reference horizon)
- `prompt.txt`
- `candidates.json`

Nothing is promoted into the live app automatically.

`export` preserves the selected 2048 master and geometry guide under
`design/exploration-backgrounds/candidates/`, writes the 1024 runtime plate
under the shared `assets/images/katchimeras/world/backgrounds/` directory, and records
generation provenance. It does not wire the asset into a screen and refuses to
overwrite an existing version. A successful export also refreshes the
Metro-safe Today background registry. `registry` can rebuild it independently
from the exported candidate metadata.

## Adding a Katchimera

Add a manifest entry containing:

- the approved square Home runtime plate as `template`;
- `referenceMode: "template-only"`;
- `internalPromptTerms` listing every invented project name associated with the
  environment; these words are forbidden in provider-facing prompt text;
- one concise `environmentDesign` string containing only the visually
  descriptive target setting, landmarks, and props;
- the standard platform lock
  `{ centerX: 0.5, centerY: 0.582, diameter: 0.26, projectedHeight: 0.12 }`.

Run `art:exploration-backgrounds:validate`, then run `plan` and inspect the
resolved provider prompt as though the reader has only that prompt and the one
supplied reference image. Generate at 2K, inspect the three phone crops and
platform guide, and only then promote a selected 1K runtime plate.
