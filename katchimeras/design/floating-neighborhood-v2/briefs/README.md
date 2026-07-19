# Environment briefs

Check in one completed JSON brief per new floating-v2 environment before image
generation. Copy `../new-environment-brief.json`, name it `<key>.json`, and keep
it beside the art so another context can reproduce the resolved prompt with
`--brief design/floating-neighborhood-v2/briefs/<key>.json`.

Use `kind: "resident"` for Katchimera habitats and `kind: "home"` for home
archetypes. The generator validates that the brief key and kind match the
command and records the brief plus SHA-256 in the candidate manifest.
