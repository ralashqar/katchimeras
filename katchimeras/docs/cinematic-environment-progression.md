# Cinematic environment progression

The companion-home cinematic can mirror the same five persisted stages as its Haven hex tile. Runtime Stage `0` through Stage `4` correspond to player-facing Level `1` through Level `5`.

Mossprout is the reference implementation:

- source art and manifest: `design/exploration-backgrounds/progressions/mossprout/`
- optimized runtime art: `assets/images/katchimeras/world/backgrounds/mossprout-exploration-stage-*.webp`
- static runtime registry: `constants/exploration-environment-progression-sources.ts`

## Preparing a progression

Create five source images and a `progression.json` under:

```text
design/exploration-backgrounds/progressions/<character>/
```

Each stage may specify `cropCenter` for square normalization. Then run:

```powershell
python scripts/prepare-cinematic-environment-progression.py --character <character>
python scripts/prepare-cinematic-environment-progression.py --character <character> --check
```

The script creates a 2048px WebP master and a 1024px mobile LOD for each stage. Add the ten files to `EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES` using static `require` calls so Metro can include them.

## Runtime behavior

`KingdomCompanionScreen` subscribes to persisted `haven.tileStages`. It places the selected companion's current stage into `ExplorationEnvironmentProgressionProvider`. Every cinematic background inside that companion experience resolves the matching stage automatically, including story, check-in, questionnaire, and quest views.

Backgrounds outside the provider, such as the ordinary Today scene, continue using their existing single exploration image. Characters without a registered progression also fall back to that image. Images at 1100 rendered pixels or below use the 1024px LOD; larger presentations use the 2048px master.
