# Environment briefs

Check in one completed JSON brief per new floating-v2 environment before image
generation. Copy `../new-environment-brief.json`, name it `<key>.json`, and keep
it beside the art so another context can reproduce the resolved prompt with
`--brief design/floating-neighborhood-v2/briefs/<key>.json`.

Use `kind: "resident"` for Katchimera habitats, `kind: "home"` for home
archetypes, and `kind: "zodiac"` for the twelve briefs under `zodiac/`. The
generator validates that the brief key and kind match the command and records
the brief plus SHA-256 in the candidate manifest.

Resident briefs must define `floor`. The floor may be sand, carpet, broad
timber, large stone slabs, smooth moss, grass, or another theme-specific
low-frequency material. Keep it continuous and free of props across the lower
half; “open stage” describes occupancy, not a mandatory grass surface.

Zodiac briefs follow the resident floor/open-stage contract, but must describe
the sign without a baked familiar, animal, person, zodiac glyph, or constellation
diagram. Runtime renders the appropriate elemental familiar separately.
