# Chain homes (September 2026)

All fifteen home renders use the established hex tile pipeline, through the generate-asset endpoint and `fal-ai/nano-banana-2/edit` (Nano Banana 2). The authoritative reference is `design/mossprout-hex-neighborhood-v1/main-source.png`. Stages 2 and 3 additionally use their own stage 1 as an identity guide. Exact prompts, reference hashes, source hashes and model provenance are saved in each `chain-*/generation.json`.

The five homes are Seed Nursery, Storm Garden, Ward Grove, Dew Spring and Lantern Grove. Stages are shown at levels 1, 4 and 7. Sources and transparent mattes were visually reviewed; `chain-homes-review.jpg` compares every stage on a light background.

From `apps/katchimeras`, for each `chain-{garden,storm,bulwark,dew,lantern}-{1,2,3}` key:

```powershell
python scripts/generate-shared-world-discovery-art.py generate --tile chain-storm-1
# Review source.png before continuing.
python scripts/generate-shared-world-discovery-art.py matte --tile chain-storm-1
# Review alpha.png before continuing.
python scripts/generate-shared-world-discovery-art.py package --tile chain-storm-1
```

Generation refuses to overwrite a source. Preserve candidates before regenerating. Keep the full 2048px square canvas during matting. The standard premultiplied-alpha packager derives 1024, 512 and 256px WebPs directly from the reviewed matte, without trimming or recentering. `generate-hex-tile-bounds.py` measures the runtime assets. Runtime references live in `constants/chain-home-art.gen.ts` and use those measured bounds.

The earlier off-style imagegen candidates are rejected and are not runtime assets.
