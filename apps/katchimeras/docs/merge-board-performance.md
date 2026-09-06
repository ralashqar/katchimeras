# Merge board performance check

The board keeps gesture and sprite motion on the UI thread, paints its 7x9
static cell surface as one native image, and shares six fixed feedback slots
between generator, settlement, and merge effects.

Enable development frame sampling with:

```powershell
$env:EXPO_PUBLIC_MERGE_BOARD_PERF='1'
npx expo start
```

After artwork has warmed, exercise a long drag, generator spawn, ordinary
merge, and Dream Mist merge. Each interaction reports total frames, frames over
20 ms, an approximate p95 upper bound, and the longest frame under the
`[merge-board] animation-frames` label.

The acceptance target on representative older iOS and mid-range Android
hardware is a p95 upper bound of at most 20 ms with fewer than 5% of frames over
20 ms. Reduced Motion should report the same interaction coverage with no
traveling particles.

