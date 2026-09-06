# Katchimera Idle Animation Pipeline

This is the production workflow for turning a static Katchimera cutout into a transparent, looping animated WebP for narrative and companion pages.

The Mossprout pilot established the current target:

- one generated video candidate per production run
- slow, restrained idle motion
- a fixed camera and fixed character placement
- one natural blink per loop
- approximately four seconds
- transparent background
- 512 x 512 output
- 24 FPS
- animated WebP with a static PNG fallback
- approximately 3 MiB or less per idle

The automation lives in `scripts/generate-katchimera-idle.py`. It calls fal through the protected `generate-katchimera-idle` Supabase Edge Function, rather than exposing `FAL_KEY` locally or in the app.

## Pipeline Summary

1. Start with the canonical transparent cutout.
2. Place it on a uniform chroma background.
3. Generate one image-to-video candidate with Seedance.
4. Use the same source image as both the start and end frame.
5. Remove the background temporally with Bria.
6. Decode the transparent WebM into RGBA PNG frames with FFmpeg.
7. Resize and sample the frames at the delivery resolution and frame rate.
8. Encode the frames as one infinite-loop animated WebP with Pillow.
9. Update the animation manifest without removing other creatures.
10. Regenerate the static React Native asset registry.
11. Run automated validation and inspect the result on a real device.

The current loop is a natural cycle: Seedance is constrained to begin and end on the same source frame. We do **not** append a reversed copy of the animation. Ping-pong playback can make breathing look mechanical and doubles the repeated motion unless a particular animation genuinely needs it.

## Prerequisites

Local tools:

```bash
python -m pip install pillow imageio-ffmpeg numpy
```

An `ffmpeg` executable on `PATH` can be used instead of `imageio-ffmpeg`.

The linked Supabase project must have these Edge Function secrets:

- `FAL_KEY`
- `KATCHIMERA_IDLE_ADMIN_TOKEN`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to hosted Edge Functions by Supabase. Never put the service-role key or `FAL_KEY` in Expo variables.

The local process needs:

- `EXPO_PUBLIC_SUPABASE_URL` in `.env.local`, or `--function-url`
- `KATCHIMERA_IDLE_ADMIN_TOKEN` in `.env.local`, or `--token`

For an internal one-off run, `--configure-admin-token` creates a fresh random token and sets it on the linked project before submitting the job.

If the Edge Function code changed, deploy it first:

```bash
supabase functions deploy generate-katchimera-idle --use-api
```

## Standard Run

The source cutout is inferred from the visual key:

```text
assets/images/katchimeras/cutouts/<visual-key>.png
```

Generate another Katchimera with the standard slow idle:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key feastle \
  --character-name Feastle \
  --configure-admin-token
```

PowerShell can use a single line:

```powershell
python scripts/generate-katchimera-idle.py --visual-key feastle --character-name Feastle --configure-admin-token
```

Equivalent npm command:

```bash
npm run art:idle -- -- --visual-key feastle --character-name Feastle --configure-admin-token
```

The defaults produce:

```text
assets/images/katchimeras/animations/feastle-idle.webp
.tmp/katchimera-idle/feastle/feastle-generation-input.png
.tmp/katchimera-idle/feastle/feastle-generated.mp4
.tmp/katchimera-idle/feastle/feastle-transparent.webm
.tmp/katchimera-idle/feastle/frames/*.png
.tmp/katchimera-idle/feastle/job.json
```

`.tmp` is ignored by Git. The transparent WebM and job metadata should be retained locally until the promoted WebP has passed review because they allow repackaging without another paid generation.

## Preview Before Spending

Resolve the paths, parameters, and complete generated prompt without calling fal or writing files:

```bash
npm run art:idle:preview -- -- --visual-key feastle --character-name Feastle
```

The second `--` is intentional for the npm version used by this repository; it prevents named Python arguments from being consumed as npm configuration flags. Calling the Python script directly does not need it.

Use this before every new creature. Confirm that the inferred source path exists and that the generic motion direction is appropriate for its anatomy.

## Prompt Direction

The default motion direction is:

> subtle breathing, one soft natural blink, and very small secondary movement in flexible details

The surrounding template also locks the camera, scale, contact points, identity, silhouette, materials and background. It forbids walking, waving, speech, morphing, new objects and scene changes.

Override only the motion clause when the standard template is otherwise correct:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key shellio \
  --character-name Shellio \
  --motion-direction "subtle breathing, one soft natural blink, and a tiny relaxed antenna sway" \
  --configure-admin-token
```

Good motion directions are short and anatomical:

- leaf character: `a tiny leaf-tip sway`
- long ears: `a very small relaxed ear settle`
- tail character: `one restrained tail-tip movement`
- floating character: `an almost imperceptible vertical hover with no horizontal drift`
- sleepy character: `slow breathing, one drowsy blink, and a tiny head settle`

Avoid stacking many actions. A prompt asking for blinking, waving, bouncing, looking around and moving the tail usually increases identity drift and loop seams.

Use `--prompt` or `--prompt-file` only when the full template needs to change:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key tempesto \
  --character-name Tempesto \
  --prompt-file design/idle-prompts/tempesto.txt \
  --configure-admin-token
```

The prompt file contains plain UTF-8 text. `--prompt` and `--prompt-file` are mutually exclusive.

## Generation Parameters

Supported production controls:

| Option | Default | Purpose |
| --- | ---: | --- |
| `--visual-key` | `mossprout` | Stable catalog and filename key |
| `--character-name` | title-cased key | Name inserted into the default prompt |
| `--motion-direction` | slow breathing/blink | Creature-specific motion clause |
| `--duration` | `4` | Seedance duration, from 4 through 12 seconds |
| `--video-resolution` | `720p` | Seedance generation resolution: 480p, 720p or 1080p |
| `--seed` | random | Optional deterministic Seedance seed |
| `--key-color` | `#D95BFF` | Uniform generation background |
| `--fps` | `24` | Delivery frame sampling and WebP timing |
| `--size` | `512` | Square WebP dimensions |
| `--quality` | `82` | Lossy WebP RGB quality |
| `--alpha-quality` | `95` | WebP alpha quality |
| `--budget-mib` | `3` | Per-asset verification budget |
| `--decontaminate-edges` | off | Remove chroma colour from the alpha fringe without eroding alpha |

The Edge Function intentionally keeps these invariants fixed:

- square aspect ratio
- locked camera
- no generated audio
- source image reused as the end image
- one generation candidate per invocation

Those constraints make idle results more stable and prevent the internal endpoint from becoming an unrestricted paid-generation proxy.

Example with reproducible motion and a different chroma colour:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key pixooka \
  --character-name Pixooka \
  --motion-direction "subtle breathing, one natural blink, and a tiny ear-tip settle" \
  --seed 14821 \
  --key-color "#00FF00" \
  --duration 4 \
  --video-resolution 720p \
  --fps 24 \
  --size 512 \
  --quality 82 \
  --alpha-quality 95 \
  --budget-mib 3 \
  --configure-admin-token
```

Use a key colour that is absent from the creature. Magenta is the default because Mossprout is green. A strongly pink or purple creature may be safer on green. Bria performs temporal foreground extraction, but a contrasting source still reduces ambiguous edges.

## Repackage Without Generating Again

If the transparent WebM is good, change frame rate, dimensions, quality or byte budget without calling fal:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key mossprout \
  --character-name Mossprout \
  --matted-video .tmp/katchimera-idle/mossprout/mossprout-transparent.webm \
  --fps 24 \
  --size 512 \
  --quality 82 \
  --alpha-quality 95 \
  --budget-mib 3
```

This is the preferred way to evaluate 256 versus 512 pixels, 12 versus 24 FPS, or different WebP quality values. Do not regenerate video just to change delivery encoding.

Package-only runs preserve existing generation request IDs and prompt provenance in the manifest.

If generation completed but a later network or matting submission failed, resume from the saved generation request instead of paying for another candidate:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key steppling \
  --source assets/images/katchimeras/cutouts/steppling-standing.png \
  --generation-request-id <generationRequestId from job.json> \
  --configure-admin-token
```

Pass the same prompt and delivery parameters as the original command so the promoted manifest records the correct provenance. This path retrieves the completed result, submits only temporal matting, and packages the WebP.

If temporal matting was also submitted before a transient failure, resume that exact job without submitting either paid stage again:

```bash
python scripts/generate-katchimera-idle.py \
  --visual-key steppling \
  --source assets/images/katchimeras/cutouts/steppling-standing.png \
  --matte-request-id <matteRequestId from job.json> \
  --configure-admin-token
```

As with generation resume, repeat the original prompt and delivery parameters. The pipeline reads the generation request ID from the existing `job.json`, waits for the matte result, and then performs only local packaging and manifest updates.

## Outputs and Runtime Registration

Every successful promotion updates:

- `data/katchimeras/idle-animations.json`
- `constants/creature-idle-animation-sources.ts`

The manifest is merged by visual key, so adding Feastle does not remove Mossprout. The TypeScript registry is regenerated with static `require(...)` calls because Metro needs asset paths to be statically discoverable.

The runtime automatically falls back to the static cutout when:

- no animation is registered
- loading fails
- the app is inactive
- the page is unfocused
- Reduce Motion is enabled

After adding a new bundled asset, restart Metro if it does not discover the new static asset module.

## Automated Validation

Run:

```bash
npm run art:idle:check
```

The verifier checks:

- the promoted file exists
- it is an animated WebP
- dimensions match the manifest
- frame count matches the manifest
- transparent pixels exist
- byte size matches the manifest
- the file remains below its declared byte budget

The normal project `npm run check` includes this verifier.

## Visual Review Checklist

Automated checks cannot decide whether the animation is artistically usable. Review the WebP on the real narrative screen and inspect individual frames when necessary.

Accept only when all of these are true:

- Character identity, facial features and proportions stay locked.
- Feet or the base contact point do not slide.
- Camera, crop and scale remain fixed.
- Breathing is subtle rather than rubbery.
- The blink is complete, natural and not repeated too rapidly.
- Secondary motion suits the creature's anatomy.
- There are no new fingers, leaves, accessories or markings.
- The first-to-last transition is not perceptible.
- Transparent edges do not show a coloured halo on light or dark backgrounds.
- Thin details are not eaten away or visibly pixelated.
- The file remains within its budget.
- Playback starts, pauses and resumes correctly on iOS and Android.

Do not repair severe edge damage with aggressive per-frame chroma erosion. The Mossprout pilot showed that this can remove genuine edge pixels and make the character look blocky. Prefer a better contrasting generation background or rerun temporal matting.

If the alpha silhouette is already clean but semi-transparent RGB still contains a thin magenta fringe, repackage with `--decontaminate-edges`. This extends nearby foreground colour into the transparent fringe while preserving every alpha value exactly; it does not contract, feather or pixelate the silhouette.

## Choosing Delivery Settings

Use the current 512/24 preset when one featured Katchimera is visible. It preserves smooth facial and leaf motion and is acceptable for narrative pages.

Possible lower-cost variants:

- 512/12: retains spatial detail but motion is less fluid
- 384/24: compromise for smaller presentation sizes
- 256/24: appropriate for thumbnails, but visibly softer at the narrative-page scale

Animated WebP is intended for one or a few visible portraits. If a screen must play many creatures simultaneously, use a GPU-oriented sprite atlas or skeletal runtime for that screen instead.

For a full roster, prefer downloading animations when a creature is unlocked or first visited, then caching them locally. Keep a small flagship set bundled so the initial experience never depends on a network request.

## Troubleshooting

### The endpoint returns `Unauthorized`

The local and remote `KATCHIMERA_IDLE_ADMIN_TOKEN` values do not match. Run with `--configure-admin-token`, or update the local value after setting the remote secret.

### The endpoint rejects generation parameters

Deploy the current `generate-katchimera-idle` Edge Function. Older deployed code only understands the original Mossprout payload.

### The result has a coloured fringe

First inspect the transparent WebM. If its alpha is clean but chroma remains in semi-transparent RGB, repackage with `--decontaminate-edges`. If the matte itself is damaged, use a chroma colour farther from the creature palette or rerun background removal. If the WebM is clean but the WebP is not, raise `--alpha-quality` or inspect frame resizing.

### The result looks pixelated

Confirm `--size 512`, avoid aggressive alpha erosion, and compare the extracted PNG frames with the encoded WebP. Raise RGB quality carefully; higher quality increases every creature's download size.

### The WebP is static on iOS

Confirm Reduce Motion is off, inspect the development `[creature-idle]` logs, and ensure playback is requested only after the image load event. The runtime wrapper already handles that ordering for registered assets.

### Repacking removes animation provenance

Use the normal `--matted-video` command against the existing manifest. The script merges the prior entry and retains its request IDs and prompt metadata.

## External API References

- [fal Seedance 1.5 Pro image-to-video API](https://fal.ai/models/fal-ai/bytedance/seedance/v1.5/pro/image-to-video/api)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
