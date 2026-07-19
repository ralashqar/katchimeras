# Kingdom daylight sky

The Kingdom background is a continuous code-rendered blue gradient with seven reusable cloud instances. It is not a single scene bitmap. The reference screenshot informs composition only and is never supplied to the image model.

## Reproduce the art

Run `python scripts/generate-kingdom-sky-assets.py --dry-run` to inspect the locked prompts, then run the script without flags to generate missing assets. Use `--only <asset-id>` for one cloud or `--force` to replace approved art.

The pipeline is fixed to:

- FAL `fal-ai/nano-banana-2` generation
- pure black `#000000` generation background
- shared BiRefNet v2 matte endpoint using internal enum `BiRefNet_lite`, transported to FAL as `General Use (Heavy)`
- `1024x1024` operating resolution and refined foreground
- lossless transparent 1024px and 512px WebP packages

The generated `manifest.json` records exact prompts, source URLs, alpha bounds, checksums, model, and matte settings for context-independent reproduction.

## Art constraints

Clouds use the project’s low-frequency toy-diorama language: a few large rounded shapes, broad bevels, clean silhouettes, simplified materials, and soft ivory/powder-blue shading. Never bake islands, creatures, text, UI, shadows, gradients, or an entire sky scene into these assets.

## Runtime composition

`KingdomSkyBackground` renders two far, three middle, and two near instances. Clouds drift on the UI thread and react gently to Kingdom camera translation without scaling with the islands. Reduced Motion or an inactive/blurred app leaves the composition static.
