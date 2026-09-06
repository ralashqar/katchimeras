# Versioned shared releases

Shared packages start at **0.1.0** with explicit subpath exports and exact internal dependency versions. Art packs can be selected independently. Nothing has been published to a registry by this refactor.

Build local distributable tarballs:

```sh
npm run verify:workspace
npm run release:pack
# Or select a smaller dependency closure and art packs:
npm run release:pack -- @incubator/story-expo @incubator/environments @incubator/art-game-hub
```

Default packing includes runtime, native and authoring packages. It excludes art unless explicitly selected. Internal runtime dependencies are included automatically. Peer dependencies remain the consumer's responsibility, particularly Expo/React Native versions.

`dist/release` contains npm tarballs and `release.json` with versions, dependency requirements and SHA-256 hashes. Install all selected tarballs together in a separate app so npm resolves their internal version pins. `npm run verify:consumer` demonstrates installing selected tarballs into a temporary directory outside the repository and running story, hex, upgrade and avatar behavior there.

For a private registry, configure an owned npm scope/registry and credentials in release infrastructure before publication. `@incubator` is the current package scope, not a claim that a public npm organization has been provisioned. Do not publish private game art publicly by default. A release owner should:

1. Update affected package versions and exact internal dependents together.
2. Run package contracts, game typecheck/lint, story/native presentation tests, generator checks and Metro asset audit.
3. Pack the selected closure, inspect the contents and verify a consumer against those archives.
4. Publish dependencies before dependents to the chosen registry; retain release hashes/changelog.
5. Update each game's pinned versions and lockfile in a separate tested change.

Runtime packages intentionally do not own application bundle IDs, save keys or backend buckets. Native implementation names are currently shared; install one version of each native package per app. Introducing an incompatible native API or changing a persisted story schema requires a migration and a tested client release.
